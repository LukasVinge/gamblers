"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "gamblers-install-hint-dismissed";

/**
 * "Get the app" banner for phone browsers. Hidden when the site already runs as an installed app,
 * on computers, and after the user dismisses it.
 *  · Android/Chrome: an Install button (uses the browser's own install prompt)
 *  · iPhone/iPad: short instructions (Share → Add to Home Screen) – Apple offers no button for it
 */
export function InstallHint() {
  const [mode, setMode] = useState<"hidden" | "ios" | "android">("hidden");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // private mode – just show it
    }
    if (standalone || dismissed) return;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) setMode("ios");
    else if (/Android/i.test(ua)) setMode("android");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
      setMode("android");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setMode("hidden");
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setMode("hidden");
    setInstallEvent(null);
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-semibold text-ink">Get Gamblers as an app</p>
        {mode === "ios" ? (
          <p className="text-sm text-ink-2">
            In Safari, tap <b>Share</b> <span aria-hidden>(the square with an arrow)</span> → <b>Add to Home Screen</b>.
          </p>
        ) : installEvent ? (
          <button type="button" onClick={install} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
            Install app
          </button>
        ) : (
          <p className="text-sm text-ink-2">
            Open the browser menu <b>⋮</b> → <b>Add to Home screen</b> (or <b>Install app</b>).
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Hide" className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-surface hover:text-ink">
        ✕
      </button>
    </div>
  );
}
