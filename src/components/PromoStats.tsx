import { fmtUnits, profitClass } from "@/lib/format";
import { PROMOS, type PromoInfo } from "@/lib/promos";
import type { PromoStatRow } from "@/lib/types";
import { BookmakerLogo } from "./BookmakerLogo";
import { Card } from "./ui";

type Totals = {
  tips: number;
  wins: number;
  losses: number;
  voids: number;
  pending: number;
  staked: number;
  profit: number;
  roi: number | null;
  hit_rate: number | null;
  avg_odds: number | null;
};

/** Numbers from Postgres arrive as strings – make them numbers once. */
export function normalizePromoRows(data: unknown): PromoStatRow[] {
  return ((data ?? []) as PromoStatRow[]).map((r) => ({
    ...r,
    staked: Number(r.staked),
    profit: Number(r.profit),
    roi: r.roi === null ? null : Number(r.roi),
    hit_rate: r.hit_rate === null ? null : Number(r.hit_rate),
    avg_odds: r.avg_odds === null ? null : Number(r.avg_odds),
  }));
}

function sum(rows: PromoStatRow[]): Totals {
  const t = rows.reduce(
    (a, r) => ({
      tips: a.tips + r.tips,
      wins: a.wins + r.wins,
      losses: a.losses + r.losses,
      voids: a.voids + r.voids,
      pending: a.pending + r.pending,
      staked: a.staked + r.staked,
      profit: a.profit + r.profit,
      oddsSum: a.oddsSum + (r.avg_odds ?? 0) * r.tips,
    }),
    { tips: 0, wins: 0, losses: 0, voids: 0, pending: 0, staked: 0, profit: 0, oddsSum: 0 },
  );
  return {
    ...t,
    roi: t.staked > 0 ? Math.round((t.profit / t.staked) * 1000) / 10 : null,
    hit_rate: t.wins + t.losses > 0 ? Math.round((t.wins / (t.wins + t.losses)) * 100) : null,
    avg_odds: t.tips > 0 ? t.oddsSum / t.tips : null,
  };
}

const fmtRoi = (roi: number | null) => (roi === null ? "—" : `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%`);

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`truncate font-mono text-sm font-semibold sm:text-base ${className}`}>{value}</p>
    </div>
  );
}

function PromoCard({ promo, rows }: { promo: PromoInfo; rows: PromoStatRow[] }) {
  const t = sum(rows);
  const byBookmaker = [...rows].sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity) || b.profit - a.profit);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <span aria-hidden>{promo.emoji}</span>
            {promo.label}
          </h2>
          <p className="text-sm text-muted">
            {t.tips} spil
            {t.pending > 0 && <span className="text-warn"> · {t.pending} åbne</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-2xl font-bold leading-tight ${profitClass(t.roi)}`}>{fmtRoi(t.roi)}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">ROI</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 px-4 py-3">
        <Stat label="Profit" value={fmtUnits(t.profit)} className={profitClass(t.profit)} />
        <Stat label="Hit rate" value={t.hit_rate === null ? "—" : `${t.hit_rate}%`} />
        <Stat label="W–L–V" value={`${t.wins}–${t.losses}–${t.voids}`} />
        <Stat label="Snit-odds" value={t.avg_odds === null ? "—" : t.avg_odds.toFixed(2)} />
      </div>

      {/* Per bookmaker – which site's offers actually pay off */}
      <ul className="divide-y divide-line border-t border-line">
        {byBookmaker.map((r) => (
          <li key={r.bookmaker_id} className="flex items-center gap-3 px-4 py-2.5">
            <BookmakerLogo name={r.bookmaker_name} url={r.bookmaker_url} size={24} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-2">{r.bookmaker_name}</p>
              <p className="truncate text-xs text-muted">
                <span className="font-mono">
                  {r.wins}–{r.losses}–{r.voids}
                </span>
                {r.hit_rate !== null && <> · {r.hit_rate}% hit</>}
                {r.avg_odds !== null && <> · snit {r.avg_odds.toFixed(2)}</>}
                {r.pending > 0 && <span className="text-warn"> · {r.pending} åbne</span>}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`font-mono text-sm font-bold leading-tight ${profitClass(r.roi)}`}>{fmtRoi(r.roi)}</p>
              <p className={`font-mono text-xs ${profitClass(r.profit)}`}>{fmtUnits(r.profit)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Boosts view on the leaderboard: one card per offer type, broken down by bookmaker. */
export function PromoStats({ rows, periodLabel }: { rows: PromoStatRow[]; periodLabel: string }) {
  const total = sum(rows);
  const groups = PROMOS.map((p) => ({ promo: p, rows: rows.filter((r) => r.promo === p.id) })).filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted">
        Ingen tilbud i perioden endnu. Markér et spil som <b>⚡ Super boost</b>, <b>✌️ Dobbelt op</b> osv., når du laver det – så
        dukker statistikken op her.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Profit på tilbud · {periodLabel.toLowerCase()}</p>
          <p className={`font-mono text-2xl font-bold sm:text-3xl ${profitClass(total.profit)}`}>{fmtUnits(total.profit)}</p>
          <p className="text-sm text-muted">
            {total.wins + total.losses + total.voids} afgjorte · {total.hit_rate === null ? "—" : `${total.hit_rate}%`} hit
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-2xl font-bold ${profitClass(total.roi)}`}>{fmtRoi(total.roi)}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">ROI</p>
        </div>
      </Card>

      {groups.map((g) => (
        <PromoCard key={g.promo.id} promo={g.promo} rows={g.rows} />
      ))}
    </div>
  );
}
