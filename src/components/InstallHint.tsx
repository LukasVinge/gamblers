"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "gamblers-install-hint-dismissed";

type Platform = "ios" | "android" | "desktop";

/**
 * Install Gamblers as an app.
 *  · variant "card"    – dismissible banner (feed + front page), phones only, hidden once installed/dismissed
 *  · variant "profile" – always-visible section on the Profile page: status + steps for this device
 */
export function InstallHint({ variant = "card" }: { variant?: "card" | "profile" }) {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setPlatform(ios ? "ios" : /Android/i.test(ua) ? "android" : "desktop");
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // private mode – just show it
    }
    setReady(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  const steps =
    platform === "ios" ? (
      <>
        Open the site in <b>Safari</b>, tap <b>Share</b> <span aria-hidden>(the square with an arrow)</span> → <b>Add to Home Screen</b>.
      </>
    ) : platform === "android" ? (
      <>
        Open the browser menu <b>⋮</b> → <b>Add to Home screen</b> (or <b>Install app</b>).
      </>
    ) : (
      <>
        On your phone, open <b>ragegamblers.vercel.app</b> and add it to the home screen. On a computer, Chrome and Edge show an
        install icon at the right of the address bar.
      </>
    );

  const installButton = installEvent && (
    <button type="button" onClick={install} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
      Install app
    </button>
  );

  // ───────── Profile: always visible ─────────
  if (variant === "profile") {
    return (
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-semibold">
            📱 App{" "}
            {installed && <span className="ml-1 rounded-full bg-win-soft px-2 py-0.5 text-xs font-medium text-win">Installed ✓</span>}
          </p>
          {installed ? (
            <p className="text-sm text-muted">You&apos;re using Gamblers as an app on this device.</p>
          ) : (
            <>
              <p className="text-sm text-muted">{steps}</p>
              {installButton}
            </>
          )}
        </div>
      </div>
    );
  }

  // ───────── Banner: phones (or when the browser offers install), until installed/dismissed ─────────
  if (installed || dismissed || (platform === "desktop" && !installEvent)) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-semibold text-ink">Get Gamblers as an app</p>
        {installButton ?? <p className="text-sm text-ink-2">{steps}</p>}
      </div>
      <button type="button" onClick={dismiss} aria-label="Hide" className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-surface hover:text-ink">
        ✕
      </button>
    </div>
  );
}
