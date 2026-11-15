import Link from "next/link";
import { createTip } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { getMainGroup } from "@/lib/group";
import { fmtKickoff } from "@/lib/format";
import { dayKey, dayLabel, timeOf } from "@/lib/fixtureFormat";
import {
  COMPETITIONS,
  competitionName,
  getMatch,
  getSquad,
  getUpcomingMatches,
  hasApiKey,
  teamName,
  type Match,
  type Team,
} from "@/lib/footballData";
import { BetFields } from "@/components/BetFields";
import { ManualMatchFields } from "@/components/ManualMatchFields";
import { NotInGroup } from "@/components/GroupHeader";
import { MatchPicker, type PickerMatch, type PickerTeam } from "@/components/MatchPicker";
import { ScannedFormHydrator } from "@/components/ScannedFormHydrator";
import { SelectionInput, type SquadPlayer } from "@/components/SelectionInput";
import { SlipScanner } from "@/components/SlipScanner";
import { TeamLogo } from "@/components/TeamLogo";
import { btnPrimary, Card, Notice } from "@/components/ui";

export const metadata = { title: "Nyt spilforslag" };

function Steps({ step }: { step: 1 | 2 }) {
  const item = (n: 1 | 2, label: string) => (
    <span className={`flex items-center gap-2 ${step === n ? "text-ink" : "text-faint"}`}>
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
          step === n
            ? "bg-accent text-white"
            : step > n
              ? "bg-win-soft text-win"
              : "bg-subtle text-faint"
        }`}
      >
        {step > n ? "✓" : n}
      </span>
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-3 text-sm font-medium">
      {item(1, "Pick match")}
      <span className="h-px w-6 bg-line-strong" />
      {item(2, "Your bet")}
    </div>
  );
}

const toPickerTeam = (t: Team): PickerTeam => ({
  name: teamName(t),
  full: t.name,
  tla: t.tla,
  crest: t.crest,
});

export default async function NewTipPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; fixture?: string; manual?: string; scanned?: string }>;
}) {
  const { error, fixture, manual, scanned } = await searchParams;
  const supabase = await createClient();

  const [group, { data: bookmakers }] = await Promise.all([
    getMainGroup(supabase),
    supabase.from("bookmakers").select("id, name").order("id"),
  ]);
  if (!group) return <NotInGroup />;

  const apiReady = hasApiKey();

  // Step 2 with a chosen match: load it so everything is pre-filled.
  let match: Match | null = null;
  let matchProblem: string | undefined;
  if (fixture && /^\d+$/.test(fixture) && apiReady) {
    try {
      match = await getMatch(Number(fixture));
      if (Date.parse(match.utcDate) <= Date.now()) {
        matchProblem = "That match has already started – pick another one.";
        match = null;
      }
    } catch {
      matchProblem = "Couldn't load that match – try again or enter it manually.";
    }
  }

  const isManual = manual === "1" || !apiReady;

  // ───────── Step 1: pick a match from the next 10 days ─────────
  if (!match && !isManual) {
    let picker: PickerMatch[] = [];
    let loadProblem: string | undefined;
    try {
      const now = Date.now();
      const upcoming = (await getUpcomingMatches(10)).filter(
        (m) => (m.status === "SCHEDULED" || m.status === "TIMED") && Date.parse(m.utcDate) > now
      );
      const counts = new Map<number, number>();
      if (upcoming.length) {
        const { data } = await supabase
          .from("tips")
          .select("fixture_id")
          .eq("group_id", group.id)
          .in(
            "fixture_id",
            upcoming.map((m) => m.id)
          );
        (data ?? []).forEach((r: { fixture_id: number | null }) => {
          if (r.fixture_id) counts.set(r.fixture_id, (counts.get(r.fixture_id) ?? 0) + 1);
        });
      }
      picker = upcoming.map((m) => {
        const day = dayKey(m.utcDate);
        return {
          id: m.id,
          day,
          dayLabel: dayLabel(day),
          time: timeOf(m.utcDate),
          leagueCode: m.competition.code,
          league: competitionName(m.competition.code, m.competition.name),
          home: toPickerTeam(m.homeTeam),
          away: toPickerTeam(m.awayTeam),
          tips: counts.get(m.id) ?? 0,
        };
      });
    } catch {
      loadProblem =
        "Couldn't load this week's matches right now – you can still enter a match manually.";
    }

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← Spilforslag
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nyt spilforslag</h1>
          <Steps step={1} />
        </div>
        <Notice error={error ?? matchProblem ?? loadProblem} />

        <SlipScanner />

        <Link
          href="/new?manual=1"
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-3 transition hover:border-accent hover:bg-accent-soft/40"
        >
          <span>
            <span className="block font-semibold">Other league or sport</span>
            <span className="block text-sm text-muted">
              Superliga, Europa League, tennis… – enter the teams, date and time yourself
            </span>
          </span>
          <span className="shrink-0 text-lg font-semibold text-accent" aria-hidden>
            →
          </span>
        </Link>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-2">
            …or pick a match from the top 5 leagues or the Champions League
          </h2>
          <MatchPicker
            matches={picker}
            leagues={COMPETITIONS.map((c) => ({ code: c.code, name: c.name }))}
          />
        </div>
      </div>
    );
  }

  // ───────── Step 2: the bet ─────────
  const home = match ? teamName(match.homeTeam) : undefined;
  const away = match ? teamName(match.awayTeam) : undefined;

  let players: SquadPlayer[] = [];
  if (match) {
    const m = match;
    const [hs, as] = await Promise.allSettled([
      getSquad(m.homeTeam.id),
      getSquad(m.awayTeam.id),
    ]);
    players = [
      ...(hs.status === "fulfilled"
        ? hs.value.map((p) => ({ name: p.name, team: home!, position: p.position }))
        : []),
      ...(as.status === "fulfilled"
        ? as.value.map((p) => ({ name: p.name, team: away!, position: p.position }))
        : []),
    ];
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href={apiReady ? "/new" : "/"} className="text-sm text-muted hover:text-ink">
          ← {apiReady ? "Pick another match" : "Spilforslag"}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nyt spilforslag</h1>
        {apiReady && <Steps step={2} />}
      </div>
      <Notice error={error ?? matchProblem} />

      <Card className="p-5">
        <form action={createTip} className="space-y-5">
          <ScannedFormHydrator active={scanned === "1"} />
          <input type="hidden" name="groupId" value={group.id} />

          {match ? (
            <>
              <input type="hidden" name="fixture_id" value={match.id} />
              <div className="rounded-xl bg-subtle p-4 ring-1 ring-line">
                <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <TeamLogo
                      src={match.competition.emblem}
                      name={match.competition.name}
                      size={14}
                    />
                    {competitionName(match.competition.code, match.competition.name)} ·{" "}
                    {fmtKickoff(match.utcDate)}
                  </span>
                  <Link href="/new" className="font-medium text-accent hover:underline">
                    Change
                  </Link>
                </div>
                <div className="flex items-center justify-center gap-4 text-center">
                  <div className="flex flex-1 flex-col items-center gap-1.5">
                    <TeamLogo src={match.homeTeam.crest} name={home!} size={44} />
                    <span className="text-sm font-semibold">{home}</span>
                  </div>
                  <span className="text-muted">vs</span>
                  <div className="flex flex-1 flex-col items-center gap-1.5">
                    <TeamLogo src={match.awayTeam.crest} name={away!} size={44} />
                    <span className="text-sm font-semibold">{away}</span>
                  </div>
                </div>
              </div>

              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  What are you betting on?
                </legend>
                <SelectionInput home={home} away={away} players={players} />
              </fieldset>
            </>
          ) : (
            <ManualMatchFields />
          )}

          <BetFields bookmakers={bookmakers ?? []} />

          <button className={`${btnPrimary} w-full sm:w-auto`}>Post spilforslag</button>
        </form>
      </Card>
    </div>
  );
}