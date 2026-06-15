import { db, schema } from "@/lib/db/client";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

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
            {rows.map((m) => (
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
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-[var(--fg-muted)]">
        {rows.length} match{rows.length === 1 ? "" : "es"} ·{" "}
        {rows.filter((r) => r.status === "final").length} final ·{" "}
        synced from ESPN
      </p>
    </div>
  );
}
