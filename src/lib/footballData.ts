// football-data.org v4 client (server-only: the API key never reaches the browser).
// Free tier: 10 requests/minute – every call is cached by Next.js, so a page view
// normally costs 0 API calls.

const API = "https://api.football-data.org/v4";

export const COMPETITIONS = [
  { code: "PL", name: "Premier League" },
  { code: "CL", name: "Champions League" },
  { code: "PD", name: "La Liga" },
  { code: "BL1", name: "Bundesliga" },
  { code: "SA", name: "Serie A" },
  { code: "FL1", name: "Ligue 1" },
] as const;

const LEAGUES_WITH_TABLES = ["PL", "PD", "BL1", "SA", "FL1"];
const COMP = Object.fromEntries(COMPETITIONS.map((c) => [c.code, c])) as Record<string, (typeof COMPETITIONS)[number]>;

export type Team = { id: number; name: string; shortName: string | null; tla: string | null; crest: string | null };
export type Match = {
  id: number;
  utcDate: string;
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED" | "AWARDED";
  matchday: number | null;
  stage: string | null;
  competition: { id: number; name: string; code: string; emblem: string | null };
  homeTeam: Team;
  awayTeam: Team;
  score: { fullTime: { home: number | null; away: number | null } };
};

export class FootballDataError extends Error {
  constructor(public kind: "missing-key" | "rate-limit" | "http", detail?: string) {
    super(detail ?? kind);
  }
}

export function hasApiKey() {
  return Boolean(process.env.FOOTBALL_DATA_API_KEY);
}

async function api<T>(path: string, revalidateSeconds: number): Promise<T> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new FootballDataError("missing-key");
  const res = await fetch(`${API}${path}`, {
    headers: { "X-Auth-Token": key },
    next: { revalidate: revalidateSeconds },
  });
  if (res.status === 429) throw new FootballDataError("rate-limit");
  if (!res.ok) throw new FootballDataError("http", `football-data.org answered ${res.status}`);
  return (await res.json()) as T;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** All matches in the chosen competitions for the next `days` days (free tier allows max 10). */
export async function getUpcomingMatches(days = 7): Promise<Match[]> {
  const from = new Date();
  const to = new Date(Date.now() + days * 86_400_000);
  const codes = COMPETITIONS.map((c) => c.code).join(",");
  const data = await api<{ matches: Match[] }>(`/matches?competitions=${codes}&dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`, 600);
  return data.matches.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}

export async function getMatch(id: number): Promise<Match> {
  const data = await api<Match & { match?: Match }>(`/matches/${id}`, 300);
  return data.match ?? data;
}

export type Player = { id: number; name: string; position: string | null };

const POSITION_ORDER: Record<string, number> = { Offence: 0, Midfield: 1, Defence: 2, Goalkeeper: 3 };

/** A team's squad, attackers first (cached 1 day). */
export async function getSquad(teamId: number): Promise<Player[]> {
  const team = await api<{ squad?: Player[] }>(`/teams/${teamId}`, 86_400);
  return (team.squad ?? []).sort((a, b) => (POSITION_ORDER[a.position ?? ""] ?? 1.5) - (POSITION_ORDER[b.position ?? ""] ?? 1.5));
}

/** Team id → league position, from the big-5 tables (cached 6 hours). Failures are ignored. */
export async function getTablePositions(): Promise<Map<number, number>> {
  const results = await Promise.allSettled(
    LEAGUES_WITH_TABLES.map((code) =>
      api<{ standings: { type: string; table: { position: number; team: { id: number } }[] }[] }>(`/competitions/${code}/standings`, 21_600),
    ),
  );
  const positions = new Map<number, number>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const total = r.value.standings.find((s) => s.type === "TOTAL") ?? r.value.standings[0];
    total?.table.forEach((row) => positions.set(row.team.id, row.position));
  }
  return positions;
}

/** This season's Champions League clubs (team ids, cached 1 day). Empty set if it can't be loaded. */
export async function getChampionsLeagueTeams(): Promise<Set<number>> {
  try {
    const data = await api<{ teams: { id: number }[] }>(`/competitions/CL/teams`, 86_400);
    return new Set(data.teams.map((t) => t.id));
  } catch {
    return new Set();
  }
}

// ───────── Storkampe ─────────
// Rules:
//  * Premier League first: a PL game is a Storkamp if both clubs are "big" (Big Six or currently top 6)
//    or it's a PL derby. PL games always rank above the other leagues.
//  * Other leagues only when both clubs play in this season's Champions League, or it's a big derby.

/** Arsenal, Chelsea, Liverpool, Man City, Man United, Tottenham (football-data.org team ids). */
const BIG_SIX = new Set([57, 61, 64, 65, 66, 73]);

const DERBIES: [number, number, string][] = [
  // Premier League
  [57, 73, "North London derby"],
  [62, 64, "Merseyside derby"],
  [65, 66, "Manchester derby"],
  [64, 66, "North West derby"],
  [67, 71, "Tyne–Wear derby"],
  [61, 73, "London derby"],
  [57, 61, "London derby"],
  [354, 397, "M23 derby"],
  [66, 341, "Roses derby"],
  // La Liga
  [81, 86, "El Clásico"],
  [78, 86, "Madrid derby"],
  [90, 559, "Seville derby"],
  [77, 92, "Basque derby"],
  [80, 81, "Barcelona derby"],
  [94, 95, "Valencian derby"],
  // Bundesliga
  [4, 5, "Der Klassiker"],
  [4, 6, "Revierderby"],
  [1, 18, "Rheinderby"],
  [7, 12, "Nordderby"],
  // Serie A
  [98, 108, "Derby della Madonnina"],
  [108, 109, "Derby d'Italia"],
  [100, 110, "Derby della Capitale"],
  [109, 586, "Derby della Mole"],
  [107, 584, "Derby della Lanterna"],
  [100, 113, "Derby del Sole"],
  // Ligue 1
  [516, 524, "Le Classique"],
  [523, 527, "Derby du Rhône"],
  [521, 546, "Derby du Nord"],
  [516, 523, "Olympico"],
  [524, 1045, "Paris derby"],
  [522, 548, "Derby de la Côte d'Azur"],
];
const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const DERBY_NAME = new Map(DERBIES.map(([a, b, name]) => [pairKey(a, b), name]));

/** Big European clubs (besides the Big Six) that make a CL league-stage game a Storkamp:
 *  Real Madrid, Barcelona, Atlético, Bayern, Dortmund, PSG, Inter, Milan, Juventus, Napoli. */
const EUROPEAN_GIANTS = new Set([86, 81, 78, 5, 4, 524, 108, 98, 109, 113]);

const CL_STAGE_NAMES: Record<string, string> = {
  PLAYOFFS: "knockout play-off",
  LAST_16: "round of 16",
  QUARTER_FINALS: "quarter-final",
  SEMI_FINALS: "semi-final",
  FINAL: "final",
};

/** Tie-breaker between leagues outside the PL. */
const LEAGUE_BONUS: Record<string, number> = { PD: 3, BL1: 2, SA: 2, FL1: 1 };

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`;

export type BigGame = { score: number; reason: string };

/** Returns why a match is a Storkamp (and how big), or null if it isn't one. */
export function bigGame(m: Match, ctx: { positions: Map<number, number>; clTeams: Set<number> }): BigGame | null {
  const h = m.homeTeam.id;
  const a = m.awayTeam.id;
  const derby = DERBY_NAME.get(pairKey(h, a));
  const bothCL = ctx.clTeams.has(h) && ctx.clTeams.has(a);
  const ph = ctx.positions.get(h);
  const pa = ctx.positions.get(a);
  const tableBonus = ph && pa ? (ph <= 4 && pa <= 4 ? 4 : ph <= 6 && pa <= 6 ? 2 : 0) - (ph + pa) / 20 : 0;

  if (m.competition.code === "CL") {
    // Knockout games always count; in the league stage only clashes between heavyweights.
    const stage = m.stage ?? "LEAGUE_STAGE";
    const knockout = !["LEAGUE_STAGE", "GROUP_STAGE", "REGULAR_SEASON"].includes(stage);
    const heavy = (id: number, pos?: number) => BIG_SIX.has(id) || EUROPEAN_GIANTS.has(id) || (pos !== undefined && pos <= 4);
    if (!knockout && !derby && !(heavy(h, ph) && heavy(a, pa))) return null;
    const stageName = CL_STAGE_NAMES[stage];
    return {
      score: (stage === "FINAL" ? 120 : stage === "SEMI_FINALS" ? 95 : knockout ? 88 : 80) + (derby ? 3 : 0),
      reason: derby ?? (knockout ? `Champions League ${stageName ?? "knockout"}` : "Champions League heavyweights"),
    };
  }

  if (m.competition.code === "PL") {
    const big = (id: number, pos?: number) => BIG_SIX.has(id) || (pos !== undefined && pos <= 6);
    if (!derby && !(big(h, ph) && big(a, pa))) return null;
    const reason =
      derby ?? (ph && pa && ph <= 6 && pa <= 6 ? `Top-6 clash · ${ordinal(ph)} vs ${ordinal(pa)}` : "Big Six clash");
    return { score: 100 + (derby ? 5 : 0) + tableBonus + (bothCL ? 1 : 0), reason };
  }

  if (!derby && !bothCL) return null;
  return {
    score: 50 + (LEAGUE_BONUS[m.competition.code] ?? 0) + (derby ? 5 : 0) + (bothCL ? 3 : 0) + tableBonus,
    reason: derby ?? "Both in the Champions League",
  };
}

export function teamName(t: Team) {
  return t.shortName || t.name;
}

export function competitionName(code: string, fallback: string) {
  return COMP[code]?.name ?? fallback;
}

export function isCrestUrl(u: string) {
  return /^https:\/\/crests\.football-data\.org\/[\w./-]+$/.test(u);
}
