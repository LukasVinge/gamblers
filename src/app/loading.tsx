// Shown instantly when you switch page (Spilforslag ↔ Kampprogram ↔ Leaderboard …) while the
// real content loads, so taps feel immediate instead of the screen appearing frozen.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-44 rounded-lg bg-line" />
        <div className="h-4 w-64 max-w-full rounded bg-line/70" />
      </div>
      <div className="h-10 rounded-xl bg-line/70 sm:w-80" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="h-10 border-b border-line bg-subtle/70" />
          <div className="flex items-center justify-between gap-4 px-4 py-5">
            <div className="space-y-2">
              <div className="h-5 w-48 rounded bg-line" />
              <div className="h-4 w-28 rounded bg-line/70" />
            </div>
            <div className="h-11 w-20 rounded-xl bg-line/70" />
          </div>
          <div className="h-11 border-t border-line" />
        </div>
      ))}
    </div>
  );
}
