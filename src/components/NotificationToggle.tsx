"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "gamblers-notify-prompt-dismissed";

type State =
  | "loading"
  | "unsupported" // browser can't do web push
  | "needs-install" // iPhone: only works once the app is on the home screen
  | "blocked" // the user said no in the browser – must be re-allowed in settings
  | "off"
  | "on";

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * 🔔 Notifications for new spilforslag, per device.
 *  · variant "card"   – full on/off control (profile page)
 *  · variant "prompt" – a dismissible nudge on the feed, shown only while it's still off
 */
export function NotificationToggle({ variant = "card" }: { variant?: "card" | "prompt" }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      } catch {
        // private mode
      }
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

      if (!VAPID_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (ios && !standalone) return setState("needs-install");
      if (Notification.permission === "denied") return setState("blocked");

      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        setState("on");
        // keep the database in sync (e.g. after switching account on this device)
        const j = sub.toJSON();
        if (j.endpoint && j.keys?.p256dh && j.keys?.auth) {
          void savePushSubscription({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, userAgent: ua });
        }
      } else {
        setState("off");
      }
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_KEY!) }));
      const j = sub.toJSON();
      if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("The browser didn't return a subscription.");
      const res = await savePushSubscription({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, userAgent: navigator.userAgent });
      if (res.error) {
        await sub.unsubscribe().catch(() => {});
        throw new Error(res.error);
      }
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  // ───────── feed nudge ─────────
  if (variant === "prompt") {
    if (state !== "off" || dismissed) return null;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="text-2xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Get notified about new spilforslag</p>
          <p className="text-sm text-muted">A notification on this device when a friend posts.</p>
          {error && <p className="text-xs text-loss">{error}</p>}
        </div>
        <button type="button" onClick={turnOn} disabled={busy} className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
          {busy ? "…" : "Turn on"}
        </button>
        <button type="button" onClick={dismiss} aria-label="Hide" className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-subtle hover:text-ink">
          ✕
        </button>
      </div>
    );
  }

  // ───────── profile card ─────────
  const text: Record<State, string> = {
    loading: "Checking this device…",
    unsupported: "This browser doesn't support notifications. Try Chrome, Edge or Firefox – or the installed app on your phone.",
    "needs-install": "On iPhone, notifications only work in the installed app: in Safari tap Share → Add to Home Screen, open Gamblers from the home screen, then turn them on here.",
    blocked: "Notifications are blocked for this site. Allow them in your browser's site settings (the lock icon in the address bar), then reload.",
    off: "Get a notification on this device when a friend posts a new spilforslag.",
    on: "You get a notification on this device when a friend posts a new spilforslag.",
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold">🔔 Notifications {state === "on" && <span className="ml-1 rounded-full bg-win-soft px-2 py-0.5 text-xs font-medium text-win">On</span>}</p>
        <p className="text-sm text-muted">{text[state]}</p>
        {error && <p className="mt-1 text-sm text-loss">{error}</p>}
      </div>
      {state === "off" && (
        <button type="button" onClick={turnOn} disabled={busy} className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
          {busy ? "…" : "Turn on"}
        </button>
      )}
      {state === "on" && (
        <button type="button" onClick={turnOff} disabled={busy} className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-2 hover:bg-subtle disabled:opacity-60">
          {busy ? "…" : "Turn off"}
        </button>
      )}
    </div>
  );
}
