/** Local review artifacts only; never writes a tracked sample or publishes.
 * pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/scoring/render-observed-badges.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// resvg is owned by the web workspace; resolve it from that package both at
// runtime and without widening the root scripts' production dependencies.
const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { renderAsync } = webRequire("@resvg/resvg-js") as {
  renderAsync(svg: string, options: { fitTo: { mode: "width"; value: number }; font: { loadSystemFonts: boolean; fontFiles: string[] } }): Promise<{ asPng(): Uint8Array }>;
};
import { scoringConsistencyFixture } from "../../apps/web/lib/profile/__fixtures__/scoring-consistency";
import { renderBadgeSvg } from "../../apps/web/lib/render/BadgeSvg";
import { resolveFontFiles } from "../../apps/web/lib/render/font-files";
import { buildBadgeI18nStrings } from "../../apps/web/lib/render/badge-i18n-strings";
import { resolveTranslation } from "../../apps/web/lib/i18n/resolve";
import { en } from "../../apps/web/lib/i18n/dictionaries/en";
import { es } from "../../apps/web/lib/i18n/dictionaries/es";

export async function renderObservedBadges(directory = "logs/v7-point/phase6-badges"): Promise<string> {
  const output = resolve(directory);
  await mkdir(output, { recursive: true });
  const fonts = resolveFontFiles();
  if (fonts.some(font => !font.found)) throw new Error("Missing bundled raster fonts");
  const cases = [
    { name: "four-core", craft: "none" },
    { name: "craft57", craft: 57 },
    { name: "craft0", craft: 0 },
    { name: "expired", craft: "expired" },
    { name: "boundary", craft: 57, boundary: true },
  ] as const;
  const cards: string[] = [];
  for (const example of cases) {
    const fixture = await scoringConsistencyFixture(example);
    for (const locale of ["en", "es"] as const) {
      const name = `${example.name}-${locale}`;
      const svg = renderBadgeSvg(fixture.stats, {
        scoring: fixture.model, demoMode: true, disableAnimation: true,
        strings: buildBadgeI18nStrings(key => resolveTranslation(key, locale === "en" ? en : es), fixture.model.tier),
      });
      await writeFile(resolve(output, `${name}.svg`), svg);
      for (const width of [1200, 320]) {
        const raster = await renderAsync(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false, fontFiles: fonts.map(font => font.path) } });
        await writeFile(resolve(output, `${name}-${width}.png`), raster.asPng());
      }
      cards.push(`<figure><figcaption>${name} — illustrative receipt</figcaption><img src="${name}-320.png" width="320" alt="${name}"></figure>`);
    }
  }
  await writeFile(resolve(output, "index.html"), `<!doctype html><meta charset="utf-8"><title>Observed badge review</title><style>body{margin:0;font:14px system-ui}section{padding:24px;display:flex;flex-wrap:wrap;gap:16px}.dark{background:#111;color:#eee}.light{background:#fafafa;color:#111}figure{margin:0}figcaption{margin-bottom:8px}img{display:block;max-width:100%}</style><section class="light">${cards.join("")}</section><section class="dark">${cards.join("")}</section>`);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  renderObservedBadges(process.argv[2]).then(output => process.stdout.write(`${output}\n`)).catch(error => { console.error(error); process.exitCode = 1; });
}
