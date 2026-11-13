"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamLogo } from "./TeamLogo";
import { matchesQuery, norm } from "@/lib/search";

export type PickerTeam = { name: string; full: string; tla: string | null; crest: string | null };
export type PickerMatch = {
  id: number;
  day: string; // YYYY-MM-DD
  dayLabel: string;
  time: string;
  leagueCode: string;
  league: string;
  home: PickerTeam;
  away: PickerTeam;
  tips: number;
};


function haystack(m: PickerMatch) {
  return norm([m.home.name, m.home.full, m.home.tla, m.away.name, m.away.full, m.away.tla, m.league].filter(Boolean).join(" "));
}

export function MatchPicker({ matches, leagues }: { matches: PickerMatch[]; leagues: { code: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState<string | null>(null);

  const indexed = useMemo(() => matches.map((m) => ({ m, text: haystack(m) })), [matches]);

  const results = useMemo(() => {
    return indexed
      .filter(({ m, text }) => (!league || m.leagueCode === league) && matchesQuery(text, query))
      .map(({ m }) => m);
  }, [indexed, query, league]);

  const days = useMemo(() => {
    const map = new Map<string, { label: string; list: PickerMatch[] }>();
    for (const m of results) {
      const entry = map.get(m.day) ?? { label: m.dayLabel, list: [] };
      entry.list.push(m);
      map.set(m.day, entry);
    }
    return [...map.values()];
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team – e.g. Arsenal, Bayern, Real…"
          aria-label="Search for a team"
          className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-base text-ink shadow-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="flex flex-wrap gap-2 py-0.5 text-sm">
        {[{ code: null as string | null, name: "All" }, ...leagues].map((l) => (
          <button
            key={l.code ?? "all"}
            type="button"
            onClick={() => setLeague(l.code)}
            className={`rounded-full px-3 py-1 ring-1 transition ${
              l.code === league ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-muted">
          {matches.length === 0
            ? "No top-5-league matches in the next 10 days."
            : `No match found${query ? ` for “${query}”` : ""}.`}{" "}
          <Link href="/new?manual=1" className="font-medium text-accent hover:underline">
            Enter the match manually
          </Link>
        </div>
      ) : (
        days.map((d) => (
          <section key={d.label} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{d.label}</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {d.list.map((m) => (
                <li key={m.id}>
                  <Link href={`/new?fixture=${m.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent-soft/60">
                    <span className="w-12 shrink-0 font-mono text-sm text-ink-2">{m.time}</span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <TeamLogo src={m.home.crest} name={m.home.name} size={20} />
                        <span className="truncate">{m.home.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <TeamLogo src={m.away.crest} name={m.away.name} size={20} />
                        <span className="truncate">{m.away.name}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted">{m.league}</span>
                      {m.tips > 0 && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">
                          {m.tips} {m.tips === 1 ? "tip" : "tips"}
                        </span>
                      )}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-faint" aria-hidden>
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
