"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Shown as the dialog heading. */
  title: string;
  /** Pre-written message; the user can edit it before sharing. */
  message: string;
  /** Link appended under the message (optional – e.g. a digest already contains links). */
  url?: string;
  /** "inline" renders the panel directly; "button" renders a button that opens it in a dialog. */
  variant?: "inline" | "button";
  label?: string;
  size?: "sm" | "md";
  primary?: boolean;
  /** Optional QR code (SVG markup) – handy for inviting people sitting next to you. */
  qrSvg?: string;
};

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

export function ShareSheet({ title, message, url, variant = "button", label = "Share", size = "md", primary = false, qrSvg }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (variant === "inline") return <SharePanel message={message} url={url} title={title} qrSvg={qrSvg} />;

  const btn =
    size === "sm"
      ? "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-line hover:bg-subtle hover:text-ink"
      : primary
        ? "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        : "inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-line-strong hover:bg-subtle";

  return (
    <>
      <button type="button" className={btn} onClick={() => dialogRef.current?.showModal()}>
        <ShareIcon />
        {label}
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{title}</h2>
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg px-2 py-1 text-muted hover:bg-subtle hover:text-ink" aria-label="Close">
              ✕
            </button>
          </div>
          <SharePanel message={message} url={url} title={title} qrSvg={qrSvg} />
        </div>
      </dialog>
    </>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.99-.88c.17-.07.36-.09.54-.04.91.25 1.88.39 2.89.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm5.95 7.46-2.94 4.66c-.47.74-1.47.93-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66c.47-.74 1.47-.93 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63z" />
    </svg>
  );
}

function SharePanel({ message, url, title, qrSvg }: { message: string; url?: string; title: string; qrSvg?: string }) {
  const [text, setText] = useState(message);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState<"" | "msg" | "link">("");
  const [showQr, setShowQr] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    const ua = navigator.userAgent;
    setIsPhone(/Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
  }, []);

  const full = url ? `${text.trim()}\n${url}` : text.trim();
  const enc = encodeURIComponent;

  async function copy(value: string, which: "msg" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", value);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share(url ? { title, text: text.trim(), url } : { title, text: full });
    } catch {
      // cancelled
    }
  }

  /** Phone only: open the Messenger app with the link (the full message is copied too, to paste if wanted). */
  async function shareMessenger() {
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      // clipboard not allowed – the link is still shared
    }
    setNotice(
      url
        ? "Opening Messenger… The message text is copied too – paste it in the chat if you want it. If nothing opens, open Messenger yourself and paste."
        : "Message copied ✓ – opening Messenger, pick a chat and paste.",
    );
    window.location.href = url ? `fb-messenger://share/?link=${enc(url)}` : "fb-messenger://";
  }

  const tile =
    "flex items-center justify-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-line";

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Message</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(10, text.split("\n").length + 1)}
          className="w-full resize-y rounded-xl border border-line bg-subtle p-3 text-sm leading-relaxed text-ink focus:border-accent focus:outline-none"
        />
        {url && <span className="mt-1 block truncate font-mono text-xs text-accent">{url}</span>}
        <span className="mt-1 block text-xs text-muted">You can edit the message before sending.</span>
      </label>

      {isPhone && (
        <button
          type="button"
          onClick={shareMessenger}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0084FF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0074e0]"
        >
          <MessengerIcon />
          Send via Messenger
        </button>
      )}

      <button
        type="button"
        onClick={() => copy(full, "msg")}
        className={isPhone ? `${tile} w-full` : "flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover"}
      >
        {copied === "msg" ? "Copied ✓ – paste it in your chat" : "Copy message"}
      </button>

      {isPhone && canShare && (
        <button type="button" onClick={nativeShare} className="w-full text-center text-sm text-muted hover:text-ink">
          Other apps…
        </button>
      )}

      {notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-ink">{notice}</p>}

      {qrSvg && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowQr((v) => !v)} className="text-xs text-muted hover:text-ink">
            {showQr ? "Hide QR code" : "Show QR code (for friends next to you)"}
          </button>
          {showQr && (
            <div className="mx-auto w-48 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          )}
        </div>
      )}
    </div>
  );
}
