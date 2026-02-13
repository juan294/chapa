/**
 * Font loading for OG image generation.
 *
 * Lazily loads JetBrains Mono Bold and Plus Jakarta Sans SemiBold
 * as ArrayBuffers for use with Satori / ImageResponse.
 * Fonts are cached after first successful load.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

let _fonts: [ArrayBuffer, ArrayBuffer] | null = null;

export async function loadOgFonts(): Promise<[ArrayBuffer, ArrayBuffer]> {
  if (_fonts) return _fonts;

  const fontsDir = join(process.cwd(), "assets", "fonts");
  const [heading, body] = await Promise.all([
    readFile(join(fontsDir, "JetBrainsMono-Bold.ttf")),
    readFile(join(fontsDir, "PlusJakartaSans-SemiBold.ttf")),
  ]);

  _fonts = [heading.buffer as ArrayBuffer, body.buffer as ArrayBuffer];
  return _fonts;
}
