// Date helpers for fixture lists – always in Danish time, computed on the server
// so the labels never flip between server and browser.
const TZ = "Europe/Copenhagen";

/** YYYY-MM-DD in Danish time. */
export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

export const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(iso));

/** "Today", "Tomorrow" or e.g. "Saturday 21 November". */
export function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${key}T12:00:00Z`),
  );
}
