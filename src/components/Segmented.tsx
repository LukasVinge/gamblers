import Link from "next/link";
import type { ReactNode } from "react";

// iOS-style segmented control: one rounded bar split into equal parts.
// SegmentedLinks navigates (server pages); segmentClass is reused by client-side buttons.

export const segmentBarClass = "grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-subtle p-1 ring-1 ring-line";

export function segmentClass(active: boolean) {
  return `flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
    active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
  }`;
}

export type Segment = { key: string; href: string; label: ReactNode; title?: string };

export function SegmentedLinks({ items, active, className = "" }: { items: Segment[]; active: string; className?: string }) {
  return (
    <nav className={`${segmentBarClass} ${className}`}>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          title={it.title}
          aria-current={it.key === active ? "page" : undefined}
          className={segmentClass(it.key === active)}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** League logo on phones, logo + name from tablet width up. */
export function LeagueLabel({ code, name }: { code: string; name: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://crests.football-data.org/${code}.png`} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain sm:h-[18px] sm:w-[18px]" />
      <span className="sr-only sm:not-sr-only sm:truncate">{name}</span>
    </>
  );
}
