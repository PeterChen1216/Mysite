/**
 * Motion parameters (PLAN §5.2, §9.3: "动效参数表集中在 src/motion/params.ts").
 * Intro timings come from the Figma prototype timeline of "Home — Voxel / 1440" (get_motion_context,
 * 7.1 s loop) — on the site the intro plays once on load. Scripts import these directly; CSS reads
 * them as custom properties (motionCssVars, set on <html> by BaseLayout and used in
 * src/styles/motion.css and PixelGlobe.astro), so changing a number here changes the page.
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
  /**
   * Blocks drop from −90 px, overshoot 10 px and settle, staggered. The overshoot sits at 70 % of
   * the duration (Figma: 420 ms drop + 180 ms settle); keyframe offsets can't be custom
   * properties, so that one number lives in motion.css.
   */
  blocks: { delayMs: 200, staggerMs: 90, durationMs: 600, fromPx: -90, overshootPx: 10 },
  /** Satellite, player card, name tag and tooltips slide up 14 px in turn. */
  cards: { delayMs: 1300, staggerMs: 120, durationMs: 350, risePx: 14 },
} as const;

/** How long a typed terminal line of `chars` characters takes (INTRO.typing). */
export function typingMs(chars: number): number {
  const t = INTRO.typing;
  return Math.max(t.minLineMs, Math.min(t.maxLineMs, chars * t.msPerChar));
}

/** Small interface transitions, in stepped (pixel-art) timing. */
export const UI = {
  /** Button hover: the classic blue/yellow highlight in 3 steps over 120 ms (PLAN §5.2). */
  buttonHover: { ms: 120, steps: 3 },
  /** Hero player card: the real photo replaces the pixel portrait in 4 steps. */
  photoSwap: { ms: 200, steps: 4 },
} as const;

export const LOOP = {
  /** One full globe rotation (PLAN §5.2: 12 s / turn). */
  globeTurnMs: 12_000,
  /** Hovering the globe slows it down (PLAN §5.2). */
  globeHoverRate: 0.35,
  /** Cursor blink 500 / 500 ms (PLAN §5.2). */
  cursorBlinkMs: 1000,
  /** Outer orbit ring: one full turn. */
  orbitTurnMs: 54_000,
  /** The tilted second ring sways back and forth (Figma 17:127: −30° per 6 s). */
  orbitSwayMs: 6000,
  orbitSwayDeg: -30,
  /** Ticker scroll speed in px/s. */
  tickerPxPerSecond: 40,
} as const;

/**
 * Motion level "calm" (PLAN-EXPERIENCE §4.1): no intro, no particles, and the loops that remain
 * run this many times slower (cursor blink, orbit rings, globe, ticker).
 */
export const CALM = { loopSlowdown: 3 } as const;

/** Width of one globe map tile in px; one tile scrolling past = one rotation. */
export const GLOBE_TILE_PX = 648;

export const PARTICLES = {
  /** Hover burst: 16 pixel particles of 4 or 6 px, 300–400 ms (PLAN §5.2). */
  count: 16,
  sizes: [4, 6],
  minMs: 300,
  maxMs: 400,
  /** Travel distance range in px. */
  distance: [18, 46],
  /** Design tokens (src/styles/tokens.css), read when a burst starts so themes recolour them. */
  colors: [
    '--color-accent-terminal-green',
    '--color-accent-diamond',
    '--color-accent-gold',
    '--color-accent-enchant',
    '--color-accent-redstone',
    '--color-block-grass',
  ],
} as const;

/**
 * The WebGL scene (PLAN-EXPERIENCE §7; src/scene/). Its loops follow the motion level like the
 * CSS ones: calm runs them CALM.loopSlowdown times slower, off and pause hold them.
 */
export const SCENE = {
  /** Camera damping time constant: PLAN §5.2's lerp 0.08–0.12 per frame at 60 fps. */
  dampMs: 160,
  /** The canvas fades in, and the DOM art it replaces fades out. */
  fadeMs: 400,
  /** Warm-up before showing it (PLAN §5.2: "连续 3 帧 < 25 ms 才淡入"), and how long to try. */
  warmFrames: 3,
  warmFrameMs: 25,
  warmTimeoutMs: 3000,
  /** Radar sweep and the satellite on the radar ring, radians per second. */
  sweepRadPerS: 1.1,
  satelliteRadPerS: 0.22,
  /** XP orbs drift towards the pointer: how far they reach (world units) and how hard. */
  orbReach: 14,
  orbPull: 0.45,
  orbSpringPerS: 3,
  /** The chest lid opens while Skills is in view. */
  lidMs: 500,
  /** One crossing of a watched route by its plane. */
  planeMs: 9000,
} as const;

/** The CSS-side parameters as a `style` value of custom properties (`--m-…`). */
export function motionCssVars(): string {
  const ms = (n: number) => `${n}ms`;
  const px = (n: number) => `${n}px`;
  const { headline: h, globe: g, blocks: b, cards: c } = INTRO;
  const vars: Record<string, string> = {
    '--m-word-dur': ms(h.durationMs),
    '--m-word-stagger': ms(h.staggerMs),
    '--m-word-rise': px(h.risePx),
    '--m-word-blur': px(h.blurPx),
    '--m-word-ease': h.ease,
    '--m-globe-delay': ms(g.delayMs),
    '--m-globe-scale-dur': ms(g.scaleMs),
    '--m-globe-fade-dur': ms(g.fadeMs),
    '--m-globe-from': String(g.fromScale),
    '--m-drop-delay': ms(b.delayMs),
    '--m-drop-stagger': ms(b.staggerMs),
    '--m-drop-dur': ms(b.durationMs),
    '--m-drop-from': px(b.fromPx),
    '--m-drop-over': px(b.overshootPx),
    '--m-rise-delay': ms(c.delayMs),
    '--m-rise-stagger': ms(c.staggerMs),
    '--m-rise-dur': ms(c.durationMs),
    '--m-rise-px': px(c.risePx),
    '--m-blink': ms(LOOP.cursorBlinkMs),
    '--m-orbit-turn': ms(LOOP.orbitTurnMs),
    '--m-sway-dur': ms(LOOP.orbitSwayMs),
    '--m-sway-deg': `${LOOP.orbitSwayDeg}deg`,
    '--m-globe-turn': ms(LOOP.globeTurnMs),
    '--m-globe-tile': px(GLOBE_TILE_PX),
    '--m-btn-hover': `${ms(UI.buttonHover.ms)} steps(${UI.buttonHover.steps})`,
    '--m-photo-swap': `${ms(UI.photoSwap.ms)} steps(${UI.photoSwap.steps})`,
    '--m-calm-slow': String(CALM.loopSlowdown),
    '--m-scene-fade': ms(SCENE.fadeMs),
  };
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
