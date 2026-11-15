"use client";

import { useEffect, useState } from "react";
import { SelectionInput } from "./SelectionInput";
import { Field, inputCls } from "./ui";

const SPORTS = ["Football", "Ice hockey", "Tennis", "Handball", "Basketball", "American football", "Esports", "Other"];

const LEAGUE_SUGGESTIONS = [
  "Superliga",
  "1. division",
  "DBU Pokalen",
  "Champions League",
  "Europa League",
  "Conference League",
  "Nations League",
  "World Cup qualifiers",
  "Eredivisie",
  "Primeira Liga",
  "Championship",
  "FA Cup",
  "Copa del Rey",
  "DFB-Pokal",
  "Coppa Italia",
  "Allsvenskan",
  "Eliteserien",
  "MLS",
  "Metal Ligaen",
  "NHL",
  "NBA",
  "NFL",
  "ATP",
  "WTA",
  "Herreligaen (håndbold)",
];

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Match details typed by hand (any sport/league) + the pick builder using the typed team names. */
export function ManualMatchFields() {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Default the date to today in the user's own timezone (set after mount so server and browser agree).
  useEffect(() => setDate((d) => d || localDate(new Date())), []);

  // date + time are in the user's local time → send an exact ISO timestamp to the server.
  const kickoff = date && time ? new Date(`${date}T${time}`) : null;
  const kickoffIso = kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff.toISOString() : "";
  const inPast = kickoff ? kickoff.getTime() <= Date.now() : false;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sport">
          <select name="sport" className={inputCls} defaultValue="Football">
            {SPORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="League / tournament" hint="Pick a suggestion or type any league">
          <input name="league" list="league-suggestions" placeholder="e.g. Superliga" autoComplete="off" className={inputCls} />
          <datalist id="league-suggestions">
            {LEAGUE_SUGGESTIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        <Field label="Home team / player 1">
          <input name="home_team" required maxLength={80} value={home} onChange={(e) => setHome(e.target.value)} placeholder="e.g. FC København" className={inputCls} />
        </Field>
        <Field label="Away team / player 2">
          <input name="away_team" required maxLength={80} value={away} onChange={(e) => setAway(e.target.value)} placeholder="e.g. Brøndby" className={inputCls} />
        </Field>
        <Field label="Date">
          <input type="date" name="kickoff_date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Kickoff time" hint={inPast ? undefined : "Your local time"}>
          <input type="time" name="kickoff_time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          {inPast && <span className="block text-xs text-loss">That time has already passed – tips must be posted before kickoff.</span>}
        </Field>
      </div>
      <input type="hidden" name="kickoff_at" value={kickoffIso} />

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">What are you betting on?</legend>
        <SelectionInput home={home.trim() || undefined} away={away.trim() || undefined} />
      </fieldset>
    </>
  );
}
