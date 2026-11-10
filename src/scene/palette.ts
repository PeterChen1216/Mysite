/**
 * The scene's colours, read from the theme tokens (PLAN-EXPERIENCE §3.4: "reads a small theme
 * object built from tokens … and re-reads it on a theme change — no shader rebuild, uniforms
 * only"). Every colour lives in src/styles/tokens.css (`--scene-*`, mostly aliases of the
 * semantic tokens); this module only parses what the browser resolved. Pure.
 */

export type Rgba = [number, number, number, number];

/** Parse a resolved CSS colour: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() in either syntax. */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const v = [...hex].map((c) => parseInt(c + c, 16) / 255);
      return [v[0]!, v[1]!, v[2]!, v[3] ?? 1];
    }
    if (hex.length === 6 || hex.length === 8) {
      const v = hex.match(/../g)!.map((c) => parseInt(c, 16) / 255);
      return [v[0]!, v[1]!, v[2]!, v[3] ?? 1];
    }
    return null;
  }
  const fn = /^rgba?\((.*)\)$/.exec(s)?.[1];
  if (!fn) return null;
  const parts = fn
    .replace(/\s*\/\s*/, ' / ')
    .split(/[\s,]+/)
    .filter((p) => p && p !== '/');
  if (parts.length < 3) return null;
  const channel = (p: string) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / 255);
  const alpha = (p: string | undefined) =>
    p === undefined ? 1 : p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p);
  const out: Rgba = [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!), alpha(parts[3])];
  return out.every((v) => Number.isFinite(v)) ? out : null;
}

/**
 * Palette slots, in shader order. Each is a `--scene-*` token. The cube atlas (atlas.ts) stores
 * slot numbers, so a theme change only replaces these sixteen colours.
 */
export const PALETTE = [
  'sky', // 0 the page background; fog and the fade go to it
  'grass', // 1
  'water', // 2
  'ice', // 3
  'dirt', // 4
  'stone', // 5
  'green', // 6 accent: terminal green
  'diamond', // 7 accent
  'gold', // 8 accent
  'enchant', // 9 accent
  'redstone', // 10 accent
  'ink', // 11 darkest (obsidian, outlines)
  'paper', // 12 lightest (paper, tnt label)
  'wood', // 13 planks, bookshelf, chest
  'panel', // 14 terminal and command blocks
  'star', // 15 stars and motes
] as const;
export type Slot = (typeof PALETTE)[number];
export const SLOT = Object.fromEntries(PALETTE.map((name, i) => [name, i])) as Record<Slot, number>;

/** Numbers the scene reads from tokens as well (0–1). */
export const LEVELS = [
  'sky-art', // stars, motes and glows (0 in the light themes: no night sky on paper)
  'grid', // the background grid's strength
  'night', // how dark the Earth's night side is
  'glow', // strength of the soft glows
] as const;
export type Level = (typeof LEVELS)[number];

export interface SceneTheme {
  /** 16 × rgb, for the palette uniform. */
  palette: Float32Array;
  grid: Rgba;
  glowA: Rgba;
  glowB: Rgba;
  levels: Record<Level, number>;
  /** The sky is light (Day, Mono light): fog and shading lean the other way. */
  light: boolean;
}

/** Relative luminance (WCAG) of an sRGB colour. */
export function luminance([r, g, b]: Rgba): number {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * The theme object, from a token reader (`name` → the resolved value of `--scene-<name>`).
 * A token the browser could not resolve falls back to the sky colour (never to a literal), so a
 * missing token shows as a hole, not a wrong colour.
 */
export function readTheme(token: (name: string) => string): SceneTheme {
  const sky = parseColor(token('sky')) ?? [0, 0, 0, 1];
  const tokenColor = (name: string): Rgba => parseColor(token(name)) ?? sky;
  const palette = new Float32Array(PALETTE.length * 3);
  PALETTE.forEach((name, i) => palette.set(tokenColor(name).slice(0, 3), i * 3));
  const level = (name: string) => {
    const v = parseFloat(token(name));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  };
  return {
    palette,
    grid: tokenColor('grid-line'),
    glowA: tokenColor('glow-a'),
    glowB: tokenColor('glow-b'),
    levels: Object.fromEntries(LEVELS.map((l) => [l, level(l)])) as Record<Level, number>,
    light: luminance(sky) > 0.5,
  };
}
