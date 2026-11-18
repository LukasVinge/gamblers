import { ApiError, GoogleGenAI, MediaResolution, ThinkingLevel, Type, type GenerateContentConfig, type Schema } from "@google/genai";

// Reads a betting-slip image with Gemini. Used by /api/parse-bet.

/** Our own deadline for all AI attempts, so we answer with a clear message before Vercel cuts us off. */
export const AI_DEADLINE_MS = 50_000;

/**
 * Models to try, in order. GEMINI_MODEL (Vercel env var) can override.
 * Measured 15 Nov 2026 (real key, bet-builder slip with boost):
 *  · gemini-3.5-flash-lite / 3.1-flash-lite: ≈1.5 s, every leg, odds and boost correct
 *  · gemini-3.6-flash / 3.5-flash: 6–10 s, and the free quota runs out after ~2 scans a minute (429)
 * Each model has its own quota, so on 429 we simply move on to the next one.
 * gemini-3.8-flash rejects "minimal thinking" and ran past 60 s → not used.
 */
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"].filter(
  (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i,
);
const MAX_MODEL_TRIES = 5;
/** One model gets at most this long; the fast ones answer in ~1.5 s, so a slow one is skipped quickly. */
const PER_MODEL_TIMEOUT_MS = 12_000;

/** "This model models/x is no longer available… use models/gemini-3.8-flash …" → "gemini-3.8-flash" */
function suggestedModel(message: string): string | null {
  return message.match(/use\s+models\/([\w.-]+)/i)?.[1] ?? null;
}

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
    odds: {
      type: Type.NUMBER,
      description:
        "Original decimal odds before any boost (e.g. 2.15) – on a boosted slip this is the smaller, often crossed-out number. If only one odds value is shown, put it here.",
    },
    boosted_odds: {
      type: Type.NUMBER,
      nullable: true,
      description: "The higher boosted decimal odds when a boost shows two prices (old crossed out, new highlighted), otherwise null. Must be higher than odds.",
    },
    promo: {
      type: Type.STRING,
      nullable: true,
      enum: ["super_boost", "odds_boost", "dobbelt_op", "other_offer"],
      description:
        "Special offer shown on the slip: 'super_boost' for Super Boost / Superboost / SuperOdds, 'odds_boost' for a normal odds boost / Boost / Price boost / Forhøjet odds, 'dobbelt_op' for Dobbelt op / Double up, 'other_offer' for any other promotion (e.g. money back, free bet). Null when there is no offer.",
    },
    bookmaker: { type: Type.STRING, nullable: true, description: "Bookmaker name if visible (e.g. bet365, Unibet, Danske Spil, Betano)." },
    league: { type: Type.STRING, nullable: true, description: "League or tournament name if visible, e.g. 'Premier League'." },
    kickoff_at: { type: Type.STRING, nullable: true, description: "ISO 8601 datetime if the kickoff date/time is visible, otherwise null." },
    legs: {
      type: Type.ARRAY,
      description:
        "Only for a combo / accumulator slip with 2 or more selections on different matches: every selection in the order shown. Empty for a single bet.",
      items: {
        type: Type.OBJECT,
        properties: {
          home_team: { type: Type.STRING },
          away_team: { type: Type.STRING },
          selection: { type: Type.STRING, description: "Formatted pick for this match, same style as the top-level selection." },
          odds: { type: Type.NUMBER, nullable: true, description: "This selection's own decimal odds, if shown." },
          league: { type: Type.STRING, nullable: true },
          kickoff_at: { type: Type.STRING, nullable: true, description: "ISO 8601 with the Copenhagen offset, if shown." },
        },
        required: ["home_team", "away_team", "selection"],
      },
    },
  },
  required: ["home_team", "away_team", "selection", "odds"],
};

/** Today's date matters: slips show "Lør 21 nov" without a year, and the AI otherwise guesses wrong. */
function buildPrompt() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(new Date());
  return (
    `Today is ${today} (Europe/Copenhagen). Extract the betting slip details from this screenshot. ` +
    "Translate Danish bet selections into clean English betting terminology " +
    "(e.g. 'Begge hold scorer' -> 'Both teams to score', 'Over 2,5 mål' -> 'Over 2.5 goals', " +
    "'Vinder kampen - Arsenal' or 'Kampresultat: Arsenal' -> 'Arsenal to win', 'Uafgjort' -> 'Draw', " +
    "'Scorer når som helst - Haaland' -> 'Haaland to score'). Use decimal odds with a dot. " +
    "If the slip shows a date without a year, use the next upcoming such date. Give kickoff_at as ISO 8601 with the Copenhagen offset. " +
    "If the slip is a combo / accumulator (Kombination, Kombi, Dobbelt, Tripel, 3-fold, Accumulator – several selections on different matches), " +
    "list every selection in legs, put the slip's TOTAL odds in odds (and boosted_odds if the total is boosted), and copy the first selection's teams, pick and kickoff into the top-level fields. " +
    "Note: 'Dobbelt op' is an offer (promo), not a combo. For a single bet leave legs empty."
  );
}

function isTimeout(e: unknown) {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /abort|timeout|timed out|deadline/i.test(msg);
}

/** Turns a Gemini error into a message the user (and you) can act on. */
function describeGeminiError(e: unknown): { error: string; status: number } {
  const status = e instanceof ApiError ? e.status : undefined;
  const msg = e instanceof Error ? e.message : String(e);
  if (isTimeout(e)) return { error: "AI'en var for længe om at svare. Prøv igen – eller brug et skarpere screenshot.", status: 504 };
  if (status === 400 && /api key/i.test(msg)) return { error: "Gemini-nøglen (GEMINI_API_KEY) er ugyldig. Tjek den i Vercel.", status: 500 };
  if (status === 401 || status === 403) return { error: "Gemini afviste nøglen (GEMINI_API_KEY). Tjek den i Vercel.", status: 500 };
  if (status === 429) return { error: "AI-grænsen er nået lige nu. Prøv igen om lidt.", status: 429 };
  if (status === 400) return { error: "AI'en kunne ikke læse billedet. Prøv et tydeligere screenshot.", status: 400 };
  return { error: `AI-fejl${status ? ` (${status})` : ""}: ${msg.slice(0, 160)}`, status: 502 };
}


export type SlipResult = { text: string; model: string; ms: number } | { error: string; status: number };

/** models: only for testing – normally the MODELS list above is used. */
export async function readSlip(base64: string, mimeType: string, models: string[] = MODELS): Promise<SlipResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const startedAt = Date.now();

  // Reading a slip needs no "thinking" (that's what made it slow), and medium image detail is plenty for text.
  const fastConfig: GenerateContentConfig = {
    responseMimeType: "application/json",
    responseSchema: BET_SCHEMA,
    temperature: 0.1,
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
  };
  const PROMPT = buildPrompt();

  // Ask the AI. On 404 (model retired / not available to this key) move on to Google's suggested
  // replacement, or the next model in the list.
  let text: string | undefined;
  // the standard models always come last as a backup
  const queue = [...new Set([...models, ...MODELS])];
  const tried: string[] = [];
  while (queue.length > 0 && tried.length < MAX_MODEL_TRIES) {
    const model = queue.shift()!;
    if (tried.includes(model)) continue;
    tried.push(model);
    try {
      const timeLeft = AI_DEADLINE_MS - (Date.now() - startedAt);
      if (timeLeft < 3_000) throw new Error("deadline exceeded");
      const response = await ai.models.generateContent({
        model,
        contents: [{ inlineData: { data: base64, mimeType } }, PROMPT],
        config: { ...fastConfig, httpOptions: { timeout: Math.min(PER_MODEL_TIMEOUT_MS, timeLeft) } },
      });
      text = response.text;
      console.log(`parse-bet: ${model} answered in ${Date.now() - startedAt} ms`);
      break;
    } catch (e) {
      const suggestion = e instanceof Error ? suggestedModel(e.message) : null;
      const msg = e instanceof Error ? e.message : "";
      // Move on to another model when this one is retired (404), doesn't accept our fast settings (400 thinking),
      // or is too slow (timeout). Without "thinking" off, the newest models take a minute – never fall back to that.
      const skippable =
        (e instanceof ApiError && e.status === 404) ||
        (e instanceof ApiError && e.status === 400 && /thinking|media.?resolution/i.test(msg)) ||
        (e instanceof ApiError && (e.status === 429 || e.status === 503)) || // quota used up / model overloaded → next model
        (isTimeout(e) && Date.now() - startedAt < AI_DEADLINE_MS - 3_000);
      if (skippable && (suggestion || queue.length > 0) && tried.length < MAX_MODEL_TRIES) {
        console.warn(`parse-bet: skipping ${model} (${e instanceof ApiError ? e.status : "timeout"})${suggestion ? `, Google suggests ${suggestion}` : ""}`);
        if (suggestion && !tried.includes(suggestion)) queue.unshift(suggestion);
        continue;
      }
      console.error("parse-bet gemini error:", model, e);
      const { error, status } = describeGeminiError(e);
      return { error, status };
    }
  }
  if (text === undefined) {
    return { error: `Ingen AI-model var tilgængelig (prøvede: ${tried.join(", ")}). Sæt GEMINI_MODEL i Vercel til en model fra aistudio.google.com.`, status: 502 };
  }


  return { text, model: tried[tried.length - 1], ms: Date.now() - startedAt };
}
