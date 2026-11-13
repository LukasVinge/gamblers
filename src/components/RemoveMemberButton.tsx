"use client";

import { useRef } from "react";
import { removeMember } from "@/app/actions";

/** Admin-only: remove a member, with a confirmation dialog. */
export function RemoveMemberButton({
  groupId,
  userId,
  username,
  tipCount,
}: {
  groupId: string;
  userId: string;
  username: string;
  tipCount: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md px-2 py-1 text-xs text-muted hover:bg-loss-soft hover:text-loss"
      >
        Remove
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <form action={removeMember} className="space-y-4 p-5">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="username" value={username} />

          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Remove @{username}?</h2>
            <p className="text-sm text-muted">
              They&apos;re out of Gamblers right away and disappear from the leaderboard. Their login still exists, but
              they can&apos;t see anything.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-subtle p-3 text-sm">
            <input type="checkbox" name="deleteTips" className="mt-0.5 h-4 w-4 accent-loss" />
            <span>
              <span className="font-medium">Also delete their spilforslag</span>
              <span className="block text-xs text-muted">
                {tipCount === 0
                  ? "They haven't posted any."
                  : `${tipCount} ${tipCount === 1 ? "tip" : "tips"} – can't be undone. Leave unticked to keep them in the history as “former member”.`}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl bg-subtle p-3 text-sm">
            <input type="checkbox" name="resetInvite" className="mt-0.5 h-4 w-4 accent-accent" />
            <span>
              <span className="font-medium">Reset the invite link</span>
              <span className="block text-xs text-muted">
                Stops them re-joining with the old link. You&apos;ll need to send the new link to anyone you still want to invite.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-subtle"
            >
              Cancel
            </button>
            <button className="rounded-lg bg-loss px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Remove @{username}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
