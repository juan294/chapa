import { type NextRequest, NextResponse } from "next/server";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const safeHandle = escapeXml(handle);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" rx="16" fill="#0F1720" stroke="rgba(230,237,243,0.12)" stroke-width="2"/>
  <text x="60" y="80" font-family="Inter, system-ui, sans-serif" font-size="42" font-weight="700" fill="#39FF88">CHAPA</text>
  <text x="60" y="120" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#9AA4B2">Developer Impact Badge</text>
  <text x="60" y="340" font-family="Inter, system-ui, sans-serif" font-size="28" fill="#E6EDF3">@${safeHandle}</text>
  <text x="60" y="400" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#9AA4B2">Badge coming soon — data pipeline not yet connected.</text>
  <text x="60" y="590" font-family="Inter, system-ui, sans-serif" font-size="12" fill="#9AA4B2">Powered by GitHub</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
