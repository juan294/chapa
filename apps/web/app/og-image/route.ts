import { NextResponse } from "next/server";
import { svgToPng } from "@/lib/render/svg-to-png";

/**
 * GET /og-image
 *
 * Generates the root OpenGraph image — a minimal branded social card at 1200x630.
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

  const bg = "#0C0D14";
  const accent = "#7C6AEF";
  const textPrimary = "#E6EDF3";
  const textSecondary = "#6B6F7B";

  // Heatmap colors — 5 intensity levels of the accent purple
  const heatmapColors = [
    "rgba(124,106,239,0.06)",
    "rgba(124,106,239,0.18)",
    "rgba(124,106,239,0.35)",
    "rgba(124,106,239,0.55)",
    "rgba(124,106,239,0.80)",
  ];

  // Wider heatmap grid: 7 rows x 52 cols (one year of weeks)
  const heatRows = 7;
  const heatCols = 52;
  const cellSize = 14;
  const cellGap = 3;
  const gridW = heatCols * (cellSize + cellGap) - cellGap;
  const heatX = Math.round((W - gridW) / 2);
  const heatY = 340;

  // Seeded pattern — builds an organic contribution shape
  const pattern: number[][] = [];
  for (let r = 0; r < heatRows; r++) {
    const row: number[] = [];
    for (let c = 0; c < heatCols; c++) {
      // Create an organic wave pattern that peaks in the middle
      const cx = heatCols / 2;
      const cy = heatRows / 2;
      const dx = (c - cx) / cx;
      const dy = (r - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Wave function with some variation
      const wave =
        Math.sin(c * 0.3 + r * 0.5) * 0.5 +
        Math.cos(c * 0.15 - r * 0.3) * 0.3 +
        (1 - dist) * 0.6;

      // Fade edges
      const edgeFade = Math.min(c / 4, (heatCols - 1 - c) / 4, 1);
      const val = wave * edgeFade;

      if (val < 0.15) row.push(0);
      else if (val < 0.35) row.push(1);
      else if (val < 0.55) row.push(2);
      else if (val < 0.75) row.push(3);
      else row.push(4);
    }
    pattern.push(row);
  }

  let heatmapSvg = "";
  for (let r = 0; r < heatRows; r++) {
    for (let c = 0; c < heatCols; c++) {
      const x = heatX + c * (cellSize + cellGap);
      const y = heatY + r * (cellSize + cellGap);
      const level = pattern[r]?.[c] ?? 0;
      const color = heatmapColors[level] ?? heatmapColors[0];
      heatmapSvg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${bg}"/>

  <!-- Logo: Chapa_ — centered -->
  <text x="${W / 2}" y="200" fill="${textPrimary}" font-family="JetBrains Mono, monospace" font-size="88" font-weight="800" text-anchor="middle" letter-spacing="-3">Chapa<tspan fill="${accent}">_</tspan></text>

  <!-- Tagline — centered -->
  <text x="${W / 2}" y="260" fill="${textSecondary}" font-family="Plus Jakarta Sans, sans-serif" font-size="24" font-weight="500" text-anchor="middle">Developer Impact, Decoded</text>

  <!-- Heatmap grid — centered, full year width -->
  ${heatmapSvg}

  <!-- URL — bottom center -->
  <text x="${W / 2}" y="${H - 40}" fill="${textSecondary}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="400" text-anchor="middle" opacity="0.6">chapa.thecreativetoken.com</text>
</svg>`;
}
