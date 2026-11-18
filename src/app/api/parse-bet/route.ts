import { NextResponse } from "next/server";
import { getAuth } from "@/lib/supabase/server";
import { competitionName, getUpcomingMatches, hasApiKey, isCrestUrl, teamName } from "@/lib/footballData";
import { matchesQuery, norm } from "@/lib/search";
import { readSlip } from "@/lib/slipReader";
import { isPromo } from "@/lib/promos";

// Bet-slip scanner: a screenshot in, the spilforslag fields out (Gemini reads the image).

export const maxDuration = 60; // seconds – Vercel stops the function after this

/** Vercel rejects request bodies over ~4.5 MB; the browser shrinks images well below this first. */
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** A kickoff well in the past that lands in the future one year later → the AI picked last year. */
function fixYear(iso: unknown): unknown {
  if (typeof iso !== "string" || !/^\d{4}-/.test(iso)) return iso;
  if (Date.parse(iso) >= Date.now() - 12 * 3600_000) return iso;
  const next = iso.replace(/^\d{4}/, (y) => String(Number(y) + 1));
  return Date.parse(next) > Date.now() ? next : iso;
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return fail("AI-scanneren er ikke sat op endnu: GEMINI_API_KEY mangler i Vercels miljøvariabler.", 500);
  }

  const { supabase, user } = await getAuth();
  if (!user) return fail("Du skal være logget ind.", 401);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("image");
  } catch {
    return fail("Billedet blev ikke modtaget – det er måske for stort. Prøv et screenshot i stedet for et foto.", 413);
  }
  if (!(file instanceof File)) return fail("Intet billede modtaget.", 400);
  if (file.size > MAX_BYTES) return fail("Billedet er for stort (max 4 MB). Prøv et screenshot.", 413);
  const mimeType = file.type || "image/jpeg";
  if (!ALLOWED_TYPES.includes(mimeType)) return fail("Upload et billede (JPG, PNG eller WebP).", 415);

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const result = await readSlip(base64, mimeType);
  if ("error" in result) return fail(result.error, result.status);
  const text = result.text;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text || "{}");
  } catch {
    return fail("AI'en svarede ikke i et brugbart format. Prøv igen.", 502);
  }

  // Safety net: a 1X2 pick sometimes comes back as just the team name ("Arsenal") → "Arsenal to win".
  if (typeof parsed.selection === "string") {
    const pick = parsed.selection.trim();
    const same = (team: unknown) => typeof team === "string" && norm(team) === norm(pick);
    if (same(parsed.home_team) || same(parsed.away_team)) parsed.selection = `${pick} to win`;
  }

  if (!isPromo(parsed.promo)) parsed.promo = null;

  // Safety net: slips show "Lør 22 nov" without a year and the AI sometimes picks last year.
  // A kickoff well in the past that lands in the future one year later → use next year.
  parsed.kickoff_at = fixYear(parsed.kickoff_at);
  if (Array.isArray(parsed.legs)) {
    for (const l of parsed.legs as Record<string, unknown>[]) if (l && typeof l === "object") l.kickoff_at = fixYear(l.kickoff_at);
  }

  // Safety net: boosted odds must be above the normal odds, or the form refuses the bet.
  // (The AI sometimes repeats the boosted price as both.) Keep the higher one as the odds that count.
  const odds = Number(parsed.odds);
  const boosted = parsed.boosted_odds == null ? null : Number(parsed.boosted_odds);
  if (boosted !== null && !(boosted > odds)) {
    parsed.odds = Math.max(odds || 0, boosted) || parsed.odds;
    parsed.boosted_odds = null;
  }

  // 1. Match the bookmaker against our list
  let matchedBookmakerId: number | null = null;
  if (typeof parsed.bookmaker === "string" && parsed.bookmaker.trim()) {
    const { data: bookmakers } = await supabase.from("bookmakers").select("id, name");
    const target = norm(parsed.bookmaker);
    const hit = (bookmakers ?? []).find((b: { id: number; name: string }) => norm(b.name).includes(target) || target.includes(norm(b.name)));
    if (hit) matchedBookmakerId = hit.id;
  }

  // 2. Try to find the match(es) among upcoming fixtures (gives logos + locks the kickoff)
  let upcoming: Awaited<ReturnType<typeof getUpcomingMatches>> = [];
  if (hasApiKey()) {
    try {
      upcoming = await getUpcomingMatches(10);
    } catch {
      // fixture lookup is optional – fall back to manual entry
    }
  }
  const findFixture = (home: unknown, away: unknown) => {
    if (typeof home !== "string" || typeof away !== "string") return null;
    const query = `${home} ${away}`;
    const match = upcoming.find((m) =>
      matchesQuery(norm(`${teamName(m.homeTeam)} ${m.homeTeam.name} ${teamName(m.awayTeam)} ${m.awayTeam.name}`), query),
    );
    return match && Date.parse(match.utcDate) > Date.now() ? match : null;
  };

  // Combo slip: match each leg, so logos and exact kickoffs come from the fixture list
  const rawLegs = Array.isArray(parsed.legs) ? (parsed.legs as Record<string, unknown>[]) : [];
  const legs =
    rawLegs.length >= 2
      ? rawLegs.slice(0, 20).map((l) => {
          const m = findFixture(l.home_team, l.away_team);
          return m
            ? {
                ...l,
                fixture_id: m.id,
                home_team: teamName(m.homeTeam),
                away_team: teamName(m.awayTeam),
                home_logo: m.homeTeam.crest && isCrestUrl(m.homeTeam.crest) ? m.homeTeam.crest : null,
                away_logo: m.awayTeam.crest && isCrestUrl(m.awayTeam.crest) ? m.awayTeam.crest : null,
                kickoff_at: m.utcDate,
                league: competitionName(m.competition.code, m.competition.name),
              }
            : { ...l, fixture_id: null };
        })
      : [];

  const single = legs.length ? null : findFixture(parsed.home_team, parsed.away_team);
  return NextResponse.json({ ...parsed, legs, bookmaker_id: matchedBookmakerId, fixture_id: single?.id ?? null });
}
