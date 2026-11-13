"use client";

import { useMemo, useState } from "react";
import { matchesQuery, norm } from "@/lib/search";
import { inputCls } from "./ui";

export type SquadPlayer = { name: string; team: string; position: string | null };

type Mode = "1x2" | "player" | "other";

const MARKETS = [
  { key: "goal", label: "Goal", max: 3 },
  { key: "assist", label: "Assist", max: 2 },
  { key: "goal_or_assist", label: "Goal or assist", max: 0 },
  { key: "shots", label: "Shots", max: 5 },
  { key: "sot", label: "Shots on target", max: 4 },
  { key: "fouls_committed", label: "Fouls committed", max: 4 },
  { key: "fouls_won", label: "Fouls won", max: 4 },
] as const;
type MarketKey = (typeof MARKETS)[number]["key"];

/** Turns the choices into the pick text stored on the tip, e.g. "Haaland 2+ shots on target". */
function playerPick(player: string, market: MarketKey, count: number) {
  const p = player.trim();
  if (!p) return "";
  switch (market) {
    case "goal":
      return count === 1 ? `${p} to score` : `${p} ${count}+ goals`;
    case "assist":
      return count === 1 ? `${p} to assist` : `${p} ${count}+ assists`;
    case "goal_or_assist":
      return `${p} goal or assist`;
    case "shots":
      return `${p} ${count}+ ${count === 1 ? "shot" : "shots"}`;
    case "sot":
      return `${p} ${count}+ ${count === 1 ? "shot" : "shots"} on target`;
    case "fouls_committed":
      return `${p} ${count}+ ${count === 1 ? "foul" : "fouls"} committed`;
    case "fouls_won":
      return `${p} ${count}+ ${count === 1 ? "foul" : "fouls"} won`;
  }
}

const POS_SHORT: Record<string, string> = { Offence: "FW", Midfield: "MF", Defence: "DF", Goalkeeper: "GK" };

function chip(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm ring-1 transition ${
    active ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong"
  }`;
}

/** Builds the "pick" for a spilforslag: 1X2, a player bet, or free text. Submits as `selection`. */
export function SelectionInput({
  home,
  away,
  players = [],
  initial,
}: {
  home?: string;
  away?: string;
  players?: SquadPlayer[];
  /** Existing pick when editing: 1X2 picks reopen on the 1 X 2 tab, anything else under "Other". */
  initial?: string;
}) {
  const initialResult =
    initial === (home ? `${home} to win` : "Home win") ? "1" : initial === "Draw" ? "X" : initial === (away ? `${away} to win` : "Away win") ? "2" : null;
  const [mode, setMode] = useState<Mode>(initial && !initialResult ? "other" : "1x2");
  const [result, setResult] = useState<"1" | "X" | "2" | null>(initialResult);
  const [player, setPlayer] = useState("");
  const [showList, setShowList] = useState(false);
  const [market, setMarket] = useState<MarketKey>("goal");
  const [count, setCount] = useState(1);
  const [other, setOther] = useState(initial && !initialResult ? initial : "");

  const homeName = home ?? "Home";
  const awayName = away ?? "Away";

  const indexed = useMemo(() => players.map((p) => ({ p, text: norm(`${p.name} ${p.team}`) })), [players]);
  const suggestions = useMemo(
    () => (player.trim() ? indexed.filter(({ text }) => matchesQuery(text, player)).slice(0, 8).map(({ p }) => p) : []),
    [indexed, player],
  );

  const marketDef = MARKETS.find((m) => m.key === market)!;

  const selection =
    mode === "1x2"
      ? result === "1"
        ? home ? `${home} to win` : "Home win"
        : result === "X"
          ? "Draw"
          : result === "2"
            ? away ? `${away} to win` : "Away win"
            : ""
      : mode === "player"
        ? playerPick(player, market, count)
        : other.trim();

  return (
    <div className="space-y-4">
      <input type="hidden" name="selection" value={selection} />

      <div className="flex gap-1 rounded-xl bg-subtle p-1 ring-1 ring-line">
        {(
          [
            ["1x2", "1 X 2"],
            ["player", "Player"],
            ["other", "Other"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === k ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "1x2" && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["1", homeName],
              ["X", "Draw"],
              ["2", awayName],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setResult(k)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-3 ring-1 transition ${
                result === k ? "bg-accent text-white ring-accent" : "bg-surface text-ink ring-line hover:ring-line-strong"
              }`}
            >
              <span className="text-lg font-bold">{k}</span>
              <span className={`w-full truncate text-xs ${result === k ? "text-white/85" : "text-muted"}`}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {mode === "player" && (
        <div className="space-y-4">
          <div className="relative">
            <input
              value={player}
              onChange={(e) => {
                setPlayer(e.target.value);
                setShowList(true);
              }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
              placeholder={players.length ? "Search player – e.g. Kane, Saka…" : "Player name"}
              aria-label="Player"
              autoComplete="off"
              className={inputCls}
            />
            {showList && suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
                {suggestions.map((p) => (
                  <li key={`${p.team}-${p.name}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPlayer(p.name);
                        setShowList(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent-soft"
                    >
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {p.team}
                        {p.position && POS_SHORT[p.position] ? ` · ${POS_SHORT[p.position]}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMarket(m.key);
                  setCount((c) => Math.min(Math.max(c, 1), Math.max(m.max, 1)));
                }}
                className={chip(market === m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {marketDef.max > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">How many</span>
              {Array.from({ length: marketDef.max }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)} className={`${chip(count === n)} min-w-11 font-mono`}>
                  {n}+
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "other" && (
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          maxLength={200}
          placeholder="e.g. Over 2.5 goals, both teams to score, 10+ corners"
          aria-label="Your pick"
          className={inputCls}
        />
      )}

      <div className="rounded-xl bg-accent-soft px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-accent-ink/70">Your pick</p>
        <p className={`text-lg font-semibold ${selection ? "text-accent-ink" : "text-accent-ink/40"}`}>
          {selection || (mode === "player" ? "Choose a player and a bet" : mode === "1x2" ? "Tap 1, X or 2" : "Write your pick")}
        </p>
      </div>
    </div>
  );
}
