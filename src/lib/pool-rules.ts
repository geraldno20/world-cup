import type { Match, Team } from "@/lib/db/schema";

// Opening matches for these teams happened before the draft was finalized,
// so their results don't count toward the leaderboard.
export const EXCLUDE_FIRST_MATCH_FOR = ["MEX", "CAN", "KOR"];

export const EXCLUSION_NOTE =
  "Yellow scores were played before the draft was finalized — those points don't count toward the leaderboard.";

type MatchSlim = Pick<
  Match,
  "id" | "homeTeamId" | "awayTeamId" | "kickoffAt" | "status"
>;
type TeamSlim = Pick<Team, "id" | "code">;

export function findExcludedMatchIds(
  matches: MatchSlim[],
  teams: TeamSlim[],
): Set<number> {
  const teamIdByCode = new Map(teams.map((t) => [t.code, t.id]));
  const finals = matches.filter((m) => m.status === "final");
  const ids = new Set<number>();
  for (const code of EXCLUDE_FIRST_MATCH_FOR) {
    const teamId = teamIdByCode.get(code);
    if (teamId == null) continue;
    const earliest = finals
      .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0];
    if (earliest) ids.add(earliest.id);
  }
  return ids;
}
