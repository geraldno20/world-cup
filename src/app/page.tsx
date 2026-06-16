import { computeLeaderboard, type TeamStat } from "@/lib/leaderboard";
import { EXCLUSION_NOTE } from "@/lib/pool-rules";

export default async function Home() {
  const standings = await computeLeaderboard();
  const anyMatchesPlayed = standings.some((s) =>
    s.teams.some((t) => t.played > 0 || t.excluded != null),
  );
  const anyExcluded = standings.some((s) =>
    s.teams.some((t) => t.excluded != null),
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
              <th className="px-3 py-2 text-center w-14">W</th>
              <th className="px-3 py-2 text-center w-14">D</th>
              <th className="px-3 py-2 text-center w-14">L</th>
              <th className="px-3 py-2 text-center w-16">Pts</th>
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

      {anyExcluded && (
        <p className="text-xs text-[var(--fg-muted)]">
          <span className="inline-block w-2 h-2 align-middle mr-1 rounded bg-[color-mix(in_oklab,var(--warning)_50%,transparent)]" />
          {EXCLUSION_NOTE}
        </p>
      )}
    </div>
  );
}

function StatCell({
  counted,
  excluded,
}: {
  counted: number;
  excluded: number;
}) {
  if (counted === 0 && excluded === 0) return null;
  return (
    <>
      {counted > 0 ? counted : excluded > 0 ? 0 : null}
      {excluded > 0 && (
        <span
          className="ml-1 text-xs line-through text-[var(--warning)]"
          title="Excluded — match played before the draft was finalized"
        >
          +{excluded}
        </span>
      )}
    </>
  );
}

function ManagerBlock({ s }: { s: { managerId: number; manager: string; total: number; droppedPoints: number; rank: number; teams: TeamStat[] } }) {
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
            {t && <StatCell counted={t.won} excluded={t.excluded?.won ?? 0} />}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t && <StatCell counted={t.drawn} excluded={t.excluded?.drawn ?? 0} />}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t && <StatCell counted={t.lost} excluded={t.excluded?.lost ?? 0} />}
          </td>
          <td className="px-3 py-2 text-center font-mono">
            {t && <StatCell counted={t.points} excluded={t.excluded?.points ?? 0} />}
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
