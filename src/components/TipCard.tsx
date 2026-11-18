import Link from "next/link";
import type { ReactNode } from "react";
import type { TipView } from "@/lib/types";
import { fmtKickoff, fmtOdds, fmtStake, fmtUnits, profitClass, STATUS_CLASS, STATUS_LABEL, tipProfit } from "@/lib/format";
import { tipMessage, sportEmoji } from "@/lib/shareText";
import { promoBadge } from "@/lib/promos";
import { isCombo } from "@/lib/types";
import { ComboLegs } from "./ComboLegs";
import { ShareSheet } from "./ShareSheet";
import { Avatar } from "./Avatar";
import { BookmakerLogo } from "./BookmakerLogo";
import { TeamLogo } from "./TeamLogo";
import { Card } from "./ui";

export function StatusBadge({ status }: { status: TipView["status"] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TipCard({
  tip,
  linkToShare = true,
  showReasoning = false,
  shareUrl,
  social,
  children,
}: {
  tip: TipView;
  linkToShare?: boolean;
  /** true = full comment, "clamp" = first 3 lines (feed), false = hidden */
  showReasoning?: boolean | "clamp";
  /** When set, shows a one-tap Share button with a ready-made chat message. */
  shareUrl?: string;
  /** "🤝 I'm on it" row (shown under the pick). */
  social?: ReactNode;
  children?: ReactNode;
}) {
  const profit = tipProfit(tip);
  const badge = promoBadge(tip);
  const combo = isCombo(tip);
  const hasLogos = Boolean(tip.home_logo || tip.away_logo);
  const selection = <span className="text-lg font-semibold leading-snug text-ink">{tip.selection}</span>;

  return (
    <Card className="overflow-hidden">
      {/* Match bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-subtle/70 px-4 py-2.5 text-xs">
        {combo ? (
          <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-2">
            <span aria-hidden>🧩</span>
            {linkToShare ? (
              <Link href={`/t/${tip.share_slug}`} className="hover:underline">
                Kombi · {tip.legs!.length} kampe
              </Link>
            ) : (
              <>Kombi · {tip.legs!.length} kampe</>
            )}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink-2">
            {hasLogos ? <TeamLogo src={tip.home_logo} name={tip.home_team} size={18} /> : <span aria-hidden>{sportEmoji(tip.sport)}</span>}
            <span className="truncate">{tip.home_team}</span>
            <span className="text-faint">vs</span>
            {hasLogos && <TeamLogo src={tip.away_logo} name={tip.away_team} size={18} />}
            <span className="truncate">{tip.away_team}</span>
          </span>
        )}
        <span className="shrink-0 text-muted">
          {combo ? "Første kamp " : tip.league ? `${tip.league} · ` : ""}
          {fmtKickoff(tip.kickoff_at)}
        </span>
      </div>

      {/* Pick + odds */}
      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0 space-y-1">
          {combo ? null : linkToShare ? (
            <Link href={`/t/${tip.share_slug}`} className="hover:underline">
              {selection}
            </Link>
          ) : (
            selection
          )}
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Avatar url={tip.author_avatar} name={tip.author_username} size={20} />
            @{tip.author_username}
            {tip.edited_at && <span className="text-faint"> · edited</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-xl bg-accent-soft px-3 py-1.5 font-mono text-xl font-bold text-accent-ink">
            {fmtOdds(tip.boosted_odds ?? tip.odds)}
          </span>
          {badge && (
            <span className="flex items-center gap-1 text-[11px]">
              {tip.boosted_odds && <span className="text-muted line-through">{fmtOdds(tip.odds)}</span>}
              <span className="whitespace-nowrap rounded bg-boost-soft px-1 font-bold text-boost">{badge}</span>
            </span>
          )}
        </div>
      </div>

      {/* Combo: the matches get the full card width, so team names aren't squeezed next to the odds */}
      {combo && (
        <div className="-mt-1 px-4 pb-4">
          <ComboLegs legs={tip.legs!} />
        </div>
      )}

      {/* The tipster's own comment ("Why?"): in full on the tip's page, max 3 lines in the feed */}
      {showReasoning !== false && tip.reasoning && (
        <div className="mx-4 mb-4 rounded-lg bg-subtle p-3 text-sm text-ink-2">
          <p className={`whitespace-pre-line ${showReasoning === "clamp" ? "line-clamp-3" : ""}`} title={showReasoning === "clamp" ? tip.reasoning : undefined}>
            <span aria-hidden>💬 </span>
            {tip.reasoning}
          </p>
        </div>
      )}

      {social && <div className="px-4 pb-3">{social}</div>}

      {/* Meta + result */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span className="inline-flex items-center gap-1.5">
            <BookmakerLogo name={tip.bookmaker_name} url={tip.bookmaker_url} size={18} />
            {tip.bookmaker_url ? (
              <a href={tip.bookmaker_url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink-2 hover:underline">
                {tip.bookmaker_name}
              </a>
            ) : (
              <span className="font-medium text-ink-2">{tip.bookmaker_name}</span>
            )}
          </span>
          <span>Stake {fmtStake(tip.stake_units)}</span>
          <StatusBadge status={tip.status} />
          {profit !== null && <span className={`font-mono font-semibold ${profitClass(profit)}`}>{fmtUnits(profit)}</span>}
        </div>
        {shareUrl && <ShareSheet size="sm" title="Share this tip" message={tipMessage(tip)} url={shareUrl} />}
      </div>

      {children && <div className="px-4 pb-3">{children}</div>}
    </Card>
  );
}
