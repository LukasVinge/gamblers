import Link from "next/link";
import type { BookmakerOption } from "./BetFields";
import { BookmakerLogo } from "./BookmakerLogo";

/**
 * Show spilforslag from one or more betting sites. Each chip toggles that site on/off (?bm=2,14);
 * "Alle sites" clears the filter. One row that scrolls sideways on a phone.
 */
export function BookmakerFilter({ bookmakers, selected, view }: { bookmakers: BookmakerOption[]; selected: number[]; view: string }) {
  const href = (ids: number[]) => `/?view=${view}${ids.length ? `&bm=${ids.join(",")}` : ""}`;
  const chip = "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition";
  const on = "bg-accent-soft text-accent-ink ring-2 ring-accent";
  const off = "bg-surface text-ink-2 ring-line hover:ring-line-strong";

  return (
    // Phones: one row you swipe sideways. Wider screens: the chips wrap onto more lines, so none are hidden
    // (a mouse can't easily scroll a row sideways).
    <nav aria-label="Filter by betting site" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="flex w-max gap-2 p-0.5 sm:w-auto sm:flex-wrap">
        <Link href={href([])} aria-current={selected.length === 0 ? "true" : undefined} className={`${chip} ${selected.length === 0 ? on : off}`}>
          Alle sites
        </Link>
        {bookmakers.map((b) => {
          const active = selected.includes(b.id);
          const next = active ? selected.filter((x) => x !== b.id) : [...selected, b.id];
          return (
            <Link key={b.id} href={href(next)} aria-pressed={active} className={`${chip} ${active ? on : off}`}>
              <BookmakerLogo name={b.name} url={b.url} size={18} />
              {b.name}
              {active && <span aria-hidden className="text-xs">✕</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
