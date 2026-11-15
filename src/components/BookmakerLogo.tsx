import { bookmakerLogo } from "@/lib/bookmakerLogo";

/** The bookmaker's icon, or a neutral rounded square with initials (e.g. for "Other"). */
export function BookmakerLogo({ name, url, size = 20 }: { name: string; url?: string | null; size?: number }) {
  // Always the large icon: for some sites Google's smaller sizes are only 16 px and look blurry.
  const src = bookmakerLogo(url, 128);
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.22) };
  if (!src) {
    return (
      <span
        aria-hidden
        className="inline-grid shrink-0 place-items-center bg-subtle font-semibold text-muted ring-1 ring-line"
        style={{ ...style, fontSize: Math.max(8, size * 0.42) }}
      >
        {name === "Other" ? "…" : name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 object-contain ring-1 ring-line" style={style} />
  );
}
