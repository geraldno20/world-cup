import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { findExcludedMatchIds } from "@/lib/pool-rules";

export type ExcludedContribution = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
};

export type TeamStat = {
  teamId: number;
  team: string;
  flag: string | null;
  // Counted values — these are what feed into the manager total.
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  droppedPoints: number;
  // Pre-draft contribution (display only, rendered with strikethrough).
  excluded: ExcludedContribution | null;
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

  const skipMatchIds = findExcludedMatchIds(finals, teams);

  type Counters = ExcludedContribution;
  const emptyCounters = (): Counters => ({
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
  });

  const stats = new Map<number, TeamStat>();
  const excludedAccum = new Map<number, Counters>();
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
      excluded: null,
    });
    excludedAccum.set(t.id, emptyCounters());
  }

  function applyResult(
    target: { played: number; won: number; drawn: number; lost: number; points: number },
    didWin: boolean,
    didDraw: boolean,
  ) {
    target.played++;
    if (didDraw) {
      target.drawn++;
      target.points++;
    } else if (didWin) {
      target.won++;
      target.points += 3;
    } else {
      target.lost++;
    }
  }

  for (const m of finals) {
    if (m.homeTeamId == null || m.awayTeamId == null) continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    const home = stats.get(m.homeTeamId);
    const away = stats.get(m.awayTeamId);
    if (!home || !away) continue;
    const draw = m.homeScore === m.awayScore;
    const homeWin = m.homeScore > m.awayScore;
    applyResult(home, homeWin, draw);
    applyResult(away, !homeWin && !draw, draw);

    if (skipMatchIds.has(m.id)) {
      const eHome = excludedAccum.get(m.homeTeamId)!;
      const eAway = excludedAccum.get(m.awayTeamId)!;
      applyResult(eHome, homeWin, draw);
      applyResult(eAway, !homeWin && !draw, draw);
    }
  }

  // Subtract the excluded contribution from each team's totals so the
  // counted values feed directly into the leaderboard math, and keep the
  // excluded contribution attached for display.
  for (const t of teams) {
    const s = stats.get(t.id)!;
    const exc = excludedAccum.get(t.id)!;
    s.played -= exc.played;
    s.won -= exc.won;
    s.drawn -= exc.drawn;
    s.lost -= exc.lost;
    s.points -= exc.points;
    s.droppedPoints = s.played * 3 - s.points;
    s.excluded = exc.played > 0 ? exc : null;
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
