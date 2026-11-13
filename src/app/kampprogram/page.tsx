import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMainGroup } from "@/lib/group";
import {
  COMPETITIONS,
  FootballDataError,
  bigGame,
  competitionName,
  getChampionsLeagueTeams,
  getTablePositions,
  getUpcomingMatches,
  hasApiKey,
  teamName,
  type BigGame,
  type Match,
} from "@/lib/footballData";
import { dayKey, dayLabel, timeOf } from "@/lib/fixtureFormat";
import { GroupHeader, NotInGroup } from "@/components/GroupHeader";
import { LeagueLabel, SegmentedLinks } from "@/components/Segmented";
import { TeamLogo } from "@/components/TeamLogo";
import { Card, Notice } from "@/components/ui";

export const metadata = { title: "Kampprogram" };

const UPCOMING = new Set(["SCHEDULED", "TIMED"]);
const LIVE = new Set(["IN_PLAY", "PAUSED"]);

function ScoreOrTime({ m }: { m: Match }) {
  const { home, away } = m.score.fullTime;
  if (LIVE.has(m.status))
    return (
      <span className="font-mono text-sm font-semibold text-loss">
        {home ?? 0}–{away ?? 0} <span className="ml-1 animate-pulse text-[10px]">LIVE</span>
      </span>
    );
  if (m.status === "FINISHED") return <span className="font-mono text-sm text-muted">{home}–{away}</span>;
  if (m.status === "POSTPONED" || m.status === "CANCELLED") return <span className="text-xs text-warn">{m.status.toLowerCase()}</span>;
  return <span className="font-mono text-sm text-ink-2">{timeOf(m.utcDate)}</span>;
}

function TipsLink({ id, count }: { id: number; count: number }) {
  if (!count) return null;
  return (
    <Link href={`/?view=all&fixture=${id}`} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink hover:bg-accent-soft">
      {count} {count === 1 ? "tip" : "tips"}
    </Link>
  );
}

function NewTipButton({ m, label = "+ Tip" }: { m: Match; label?: string }) {
  if (!UPCOMING.has(m.status) || Date.parse(m.utcDate) <= Date.now()) return null;
  return (
    <Link
      href={`/new?fixture=${m.id}`}
      className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-hover"
    >
      {label}
    </Link>
  );
}

function BigGameCard({ m, tips, reason, featured = false }: { m: Match; tips: number; reason: string; featured?: boolean }) {
  const logo = featured ? 64 : 48;
  return (
    <Card className={`space-y-4 p-4 ${featured ? "border-accent/40 bg-gradient-to-b from-accent-soft to-surface p-5 sm:p-6" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <TeamLogo src={m.competition.emblem} name={m.competition.name} size={16} />
          {competitionName(m.competition.code, m.competition.name)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${featured ? "bg-accent text-white" : "bg-warn-soft text-warn"}`}
        >
          {featured ? "🏆 Match of the week" : "⭐ Storkamp"}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="flex flex-col items-center gap-2">
          <TeamLogo src={m.homeTeam.crest} name={teamName(m.homeTeam)} size={logo} />
          <span className={`font-semibold leading-tight ${featured ? "text-base" : "text-sm"}`}>{teamName(m.homeTeam)}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ScoreOrTime m={m} />
          <span className="text-[11px] text-muted">{dayLabel(dayKey(m.utcDate))}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <TeamLogo src={m.awayTeam.crest} name={teamName(m.awayTeam)} size={logo} />
          <span className={`font-semibold leading-tight ${featured ? "text-base" : "text-sm"}`}>{teamName(m.awayTeam)}</span>
        </div>
      </div>
      <p className="text-center text-xs font-medium text-ink-2">{reason}</p>
      <div className="flex items-center justify-between gap-2">
        <TipsLink id={m.id} count={tips} />
        <span className="ml-auto">
          <NewTipButton m={m} label="+ Spilforslag" />
        </span>
      </div>
    </Card>
  );
}

function MatchRow({ m, tips, big }: { m: Match; tips: number; big?: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-14 shrink-0 text-center">
        <ScoreOrTime m={m} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <TeamLogo src={m.homeTeam.crest} name={teamName(m.homeTeam)} size={20} />
          <span className="truncate font-medium">{teamName(m.homeTeam)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TeamLogo src={m.awayTeam.crest} name={teamName(m.awayTeam)} size={20} />
          <span className="truncate font-medium">{teamName(m.awayTeam)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          {big && <span title={`Storkamp: ${big}`}>⭐</span>}
          {competitionName(m.competition.code, m.competition.name)}
        </span>
        <div className="flex items-center gap-1.5">
          <TipsLink id={m.id} count={tips} />
          <NewTipButton m={m} />
        </div>
      </div>
    </li>
  );
}

function SetupCard() {
  return (
    <Card className="space-y-3 p-6">
      <h2 className="font-semibold">Connect the fixture data (2 minutes)</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
        <li>
          Register for a free key at{" "}
          <a href="https://www.football-data.org/client/register" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            football-data.org/client/register
          </a>
          . The key arrives by email.
        </li>
        <li>
          Open <code className="rounded bg-subtle px-1">.env.local</code> and add the line{" "}
          <code className="rounded bg-subtle px-1">FOOTBALL_DATA_API_KEY=your-key</code>
        </li>
        <li>
          Restart the site (<code className="rounded bg-subtle px-1">npm run dev</code>).
        </li>
      </ol>
    </Card>
  );
}

export default async function KampprogramPage({ searchParams }: { searchParams: Promise<{ comp?: string }> }) {
  const supabase = await createClient();
  const group = await getMainGroup(supabase);
  if (!group) return <NotInGroup />;

  const sp = await searchParams;
  const comp = COMPETITIONS.find((c) => c.code === sp.comp)?.code ?? null;

  if (!hasApiKey()) {
    return (
      <div className="space-y-6">
        <GroupHeader active="fixtures" />
        <SetupCard />
      </div>
    );
  }

  let matches: Match[] = [];
  let positions = new Map<number, number>();
  let clTeams = new Set<number>();
  let problem: string | undefined;
  try {
    [matches, positions, clTeams] = await Promise.all([getUpcomingMatches(10), getTablePositions(), getChampionsLeagueTeams()]);
  } catch (e) {
    problem =
      e instanceof FootballDataError && e.kind === "rate-limit"
        ? "The fixture service is busy (free plan: 10 requests/minute). Try again in a minute."
        : `Couldn't load fixtures right now${e instanceof Error ? ` (${e.message})` : ""}.`;
  }

  const visible = matches.filter((m) => !comp || m.competition.code === comp);
  const bigInfo = new Map<number, BigGame>();
  for (const m of visible) {
    const b = bigGame(m, { positions, clTeams });
    if (b) bigInfo.set(m.id, b);
  }
  const bigGames = visible
    .filter((m) => bigInfo.has(m.id) && (UPCOMING.has(m.status) || LIVE.has(m.status)))
    .sort((a, b) => bigInfo.get(b.id)!.score - bigInfo.get(a.id)!.score || a.utcDate.localeCompare(b.utcDate));

  // Match of the week = the biggest game in the next 7 days (falls back to the biggest one shown).
  const weekEnd = Date.now() + 7 * 86_400_000;
  const matchOfWeek = bigGames.find((m) => Date.parse(m.utcDate) <= weekEnd) ?? bigGames[0];
  const otherBig = bigGames.filter((m) => m !== matchOfWeek).slice(0, 6);

  // How many tips the group already has on each fixture (ignored if migration 0003 isn't run yet)
  const counts = new Map<number, number>();
  if (visible.length) {
    const { data } = await supabase
      .from("tips")
      .select("fixture_id")
      .eq("group_id", group.id)
      .in("fixture_id", visible.map((m) => m.id));
    (data ?? []).forEach((r: { fixture_id: number | null }) => {
      if (r.fixture_id) counts.set(r.fixture_id, (counts.get(r.fixture_id) ?? 0) + 1);
    });
  }

  const days = new Map<string, Match[]>();
  for (const m of visible) {
    const k = dayKey(m.utcDate);
    days.set(k, [...(days.get(k) ?? []), m]);
  }

  return (
    <div className="space-y-6">
      <GroupHeader active="fixtures" />
      <Notice error={problem} />

      <SegmentedLinks
        active={comp ?? "all"}
        items={[
          { key: "all", href: "/kampprogram", label: "All" },
          ...COMPETITIONS.map((c) => ({
            key: c.code,
            href: `/kampprogram?comp=${c.code}`,
            title: c.name,
            label: <LeagueLabel code={c.code} name={c.name} />,
          })),
        ]}
      />

      {matchOfWeek && (
        <BigGameCard m={matchOfWeek} tips={counts.get(matchOfWeek.id) ?? 0} reason={bigInfo.get(matchOfWeek.id)!.reason} featured />
      )}

      {otherBig.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Storkampe coming up</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherBig.map((m) => (
              <BigGameCard key={m.id} m={m} tips={counts.get(m.id) ?? 0} reason={bigInfo.get(m.id)!.reason} />
            ))}
          </div>
        </section>
      )}

      {!problem && visible.length === 0 && (
        <Card className="p-8 text-center text-muted">
          No matches in the next 10 days{comp ? " for this competition" : ""}.
        </Card>
      )}

      {[...days.entries()].map(([k, list]) => (
        <section key={k} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{dayLabel(k)}</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {list.map((m) => (
                <MatchRow key={m.id} m={m} tips={counts.get(m.id) ?? 0} big={bigInfo.get(m.id)?.reason} />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
