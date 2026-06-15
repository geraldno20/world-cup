import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data.db");

let realDb: BetterSQLite3Database<typeof schema> | null = null;

function init(): BetterSQLite3Database<typeof schema> {
  if (realDb) return realDb;
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("busy_timeout = 10000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  bootstrapSchema(sqlite);
  realDb = drizzle(sqlite, { schema });
  return realDb;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    const real = init();
    const value = Reflect.get(real as object, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };

function bootstrapSchema(conn: Database.Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      group_name TEXT,
      flag TEXT
    );

    CREATE TABLE IF NOT EXISTS draft_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
      team_id INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
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

    CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches(stage);
    CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_at);
    CREATE INDEX IF NOT EXISTS idx_draft_picks_manager ON draft_picks(manager_id);
  `);

  // Migration: older DBs created before external_id existed.
  const matchCols = conn.prepare("PRAGMA table_info(matches)").all() as {
    name: string;
  }[];
  if (!matchCols.some((c) => c.name === "external_id")) {
    conn.exec("ALTER TABLE matches ADD COLUMN external_id TEXT");
    conn.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id ON matches(external_id)",
    );
  }
}
