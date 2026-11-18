import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTip } from "../../actions";
import { getAuth } from "@/lib/supabase/server";
import { fmtKickoff } from "@/lib/format";
import { getMatch, getSquad, hasApiKey } from "@/lib/footballData";
import { isCombo, legsMissing, TIP_SELECT, TIP_SELECT_BASIC, toTipView, type TipRow } from "@/lib/types";
import { ComboLegs } from "@/components/ComboLegs";
import { BetFields } from "@/components/BetFields";
import { SelectionInput, type SquadPlayer } from "@/components/SelectionInput";
import { TeamLogo } from "@/components/TeamLogo";
import { btnGhost, btnPrimary, Card, Notice } from "@/components/ui";

export const metadata = { title: "Edit spilforslag" };

export default async function EditTipPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await getAuth();

  const tipQuery = (select: string) => supabase.from("tips").select(select).eq("share_slug", slug).maybeSingle();
  const [first, { data: bookmakers }] = await Promise.all([
    tipQuery(TIP_SELECT),
    supabase.from("bookmakers").select("id, name, url").order("id"),
  ]);
  // before migration 0012 there's no tip_legs table – load the tip without the combo matches
  const { data: row } = legsMissing(first.error) ? await tipQuery(TIP_SELECT_BASIC) : first;
  if (!row) notFound();
  const tip = toTipView(row as unknown as TipRow);

  const locked =
    tip.author_id !== user?.id
      ? "Only the person who posted this spilforslag can edit it."
      : tip.status !== "pending"
        ? "This spilforslag is already settled, so it can't be edited."
        : Date.parse(tip.kickoff_at) <= Date.now()
          ? "The match has started – spilforslag are locked at kickoff."
          : null;

  // Squads for the player search, if the tip was made from a real match.
  let players: SquadPlayer[] = [];
  if (!locked && tip.fixture_id && hasApiKey()) {
    try {
      const m = await getMatch(tip.fixture_id);
      const [hs, as] = await Promise.allSettled([getSquad(m.homeTeam.id), getSquad(m.awayTeam.id)]);
      players = [
        ...(hs.status === "fulfilled" ? hs.value.map((p) => ({ name: p.name, team: tip.home_team, position: p.position })) : []),
        ...(as.status === "fulfilled" ? as.value.map((p) => ({ name: p.name, team: tip.away_team, position: p.position })) : []),
      ];
    } catch {
      // no suggestions – the player field still works as free text
    }
  }

  const hasLogos = Boolean(tip.home_logo || tip.away_logo);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/t/${tip.share_slug}`} className="text-sm text-muted hover:text-ink">
          ← Back to the spilforslag
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit spilforslag</h1>
        <p className="text-sm text-muted">You can change your bet until kickoff. The match itself can&apos;t be changed.</p>
      </div>
      <Notice error={error ?? locked ?? undefined} />

      {!locked && (
        <Card className="p-5">
          <form action={updateTip} className="space-y-5">
            <input type="hidden" name="tipId" value={tip.id} />
            <input type="hidden" name="slug" value={tip.share_slug} />

            {isCombo(tip) ? (
              <div className="space-y-2 rounded-xl bg-subtle p-4 ring-1 ring-line">
                <p className="text-xs text-muted">
                  🧩 Kombi · {tip.legs!.length} kampe – kampene kan ikke ændres (slet og lav den igen før kampstart)
                </p>
                <ComboLegs legs={tip.legs!} />
                <input type="hidden" name="selection" value={tip.selection} />
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-subtle p-4 ring-1 ring-line">
                  <p className="mb-3 text-xs text-muted">
                    {tip.league ? `${tip.league} · ` : ""}
                    {fmtKickoff(tip.kickoff_at)}
                  </p>
                  <div className="flex items-center justify-center gap-4 text-center">
                    <div className="flex flex-1 flex-col items-center gap-1.5">
                      {hasLogos && <TeamLogo src={tip.home_logo} name={tip.home_team} size={40} />}
                      <span className="text-sm font-semibold">{tip.home_team}</span>
                    </div>
                    <span className="text-muted">vs</span>
                    <div className="flex flex-1 flex-col items-center gap-1.5">
                      {hasLogos && <TeamLogo src={tip.away_logo} name={tip.away_team} size={40} />}
                      <span className="text-sm font-semibold">{tip.away_team}</span>
                    </div>
                  </div>
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">What are you betting on?</legend>
                  <SelectionInput home={tip.home_team} away={tip.away_team} players={players} initial={tip.selection} />
                </fieldset>
              </>
            )}

            <BetFields
              bookmakers={bookmakers ?? []}
              defaults={{
                bookmaker_id: tip.bookmaker_id,
                odds: tip.odds,
                boosted_odds: tip.boosted_odds,
                stake_units: tip.stake_units,
                reasoning: tip.reasoning,
                promo: tip.promo,
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary}>Save changes</button>
              <Link href={`/t/${tip.share_slug}`} className={btnGhost}>
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
