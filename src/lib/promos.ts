/** Bookmaker offers ("tilbud") a tip can be marked with. The ids match the check in migration 0011. */
export const PROMOS = [
  { id: "super_boost", label: "Super boost", badge: "SUPER BOOST", emoji: "⚡" },
  { id: "odds_boost", label: "Odds boost", badge: "BOOST", emoji: "🚀" },
  { id: "dobbelt_op", label: "Dobbelt op", badge: "DOBBELT OP", emoji: "✌️" },
  { id: "other_offer", label: "Andet tilbud", badge: "TILBUD", emoji: "🎁" },
] as const;

export type Promo = (typeof PROMOS)[number]["id"];
export type PromoInfo = (typeof PROMOS)[number];

export function isPromo(v: unknown): v is Promo {
  return typeof v === "string" && PROMOS.some((p) => p.id === v);
}

export function promoInfo(p: string | null | undefined): PromoInfo | null {
  return PROMOS.find((x) => x.id === p) ?? null;
}

/** Badge text on a tip: the offer's name, or plain "BOOST" for boosted odds without a marked offer. */
export function promoBadge(t: { promo?: string | null; boosted_odds: number | null }): string | null {
  return promoInfo(t.promo)?.badge ?? (t.boosted_odds ? "BOOST" : null);
}

/**
 * Offers that are shared on the site but don't count on anyone's personal leaderboard.
 * Keep in sync with counts_on_leaderboard() in supabase/migrations/0013_offers_off_leaderboard.sql.
 */
export const OFF_LEADERBOARD: { bookmaker: string; promo: Promo }[] = [
  { bookmaker: "bet365", promo: "super_boost" },
  { bookmaker: "Danske Spil", promo: "dobbelt_op" },
];

export function countsOnLeaderboard(t: { promo?: string | null; bookmaker_name: string }): boolean {
  return !OFF_LEADERBOARD.some((o) => o.bookmaker === t.bookmaker_name && o.promo === t.promo);
}

/** e.g. "Super boost hos bet365 og Dobbelt op hos Danske Spil" */
export const OFF_LEADERBOARD_TEXT = OFF_LEADERBOARD.map((o) => `${promoInfo(o.promo)?.label} hos ${o.bookmaker}`).join(" og ");
