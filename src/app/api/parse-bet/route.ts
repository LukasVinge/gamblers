import { NextResponse } from "next/server";
import { getAuth } from "@/lib/supabase/server";
import { getUpcomingMatches, hasApiKey, teamName } from "@/lib/footballData";
import { matchesQuery, norm } from "@/lib/search";
import { readSlip } from "@/lib/slipReader";

// Bet-slip scanner: a screenshot in, the spilforslag fields out (Gemini reads the image).

export const maxDuration = 60; // seconds – Vercel stops the function after this

/** Vercel rejects request bodies over ~4.5 MB; the browser shrinks images well below this first. */
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

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

  // 1. Match the bookmaker against our list
  let matchedBookmakerId: number | null = null;
  if (typeof parsed.bookmaker === "string" && parsed.bookmaker.trim()) {
    const { data: bookmakers } = await supabase.from("bookmakers").select("id, name");
    const target = norm(parsed.bookmaker);
    const hit = (bookmakers ?? []).find((b: { id: number; name: string }) => norm(b.name).includes(target) || target.includes(norm(b.name)));
    if (hit) matchedBookmakerId = hit.id;
  }

  // 2. Try to find the match among upcoming fixtures (gives logos + locks the kickoff)
  let matchedFixtureId: number | null = null;
  if (hasApiKey() && typeof parsed.home_team === "string" && typeof parsed.away_team === "string") {
    try {
      const upcoming = await getUpcomingMatches(10);
      const query = `${parsed.home_team} ${parsed.away_team}`;
      const match = upcoming.find((m) =>
        matchesQuery(norm(`${teamName(m.homeTeam)} ${m.homeTeam.name} ${teamName(m.awayTeam)} ${m.awayTeam.name}`), query),
      );
      if (match && Date.parse(match.utcDate) > Date.now()) matchedFixtureId = match.id;
    } catch {
      // fixture lookup is optional – fall back to manual entry
    }
  }

  return NextResponse.json({ ...parsed, bookmaker_id: matchedBookmakerId, fixture_id: matchedFixtureId });
}
