/**
 * A bookmaker's logo = its website's icon, via Google's free favicon service.
 * Works for any bookmaker with a URL in the database, so new ones get a logo automatically.
 */
export function bookmakerLogo(url: string | null | undefined, size: 32 | 64 | 128 = 64): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return null;
  }
}

/** "Other" goes last; everything else keeps the database order. */
export function sortBookmakers<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(a.name === "Other") - Number(b.name === "Other"));
}
