"use client";

import { useRef, useState, useTransition } from "react";
import { addComment, deleteComment, toggleReaction } from "@/app/actions";
import { REACTIONS, type Reaction, type ReactionCounts, type TipComment } from "@/lib/social";
import type { TailUser } from "@/lib/tails";
import { Avatar } from "./Avatar";
import { TailButton } from "./TailButton";

/** "nu", "5 min", "3 t", "2 d", or a date. */
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "nu";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} t`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" }).format(new Date(iso));
}

/** 🔥 💰 😬 🤡 – tap to react, tap again to take it back. Counts update at once, saved in the background. */
function ReactionBar({ tipId, initial }: { tipId: string; initial: ReactionCounts }) {
  const [counts, setCounts] = useState(initial);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function toggle(r: Reaction) {
    const before = counts;
    const on = !counts[r].mine;
    setError("");
    setCounts({ ...counts, [r]: { count: counts[r].count + (on ? 1 : -1), mine: on } });
    startTransition(async () => {
      const res = await toggleReaction(tipId, r, on);
      if (res.error) {
        setCounts(before);
        setError(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reaktioner">
        {REACTIONS.map((r) => {
          const c = counts[r.id];
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              aria-pressed={c.mine}
              aria-label={`${r.label}${c.count ? ` (${c.count})` : ""}`}
              title={r.label}
              className={`inline-flex h-8 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 text-sm ring-1 transition active:scale-95 ${
                c.mine ? "bg-accent-soft text-accent-ink ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong"
              }`}
            >
              <span aria-hidden>{r.emoji}</span>
              {c.count > 0 && <span className="font-mono text-xs font-semibold">{c.count}</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="w-full text-xs text-loss">{error}</p>}
    </>
  );
}

/** The comment thread: the newest few (or all), delete for your own (admin: all), and a field to write. */
function Comments({
  tipId,
  initial,
  me,
  isAdmin,
  collapsedCount,
}: {
  tipId: string;
  initial: TipComment[];
  me: TailUser | null;
  isAdmin: boolean;
  collapsedCount: number;
}) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = open ? list : list.slice(-collapsedCount);
  const hidden = list.length - shown.length;

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || pending || !me) return;
    const temp: TipComment = { id: `tmp-${Date.now()}`, author_id: me.user_id, username: me.username, avatar_url: me.avatar_url, body, created_at: new Date().toISOString() };
    setError("");
    setText("");
    setList((l) => [...l, temp]);
    startTransition(async () => {
      const res = await addComment(tipId, body);
      if (res.comment) {
        setList((l) => l.map((c) => (c.id === temp.id ? res.comment! : c)));
      } else {
        setList((l) => l.filter((c) => c.id !== temp.id));
        setText(body);
        setError(res.error ?? "Kunne ikke gemme.");
      }
    });
  }

  function remove(c: TipComment) {
    const before = list;
    setList(list.filter((x) => x.id !== c.id));
    startTransition(async () => {
      const res = await deleteComment(c.id);
      if (res.error) {
        setList(before);
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-2.5">
      {hidden > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-muted hover:text-ink">
          Se alle {list.length} kommentarer
        </button>
      )}
      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((c) => {
            const canDelete = !c.id.startsWith("tmp-") && (c.author_id === me?.user_id || isAdmin);
            return (
              <li key={c.id} className="group flex items-start gap-2">
                <Avatar url={c.avatar_url} name={c.username} size={24} />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-subtle px-3 py-1.5">
                  <p className="flex items-baseline gap-1.5 text-xs">
                    <span className="font-semibold text-ink">@{c.username}</span>
                    <span className="text-muted">{c.id.startsWith("tmp-") ? "sender…" : ago(c.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-line break-words text-sm text-ink-2">{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label="Slet kommentar"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle hover:text-loss"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {me && (
        <form onSubmit={send} className="flex items-center gap-2">
          <Avatar url={me.avatar_url} name={me.username} size={24} />
          <label className="sr-only" htmlFor={`comment-${tipId}`}>
            Skriv en kommentar
          </label>
          <input
            ref={inputRef}
            id={`comment-${tipId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Skriv en kommentar…"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {text.trim() && (
            <button type="submit" disabled={pending} className="h-9 shrink-0 rounded-full bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
              Send
            </button>
          )}
        </form>
      )}
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}

/**
 * Everything social under a tip: 🤝 "I'm on it", reactions and the comment thread.
 * Without `social` (database not set up yet) only "I'm on it" shows, as before.
 */
export function TipSocial({
  tipId,
  tails,
  me,
  canTail,
  social,
  isAdmin = false,
  collapsedCount = 2,
}: {
  tipId: string;
  tails: TailUser[];
  me: TailUser | null;
  canTail: boolean;
  social: { comments: TipComment[]; reactions: ReactionCounts } | null;
  isAdmin?: boolean;
  /** comments shown before "Se alle" (the feed: 2; the tip's own page: all) */
  collapsedCount?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TailButton tipId={tipId} users={tails} me={me} canTail={canTail} />
        {social && <ReactionBar tipId={tipId} initial={social.reactions} />}
      </div>
      {social && <Comments tipId={tipId} initial={social.comments} me={me} isAdmin={isAdmin} collapsedCount={collapsedCount} />}
    </div>
  );
}
