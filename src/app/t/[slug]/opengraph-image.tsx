import { ImageResponse } from "next/og";
import { fmtKickoff, fmtOdds, fmtStake, STATUS_LABEL } from "@/lib/format";
import { getSharedTip } from "@/lib/sharedTip";

// The image shown when a tip link is pasted in Messenger, WhatsApp, Discord, Slack, …
export const alt = "Shared tip on Gamblers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  page: "#f4f5f7",
  surface: "#ffffff",
  line: "#e3e7ec",
  ink: "#0f172a",
  muted: "#64748b",
  accent: "#2563eb",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fdf2e1", fg: "#b45309" },
  won: { bg: "#e6f5ec", fg: "#15803d" },
  half_won: { bg: "#e6f5ec", fg: "#15803d" },
  lost: { bg: "#fdecec", fg: "#c62828" },
  half_lost: { bg: "#fdecec", fg: "#c62828" },
  void: { bg: "#f1f3f6", fg: "#334155" },
};

function Crest({ src }: { src: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={56} height={56} style={{ objectFit: "contain" }} alt="" />;
}

export default async function Image({ params }: { params: { slug: string } | Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tip = await getSharedTip(slug);

  if (!tip) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: C.page, color: C.ink, fontSize: 72, fontWeight: 900, alignItems: "center", justifyContent: "center", letterSpacing: -2 }}>
          GAMBLERS
        </div>
      ),
      size,
    );
  }

  const st = STATUS_STYLE[tip.status];

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.page, padding: 40, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.surface, border: `2px solid ${C.line}`, borderRadius: 32, padding: 48, color: C.ink }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>GAMBLERS</span>
            <span style={{ display: "flex", fontSize: 26, fontWeight: 700, padding: "8px 20px", borderRadius: 999, background: st.bg, color: st.fg }}>
              {STATUS_LABEL[tip.status]}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, fontSize: 32, color: C.muted }}>
            <Crest src={tip.home_logo} />
            <span style={{ color: C.ink, fontWeight: 600 }}>{tip.home_team}</span>
            <span>vs</span>
            <Crest src={tip.away_logo} />
            <span style={{ color: C.ink, fontWeight: 600 }}>{tip.away_team}</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: C.muted, marginTop: 8 }}>
            {tip.league ? `${tip.league} · ` : ""}
            {fmtKickoff(tip.kickoff_at)}
          </div>

          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.1, marginTop: 28, letterSpacing: -1 }}>{tip.selection}</div>

          <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", gap: 56 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              {tip.boosted_odds ? (
                <span style={{ fontSize: 36, color: C.muted, textDecoration: "line-through" }}>{fmtOdds(tip.odds)}</span>
              ) : null}
              <span style={{ fontSize: 96, fontWeight: 800, color: C.accent, letterSpacing: -2 }}>{fmtOdds(tip.boosted_odds ?? tip.odds)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 14 }}>
              <span style={{ fontSize: 22, color: C.muted }}>Bookmaker</span>
              <span style={{ fontSize: 34, fontWeight: 700 }}>{tip.bookmaker_name}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 14 }}>
              <span style={{ fontSize: 22, color: C.muted }}>Stake</span>
              <span style={{ fontSize: 34, fontWeight: 700 }}>{fmtStake(tip.stake_units)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 14, marginLeft: "auto" }}>
              {tip.author_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tip.author_avatar} width={64} height={64} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: C.muted }}>Tipster</span>
                <span style={{ fontSize: 34, fontWeight: 700 }}>@{tip.author_username}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
