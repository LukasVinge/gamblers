import { createClient } from "@/lib/supabase/server";
import { getMainGroup } from "@/lib/group";
import { fmtUnits, profitClass } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { leaderboardMessage } from "@/lib/shareText";
import { getBaseUrl } from "@/lib/url";
import { GroupHeader, NotInGroup } from "@/components/GroupHeader";
import { SegmentedLinks } from "@/components/Segmented";
import { ShareSheet } from "@/components/ShareSheet";
import { LeaderboardStandings } from "@/components/LeaderboardStandings";
import { normalizePromoRows, PromoStats } from "@/components/PromoStats";
import { OFF_LEADERBOARD_TEXT } from "@/lib/promos";
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

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];
  const view = sp.view === "boosts" ? "boosts" : "tipsters";
  const href = (v: string, p: string) => `/leaderboard?${v === "boosts" ? "view=boosts&" : ""}period=${p}`;

  const supabase = await createClient();
  const group = await getMainGroup(supabase);
  if (!group) return <NotInGroup />;
  const id = group.id;

  const since = period.days ? new Date(Date.now() - period.days * 86_400_000).toISOString() : null;

  const filters = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SegmentedLinks
        active={view}
        className="sm:w-64"
        items={[
          { key: "tipsters", href: href("tipsters", period.key), label: "🏆 Tipsters" },
          { key: "boosts", href: href("boosts", period.key), label: "⚡ Boosts" },
        ]}
      />
      <SegmentedLinks
        active={period.key}
        className="sm:w-96"
        items={PERIODS.map((p) => ({ key: p.key, href: href(view, p.key), label: p.label }))}
      />
    </div>
  );

  if (view === "boosts") {
    const { data: promoData, error } = await supabase.rpc("promo_stats", { p_group: id, p_since: since });
    return (
      <div className="space-y-6">
        <GroupHeader active="leaderboard" />
        {filters}
        {error ? (
          <Card className="p-6 text-center text-sm text-muted">
            {error.code === "PGRST202"
              ? "Boost-statistikken er ikke sat op i databasen endnu – kør migration 0011_promos.sql i Supabase."
              : `Kunne ikke hente statistikken: ${error.message}`}
          </Card>
        ) : (
          <PromoStats rows={normalizePromoRows(promoData)} periodLabel={period.label} />
        )}
        <p className="text-xs text-muted">
          ROI og profit regnes med de boostede odds · W–L–V = vundet–tabt–void · Spil med boost-odds uden markering tæller som Odds boost
        </p>
      </div>
    );
  }

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

      {filters}

      <Card className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Group profit · {period.label.toLowerCase()}</p>
          <p className={`font-mono text-2xl font-bold sm:text-3xl ${profitClass(totalProfit)}`}>{fmtUnits(totalProfit)}</p>
          <p className="text-sm text-muted">{totalSettled} settled tips</p>
        </div>
        {totalSettled > 0 && (
          <div className="shrink-0">
            <ShareSheet
              size="sm"
              label="Share"
              title="Share the standings"
              message={leaderboardMessage(group.name, period.label, [...ranked, ...unranked], ranked.length)}
              url={`${await getBaseUrl()}/leaderboard?period=${period.key}`}
            />
          </div>
        )}
      </Card>

      <LeaderboardStandings ranked={ranked} unranked={unranked} minSettled={MIN_SETTLED} />

      <p className="text-xs text-muted">
        Ranked by ROI (profit ÷ staked) · {MIN_SETTLED}+ settled tips needed · W–L–V = won–lost–void · {OFF_LEADERBOARD_TEXT} tæller
        ikke med (se dem under ⚡ Boosts)
      </p>
    </div>
  );
}
