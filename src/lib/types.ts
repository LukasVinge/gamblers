export type TipStatus = "pending" | "won" | "lost" | "void" | "half_won" | "half_lost";

export const TIP_STATUSES: TipStatus[] = ["pending", "won", "lost", "void", "half_won", "half_lost"];

/** A tip in the shape the UI uses (both group lists and the public share page map into this). */
export type TipView = {
  id: string;
  share_slug: string;
  group_id: string;
  author_id: string;
  author_username: string;
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
};

/** Row from `tips` with embedded author + bookmaker (see TIP_SELECT). */
export type TipRow = Omit<TipView, "author_username" | "bookmaker_name" | "bookmaker_url"> & {
  author: { username: string } | null;
  bookmaker: { name: string; url: string | null } | null;
};

export const TIP_SELECT = "*, author:profiles!tips_author_id_fkey(username), bookmaker:bookmakers(name,url)";

export function toTipView(r: TipRow): TipView {
  const { author, bookmaker, ...rest } = r;
  return {
    ...rest,
    author_username: author?.username ?? "former member",
    bookmaker_name: bookmaker?.name ?? "Unknown",
    bookmaker_url: bookmaker?.url ?? null,
  };
}

export type LeaderboardRow = {
  user_id: string;
  username: string;
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
