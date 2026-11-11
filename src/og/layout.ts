/**
 * Share cards (Open Graph images; PLAN §11, PLAN-EXPERIENCE §9 "OG images per locale and theme"):
 * the layout of a 1200 × 630 card in the site's voxel × terminal language — a terminal window
 * with the page's command, title and a line about it; the pixel Earth from the globe's own map;
 * a few voxel blocks and stars. Pure: geometry, wrapping and colours from values handed in
 * (src/og/render.ts draws it with the theme's tokens and the repository's fonts).
 */
import { maskAt, type CellMask as CellGrid } from '../scene/earth';
import { rng } from '../scene/atlas';
import type { Rgba } from '../scene/palette';

export const CARD = { width: 1200, height: 630 };

/** The terminal window on the card: its box, its bar, the text column inside it. */
export const WINDOW_BOX = { x: 56, y: 96, w: 660, h: 440, bar: 52, pad: 32, shadow: 14 };

/** The Earth on the right: centre, radius, cell size (px). */
export const GLOBE = { cx: 940, cy: 316, r: 200, cell: 12 };

/** Title sizes to try, largest first (Pixelify Sans; 12 px multiples for the pixel CJK face). */
export const TITLE_SIZES = [72, 60, 48, 36] as const;

/**
 * Break text into lines no wider than `max`: at spaces for words, anywhere between CJK characters
 * (and inside a word that alone is too wide). `measure` gives a string's width.
 */
export function wrapText(text: string, max: number, measure: (s: string) => number): string[] {
  const tokens = text
    .trim()
    .split(/(\s+|[⺀-鿿豈-﫿＀-￯])/u)
    .filter((t) => t !== '');
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line.trim()) lines.push(line.trim());
    line = '';
  };
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (line) line += ' ';
      continue;
    }
    if (measure(line + tok) <= max) {
      line += tok;
      continue;
    }
    if (line.trim()) push();
    if (measure(tok) <= max) {
      line = tok;
      continue;
    }
    // One word wider than the line: by characters.
    for (const ch of tok) {
      if (measure(line + ch) > max && line) push();
      line += ch;
    }
  }
  push();
  return lines;
}

/**
 * The largest size at which `text` fits in `maxLines` lines of `max` px (measure(s, size) gives
 * the width at a size); the smallest size, its lines cut to `maxLines` with an ellipsis, if none.
 */
export function fitText(
  text: string,
  max: number,
  maxLines: number,
  sizes: readonly number[],
  measure: (s: string, size: number) => number,
): { size: number; lines: string[] } {
  for (const size of sizes) {
    const lines = wrapText(text, max, (s) => measure(s, size));
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1]!;
  const lines = wrapText(text, max, (s) => measure(s, size)).slice(0, maxLines);
  const lastLine = lines[maxLines - 1];
  if (lastLine !== undefined) {
    let cut = lastLine;
    while (cut && measure(`${cut}…`, size) > max) cut = cut.slice(0, -1);
    lines[maxLines - 1] = `${cut.trimEnd()}…`;
  }
  return { size, lines };
}

/** A colour with each channel multiplied (a cube's shaded faces), alpha kept. */
export const shade = ([r, g, b, a]: Rgba, k: number): Rgba => [
  Math.min(1, r * k),
  Math.min(1, g * k),
  Math.min(1, b * k),
  a,
];

/** An SVG colour and opacity for a colour. */
export function svgColor([r, g, b, a]: Rgba): { fill: string; opacity: number } {
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return { fill: `#${h(r)}${h(g)}${h(b)}`, opacity: Math.round(a * 1000) / 1000 };
}

/**
 * The cells of the pixel Earth seen from above `lon0` (orthographic, north up), from the
 * globe's own map (earth.ts): each cell's top-left corner and what is there.
 */
export function globeCells(
  land: CellGrid,
  ice: CellGrid,
  lon0: number,
  g: { cx: number; cy: number; r: number; cell: number } = GLOBE,
): Array<{ x: number; y: number; kind: 'land' | 'ice' | 'water'; edge: number }> {
  const out: Array<{ x: number; y: number; kind: 'land' | 'ice' | 'water'; edge: number }> = [];
  const n = Math.ceil(g.r / g.cell);
  for (let j = -n; j < n; j++)
    for (let i = -n; i < n; i++) {
      const px = (i + 0.5) * g.cell;
      const py = (j + 0.5) * g.cell;
      const d = Math.hypot(px, py) / g.r;
      if (d > 1) continue;
      const x = px / g.r;
      const y = -py / g.r;
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lon = ((lon0 + (Math.atan2(x, z) * 180) / Math.PI + 540) % 360) - 180;
      const kind = maskAt(ice, lat, lon) ? 'ice' : maskAt(land, lat, lon) ? 'land' : 'water';
      out.push({ x: g.cx + i * g.cell, y: g.cy + j * g.cell, kind, edge: d });
    }
  return out;
}

/**
 * An isometric voxel block: the three visible faces (top, left, right) of a cube of edge `s` whose
 * top corner is at (x, y), as polygon points.
 */
export function isoCube(x: number, y: number, s: number): Record<'top' | 'left' | 'right', string> {
  const w = s * 0.866;
  const h = s / 2;
  const p = (pts: Array<[number, number]>) =>
    pts.map(([a, b]) => `${Math.round(a * 10) / 10},${Math.round(b * 10) / 10}`).join(' ');
  return {
    top: p([
      [x, y],
      [x + w, y + h],
      [x, y + 2 * h],
      [x - w, y + h],
    ]),
    left: p([
      [x - w, y + h],
      [x, y + 2 * h],
      [x, y + 2 * h + s],
      [x - w, y + h + s],
    ]),
    right: p([
      [x, y + 2 * h],
      [x + w, y + h],
      [x + w, y + h + s],
      [x, y + 2 * h + s],
    ]),
  };
}

/** Stars: square pixels scattered over the card (seeded: the same on every build), off the window. */
export function stars(
  count = 70,
  seed = 11,
): Array<{ x: number; y: number; size: number; tone: number }> {
  const r = rng(seed);
  const out: Array<{ x: number; y: number; size: number; tone: number }> = [];
  const w = WINDOW_BOX;
  while (out.length < count) {
    const x = Math.floor(r() * CARD.width);
    const y = Math.floor(r() * CARD.height);
    const inWindow = x > w.x - 12 && x < w.x + w.w + 24 && y > w.y - 12 && y < w.y + w.h + 24;
    const pick = r();
    const size = r() < 0.15 ? 6 : 3;
    if (!inWindow) out.push({ x, y, size, tone: pick < 0.7 ? 0 : pick < 0.85 ? 1 : 2 });
  }
  return out;
}
