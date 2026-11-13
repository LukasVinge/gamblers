// Ready-to-paste messages for group chats. The link is appended by the share sheet.
import { effectiveOdds, fmtKickoff, fmtOdds, fmtStake, fmtUnits, tipProfit } from "./format";
import type { LeaderboardRow, TipView } from "./types";

const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽",
  "Ice hockey": "🏒",
  Tennis: "🎾",
  Handball: "🤾",
  Basketball: "🏀",
  "American football": "🏈",
  Esports: "🎮",
};

export function sportEmoji(sport: string) {
  return SPORT_EMOJI[sport] ?? "🎯";
}

function oddsText(t: TipView) {
  return t.boosted_odds ? `${fmtOdds(effectiveOdds(t))} 🚀 (boosted from ${fmtOdds(t.odds)})` : fmtOdds(t.odds);
}

function resultLine(t: TipView) {
  const p = tipProfit(t);
  switch (t.status) {
    case "won":
    case "half_won":
      return `✅ ${t.status === "won" ? "WON" : "HALF WON"} ${fmtUnits(p ?? 0)}`;
    case "lost":
    case "half_lost":
      return `❌ ${t.status === "lost" ? "LOST" : "HALF LOST"} ${fmtUnits(p ?? 0)}`;
    case "void":
      return "↩️ VOID – stake returned";
    default:
      return null;
  }
}

/** One tip, e.g. for WhatsApp:
 *  🎯 FCK to win @ 2.10
 *  ⚽ FCK vs Brøndby · Sun 16 Nov, 14:00
 *  🏦 Danske Spil · Stake 2/10 · @bob
 */
export function tipMessage(t: TipView) {
  const lines = [
    resultLine(t),
    `🎯 ${t.selection} @ ${oddsText(t)}`,
    `${sportEmoji(t.sport)} ${t.home_team} vs ${t.away_team} · ${fmtKickoff(t.kickoff_at)}`,
    `🏦 ${t.bookmaker_name} · Stake ${fmtStake(t.stake_units)} · @${t.author_username}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** All open tips in one message (links included per tip). */
export function openTipsDigest(groupName: string, tips: TipView[], tipUrl: (t: TipView) => string) {
  const body = tips
    .map(
      (t, i) =>
        `${i + 1}. ${sportEmoji(t.sport)} ${t.home_team} vs ${t.away_team} (${fmtKickoff(t.kickoff_at)})\n` +
        `   ${t.selection} @ ${oddsText(t)} · ${t.bookmaker_name} · ${fmtStake(t.stake_units)} · @${t.author_username}\n` +
        `   ${tipUrl(t)}`,
    )
    .join("\n\n");
  return `📋 Open tips in ${groupName} (${tips.length})\n\n${body}`;
}

export function leaderboardMessage(groupName: string, periodLabel: string, rows: LeaderboardRow[], rankedCount: number) {
  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
  const lines = rows.map((r, i) => {
    const roi = r.roi === null ? "—" : `${r.roi > 0 ? "+" : ""}${Number(r.roi).toFixed(1)}%`;
    const pos = i < rankedCount ? medal(i) : "·";
    return `${pos} @${r.username}  ROI ${roi} · ${fmtUnits(r.profit)} · ${r.wins}–${r.losses}–${r.voids}`;
  });
  return `🏆 ${groupName} – ${periodLabel}\n\n${lines.join("\n")}`;
}

export function inviteMessage(groupName: string) {
  return `Join my betting league "${groupName}" 🎯\nWe post our tips, track every hit and miss, and see who has the best ROI. Sign up here 👇`;
}
