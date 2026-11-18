"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MatchPicker, type PickerMatch } from "./MatchPicker";
import { TeamLogo } from "./TeamLogo";
import { TimeSelect } from "./TimeSelect";
import { inputCls } from "./ui";

/** One match on the slip while it's being built (sent to the server as JSON in the "legs" field). */
type Leg = {
  key: string;
  fixture_id: number | null;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  kickoff_at: string; // ISO
  selection: string;
  odds: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const newKey = () => Math.random().toString(36).slice(2);
const parseOdds = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 1 ? n : null;
};

/** Legs read by the AI scanner from a combo slip, if any (left in sessionStorage by SlipScanner). */
function scannedLegs(): { legs: Leg[]; hasTotalOdds: boolean } | null {
  try {
    const raw = sessionStorage.getItem("rg_scanned_slip");
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data?.legs) || data.legs.length < 2) return null;
    const legs: Leg[] = data.legs
      .filter((l: Record<string, unknown>) => typeof l.home_team === "string" && typeof l.away_team === "string")
      .map((l: Record<string, unknown>) => ({
        key: newKey(),
        fixture_id: typeof l.fixture_id === "number" ? l.fixture_id : null,
        sport: "Football",
        league: typeof l.league === "string" ? l.league : "",
        home_team: String(l.home_team),
        away_team: String(l.away_team),
        home_logo: typeof l.home_logo === "string" ? l.home_logo : null,
        away_logo: typeof l.away_logo === "string" ? l.away_logo : null,
        kickoff_at: typeof l.kickoff_at === "string" && !Number.isNaN(Date.parse(l.kickoff_at)) ? new Date(l.kickoff_at).toISOString() : "",
        selection: typeof l.selection === "string" ? l.selection : "",
        odds: typeof l.odds === "number" ? l.odds.toFixed(2) : "",
      }));
    return { legs, hasTotalOdds: typeof data.odds === "number" };
  } catch {
    return null;
  }
}

/** Builds a combo slip: add matches from the fixture list (or type them in), pick + odds per match. */
export function ComboBuilder({ matches, leagues }: { matches: PickerMatch[]; leagues: { code: string; name: string }[] }) {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [adding, setAdding] = useState<"list" | "manual" | null>("list");
  const oddsTouched = useRef(false);
  const guard = useRef<HTMLInputElement>(null);

  // Prefill from a scanned combo slip
  useEffect(() => {
    const scanned = scannedLegs();
    if (scanned && scanned.legs.length >= 2) {
      setLegs(scanned.legs);
      setAdding(null);
      if (scanned.hasTotalOdds) oddsTouched.current = true; // keep the slip's own total odds
    }
  }, []);

  // Total odds = all match odds multiplied, written into the Odds field until the user types there themselves
  const product = useMemo(() => {
    const all = legs.map((l) => parseOdds(l.odds));
    return legs.length >= 2 && all.every((o) => o !== null) ? all.reduce((a, b) => a! * b!, 1)! : null;
  }, [legs]);

  useEffect(() => {
    const el = document.querySelector<HTMLInputElement>('input[name="odds"]');
    if (!el) return;
    const onInput = (e: Event) => {
      if (e.isTrusted) oddsTouched.current = true;
    };
    el.addEventListener("input", onInput);
    return () => el.removeEventListener("input", onInput);
  }, []);

  useEffect(() => {
    const el = document.querySelector<HTMLInputElement>('input[name="odds"]');
    // auto-filled only: a match without odds means the total can't be computed → leave it for the user to type
    if (el && !oddsTouched.current) el.value = product !== null ? product.toFixed(2) : "";
  }, [product]);

  // The browser's own "fill this in" check: at least 2 matches before posting
  useEffect(() => {
    guard.current?.setCustomValidity(legs.length >= 2 ? "" : "Tilføj mindst 2 kampe til kombien");
  }, [legs.length]);

  const update = (key: string, patch: Partial<Leg>) => setLegs((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLegs((ls) => ls.filter((l) => l.key !== key));
  const add = (leg: Omit<Leg, "key" | "selection" | "odds">) => {
    setLegs((ls) => [...ls, { ...leg, key: newKey(), selection: "", odds: "" }].sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)));
    setAdding(null);
  };

  const pickFixture = (m: PickerMatch) =>
    add({
      fixture_id: m.id,
      sport: "Football",
      league: m.league,
      home_team: m.home.name,
      away_team: m.away.name,
      home_logo: m.home.crest,
      away_logo: m.away.crest,
      kickoff_at: m.kickoffIso,
    });

  const payload = JSON.stringify(
    legs.map((l) => ({
      fixture_id: l.fixture_id,
      sport: l.sport,
      league: l.league,
      home_team: l.home_team,
      away_team: l.away_team,
      home_logo: l.home_logo,
      away_logo: l.away_logo,
      kickoff_at: l.kickoff_at,
      selection: l.selection,
      odds: parseOdds(l.odds),
    })),
  );

  return (
    <div className="space-y-4">
      <input type="hidden" name="legs" value={payload} />
      <input ref={guard} required tabIndex={-1} aria-hidden value={legs.length >= 2 ? "ok" : ""} onChange={() => {}} className="sr-only" />

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Kampe på kuponen ({legs.length})</h2>
        {product !== null && (
          <span className="text-xs text-muted">
            Samlet odds <span className="font-mono font-semibold text-ink">{product.toFixed(2)}</span>
          </span>
        )}
      </div>

      {legs.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-muted">
          Ingen kampe endnu – tilføj mindst 2.
        </p>
      )}

      <ol className="space-y-3">
        {legs.map((l, i) => (
          <li key={l.key} className="space-y-3 rounded-xl bg-subtle p-3 ring-1 ring-line">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
                  <span className="font-mono text-xs text-muted">{i + 1}.</span>
                  {(l.home_logo || l.away_logo) && <TeamLogo src={l.home_logo} name={l.home_team} size={18} />}
                  <span className="truncate">{l.home_team}</span>
                  <span className="text-faint">–</span>
                  {(l.home_logo || l.away_logo) && <TeamLogo src={l.away_logo} name={l.away_team} size={18} />}
                  <span className="truncate">{l.away_team}</span>
                </p>
                <p className="text-xs text-muted">
                  {l.league ? `${l.league} · ` : ""}
                  {l.kickoff_at ? fmtTime(l.kickoff_at) : <span className="text-loss">Mangler tidspunkt</span>}
                </p>
              </div>
              <button type="button" onClick={() => remove(l.key)} aria-label={`Fjern ${l.home_team} – ${l.away_team}`} className="shrink-0 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface hover:text-loss">
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[`${l.home_team} to win`, "Draw", `${l.away_team} to win`].map((s, k) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update(l.key, { selection: s })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                    l.selection === s ? "bg-accent-soft text-accent-ink ring-2 ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong"
                  }`}
                >
                  {["1", "X", "2"][k]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <input
                required
                minLength={2}
                maxLength={200}
                value={l.selection}
                onChange={(e) => update(l.key, { selection: e.target.value })}
                placeholder="Spil – fx Over 2.5 goals"
                aria-label={`Spil på ${l.home_team} – ${l.away_team}`}
                className={inputCls}
              />
              <input
                inputMode="decimal"
                value={l.odds}
                onChange={(e) => update(l.key, { odds: e.target.value })}
                placeholder="Odds"
                aria-label={`Odds på ${l.home_team} – ${l.away_team}`}
                className={`${inputCls} font-mono`}
              />
            </div>
          </li>
        ))}
      </ol>

      {adding === null ? (
        <button
          type="button"
          onClick={() => setAdding("list")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/50 bg-accent-soft/40 px-4 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
        >
          <span aria-hidden>＋</span> Tilføj kamp
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setAdding("list")} className={`rounded-full px-3 py-1 text-xs font-semibold ${adding === "list" ? "bg-ink text-white" : "bg-subtle text-ink-2"}`}>
                Top 5 + CL
              </button>
              <button type="button" onClick={() => setAdding("manual")} className={`rounded-full px-3 py-1 text-xs font-semibold ${adding === "manual" ? "bg-ink text-white" : "bg-subtle text-ink-2"}`}>
                Anden kamp
              </button>
            </div>
            {legs.length > 0 && (
              <button type="button" onClick={() => setAdding(null)} className="text-xs text-muted hover:text-ink">
                Luk
              </button>
            )}
          </div>
          {adding === "list" ? (
            <MatchPicker matches={matches} leagues={leagues} onPick={pickFixture} onManual={() => setAdding("manual")} exclude={legs.map((l) => l.fixture_id ?? -1)} />
          ) : (
            <ManualLeg onAdd={add} />
          )}
        </div>
      )}
    </div>
  );
}

/** A match typed by hand (other leagues/sports): teams, league, date and 24-hour time. */
function ManualLeg({ onAdd }: { onAdd: (leg: Omit<Leg, "key" | "selection" | "odds">) => void }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [league, setLeague] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  useEffect(() => setDate((d) => d || localDate(new Date())), []);

  const kickoff = date && time ? new Date(`${date}T${time}`) : null;
  const valid = home.trim() && away.trim() && kickoff && !Number.isNaN(kickoff.getTime());
  const inPast = kickoff ? kickoff.getTime() <= Date.now() : false;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input value={home} onChange={(e) => setHome(e.target.value)} maxLength={80} placeholder="Hjemmehold" aria-label="Hjemmehold" className={inputCls} />
        <input value={away} onChange={(e) => setAway(e.target.value)} maxLength={80} placeholder="Udehold" aria-label="Udehold" className={inputCls} />
      </div>
      <input value={league} onChange={(e) => setLeague(e.target.value)} maxLength={80} placeholder="Liga (valgfri) – fx Superliga" aria-label="Liga" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Dato" className={inputCls} />
        <TimeSelect value={time} onChange={setTime} />
      </div>
      {inPast && <p className="text-xs text-loss">Det tidspunkt er allerede passeret.</p>}
      <button
        type="button"
        disabled={!valid || inPast}
        onClick={() =>
          onAdd({
            fixture_id: null,
            sport: "Football",
            league: league.trim(),
            home_team: home.trim(),
            away_team: away.trim(),
            home_logo: null,
            away_logo: null,
            kickoff_at: kickoff!.toISOString(),
          })
        }
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        Tilføj kampen
      </button>
    </div>
  );
}
