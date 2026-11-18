import type { TipStatus, TipView } from "./types";

export const STATUS_LABEL: Record<TipStatus, string> = {
  pending: "Pending",
  won: "Won",
  lost: "Lost",
  void: "Void",
  half_won: "Half won",
  half_lost: "Half lost",
};

export const STATUS_CLASS: Record<TipStatus, string> = {
  pending: "bg-warn-soft text-warn ring-warn/30",
  won: "bg-win-soft text-win ring-win/30",
  half_won: "bg-win-soft text-win ring-win/30",
  lost: "bg-loss-soft text-loss ring-loss/30",
  half_lost: "bg-loss-soft text-loss ring-loss/20",
  void: "bg-subtle text-ink-2 ring-line",
};

export const SPORTS = ["Football", "Ice hockey", "Tennis", "Handball", "Basketball", "American football", "Esports", "Other"];

export function effectiveOdds(t: Pick<TipView, "odds" | "boosted_odds">) {
  return Number(t.boosted_odds ?? t.odds);
}

/** Profit in units for a settled tip, null while pending. Same formula as the SQL leaderboard. */
export function tipProfit(t: Pick<TipView, "odds" | "boosted_odds" | "stake_units" | "status">): number | null {
  const s = Number(t.stake_units);
  const o = effectiveOdds(t);
  switch (t.status) {
    case "won":
      return s * (o - 1);
    case "half_won":
      return (s * (o - 1)) / 2;
    case "lost":
      return -s;
    case "half_lost":
      return -s / 2;
    case "void":
      return 0;
    default:
      return null;
  }
}

export function fmtOdds(n: number) {
  return Number(n).toFixed(2);
}

export function fmtUnits(n: number) {
  const v = Number(n);
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}u`;
}

export function fmtStake(n: number) {
  return `${Number(n).toString()}/10`;
}

export function fmtKickoff(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // always 24-hour (17:35), whatever the phone's own setting
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

export function profitClass(n: number | null) {
  if (n === null || n === 0) return "text-ink-2";
  return n > 0 ? "text-win" : "text-loss";
}
