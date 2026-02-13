/**
 * Font loading for OG image generation.
 *
 * Lazily loads JetBrains Mono Bold and Plus Jakarta Sans SemiBold
 * as ArrayBuffers for use with Satori / ImageResponse.
 * Fonts are cached after first load.
 */

let _fonts: Promise<[ArrayBuffer, ArrayBuffer]> | null = null;

export function loadOgFonts(): Promise<[ArrayBuffer, ArrayBuffer]> {
  if (!_fonts) {
    _fonts = Promise.all([
      fetch(
        new URL("../../assets/fonts/JetBrainsMono-Bold.ttf", import.meta.url),
      ).then((res) => res.arrayBuffer()),
      fetch(
        new URL(
          "../../assets/fonts/PlusJakartaSans-SemiBold.ttf",
          import.meta.url,
        ),
      ).then((res) => res.arrayBuffer()),
    ]);
  }
  return _fonts;
}
