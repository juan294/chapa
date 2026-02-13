import { ImageResponse } from "next/og";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { isValidHandle } from "@/lib/validation";
import { loadOgFonts } from "@/lib/render/fonts";
import type { DeveloperArchetype, ImpactTier } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Next.js OG image convention exports
// ---------------------------------------------------------------------------

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Chapa Developer Impact Badge";

// ---------------------------------------------------------------------------
// Theme constants (matches badge theme)
// ---------------------------------------------------------------------------

const T = {
  bg: "#0C0D14",
  card: "#13141E",
  textPrimary: "#E6EDF3",
  textSecondary: "#9AA4B2",
  accent: "#7C6AEF",
  stroke: "rgba(124,106,239,0.12)",
} as const;

const TIER_COLORS: Record<ImpactTier, string> = {
  Emerging: "#9AA4B2",
  Solid: "#E6EDF3",
  High: "#9D8FFF",
  Elite: "#7C6AEF",
};

const ARCHETYPE_COLORS: Record<DeveloperArchetype, string> = {
  Builder: "#7C6AEF",
  Guardian: "#F472B6",
  Marathoner: "#4ADE80",
  Polymath: "#FBBF24",
  Balanced: "#E6EDF3",
  Emerging: "#9AA4B2",
};

// ---------------------------------------------------------------------------
// OG Image handler
// ---------------------------------------------------------------------------

/**
 * Safely load all data needed for OG image rendering.
 * Returns the resolved data or a string error message for the fallback.
 */
type OgDataSuccess = {
  ok: true;
  stats: NonNullable<Awaited<ReturnType<typeof getStats>>>;
  impact: ReturnType<typeof computeImpactV4>;
  fonts: [ArrayBuffer, ArrayBuffer];
};
type OgDataError = {
  ok: false;
  error: string;
  fonts: [ArrayBuffer, ArrayBuffer] | null;
};

async function loadOgData(handle: string): Promise<OgDataSuccess | OgDataError> {
  let fonts: [ArrayBuffer, ArrayBuffer];
  try {
    fonts = await loadOgFonts();
  } catch (e) {
    console.error("[og-image] font load failed:", e);
    return { ok: false, error: "Font load failed", fonts: null };
  }

  if (!isValidHandle(handle)) {
    return { ok: false, error: "Invalid GitHub handle", fonts };
  }

  try {
    const stats = await getStats(handle);
    if (!stats) return { ok: false, error: "Could not load data", fonts };
    const impact = computeImpactV4(stats);
    return { ok: true, stats, impact, fonts };
  } catch (e) {
    console.error("[og-image] data fetch failed:", e);
    return { ok: false, error: "Could not generate image", fonts };
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const data = await loadOgData(handle);

  if (!data.ok) {
    if (!data.fonts) return renderMinimalFallback(handle);
    return renderFallback(handle, data.error, data.fonts[0], data.fonts[1]);
  }

  const [fontHeading, fontBody] = data.fonts;
  const { impact, stats } = data;

  const tierColor = TIER_COLORS[impact.tier];
  const archetypeColor = ARCHETYPE_COLORS[impact.archetype];

  const dimensions: { label: string; value: number }[] = [
    { label: "Building", value: impact.dimensions.building },
    { label: "Guarding", value: impact.dimensions.guarding },
    { label: "Consistency", value: impact.dimensions.consistency },
    { label: "Breadth", value: impact.dimensions.breadth },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: T.bg,
          padding: "48px 56px",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        {/* Purple accent line at top */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: `linear-gradient(90deg, ${T.accent}, ${T.accent}88, transparent)`,
          }}
        />

        {/* Left column: avatar + identity + branding */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "420px",
            paddingRight: "40px",
          }}
        >
          {/* Avatar + handle */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {stats.avatarUrl ? (
                <img
                  src={stats.avatarUrl}
                  alt=""
                  width={80}
                  height={80}
                  style={{ borderRadius: "50%", border: `3px solid ${T.stroke}` }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    backgroundColor: T.card,
                    border: `3px solid ${T.stroke}`,
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono",
                    fontSize: "28px",
                    color: T.textPrimary,
                  }}
                >
                  @{handle}
                </span>
                {stats.displayName && (
                  <span
                    style={{
                      fontSize: "16px",
                      color: T.textSecondary,
                      marginTop: "4px",
                    }}
                  >
                    {stats.displayName}
                  </span>
                )}
              </div>
            </div>

            {/* Archetype tag */}
            <div
              style={{
                display: "flex",
                marginTop: "24px",
              }}
            >
              <span
                style={{
                  fontFamily: "JetBrains Mono",
                  fontSize: "14px",
                  color: archetypeColor,
                  backgroundColor: `${archetypeColor}18`,
                  padding: "6px 16px",
                  borderRadius: "6px",
                  border: `1px solid ${archetypeColor}30`,
                }}
              >
                {impact.archetype}
              </span>
            </div>

            {/* Stats pills */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "20px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: T.textSecondary,
                }}
              >
                {stats.commitsTotal} commits
              </span>
              <span style={{ fontSize: "13px", color: T.textSecondary }}>
                {stats.prsMergedCount} PRs
              </span>
              <span style={{ fontSize: "13px", color: T.textSecondary }}>
                {stats.reviewsSubmittedCount} reviews
              </span>
            </div>
          </div>

          {/* Bottom: Chapa branding */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: "20px",
                color: T.accent,
              }}
            >
              CHAPA
            </span>
            <span style={{ fontSize: "13px", color: T.textSecondary }}>
              Developer Impact Badge
            </span>
          </div>
        </div>

        {/* Vertical divider */}
        <div
          style={{
            display: "flex",
            width: "1px",
            backgroundColor: T.stroke,
            marginTop: "8px",
            marginBottom: "8px",
          }}
        />

        {/* Right column: score + dimensions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            paddingLeft: "48px",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Score + tier */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "36px",
            }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: "96px",
                color: tierColor,
                lineHeight: 1,
              }}
            >
              {impact.adjustedComposite}
            </span>
            <span
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: "18px",
                color: tierColor,
                marginTop: "8px",
                letterSpacing: "4px",
                textTransform: "uppercase",
              }}
            >
              {impact.tier}
            </span>
          </div>

          {/* Dimension bars */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              width: "100%",
              maxWidth: "480px",
            }}
          >
            {dimensions.map((dim) => (
              <div
                key={dim.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: T.textSecondary,
                    width: "100px",
                    textAlign: "right",
                  }}
                >
                  {dim.label}
                </span>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    height: "10px",
                    backgroundColor: `${T.accent}15`,
                    borderRadius: "5px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${dim.value}%`,
                      height: "100%",
                      backgroundColor: T.accent,
                      borderRadius: "5px",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "JetBrains Mono",
                    fontSize: "14px",
                    color: T.textPrimary,
                    width: "32px",
                    textAlign: "right",
                  }}
                >
                  {dim.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "JetBrains Mono", data: fontHeading, style: "normal", weight: 700 },
        { name: "Plus Jakarta Sans", data: fontBody, style: "normal", weight: 600 },
      ],
    },
  );
}

// ---------------------------------------------------------------------------
// Fallback image for errors
// ---------------------------------------------------------------------------

function renderFallback(
  handle: string,
  message: string,
  fontHeading: ArrayBuffer,
  fontBody: ArrayBuffer,
) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          backgroundColor: T.bg,
          fontFamily: "Plus Jakarta Sans",
          gap: "16px",
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono",
            fontSize: "36px",
            color: T.accent,
          }}
        >
          CHAPA
        </span>
        <span
          style={{
            fontFamily: "JetBrains Mono",
            fontSize: "24px",
            color: T.textPrimary,
          }}
        >
          @{handle}
        </span>
        <span style={{ fontSize: "16px", color: T.textSecondary }}>
          {message}
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "JetBrains Mono", data: fontHeading, style: "normal", weight: 700 },
        { name: "Plus Jakarta Sans", data: fontBody, style: "normal", weight: 600 },
      ],
    },
  );
}

/**
 * Ultra-minimal fallback when even fonts fail to load — no custom fonts needed.
 */
function renderMinimalFallback(handle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: T.bg,
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <span style={{ fontSize: "36px", color: T.accent }}>CHAPA</span>
        <span style={{ fontSize: "20px", color: T.textSecondary }}>
          @{handle}
        </span>
      </div>
    ),
    { ...size },
  );
}
