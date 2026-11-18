import { ImageResponse } from "next/og";
import { fmtKickoff, fmtOdds, fmtStake, STATUS_LABEL } from "@/lib/format";
import type { SharedTip } from "@/lib/sharedTip";
import { bookmakerLogo } from "@/lib/bookmakerLogo";
import { promoBadge } from "@/lib/promos";

// The preview image for a shared tip (Messenger, WhatsApp, Discord, …). 1200×630.

export const TIP_IMAGE_SIZE = { width: 1200, height: 630 };

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

/** Room for the pick between the match line and the bottom row (odds · bookmaker · stake · tipster). */
const PICK_BOX = { width: 1000, height: 156 };
const LINE_HEIGHT = 1.25; // tighter clips the bottom of letters like "g"
/** Average width of a bold character relative to the font size, plus slack for word wrapping. */
const CHAR_WIDTH = 0.6;

/**
 * Picks the biggest font size at which the text fits in the pick box, so long bet builders shrink
 * instead of running into the bottom row. Text that doesn't fit even at the smallest size is cut with "…".
 */
export function fitPick(text: string): { fontSize: number; text: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const sizes = [64, 56, 48, 42, 36, 32];
  const capacity = (size: number) => {
    const perLine = Math.floor(PICK_BOX.width / (size * CHAR_WIDTH));
    const lines = Math.floor(PICK_BOX.height / (size * LINE_HEIGHT));
    return perLine * lines;
  };
  for (const size of sizes) {
    if (clean.length <= capacity(size)) return { fontSize: size, text: clean };
  }
  const smallest = sizes[sizes.length - 1];
  const max = capacity(smallest) - 1;
  const cut = clean.slice(0, max);
  const atWord = cut.lastIndexOf(" ") > max * 0.7 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return { fontSize: smallest, text: `${atWord.replace(/[,\s]+$/, "")}…` };
}

function shorten(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function Crest({ src }: { src: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={56} height={56} style={{ objectFit: "contain" }} alt="" />;
}

export function renderNotFoundImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.page, color: C.ink, fontSize: 72, fontWeight: 900, alignItems: "center", justifyContent: "center", letterSpacing: -2 }}>
        GAMBLERS
      </div>
    ),
    TIP_IMAGE_SIZE,
  );
}

export function renderTipImage(tip: SharedTip, baseUrl?: string) {
  const st = STATUS_STYLE[tip.status];
  const legs = tip.legs ?? [];
  const isCombo = legs.length > 1;
  const pick = fitPick(isCombo ? legs.map((l) => l.selection).join(" + ") : tip.selection);
  const badge = promoBadge(tip);
  const logo = bookmakerLogo(tip.bookmaker_url, 128, baseUrl);

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

          {isCombo ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28, fontSize: 32, color: C.ink, fontWeight: 600 }}>
                {`Kombi · ${legs.length} kampe`}
              </div>
              <div style={{ display: "flex", fontSize: 26, color: C.muted, marginTop: 6 }}>
                {shorten(legs.map((l) => `${l.home_team}–${l.away_team}`).join(", "), 70)}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28, fontSize: 32, color: C.muted }}>
                <Crest src={tip.home_logo} />
                <span style={{ color: C.ink, fontWeight: 600 }}>{shorten(tip.home_team, 26)}</span>
                <span>vs</span>
                <Crest src={tip.away_logo} />
                <span style={{ color: C.ink, fontWeight: 600 }}>{shorten(tip.away_team, 26)}</span>
              </div>
              <div style={{ display: "flex", fontSize: 26, color: C.muted, marginTop: 6 }}>
                {tip.league ? `${shorten(tip.league, 40)} · ` : ""}
                {fmtKickoff(tip.kickoff_at)}
              </div>
            </>
          )}

          {/* The pick: sized to fit, and clipped as a last resort so it never covers the bottom row */}
          <div
            style={{
              display: "flex",
              marginTop: 18,
              maxHeight: PICK_BOX.height + 8,
              paddingBottom: 4,
              overflow: "hidden",
              fontSize: pick.fontSize,
              fontWeight: 800,
              lineHeight: LINE_HEIGHT,
              letterSpacing: -1,
            }}
          >
            {pick.text}
          </div>

          <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", gap: 56 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              {badge ? (
                <span style={{ fontSize: 22, fontWeight: 800, color: "#7c3aed", background: "#f1eafe", borderRadius: 8, padding: "4px 10px" }}>{badge}</span>
              ) : null}
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                {tip.boosted_odds ? (
                  <span style={{ fontSize: 36, color: C.muted, textDecoration: "line-through" }}>{fmtOdds(tip.odds)}</span>
                ) : null}
                <span style={{ fontSize: 96, fontWeight: 800, color: C.accent, letterSpacing: -2, lineHeight: 1 }}>{fmtOdds(tip.boosted_odds ?? tip.odds)}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 6 }}>
              <span style={{ fontSize: 22, color: C.muted }}>Bookmaker</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} width={36} height={36} style={{ borderRadius: 8 }} alt="" />
                ) : null}
                <span style={{ fontSize: 34, fontWeight: 700 }}>{tip.bookmaker_name}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 6 }}>
              <span style={{ fontSize: 22, color: C.muted }}>Stake</span>
              <span style={{ fontSize: 34, fontWeight: 700 }}>{fmtStake(tip.stake_units)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 6, marginLeft: "auto" }}>
              {tip.author_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tip.author_avatar} width={64} height={64} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: C.muted }}>Tipster</span>
                <span style={{ fontSize: 34, fontWeight: 700 }}>@{shorten(tip.author_username, 16)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    TIP_IMAGE_SIZE,
  );
}
