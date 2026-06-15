import { computeLeaderboard } from "@/lib/leaderboard";

export default async function Home() {
  const standings = await computeLeaderboard();
  const anyMatchesPlayed = standings.some((s) =>
    s.teams.some((t) => t.played > 0),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-1">World Cup Pool</h1>
        <p className="text-[var(--fg-muted)] text-sm">
          {standings.length} managers · 4 teams each · win 3 / draw 1 / loss 0
        </p>
      </section>

      {!anyMatchesPlayed && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--fg-muted)]">
          No match results yet — totals will populate as matches are marked{" "}
          <code className="font-mono">final</code> via{" "}
          <code className="font-mono">/api/matches</code>.
        </div>
      )}

      <section className="overflow-x-auto">
        <table className="w-full text-sm border border-[var(--border)] rounded-lg overflow-hidden">
          <thead className="bg-[var(--bg-elevated)] text-[var(--fg-muted)] text-left">
            <tr>
              <th className="px-3 py-2 w-32">Manager</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2 text-center w-10">W</th>
              <th className="px-3 py-2 text-center w-10">D</th>
              <th className="px-3 py-2 text-center w-10">L</th>
              <th className="px-3 py-2 text-center w-14">Pts</th>
              <th className="px-3 py-2 text-center w-16">Total</th>
              <th className="px-3 py-2 text-center w-20 text-[var(--danger)]">
                Dropped
              </th>
              <th className="px-3 py-2 text-center w-12">Rank</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <ManagerBlock key={s.managerId} s={s} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ManagerBlock({
  s,
}: {
  s: Awaited<ReturnType<typeof computeLeaderboard>>[number];
}) {
  const rows = s.teams.length || 1;
  return (
    <>
      {(s.teams.length ? s.teams : [null]).map((t, i) => (
        <tr
          key={t?.teamId ?? `empty-${s.managerId}`}
          className="border-t border-[var(--border)]"
        >
          {i === 0 && (
            <td
              rowSpan={rows}
              className="px-3 py-2 align-middle font-medium bg-[color-mix(in_oklab,var(--accent)_15%,transparent)]"
            >
              {s.manager}
            </td>
          )}
          <td className="px-3 py-2">
            {t ? (
              <span className="flex items-center gap-2">
                <span>{t.flag ?? "·"}</span>
                <span>{t.team}</span>
              </span>
            ) : (
              <span className="text-[var(--fg-muted)]">—</span>
            )}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t?.won || ""}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t?.drawn || ""}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t?.lost || ""}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t ? t.points : ""}
          </td>
          {i === 0 && (
            <>
              <td
                rowSpan={rows}
                className="px-3 py-2 align-middle text-center font-mono text-lg bg-[color-mix(in_oklab,var(--warning)_18%,transparent)]"
              >
                {s.total}
              </td>
              <td
                rowSpan={rows}
                className="px-3 py-2 align-middle text-center font-mono text-[var(--danger)]"
              >
                {s.droppedPoints}
              </td>
              <td
                rowSpan={rows}
                className="px-3 py-2 align-middle text-center font-mono text-lg"
              >
                {s.rank}
              </td>
            </>
          )}
        </tr>
      ))}
    </>
  );
}
