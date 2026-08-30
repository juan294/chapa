import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";

/**
 * The Jade palette (#1206) converted the app, and #1225 converted the badge
 * SVG, but the six served brand assets kept the retired violet until #1229.
 * They are static files, so nothing else in the test suite reads them and a
 * revert would be invisible until someone looked at a browser tab.
 *
 * `public/favicon.svg` is the single source for both raster icons. To change
 * the mark, edit that file and regenerate the rasters from it:
 *
 *   rsvg-convert -w 512 -h 512 apps/web/public/favicon.svg \
 *     -o apps/web/public/logo-512.png
 *   # apps/web/app/favicon.ico packs the same SVG at 16px and 32px, one
 *   # embedded PNG per ICO directory entry.
 *
 * `app/icon.tsx` and `app/apple-icon.tsx` render the mark dynamically and
 * already carry the accent, so they need no regeneration. Note that
 * `app/layout.tsx` declares `icons.icon = /favicon.svg`, which overrides the
 * Next file convention -- the static SVG, not `icon.tsx`, is what a browser
 * tab shows.
 */

const WEB_ROOT = path.resolve(__dirname, "..");
const asset = (relative: string) => path.join(WEB_ROOT, relative);

/** Every literal the pre-Jade violet was ever spelled as on these assets. */
const RETIRED_VIOLET_LITERALS = [
  "#8B5CF6",
  "#7C6AEF",
  "#A78BFA",
  "#7C3AED",
  "#6D28D9",
  "139,92,246",
  "139, 92, 246",
];

/** The dark half of `--color-amber`, the same literal `icon.tsx` renders. */
const JADE_ACCENT = "#1BD093";

const TEXT_ASSETS = [
  "public/favicon.svg",
  "public/logo.svg",
  "public/bimi.svg",
  "public/site.webmanifest",
] as const;

/** The three shield/wordmark SVGs must actually carry the accent, not merely lack violet. */
const ACCENTED_SVGS = [
  "public/favicon.svg",
  "public/logo.svg",
  "public/bimi.svg",
] as const;

const readText = (relative: string) => readFileSync(asset(relative), "utf8");

/**
 * Minimal 8-bit truecolour-alpha PNG decoder. The raster brand assets are the
 * two files where a violet literal cannot be grepped for, and pixels are the
 * only honest assertion. Node's zlib is enough, so this needs no dependency.
 */
function decodePngPixels(buffer: Buffer): { r: number; g: number; b: number; a: number }[] {
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colourType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  expect({ bitDepth, colourType, interlace }).toEqual({
    bitDepth: 8,
    colourType: 6,
    interlace: 0,
  });

  const channels = 4;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);

  // Buffer#readUInt8 rather than index access: `noUncheckedIndexedAccess`
  // widens every `buffer[i]` to `number | undefined`, and the filter maths
  // below reads five bytes per output byte.
  for (let y = 0; y < height; y += 1) {
    const filter = raw.readUInt8(y * (stride + 1));
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? out.readUInt8(y * stride + x - channels) : 0;
      const up = y > 0 ? out.readUInt8((y - 1) * stride + x) : 0;
      const upLeft =
        x >= channels && y > 0
          ? out.readUInt8((y - 1) * stride + x - channels)
          : 0;

      let value = line.readUInt8(x);
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const predictor = left + up - upLeft;
        const pa = Math.abs(predictor - left);
        const pb = Math.abs(predictor - up);
        const pc = Math.abs(predictor - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }

      out.writeUInt8(value & 0xff, y * stride + x);
    }
  }

  const pixels: { r: number; g: number; b: number; a: number }[] = [];
  for (let i = 0; i < out.length; i += channels) {
    pixels.push({
      r: out.readUInt8(i),
      g: out.readUInt8(i + 1),
      b: out.readUInt8(i + 2),
      a: out.readUInt8(i + 3),
    });
  }
  return pixels;
}

/**
 * An ICO wraps several sizes; ours embeds one PNG per entry. Every entry is
 * returned, because a browser is free to pick any of them for the tab and
 * checking only the first would have missed the 32x32 image entirely.
 */
function pngsInsideIco(buffer: Buffer): Buffer[] {
  expect(buffer.readUInt16LE(0)).toBe(0); // reserved
  expect(buffer.readUInt16LE(2)).toBe(1); // type: icon
  const count = buffer.readUInt16LE(4);
  expect(count).toBeGreaterThan(0);

  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const size = buffer.readUInt32LE(entry + 8);
    const offset = buffer.readUInt32LE(entry + 12);
    return buffer.subarray(offset, offset + size);
  });
}

const isViolet = ({ r, g, b, a }: { r: number; g: number; b: number; a: number }) =>
  a > 0 && b > g + 30 && r > g + 15 && b > 90;

const isJade = ({ g, r, b, a }: { r: number; g: number; b: number; a: number }) =>
  a > 0 && g > r + 40 && g > b + 20 && g > 120;

describe("served brand assets use the Jade palette", () => {
  describe.each(TEXT_ASSETS)("%s", (relative) => {
    it("contains no retired violet literal", () => {
      const source = readText(relative).toUpperCase();

      for (const violet of RETIRED_VIOLET_LITERALS) {
        expect(source).not.toContain(violet.toUpperCase());
      }
    });
  });

  describe.each(ACCENTED_SVGS)("%s", (relative) => {
    it("carries the Jade accent", () => {
      expect(readText(relative).toUpperCase()).toContain(JADE_ACCENT);
    });
  });

  it("site.webmanifest declares the Jade theme on the forest ground", () => {
    const manifest = JSON.parse(readText("public/site.webmanifest"));

    expect(manifest.theme_color.toUpperCase()).toBe(JADE_ACCENT);
    expect(manifest.background_color.toLowerCase()).toBe("#08170f");
  });

  describe.each(["app/favicon.ico", "public/logo-512.png"] as const)(
    "%s",
    (relative) => {
      const pixels = () => {
        const buffer = readFileSync(asset(relative));
        const images = relative.endsWith(".ico")
          ? pngsInsideIco(buffer)
          : [buffer];
        return images.flatMap(decodePngPixels);
      };

      it("has no violet pixels", () => {
        expect(pixels().filter(isViolet)).toHaveLength(0);
      });

      it("has jade pixels", () => {
        expect(pixels().filter(isJade).length).toBeGreaterThan(0);
      });
    },
  );
});
