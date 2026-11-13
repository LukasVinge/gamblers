import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMainGroup } from "@/lib/group";
import { fmtUnits, profitClass } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { leaderboardMessage } from "@/lib/shareText";
import { getBaseUrl } from "@/lib/url";
import { GroupHeader, NotInGroup } from "@/components/GroupHeader";
import { ShareSheet } from "@/components/ShareSheet";
import { Card } from "@/components/ui";

export const metadata = { title: "Leaderboard" };

// Fewer settled tips than this → listed, but not ranked on ROI (one lucky 9.00 shot shouldn't top the table).
const MIN_SETTLED = 5;

const PERIODS = [
  { key: "week", label: "Week", days: 7 },
  { key: "month", label: "Month", days: 30 },
  { key: "year", label: "Year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];

  const supabase = await createClient();
  const group = await getMainGroup(supabase);
  if (!group) return <NotInGroup />;
  const id = group.id;

  const since = period.days ? new Date(Date.now() - period.days * 86_400_000).toISOString() : null;
  const { data } = await supabase.rpc("group_leaderboard", { p_group: id, p_since: since });
  const rows = ((data ?? []) as LeaderboardRow[]).map((r) => ({
    ...r,
    profit: Number(r.profit),
    staked: Number(r.staked),
    roi: r.roi === null ? null : Number(r.roi),
  }));

  const ranked = rows
    .filter((r) => r.settled >= MIN_SETTLED)
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity) || b.profit - a.profit);
  const unranked = rows.filter((r) => r.settled < MIN_SETTLED).sort((a, b) => b.profit - a.profit);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totalSettled = rows.reduce((s, r) => s + r.settled, 0);

  return (
    <div className="space-y-6">
      <GroupHeader active="leaderboard" />

      <div className="flex gap-2 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/leaderboard?period=${p.key}`}
            className={`rounded-full px-3 py-1 ring-1 ${
              p.key === period.key ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <Card className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Group profit · {period.label.toLowerCase()}</p>
          <p className={`font-mono text-3xl font-bold ${profitClass(totalProfit)}`}>{fmtUnits(totalProfit)}</p>
          <p className="text-sm text-muted">{totalSettled} settled tips</p>
        </div>
        {totalSettled > 0 && (
          <ShareSheet
            label="Share standings"
            title="Share the standings"
            message={leaderboardMessage(group.name, period.label, [...ranked, ...unranked], ranked.length)}
            url={`${await getBaseUrl()}/leaderboard?period=${period.key}`}
          />
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
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
                  <td className="px-4 py-3 font-mono">{isRanked ? i + 1 : "–"}</td>
                  <td className="px-4 py-3 font-medium">
                    @{r.username}
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
      <p className="text-xs text-muted">
        Ranked by ROI (profit ÷ staked). You need {MIN_SETTLED}+ settled tips in the period to be ranked. Boosted odds count
        when present; voids don&apos;t count towards staked or hit rate.
      </p>
    </div>
  );
}
