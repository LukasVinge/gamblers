/**
 * Logos we host ourselves (public/bookmakers/…), so they always load fast – Google's favicon service
 * is sometimes slow or blocked on phones. Key = the bookmaker's domain without "www.".
 */
const LOCAL_LOGOS: Record<string, string> = {
  "danskespil.dk": "/bookmakers/danskespil.dk.png",
  "bet365.dk": "/bookmakers/bet365.dk.png",
  "unibet.dk": "/bookmakers/unibet.dk.png",
  "betano.dk": "/bookmakers/betano.dk.png",
  "leovegas.dk": "/bookmakers/leovegas.dk.png",
  "betsson.dk": "/bookmakers/betsson.dk.png",
  "nordicbet.dk": "/bookmakers/nordicbet.dk.png",
  "mrgreen.dk": "/bookmakers/mrgreen.dk.png",
  "bwin.dk": "/bookmakers/bwin.dk.png",
  "coolbet.dk": "/bookmakers/coolbet.dk.jpg",
  "expekt.dk": "/bookmakers/expekt.dk.png",
  "bet25.dk": "/bookmakers/bet25.dk.png",
  "stake.dk": "/bookmakers/stake.dk.png",
};

/** Bookmakers with no usable icon anywhere – shown as a letter tile instead of a blurry/empty image. */
const NO_LOGO = new Set(["betfair.com"]);

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * A bookmaker's logo. Our own copy when we have one; otherwise the website's icon via Google's
 * favicon service, so a bookmaker added later still gets a logo automatically.
 * absoluteBase: needed where a full URL is required (the share image).
 */
export function bookmakerLogo(url: string | null | undefined, size: 32 | 64 | 128 = 64, absoluteBase?: string): string | null {
  if (!url) return null;
  const host = hostOf(url);
  if (!host || NO_LOGO.has(host)) return null;
  const local = LOCAL_LOGOS[host];
  if (local) return absoluteBase ? `${absoluteBase}${local}` : local;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

/** "Other" goes last; everything else keeps the database order. */
export function sortBookmakers<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(a.name === "Other") - Number(b.name === "Other"));
}
