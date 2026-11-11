/**
 * The tier 2 ambient layer (PLAN-EXPERIENCE §7.4): a three-layer parallax star field and rising
 * motes on one 2D canvas behind the page. Pure: where each star and mote is for a scroll position
 * and a time; src/scripts/ambient.ts draws them. Unit-tested in tests/unit/ambient.test.ts.
 *
 * Each layer is a field of pixel stars one viewport tall (repeating down the page); it scrolls by
 * its factor of the page's scroll (far 0.2, middle 0.5, near 1.0 — the near layer moves with the
 * page, the far one barely), so depth shows as the visitor scrolls.
 */

export interface Star {
  /** Position in the layer's field, 0–1 of its width and height. */
  x: number;
  y: number;
  /** Which of the layer's colours, and how bright (0–1). */
  tone: number;
  alpha: number;
}

export interface Layer {
  factor: number;
  size: number;
  stars: Star[];
}

/** A small deterministic generator (mulberry32): the same sky on every visit. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The three layers for a view of `width` × `height` css px: `density[i]` stars per 1000 × 1000 px,
 * `tones` colours to pick from in each layer.
 */
export function starLayers(
  width: number,
  height: number,
  factors: readonly number[],
  density: readonly number[],
  sizes: readonly number[],
  tones = 3,
  seed = 7,
): Layer[] {
  const area = (Math.max(1, width) * Math.max(1, height)) / 1e6;
  return factors.map((factor, i) => {
    const r = seeded(seed + i * 101);
    const n = Math.max(1, Math.round((density[i] ?? 0) * area));
    const stars = Array.from({ length: n }, () => ({
      x: r(),
      y: r(),
      tone: Math.floor(r() * tones),
      alpha: 0.35 + r() * 0.55,
    }));
    return { factor, size: sizes[i] ?? 2, stars };
  });
}

/** How far a layer's field has moved up for a page scroll of `scroll` px (wrapped to its height). */
export function layerOffset(scroll: number, factor: number, height: number): number {
  const h = Math.max(1, height);
  return (((scroll * factor) % h) + h) % h;
}

/** A star's place on screen (css px, whole pixels) for a layer moved by `offset`. */
export function starAt(
  s: Star,
  offset: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const y = (((s.y * height - offset) % height) + height) % height;
  return { x: Math.round(s.x * width), y: Math.round(y) };
}

export interface Mote {
  x: number;
  /** Where in its climb it starts (0–1), how fast (px/s, times the base) and how bright. */
  phase: number;
  speed: number;
  alpha: number;
  tone: number;
}

export function motes(count: number, tones = 2, seed = 11): Mote[] {
  const r = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: r(),
    phase: r(),
    speed: 0.6 + r() * 0.8,
    alpha: 0.5 + r() * 0.4,
    tone: Math.floor(r() * tones),
  }));
}

/**
 * Where a mote is at `t` seconds: it rises through the lower `band` px of a view `height` tall at
 * `rise` px/s (times its speed), fading in at the bottom and out at the top, then starts again.
 */
export function moteAt(
  m: Mote,
  t: number,
  width: number,
  height: number,
  band: number,
  rise: number,
): { x: number; y: number; alpha: number } {
  const b = Math.max(1, Math.min(band, height));
  const f = (((m.phase + (t * rise * m.speed) / b) % 1) + 1) % 1; // 0 at the bottom → 1 at the top
  const fade = Math.min(1, f / 0.15, (1 - f) / 0.25);
  return {
    x: Math.round(m.x * width + Math.sin((f + m.phase) * 6.283) * 6),
    y: Math.round(height - f * b),
    alpha: m.alpha * Math.max(0, fade),
  };
}
