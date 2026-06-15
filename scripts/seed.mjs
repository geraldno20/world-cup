// Seed the prediction game: managers, teams, draft picks.
// Idempotent — re-running is safe (uses INSERT OR IGNORE + lookups).
// Run with: npm run seed
import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data.db");
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

db.exec(`
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
`);

// [code, name, flag]
const TEAMS = [
  ["ESP", "Spain", "🇪🇸"],
  ["NOR", "Norway", "🇳🇴"],
  ["URU", "Uruguay", "🇺🇾"],
  ["SWE", "Sweden", "🇸🇪"],
  ["FRA", "France", "🇫🇷"],
  ["SUI", "Switzerland", "🇨🇭"],
  ["USA", "USA", "🇺🇸"],
  ["ALG", "Algeria", "🇩🇿"],
  ["ENG", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"],
  ["MAR", "Morocco", "🇲🇦"],
  ["JPN", "Japan", "🇯🇵"],
  ["AUT", "Austria", "🇦🇹"],
  ["ARG", "Argentina", "🇦🇷"],
  ["MEX", "Mexico", "🇲🇽"],
  ["ECU", "Ecuador", "🇪🇨"],
  ["CAN", "Canada", "🇨🇦"],
  ["POR", "Portugal", "🇵🇹"],
  ["COL", "Colombia", "🇨🇴"],
  ["CRO", "Croatia", "🇭🇷"],
  ["CIV", "Ivory Coast", "🇨🇮"],
  ["BRA", "Brazil", "🇧🇷"],
  ["BEL", "Belgium", "🇧🇪"],
  ["KOR", "South Korea", "🇰🇷"],
  ["SEN", "Senegal", "🇸🇳"],
  ["NED", "Netherlands", "🇳🇱"],
  ["GER", "Germany", "🇩🇪"],
  ["EGY", "Egypt", "🇪🇬"],
  ["TUR", "Turkey", "🇹🇷"],
];

// Manager -> drafted team codes (4 each)
const DRAFT = [
  ["Gerald", ["ESP", "NOR", "URU", "SWE"]],
  ["Ken", ["FRA", "SUI", "USA", "ALG"]],
  ["Brian", ["ENG", "MAR", "JPN", "AUT"]],
  ["Justin", ["ARG", "MEX", "ECU", "CAN"]],
  ["Sho", ["POR", "COL", "CRO", "CIV"]],
  ["Daniel", ["BRA", "BEL", "KOR", "SEN"]],
  ["Dave", ["NED", "GER", "EGY", "TUR"]],
];

const insertTeam = db.prepare(
  "INSERT OR IGNORE INTO teams (code, name, flag) VALUES (?, ?, ?)",
);
const insertManager = db.prepare(
  "INSERT OR IGNORE INTO managers (name, display_order) VALUES (?, ?)",
);
const teamId = db.prepare("SELECT id FROM teams WHERE code = ?");
const managerId = db.prepare("SELECT id FROM managers WHERE name = ?");
const insertPick = db.prepare(
  "INSERT OR IGNORE INTO draft_picks (manager_id, team_id) VALUES (?, ?)",
);

const tx = db.transaction(() => {
  for (const [code, name, flag] of TEAMS) insertTeam.run(code, name, flag);
  DRAFT.forEach(([name, codes], i) => {
    insertManager.run(name, i);
    const mid = managerId.get(name).id;
    for (const code of codes) {
      const row = teamId.get(code);
      if (!row) throw new Error(`team code not found: ${code}`);
      insertPick.run(mid, row.id);
    }
  });
});
tx();

const managerCount = db.prepare("SELECT COUNT(*) AS n FROM managers").get();
const teamCount = db.prepare("SELECT COUNT(*) AS n FROM teams").get();
const pickCount = db.prepare("SELECT COUNT(*) AS n FROM draft_picks").get();
console.log(
  `seeded: ${managerCount.n} managers, ${teamCount.n} teams, ${pickCount.n} picks`,
);
