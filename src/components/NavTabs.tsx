"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Spilforslag", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/kampprogram", label: "Kampprogram", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
  { href: "/leaderboard", label: "Leaderboard", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/t/") : pathname.startsWith(href);
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Tabs inside the top bar (tablet/desktop). */
export function TopTabs() {
  const pathname = usePathname();
  return (
    <nav className="hidden h-full items-stretch gap-1 sm:flex">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center border-b-2 px-3 text-sm font-medium transition ${
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed tab bar at the bottom of the screen on phones, with a "+" for a new spilforslag. */
export function BottomTabs() {
  const pathname = usePathname();
  const [first, second, third] = TABS;
  const tab = (t: (typeof TABS)[number]) => {
    const active = isActive(pathname, t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
      >
        <Icon d={t.icon} />
        {t.label}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-md items-center px-2">
        {tab(first)}
        {tab(second)}
        <Link
          href="/new"
          aria-label="Nyt spilforslag"
          className="mx-1 -mt-5 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-2xl font-light text-white shadow-lg shadow-accent/30 hover:bg-accent-hover"
        >
          +
        </Link>
        {tab(third)}
      </div>
    </nav>
  );
}
