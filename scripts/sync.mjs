#!/usr/bin/env node
// World Cup result sync.
// Pulls match data from ESPN's open scoreboard JSON and upserts into matches
// by external_id (ESPN event id). Idempotent — safe to re-run any time.
//
// Run manually: npm run sync
// Daily auto-run: see scripts/com.geraldyeung.worldcup-sync.plist

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const TOURNAMENT_START = "2026-06-11";
const TOURNAMENT_END = "2026-07-19";

const STAGE_KEYS = [
  ["round of 32", "r32"],
  ["round of 16", "r16"],
  ["quarter", "qf"],
  ["semi", "sf"],
  ["third", "third"],
  ["final", "final"],
];

function parseStageAndGroup(altGameNote) {
  if (!altGameNote) return { stage: "group", groupName: null };
  const m = altGameNote.match(/Group ([A-L])/i);
  if (m) return { stage: "group", groupName: m[1].toUpperCase() };
  const lower = altGameNote.toLowerCase();
  for (const [needle, stage] of STAGE_KEYS) {
    if (lower.includes(needle)) return { stage, groupName: null };
  }
  return { stage: "group", groupName: null };
}

function dateRange(startISO, endISO) {
  const out = [];
  const d = new Date(`${startISO}T00:00:00Z`);
  const last = new Date(`${endISO}T00:00:00Z`);
  while (d <= last) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${yyyy}${mm}${dd}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function statusFromESPN(s) {
  if (s?.type?.completed) return "final";
  if (s?.type?.state === "in") return "live";
  return "scheduled";
}

async function fetchDay(yyyymmdd) {
  // Use curl rather than node fetch: curl honors HTTPS_PROXY out of the box
  // (Apple corp / Claude Code sandbox set it), node's built-in fetch does not.
  const { stdout } = await execFileP(
    "curl",
    ["-sS", "--fail", `${ESPN_URL}?dates=${yyyymmdd}`],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

async function main() {
  const dbPath =
    process.env.DATABASE_URL ?? path.join(process.cwd(), "data.db");
  if (!fs.existsSync(dbPath)) {
    console.error(
      `data.db not found at ${dbPath}. Run \`npm run seed\` first.`,
    );
    process.exit(1);
  }
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  // Bootstrap matches table (and add external_id) if Next.js hasn't already.
  const matchCols = db.prepare("PRAGMA table_info(matches)").all();
  if (matchCols.length === 0) {
    db.exec(`
      CREATE TABLE matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT UNIQUE,
        stage TEXT NOT NULL,
        group_name TEXT,
        home_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        away_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        home_score INTEGER,
        away_score INTEGER,
        kickoff_at TEXT NOT NULL,
        venue TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `);
  } else if (!matchCols.some((c) => c.name === "external_id")) {
    db.exec("ALTER TABLE matches ADD COLUMN external_id TEXT");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id ON matches(external_id)",
    );
  }

  if (db.prepare("SELECT COUNT(*) AS n FROM teams").get().n === 0) {
    console.error("no teams in DB — run `npm run seed` first.");
    process.exit(1);
  }

  const insertTeam = db.prepare(
    "INSERT OR IGNORE INTO teams (name, code, group_name) VALUES (?, ?, ?)",
  );
  const updateGroup = db.prepare(
    "UPDATE teams SET group_name = ? WHERE code = ? AND group_name IS NULL",
  );
  const teamIdByCode = db.prepare("SELECT id FROM teams WHERE code = ?");

  function ensureTeam(displayName, abbreviation, groupName) {
    if (!abbreviation) return null;
    insertTeam.run(displayName ?? abbreviation, abbreviation, groupName);
    if (groupName) updateGroup.run(groupName, abbreviation);
    return teamIdByCode.get(abbreviation)?.id ?? null;
  }

  const upsert = db.prepare(`
    INSERT INTO matches (external_id, stage, group_name, home_team_id, away_team_id,
                         home_score, away_score, kickoff_at, venue, status)
    VALUES (@external_id, @stage, @group_name, @home_team_id, @away_team_id,
            @home_score, @away_score, @kickoff_at, @venue, @status)
    ON CONFLICT(external_id) DO UPDATE SET
      stage = excluded.stage,
      group_name = excluded.group_name,
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      kickoff_at = excluded.kickoff_at,
      venue = excluded.venue,
      status = excluded.status
  `);

  const today = new Date().toISOString().slice(0, 10);
  const days = dateRange(TOURNAMENT_START, TOURNAMENT_END).filter((d) => {
    const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return iso <= today;
  });

  let upserted = 0;
  let dropped = 0;
  for (const day of days) {
    let json;
    try {
      json = await fetchDay(day);
    } catch (e) {
      console.error(`skip ${day}: ${e.message}`);
      continue;
    }
    for (const ev of json?.events ?? []) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find((c) => c.homeAway === "home");
      const away = comp.competitors?.find((c) => c.homeAway === "away");
      if (!home || !away) continue;
      const { stage, groupName } = parseStageAndGroup(comp.altGameNote);
      const homeId = ensureTeam(
        home.team?.displayName,
        home.team?.abbreviation,
        groupName,
      );
      const awayId = ensureTeam(
        away.team?.displayName,
        away.team?.abbreviation,
        groupName,
      );
      if (!homeId || !awayId) {
        dropped++;
        continue;
      }
      const status = statusFromESPN(comp.status);
      const homeScore = Number(home.score);
      const awayScore = Number(away.score);
      upsert.run({
        external_id: `espn:${ev.id}`,
        stage,
        group_name: groupName,
        home_team_id: homeId,
        away_team_id: awayId,
        home_score:
          status === "scheduled" || Number.isNaN(homeScore) ? null : homeScore,
        away_score:
          status === "scheduled" || Number.isNaN(awayScore) ? null : awayScore,
        kickoff_at: ev.date ?? `${day}T00:00:00Z`,
        venue: comp.venue?.fullName ?? null,
        status,
      });
      upserted++;
    }
  }

  const stamp = new Date().toISOString();
  console.log(
    `[${stamp}] sync ok: ${upserted} matches upserted, ${dropped} dropped (no team id)`,
  );
}

main().catch((e) => {
  console.error("sync failed:", e);
  process.exit(1);
});
