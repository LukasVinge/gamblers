import { settleTip } from "@/app/actions";
import { STATUS_LABEL } from "@/lib/format";
import type { TipStatus } from "@/lib/types";

const OPTIONS: { status: TipStatus; cls: string }[] = [
  { status: "won", cls: "bg-win-soft text-win ring-1 ring-win/20 hover:bg-win hover:text-white" },
  { status: "lost", cls: "bg-loss-soft text-loss ring-1 ring-loss/20 hover:bg-loss hover:text-white" },
  { status: "void", cls: "bg-subtle text-ink-2 ring-1 ring-line hover:bg-line" },
  { status: "half_won", cls: "bg-win-soft text-win ring-1 ring-win/20 hover:bg-win hover:text-white" },
  { status: "half_lost", cls: "bg-loss-soft text-loss ring-1 ring-loss/20 hover:bg-loss hover:text-white" },
];

/** Result buttons for the tipster or a group admin. `back` = where to return after saving. */
export function SettleForm({ tipId, current, back }: { tipId: string; current: TipStatus; back: string }) {
  return (
    <form action={settleTip} className="space-y-2 border-t border-line pt-3">
      <input type="hidden" name="tipId" value={tipId} />
      <input type="hidden" name="back" value={back} />
      <p className="text-xs text-muted">{current === "pending" ? "Set result" : "Change result"}</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.filter((o) => o.status !== current).map((o) => (
          <button key={o.status} name="status" value={o.status} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${o.cls}`}>
            {STATUS_LABEL[o.status]}
          </button>
        ))}
        {current !== "pending" && (
          <button name="status" value="pending" className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-ink-2">
            Reset to pending
          </button>
        )}
      </div>
    </form>
  );
}
