import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export type TeamStat = {
  teamId: number;
  team: string;
  flag: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  droppedPoints: number;
};

export type ManagerStanding = {
  managerId: number;
  manager: string;
  total: number;
  droppedPoints: number;
  rank: number;
  teams: TeamStat[];
};

export async function computeLeaderboard(): Promise<ManagerStanding[]> {
  const managers = await db
    .select()
    .from(schema.managers)
    .orderBy(schema.managers.displayOrder);
  const teams = await db.select().from(schema.teams);
  const picks = await db.select().from(schema.draftPicks);
  const finals = await db
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.status, "final"));

  const stats = new Map<number, TeamStat>();
  for (const t of teams) {
    stats.set(t.id, {
      teamId: t.id,
      team: t.name,
      flag: t.flag,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      droppedPoints: 0,
    });
  }

  for (const m of finals) {
    if (m.homeTeamId == null || m.awayTeamId == null) continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    const home = stats.get(m.homeTeamId);
    const away = stats.get(m.awayTeamId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    if (m.homeScore > m.awayScore) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.homeScore < m.awayScore) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }
  for (const s of stats.values()) {
    s.droppedPoints = s.played * 3 - s.points;
  }

  const picksByManager = new Map<number, number[]>();
  for (const p of picks) {
    const list = picksByManager.get(p.managerId) ?? [];
    list.push(p.teamId);
    picksByManager.set(p.managerId, list);
  }

  const standings: ManagerStanding[] = managers.map((m) => {
    const teamIds = picksByManager.get(m.id) ?? [];
    const teamStats = teamIds
      .map((id) => stats.get(id))
      .filter((x): x is TeamStat => Boolean(x))
      .sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));
    const total = teamStats.reduce((sum, t) => sum + t.points, 0);
    const droppedPoints = teamStats.reduce(
      (sum, t) => sum + t.droppedPoints,
      0,
    );
    return {
      managerId: m.id,
      manager: m.name,
      total,
      droppedPoints,
      rank: 0,
      teams: teamStats,
    };
  });

  standings.sort((a, b) => b.total - a.total);
  standings.forEach((s, i) => {
    if (i === 0 || standings[i - 1].total !== s.total) s.rank = i + 1;
    else s.rank = standings[i - 1].rank;
  });

  return standings;
}
