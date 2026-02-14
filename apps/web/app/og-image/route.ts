import { NextResponse } from "next/server";
import { svgToPng } from "@/lib/render/svg-to-png";

/**
 * GET /og-image
 *
 * Generates the root OpenGraph image — a branded social card at 1200x630.
 * Uses the same SVG→PNG pipeline as the share page OG image.
 */
export async function GET() {
  try {
    const svg = renderOgSvg();
    const png = svgToPng(svg, 1200);

    return new NextResponse(Buffer.from(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    console.error("[og-image] failed to generate root OG image:", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}

function renderOgSvg(): string {
  const W = 1200;
  const H = 630;

  // Theme colors (badge dark theme)
  const bg = "#0C0D14";
  const card = "#13141E";
  const accent = "#7C6AEF";
  const accentLight = "#9D8FFF";
  const textPrimary = "#E6EDF3";
  const textSecondary = "#9AA4B2";
  const stroke = "rgba(124,106,239,0.12)";

  // Sample heatmap grid (decorative, bottom-left area)
  const heatmapColors = [
    "rgba(124,106,239,0.06)",
    "rgba(124,106,239,0.20)",
    "rgba(124,106,239,0.38)",
    "rgba(124,106,239,0.58)",
    "rgba(124,106,239,0.85)",
  ];

  // Generate a decorative heatmap pattern (7 rows x 15 cols)
  const heatRows = 7;
  const heatCols = 15;
  const cellSize = 18;
  const cellGap = 4;
  const heatX = 60;
  const heatY = 340;

  // Seeded pattern for consistent rendering
  const pattern = [
    [0, 0, 1, 0, 0, 2, 1, 0, 0, 1, 2, 3, 1, 0, 0],
    [0, 1, 2, 1, 0, 1, 3, 2, 1, 0, 1, 4, 3, 1, 0],
    [1, 2, 3, 2, 1, 0, 2, 4, 3, 2, 1, 3, 4, 2, 1],
    [0, 1, 4, 3, 2, 1, 3, 4, 4, 3, 2, 4, 3, 2, 0],
    [1, 2, 3, 4, 3, 2, 4, 3, 4, 4, 3, 2, 2, 1, 0],
    [0, 1, 2, 3, 2, 1, 2, 3, 3, 2, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0],
  ];

  let heatmapSvg = "";
  for (let r = 0; r < heatRows; r++) {
    for (let c = 0; c < heatCols; c++) {
      const x = heatX + c * (cellSize + cellGap);
      const y = heatY + r * (cellSize + cellGap);
      const level = pattern[r]?.[c] ?? 0;
      heatmapSvg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="${heatmapColors[level]}"/>`;
    }
  }

  // Decorative radar chart (right side)
  const radarCX = 900;
  const radarCY = 340;
  const radarR = 120;
  const dims = [0.85, 0.6, 0.9, 0.7]; // sample dimension values
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const radarPoints = dims
    .map((d, i) => {
      const angle = angles[i] ?? 0;
      const x = radarCX + radarR * d * Math.cos(angle - Math.PI / 2);
      const y = radarCY + radarR * d * Math.sin(angle - Math.PI / 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Radar axis lines
  const radarAxes = angles
    .map((a) => {
      const x = radarCX + radarR * Math.cos(a - Math.PI / 2);
      const y = radarCY + radarR * Math.sin(a - Math.PI / 2);
      return `<line x1="${radarCX}" y1="${radarCY}" x2="${x}" y2="${y}" stroke="${stroke}" stroke-width="1"/>`;
    })
    .join("");

  // Radar grid rings
  const radarRings = [0.33, 0.66, 1.0]
    .map(
      (s) =>
        `<circle cx="${radarCX}" cy="${radarCY}" r="${radarR * s}" fill="none" stroke="${stroke}" stroke-width="1"/>`,
    )
    .join("");

  // Dimension labels
  const dimLabels = [
    { label: "Building", angle: -Math.PI / 2 },
    { label: "Guarding", angle: 0 },
    { label: "Consistency", angle: Math.PI / 2 },
    { label: "Breadth", angle: Math.PI },
  ];
  const dimLabelsSvg = dimLabels
    .map((d) => {
      const labelR = radarR + 24;
      const x = radarCX + labelR * Math.cos(d.angle);
      const y = radarCY + labelR * Math.sin(d.angle);
      const anchor =
        Math.abs(d.angle) < 0.1 || Math.abs(d.angle - Math.PI) < 0.1
          ? "middle"
          : d.angle > 0 && d.angle < Math.PI
            ? "start"
            : "end";
      return `<text x="${x}" y="${y}" fill="${textSecondary}" font-family="JetBrains Mono, monospace" font-size="11" text-anchor="${anchor}" dominant-baseline="middle">${d.label}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="accent-glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${bg}" rx="0"/>

  <!-- Subtle accent glow (top-right) -->
  <ellipse cx="${W - 100}" cy="80" rx="400" ry="250" fill="url(#accent-glow)"/>

  <!-- Card panel -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="24" fill="${card}" stroke="${stroke}" stroke-width="1"/>

  <!-- Logo: Chapa_ -->
  <text x="80" y="130" fill="${textPrimary}" font-family="JetBrains Mono, monospace" font-size="72" font-weight="800" letter-spacing="-2">Chapa<tspan fill="${accent}">_</tspan></text>

  <!-- Tagline -->
  <text x="80" y="175" fill="${textSecondary}" font-family="Plus Jakarta Sans, sans-serif" font-size="22" font-weight="500">Developer Impact, Decoded</text>

  <!-- Dimension pills -->
  <g font-family="JetBrains Mono, monospace" font-size="12" font-weight="500">
    <rect x="80" y="210" width="110" height="30" rx="15" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.25" stroke-width="1"/>
    <text x="135" y="230" fill="${accentLight}" text-anchor="middle">Building</text>

    <rect x="200" y="210" width="115" height="30" rx="15" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.25" stroke-width="1"/>
    <text x="257" y="230" fill="${accentLight}" text-anchor="middle">Guarding</text>

    <rect x="325" y="210" width="135" height="30" rx="15" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.25" stroke-width="1"/>
    <text x="392" y="230" fill="${accentLight}" text-anchor="middle">Consistency</text>

    <rect x="470" y="210" width="105" height="30" rx="15" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.25" stroke-width="1"/>
    <text x="522" y="230" fill="${accentLight}" text-anchor="middle">Breadth</text>
  </g>

  <!-- Decorative subtitle -->
  <text x="80" y="310" fill="${textSecondary}" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="400">4 dimensions &middot; 6 archetypes &middot; 12 months of GitHub activity</text>

  <!-- Heatmap (decorative) -->
  ${heatmapSvg}

  <!-- Radar chart (decorative) -->
  ${radarRings}
  ${radarAxes}
  <polygon points="${radarPoints}" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
  ${radarPoints.split(" ").map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="4" fill="${accent}"/>`).join("")}
  ${dimLabelsSvg}

  <!-- Bottom bar -->
  <text x="80" y="${H - 68}" fill="${textSecondary}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="400">chapa.thecreativetoken.com</text>

  <!-- Powered by GitHub -->
  <g transform="translate(${W - 260}, ${H - 82})">
    <text x="24" y="14" fill="${textSecondary}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="400">Powered by GitHub</text>
  </g>
</svg>`;
}
