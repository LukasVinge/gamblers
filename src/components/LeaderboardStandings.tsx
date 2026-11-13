import { fmtUnits, profitClass } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Card } from "./ui";

type Row = Omit<LeaderboardRow, "profit" | "staked" | "roi"> & { profit: number; staked: number; roi: number | null };

/** 🥇🥈🥉 for the podium, a numbered circle after that, a dash when not ranked yet. */
function RankBadge({ rank }: { rank: number | null }) {
  if (rank !== null && rank <= 3) {
    return <span className="grid h-7 w-7 shrink-0 place-items-center text-xl leading-none">{["🥇", "🥈", "🥉"][rank - 1]}</span>;
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subtle font-mono text-xs font-semibold text-muted">
      {rank ?? "–"}
    </span>
  );
}

/** Ranked list on phones, full table from tablet width up. */
export function LeaderboardStandings({ ranked, unranked, minSettled }: { ranked: Row[]; unranked: Row[]; minSettled: number }) {
  return (
    <>
      {/* Phones: ranked list */}
      <Card className="overflow-hidden sm:hidden">
        {ranked.length + unranked.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No tips settled yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...ranked, ...unranked].map((r, i) => {
              const isRanked = i < ranked.length;
              return (
                <li key={r.user_id}>
                  {i === ranked.length && unranked.length > 0 && (
                    <p className="bg-subtle px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                      Not ranked yet · needs {minSettled}+ settled tips
                    </p>
                  )}
                  <div className={`flex items-center gap-3 px-4 py-3 ${isRanked && i === 0 ? "bg-warn-soft/50" : ""}`}>
                    <RankBadge rank={isRanked ? i + 1 : null} />
                    <Avatar url={r.avatar_url} name={r.username} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-semibold ${isRanked ? "text-ink" : "text-ink-2"}`}>@{r.username}</p>
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">
                          {r.wins}–{r.losses}–{r.voids}
                        </span>
                        {r.hit_rate !== null && <> · {Number(r.hit_rate)}% hit</>}
                        {r.pending > 0 && <span className="text-warn"> · {r.pending} open</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-base font-bold leading-tight ${profitClass(r.roi)}`}>
                        {r.roi === null ? "—" : `${r.roi > 0 ? "+" : ""}${r.roi.toFixed(1)}%`}
                      </p>
                      <p className={`font-mono text-xs ${profitClass(r.profit)}`}>{fmtUnits(r.profit)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Tablet/desktop: full table */}
      <Card className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Tipster</th>
              <th className="px-4 py-3 text-right">W–L–V</th>
              <th className="px-4 py-3 text-right">Hit rate</th>
              <th className="px-4 py-3 text-right">Staked</th>
              <th className="px-4 py-3 text-right">Profit</th>
              <th className="px-4 py-3 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {[...ranked, ...unranked].map((r, i) => {
              const isRanked = i < ranked.length;
              return (
                <tr key={r.user_id} className={`border-b border-line last:border-0 ${isRanked ? "" : "text-muted"}`}>
                  <td className="px-4 py-3">
                    <RankBadge rank={isRanked ? i + 1 : null} />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2 align-middle">
                      <Avatar url={r.avatar_url} name={r.username} size={28} />
                      @{r.username}
                    </span>
                    {r.pending > 0 && <span className="ml-2 text-xs text-warn">{r.pending} open</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.wins}–{r.losses}–{r.voids}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.hit_rate === null ? "—" : `${Number(r.hit_rate)}%`}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.staked.toFixed(1)}u</td>
                  <td className={`px-4 py-3 text-right font-mono ${profitClass(r.profit)}`}>{fmtUnits(r.profit)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${profitClass(r.roi)}`}>
                    {r.roi === null ? "—" : `${r.roi > 0 ? "+" : ""}${r.roi.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
