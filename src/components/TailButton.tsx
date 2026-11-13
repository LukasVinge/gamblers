"use client";

import { useState, useTransition } from "react";
import { toggleTail } from "@/app/actions";
import type { TailUser } from "@/lib/tails";
import { Avatar } from "./Avatar";

/** "🤝 I'm on it" – shows who is playing a tip too. Toggles instantly, saves in the background. */
export function TailButton({
  tipId,
  users,
  me,
  canTail,
}: {
  tipId: string;
  users: TailUser[];
  me: TailUser | null;
  /** false for your own tip and after kickoff (then it only shows who was on it). */
  canTail: boolean;
}) {
  const [list, setList] = useState(users);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const on = me ? list.some((u) => u.user_id === me.user_id) : false;

  if (!canTail && list.length === 0) return null;

  function toggle() {
    if (!me || pending) return;
    const before = list;
    const join = !on;
    setError("");
    setList(join ? [...list, me] : list.filter((u) => u.user_id !== me.user_id));
    startTransition(async () => {
      const res = await toggleTail(tipId, join);
      if (res.error) {
        setList(before);
        setError(res.error);
      }
    });
  }

  const shown = list.slice(0, 5);
  const extra = list.length - shown.length;
  const names = list.map((u) => `@${u.username}`).join(", ");

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2.5">
        {canTail ? (
          <button
            type="button"
            onClick={toggle}
            disabled={pending || !me}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition active:scale-95 disabled:opacity-70 ${
              on ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line hover:bg-accent-soft hover:ring-accent/40"
            }`}
          >
            <span aria-hidden>🤝</span>
            {on ? "You're on it" : "I'm on it"}
          </button>
        ) : (
          <span className="text-base" aria-hidden>
            🤝
          </span>
        )}

        {list.length > 0 && (
          <span className="flex items-center gap-2" title={names}>
            <span className="flex -space-x-2">
              {shown.map((u) => (
                <Avatar key={u.user_id} url={u.avatar_url} name={u.username} size={24} className="ring-2 ring-surface" />
              ))}
              {extra > 0 && (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-subtle text-[10px] font-semibold text-muted ring-2 ring-surface">
                  +{extra}
                </span>
              )}
            </span>
            <span className="text-xs text-muted">
              {list.length === 1 ? `@${list[0].username} is on it` : `${list.length} on it`}
            </span>
          </span>
        )}
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
