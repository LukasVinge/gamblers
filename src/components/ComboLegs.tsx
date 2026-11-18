import { fmtKickoff, fmtOdds } from "@/lib/format";
import type { TipLeg } from "@/lib/types";
import { TeamLogo } from "./TeamLogo";

/** The matches on a combo slip: teams + kickoff on a small line, the pick (and its odds) below. */
export function ComboLegs({ legs }: { legs: TipLeg[] }) {
  return (
    <ol className="space-y-2.5">
      {legs.map((l) => (
        <li key={l.position} className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-subtle font-mono text-[11px] font-semibold text-muted">
            {l.position}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-xs text-muted">
              {(l.home_logo || l.away_logo) && <TeamLogo src={l.home_logo} name={l.home_team} size={14} />}
              <span className="truncate">
                {l.home_team} – {l.away_team}
              </span>
              <span className="shrink-0 text-faint">· {fmtKickoff(l.kickoff_at)}</span>
            </p>
            <p className="font-semibold leading-snug text-ink">
              {l.selection}
              {l.odds !== null && <span className="ml-1.5 font-mono text-sm font-medium text-muted">@ {fmtOdds(l.odds)}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
