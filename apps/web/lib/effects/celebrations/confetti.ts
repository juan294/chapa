import type confetti from "canvas-confetti";

const AMBER_COLORS = ["#7C6AEF", "#9D8FFF", "#5E4FCC", "#E6EDF3"];
const GOLD_COLORS = ["#7C6AEF", "#9D8FFF", "#5E4FCC", "#7268D4", "#B8ADFF"];
const RAINBOW_COLORS = ["#7C6AEF", "#9D8FFF", "#E86B6B", "#6BE8C4", "#8B9CF0", "#F0A06B"];

export type ConfettiPalette = "amber" | "gold" | "rainbow";

function getColors(palette: ConfettiPalette): string[] {
  switch (palette) {
    case "gold":
      return GOLD_COLORS;
    case "rainbow":
      return RAINBOW_COLORS;
    default:
      return AMBER_COLORS;
  }
}

export async function fireSingleBurst(
  particleCount: number,
  palette: ConfettiPalette,
  origin?: { x: number; y: number },
) {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount,
    spread: 70,
    origin: origin ?? { x: 0.5, y: 0.5 },
    colors: getColors(palette),
    disableForReducedMotion: true,
  });
}

export async function fireMultiBurst(particleCount: number, palette: ConfettiPalette) {
  const confetti = (await import("canvas-confetti")).default;
  const colors = getColors(palette);
  const base = Math.round(particleCount * 0.4);
  const side = Math.round(particleCount * 0.3);

  const fire = (opts: confetti.Options) => {
    confetti({ ...opts, colors, disableForReducedMotion: true });
  };

  fire({ particleCount: base, spread: 55, origin: { x: 0.5, y: 0.5 } });
  setTimeout(() => fire({ particleCount: side, spread: 70, origin: { x: 0.3, y: 0.6 } }), 200);
  setTimeout(() => fire({ particleCount: side, spread: 70, origin: { x: 0.7, y: 0.6 } }), 400);
}

export async function fireFireworks(particleCount: number, palette: ConfettiPalette, speed: number) {
  const confetti = (await import("canvas-confetti")).default;
  const colors = getColors(palette);
  const duration = Math.round(2000 / speed);
  const end = Date.now() + duration;
  const perFrame = Math.max(1, Math.round(particleCount / 60));

  const frame = () => {
    confetti({
      particleCount: perFrame,
      angle: 60 + Math.random() * 60,
      spread: 55,
      origin: { x: Math.random(), y: Math.random() * 0.6 },
      colors,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export async function fireSubtleSparkle(palette: ConfettiPalette, speed: number): Promise<() => void> {
  const confetti = (await import("canvas-confetti")).default;
  const colors = getColors(palette);
  let cancelled = false;
  const interval = Math.round(400 / speed);

  const tick = () => {
    if (cancelled) return;
    confetti({
      particleCount: 2,
      spread: 360,
      startVelocity: 8,
      gravity: 0.4,
      ticks: 200,
      origin: { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.3 },
      colors,
      disableForReducedMotion: true,
    });
    setTimeout(tick, interval);
  };
  tick();

  return () => { cancelled = true; };
}
