import { db, schema } from "@/lib/db/client";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { findExcludedMatchIds, EXCLUSION_NOTE } from "@/lib/pool-rules";

export default async function MatchesPage() {
  const home = alias(schema.teams, "home");
  const away = alias(schema.teams, "away");
  const rows = await db
    .select({
      id: schema.matches.id,
      stage: schema.matches.stage,
      groupName: schema.matches.groupName,
      kickoffAt: schema.matches.kickoffAt,
      status: schema.matches.status,
      homeScore: schema.matches.homeScore,
      awayScore: schema.matches.awayScore,
      venue: schema.matches.venue,
      homeTeamId: schema.matches.homeTeamId,
      awayTeamId: schema.matches.awayTeamId,
      homeName: home.name,
      homeCode: home.code,
      homeFlag: home.flag,
      awayName: away.name,
      awayCode: away.code,
      awayFlag: away.flag,
    })
    .from(schema.matches)
    .leftJoin(home, eq(home.id, schema.matches.homeTeamId))
    .leftJoin(away, eq(away.id, schema.matches.awayTeamId))
    .orderBy(asc(schema.matches.kickoffAt));

  const teams = await db
    .select({ id: schema.teams.id, code: schema.teams.code })
    .from(schema.teams);
  const excludedIds = findExcludedMatchIds(rows, teams);

  const fmtKickoff = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Matches</h1>
      {rows.length === 0 ? (
        <p className="text-[var(--fg-muted)]">
          No matches yet. Run <code className="font-mono">npm run sync</code>.
        </p>
      ) : (
        <table className="w-full text-sm border border-[var(--border)] rounded-lg overflow-hidden">
          <thead className="bg-[var(--bg-elevated)] text-[var(--fg-muted)] text-left">
            <tr>
              <th className="px-3 py-2">Kickoff</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2 text-right">Home</th>
              <th className="px-3 py-2 text-center">Score</th>
              <th className="px-3 py-2">Away</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const excluded = excludedIds.has(m.id);
              return (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {fmtKickoff(m.kickoffAt)}
                  </td>
                  <td className="px-3 py-2 uppercase text-xs">
                    {m.stage === "group" ? `Grp ${m.groupName}` : m.stage}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{m.homeName ?? "TBD"}</span>
                      <span>{m.homeFlag ?? ""}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono whitespace-nowrap">
                    {m.status === "scheduled" ? (
                      <span className="text-[var(--fg-muted)]">vs</span>
                    ) : excluded ? (
                      <span
                        title={EXCLUSION_NOTE}
                        className="inline-block px-2 py-0.5 rounded bg-[color-mix(in_oklab,var(--warning)_30%,transparent)] text-[var(--warning)] line-through decoration-2"
                      >
                        {m.homeScore ?? 0} – {m.awayScore ?? 0}
                      </span>
                    ) : (
                      <span
                        className={
                          m.status === "live" ? "text-[var(--warning)]" : ""
                        }
                      >
                        {m.homeScore ?? 0} – {m.awayScore ?? 0}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{m.awayFlag ?? ""}</span>
                      <span>{m.awayName ?? "TBD"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs uppercase text-[var(--fg-muted)]">
                    {m.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="text-xs text-[var(--fg-muted)] space-y-1">
        <p>
          {rows.length} match{rows.length === 1 ? "" : "es"} ·{" "}
          {rows.filter((r) => r.status === "final").length} final · synced from
          ESPN
        </p>
        {excludedIds.size > 0 && (
          <p>
            <span className="inline-block w-2 h-2 align-middle mr-1 rounded bg-[color-mix(in_oklab,var(--warning)_50%,transparent)]" />
            {EXCLUSION_NOTE}
          </p>
        )}
      </div>
    </div>
  );
}
