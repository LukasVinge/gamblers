// football-data.org v4 client (server-only: the API key never reaches the browser).
// Free tier: 10 requests/minute – every call is cached by Next.js, so a page view
// normally costs 0 API calls.

const API = "https://api.football-data.org/v4";

export const COMPETITIONS = [
  { code: "PL", name: "Premier League", weight: 3 },
  { code: "PD", name: "La Liga", weight: 2.5 },
  { code: "BL1", name: "Bundesliga", weight: 2.5 },
  { code: "SA", name: "Serie A", weight: 2.5 },
  { code: "FL1", name: "Ligue 1", weight: 2 },
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

const GROUP_STAGES = new Set(["REGULAR_SEASON", "LEAGUE_STAGE", "GROUP_STAGE"]);

/** How "big" a game is: competition weight + table positions + knockout bonus. */
export function importance(m: Match, positions: Map<number, number>) {
  let score: number = COMP[m.competition.code]?.weight ?? 1;
  const ph = positions.get(m.homeTeam.id);
  const pa = positions.get(m.awayTeam.id);
  if (ph && pa) {
    if (ph <= 4 && pa <= 4) score += 4;
    else if (ph <= 6 && pa <= 6) score += 2.5;
    else if (ph <= 4 || pa <= 4) score += 1;
    if (ph <= 6 && Math.abs(ph - pa) <= 2) score += 0.5; // close race at the top
  }
  if (m.stage && !GROUP_STAGES.has(m.stage)) score += 3; // knockout game
  return score;
}

export const BIG_GAME_THRESHOLD = 5.5;

export function teamName(t: Team) {
  return t.shortName || t.name;
}

export function competitionName(code: string, fallback: string) {
  return COMP[code]?.name ?? fallback;
}

export function isCrestUrl(u: string) {
  return /^https:\/\/crests\.football-data\.org\/[\w./-]+$/.test(u);
}
