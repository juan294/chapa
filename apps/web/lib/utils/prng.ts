/**
 * Shared Mulberry32 PRNG utilities.
 *
 * Both functions use the same Mulberry32 algorithm. `seededRandom` returns a
 * single value for a given seed; `mulberry32` returns a stateful generator
 * that produces a sequence of values from a single seed.
 */

/** Return a single pseudo-random number in [0, 1) for a given seed (Mulberry32). */
export function seededRandom(seed: number): number {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Return a stateful PRNG generator function seeded with the given value (Mulberry32). */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
