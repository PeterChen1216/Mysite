/**
 * Motion parameters (PLAN §5.2, §9.3: "动效参数表集中在 src/motion/params.ts").
 * Intro timings come from the Figma prototype timeline of "Home — Voxel / 1440" (get_motion_context,
 * 7.1 s loop) — on the site the intro plays once on load. CSS reads these through custom
 * properties set in src/styles/motion.css; scripts import them directly.
 */
export const INTRO = {
  /** Headline: words rise 28 px with an 8 px blur, staggered. */
  headline: {
    durationMs: 277,
    staggerMs: 125,
    risePx: 28,
    blurPx: 8,
    ease: 'cubic-bezier(0, 0, 0.58, 1)',
  },
  /** Terminal lines type in sequence; per-character pace ≈ the Figma per-line durations. */
  typing: { msPerChar: 14, minLineMs: 250, maxLineMs: 1100, startMs: 450 },
  /** Globe scales 0.55 → 1 while fading in. */
  globe: { delayMs: 100, scaleMs: 800, fadeMs: 500, fromScale: 0.55 },
  /** Blocks drop from −90 px with a 10 px overshoot, staggered. */
  blocks: { delayMs: 200, staggerMs: 90, dropMs: 420, settleMs: 180, fromPx: -90, overshootPx: 10 },
  /** Satellite, player card, name tag and tooltips slide up 14 px in turn. */
  cards: { delayMs: 1300, staggerMs: 120, durationMs: 350, risePx: 14 },
} as const;

export const LOOP = {
  /** One full globe rotation (PLAN §5.2: 12 s / turn). */
  globeTurnMs: 12_000,
  /** Hovering the globe slows it down (PLAN §5.2). */
  globeHoverRate: 0.35,
  /** Cursor blink 500 / 500 ms (PLAN §5.2). */
  cursorBlinkMs: 1000,
  /** Orbit rings drift (Figma: +40° and −30° per 6 s). */
  orbitTurnMs: 54_000,
  orbit2TurnMs: 72_000,
  /** Ticker scroll speed in px/s. */
  tickerPxPerSecond: 40,
} as const;

export const PARTICLES = {
  /** Hover burst: 16 pixel particles of 4 or 6 px, 300–400 ms (PLAN §5.2). */
  count: 16,
  sizes: [4, 6],
  minMs: 300,
  maxMs: 400,
  /** Travel distance range in px. */
  distance: [18, 46],
  colors: ['#39ff14', '#4aedd9', '#fcdb05', '#a335ee', '#ff5555', '#7cbd4f'],
} as const;
