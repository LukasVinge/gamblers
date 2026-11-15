import { NextResponse } from "next/server";
import { ApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import { getAuth } from "@/lib/supabase/server";
import { getUpcomingMatches, hasApiKey, teamName } from "@/lib/footballData";
import { matchesQuery, norm } from "@/lib/search";

// Bet-slip scanner: a screenshot in, the spilforslag fields out (Gemini reads the image).

export const maxDuration = 30; // seconds – reading an image can take a while

/** Vercel rejects request bodies over ~4.5 MB; the browser shrinks images well below this first. */
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** First model that works wins. GEMINI_MODEL can override; the "-latest" alias follows Google's current Flash model. */
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash"].filter(
  (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i,
);

const BET_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    home_team: { type: Type.STRING, description: "Home team or player 1 name, e.g. 'Arsenal'" },
    away_team: { type: Type.STRING, description: "Away team or player 2 name, e.g. 'Chelsea'" },
    selection: {
      type: Type.STRING,
      description:
        "Formatted pick. For 1X2 use '<Home> to win', 'Draw', or '<Away> to win'. For player bets use '<Player> to score', '<Player> 2+ shots on target', etc. Otherwise concise market like 'Over 2.5 goals' or 'Both teams to score'.",
    },
    odds: { type: Type.NUMBER, description: "Standard decimal odds (e.g. 2.15). If only boosted odds are shown, put that here." },
    boosted_odds: { type: Type.NUMBER, nullable: true, description: "Boosted decimal odds if an odds boost is visible, otherwise null." },
    bookmaker: { type: Type.STRING, nullable: true, description: "Bookmaker name if visible (e.g. bet365, Unibet, Danske Spil, Betano)." },
    league: { type: Type.STRING, nullable: true, description: "League or tournament name if visible, e.g. 'Premier League'." },
    kickoff_at: { type: Type.STRING, nullable: true, description: "ISO 8601 datetime if the kickoff date/time is visible, otherwise null." },
  },
  required: ["home_team", "away_team", "selection", "odds"],
};

const PROMPT =
  "Extract the betting slip details from this screenshot. Translate Danish bet selections into clean English betting terminology " +
  "(e.g. 'Begge hold scorer' -> 'Both teams to score', 'Over 2,5 mål' -> 'Over 2.5 goals', 'Vinder kampen - Arsenal' -> 'Arsenal to win', " +
  "'Scorer når som helst - Haaland' -> 'Haaland to score'). Use decimal odds with a dot.";

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Turns a Gemini error into a message the user (and you) can act on. */
function describeGeminiError(e: unknown): { error: string; status: number } {
  const status = e instanceof ApiError ? e.status : undefined;
  const msg = e instanceof Error ? e.message : String(e);
  if (status === 400 && /api key/i.test(msg)) return { error: "Gemini-nøglen (GEMINI_API_KEY) er ugyldig. Tjek den i Vercel.", status: 500 };
  if (status === 401 || status === 403) return { error: "Gemini afviste nøglen (GEMINI_API_KEY). Tjek den i Vercel.", status: 500 };
  if (status === 429) return { error: "AI-grænsen er nået lige nu. Prøv igen om lidt.", status: 429 };
  if (status === 400) return { error: "AI'en kunne ikke læse billedet. Prøv et tydeligere screenshot.", status: 400 };
  return { error: `AI-fejl${status ? ` (${status})` : ""}: ${msg.slice(0, 160)}`, status: 502 };
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
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Ask the AI – try the next model if one has been retired (404).
  let text: string | undefined;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ inlineData: { data: base64, mimeType } }, PROMPT],
        config: { responseMimeType: "application/json", responseSchema: BET_SCHEMA, temperature: 0.1 },
      });
      text = response.text;
      break;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && model !== MODELS[MODELS.length - 1]) continue;
      console.error("parse-bet gemini error:", model, e);
      const { error, status } = describeGeminiError(e);
      return fail(error, status);
    }
  }

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
