import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-line-strong hover:bg-subtle";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Notice({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ${
        error ? "bg-loss-soft text-loss ring-loss/30" : "bg-win-soft text-win ring-win/30"
      }`}
    >
      {error ?? notice}
    </div>
  );
}

