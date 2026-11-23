"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

/** A field that opens the phone's keyboard (or picker wheel) when focused. */
function opensKeyboard(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.matches("textarea, select, [contenteditable='true']")) return true;
  return el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "hidden"].includes(el.type);
}

/**
 * True while the user is typing on a touch screen. iPhone doesn't shrink the page for the keyboard –
 * it slides the page under it, and a fixed bottom bar then scrolls along with the content.
 * So the bar steps aside while the keyboard is up (it would be hidden behind it anyway).
 */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const update = () => setTyping(opensKeyboard(document.activeElement));
    const onFocusIn = (e: FocusEvent) => opensKeyboard(e.target as Element) && setTyping(true);
    // focus may move straight to the next field – check where it landed
    const onFocusOut = () => window.setTimeout(update, 50);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return typing;
}

/** Fixed tab bar at the bottom of the screen on phones. "Nyt spil" is a normal tab, just in the accent colour. */
export function BottomTabs() {
  const pathname = usePathname();
  const typing = useTyping();
  const [first, second, third] = TABS;
  const tab = (t: { href: string; label: string; icon: string }, highlight = false) => {
    const active = isActive(pathname, t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={`relative flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2 text-[11px] font-medium transition ${
          active || highlight ? "text-accent" : "text-muted"
        }`}
      >
        {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" aria-hidden />}
        <Icon d={t.icon} />
        {t.label}
      </Link>
    );
  };
  return (
    <nav
      data-bottom-tabs
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden ${typing ? "hidden" : ""}`}
    >
      <div className="mx-auto flex max-w-md items-stretch px-1">
        {tab(first)}
        {tab(second)}
        {tab({ href: "/new", label: "Nyt spil", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8" }, true)}
        {tab(third)}
      </div>
    </nav>
  );
}
