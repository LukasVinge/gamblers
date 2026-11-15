import { NextResponse } from "next/server";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingMatches, hasApiKey, teamName } from "@/lib/footballData";
import { matchesQuery, norm } from "@/lib/search";

const BET_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    home_team: {
      type: Type.STRING,
      description: "Home team or player 1 name, e.g. 'Arsenal'",
    },
    away_team: {
      type: Type.STRING,
      description: "Away team or player 2 name, e.g. 'Chelsea'",
    },
    selection: {
      type: Type.STRING,
      description:
        "Formatted pick. For 1X2 use '<Home> to win', 'Draw', or '<Away> to win'. For player bets use '<Player> to score', '<Player> 2+ shots on target', etc. Otherwise concise market like 'Over 2.5 goals' or 'BTTS Yes'.",
    },
    odds: {
      type: Type.NUMBER,
      description: "Standard decimal odds (e.g. 2.15). If only boosted odds are shown, put that here.",
    },
    boosted_odds: {
      type: Type.NUMBER,
      nullable: true,
      description: "Boosted decimal odds if an odds boost is visible on the slip, otherwise null.",
    },
    bookmaker: {
      type: Type.STRING,
      nullable: true,
      description: "Detected bookmaker name if visible (e.g. Bet365, Unibet, Danske Spil, Betano, Expekt, LeoVegas).",
    },
    league: {
      type: Type.STRING,
      nullable: true,
      description: "League or tournament name if visible, e.g. 'Premier League'.",
    },
    kickoff_at: {
      type: Type.STRING,
      nullable: true,
      description: "ISO 8601 datetime string if kickoff date/time is visible on the slip, otherwise null.",
    },
  },
  required: ["home_team", "away_team", "selection", "odds"],
};

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY mangler i miljøvariablerne." }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Intet billede modtaget." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: base64,
            mimeType: file.type || "image/png",
          },
        },
        "Extract the betting slip details from this screenshot. Translate Danish bet selections into clean English betting terminology (e.g. 'Begge hold scorer' -> 'Both teams to score', 'Over 2,5 mål' -> 'Over 2.5 goals', 'Vinder kampen - Arsenal' -> 'Arsenal to win', 'Scorer når som helst - Haaland' -> 'Haaland to score').",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: BET_SCHEMA,
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    // 1. Match bookmaker mod Supabase
    let matchedBookmakerId: number | null = null;
    if (parsed.bookmaker) {
      const { data: bookmakers } = await supabase.from("bookmakers").select("id, name");
      const target = norm(parsed.bookmaker);
      const hit = (bookmakers ?? []).find(
        (b) => norm(b.name).includes(target) || target.includes(norm(b.name))
      );
      if (hit) matchedBookmakerId = hit.id;
    }

    // 2. Forsøg at matche mod kommende kampe fra football-data API (så vi får logoer & fixture_id)
    let matchedFixtureId: number | null = null;
    if (hasApiKey() && parsed.home_team && parsed.away_team) {
      try {
        const upcoming = await getUpcomingMatches(10);
        const query = `${parsed.home_team} ${parsed.away_team}`;
        const match = upcoming.find((m) => {
          const haystack = norm(
            `${teamName(m.homeTeam)} ${m.homeTeam.name} ${teamName(m.awayTeam)} ${m.awayTeam.name}`
          );
          return matchesQuery(haystack, query);
        });
        if (match) matchedFixtureId = match.id;
      } catch {
        // Ignorer API-fejl og fald tilbage til manuel udfyldning
      }
    }

    return NextResponse.json({
      ...parsed,
      bookmaker_id: matchedBookmakerId,
      fixture_id: matchedFixtureId,
    });
  } catch (err) {
    console.error("parse-bet error:", err);
    return NextResponse.json(
      { error: "Kunne ikke aflæse kuponen. Prøv et tydeligere screenshot." },
      { status: 500 }
    );
  }
}