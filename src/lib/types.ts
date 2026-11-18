export type TipStatus = "pending" | "won" | "lost" | "void" | "half_won" | "half_lost";

export const TIP_STATUSES: TipStatus[] = ["pending", "won", "lost", "void", "half_won", "half_lost"];

/** A tip in the shape the UI uses (both group lists and the public share page map into this). */
export type TipView = {
  id: string;
  share_slug: string;
  group_id: string;
  author_id: string;
  author_username: string;
  /** Tipster's profile picture (null = initials). */
  author_avatar?: string | null;
  sport: string;
  league: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  selection: string;
  odds: number;
  boosted_odds: number | null;
  bookmaker_name: string;
  bookmaker_url: string | null;
  stake_units: number;
  reasoning: string | null;
  status: TipStatus;
  settled_at: string | null;
  /** football-data.org match id when the tip was made from the Kampprogram. */
  fixture_id: number | null;
  home_logo: string | null;
  away_logo: string | null;
  /** Present on group queries (not on public share links). */
  bookmaker_id?: number;
  /** Set when the tipster edited the bet before kickoff. */
  edited_at?: string | null;
  /** Bookmaker offer: super_boost | odds_boost | dobbelt_op | other_offer (see lib/promos). */
  promo?: string | null;
  /** Combo bet (kombi): the matches on the slip, in kickoff order. Empty/absent for a single bet. */
  legs?: TipLeg[];
};

/** One match on a combo slip. */
export type TipLeg = {
  position: number;
  sport: string;
  league: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  fixture_id: number | null;
  home_logo: string | null;
  away_logo: string | null;
  selection: string;
  odds: number | null;
};

export const isCombo = (t: Pick<TipView, "legs">) => (t.legs?.length ?? 0) > 1;

/** Row from `tips` with embedded author + bookmaker (see TIP_SELECT). */
export type TipRow = Omit<TipView, "author_username" | "bookmaker_name" | "bookmaker_url" | "legs"> & {
  legs?: TipLeg[] | null;
  author: { username: string; avatar_url?: string | null } | null;
  bookmaker: { name: string; url: string | null } | null;
};

/** Without the combo matches – used when the database doesn't have tip_legs yet (migration 0012). */
export const TIP_SELECT_BASIC = "*, author:profiles!tips_author_id_fkey(username, avatar_url), bookmaker:bookmakers(name,url)";
export const TIP_SELECT = `${TIP_SELECT_BASIC}, legs:tip_legs(position,sport,league,home_team,away_team,kickoff_at,fixture_id,home_logo,away_logo,selection,odds)`;

/** True when a query failed only because tip_legs doesn't exist yet → retry with TIP_SELECT_BASIC. */
export const legsMissing = (error: { code?: string } | null) => error?.code === "PGRST200" || error?.code === "42P01";

export function normalizeLegs(legs: TipLeg[] | null | undefined): TipLeg[] {
  return [...(legs ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((l) => ({ ...l, odds: l.odds === null ? null : Number(l.odds) }));
}

export function toTipView(r: TipRow): TipView {
  const { author, bookmaker, legs, ...rest } = r;
  return {
    ...rest,
    legs: normalizeLegs(legs),
    author_username: author?.username ?? "former member",
    author_avatar: author?.avatar_url ?? null,
    bookmaker_name: bookmaker?.name ?? "Unknown",
    bookmaker_url: bookmaker?.url ?? null,
  };
}

export type LeaderboardRow = {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  settled: number;
  wins: number;
  losses: number;
  voids: number;
  pending: number;
  staked: number;
  profit: number;
  roi: number | null;
  hit_rate: number | null;
};

/** Row from promo_stats(): one offer type at one bookmaker. */
export type PromoStatRow = {
  promo: string;
  bookmaker_id: number;
  bookmaker_name: string;
  bookmaker_url: string | null;
  tips: number;
  settled: number;
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
