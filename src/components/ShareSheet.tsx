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

function SharePanel({ message, url, title, qrSvg }: { message: string; url?: string; title: string; qrSvg?: string }) {
  const [text, setText] = useState(message);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState<"" | "msg" | "link">("");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
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

  const apps = [
    { name: "WhatsApp", dot: "bg-[#25D366]", href: `https://wa.me/?text=${enc(full)}` },
    { name: "Telegram", dot: "bg-[#229ED9]", href: url ? `https://t.me/share/url?url=${enc(url)}&text=${enc(text.trim())}` : `https://t.me/share/url?url=${enc(" ")}&text=${enc(full)}` },
    { name: "SMS", dot: "bg-faint", href: `sms:?&body=${enc(full)}` },
  ];

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

      {canShare && (
        <button type="button" onClick={nativeShare} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover">
          <ShareIcon />
          Share to Messenger, Discord, …
        </button>
      )}

      <div className="grid grid-cols-3 gap-2">
        {apps.map((a) => (
          <a key={a.name} href={a.href} target="_blank" rel="noopener noreferrer" className={tile}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.dot}`} aria-hidden />
            {a.name}
          </a>
        ))}
      </div>

      <div className={`grid gap-2 ${url ? "grid-cols-2" : "grid-cols-1"}`}>
        <button type="button" onClick={() => copy(full, "msg")} className={tile}>
          {copied === "msg" ? "Copied ✓" : "Copy message"}
        </button>
        {url && (
          <button type="button" onClick={() => copy(url, "link")} className={tile}>
            {copied === "link" ? "Copied ✓" : "Copy link only"}
          </button>
        )}
      </div>

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
