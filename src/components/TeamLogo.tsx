/** Club crest, or a neutral badge with initials when there is no logo. */
export function TeamLogo({ src, name, size = 24 }: { src?: string | null; name: string; size?: number }) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="inline-grid shrink-0 place-items-center rounded-full bg-subtle font-bold text-muted"
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.36) }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // Crests are mixed PNG/SVG from football-data.org – a plain <img> handles both.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />
  );
}
