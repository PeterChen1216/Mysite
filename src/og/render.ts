/**
 * Draws a share card (src/og/layout.ts) at build time: an SVG of the card — every colour resolved
 * from src/styles/tokens.css for the theme, the text as glyph outlines from the fonts already in
 * the repository's dependencies (Pixelify Sans, JetBrains Mono, and Fusion Pixel for Chinese;
 * all SIL OFL: drawing their glyphs into a picture is use, not redistribution of the font) —
 * rasterised to PNG by sharp. Used only by src/pages/og/[...card].png.ts; nothing here reaches
 * the browser.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { create, type Font } from 'fontkitten';
import sharp from 'sharp';
import iceSvg from '../assets/voxel/globe/ice.svg?raw';
import landSvg from '../assets/voxel/globe/land.svg?raw';
import tokensCss from '../styles/tokens.css?raw';
import { CJK_FONTS } from '../i18n/cjk-font';
import type { Locale } from '../i18n/locales';
import { parseTokenCss, resolveTokens } from '../lib/theme-tokens';
import { parseCellSvg } from '../scene/earth';
import { parseColor, type Rgba } from '../scene/palette';
import {
  CARD,
  GLOBE,
  TITLE_SIZES,
  WINDOW_BOX,
  fitText,
  globeCells,
  isoCube,
  shade,
  stars,
  svgColor,
} from './layout';

/** What a card says: the window's title bar, its command, the title, a line about the page. */
export interface CardText {
  bar: string;
  cmd: string;
  title: string;
  line: string;
  /** The domain, at the foot of the window. */
  foot: string;
}

const NM = join(process.cwd(), 'node_modules', '@fontsource');
const fonts = new Map<string, Font>();
function font(file: string): Font {
  let f = fonts.get(file);
  if (!f) {
    f = create(readFileSync(join(NM, file))) as Font;
    fonts.set(file, f);
  }
  return f;
}
const PIXEL = 'pixelify-sans/files/pixelify-sans-latin-700-normal.woff';
const CODE = 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff';
const cjkFont = (locale: Locale) =>
  locale === 'en' ? null : font(CJK_FONTS[locale].source.replace(/^@fontsource\//, ''));

/** A text run as glyph outlines: each character from `main`, or the fallbacks that have it. */
function run(
  text: string,
  size: number,
  x: number,
  y: number,
  faces: readonly Font[],
): { d: string; width: number } {
  let d = '';
  let cx = x;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    let f = faces[0]!;
    let g = f.glyphForCodePoint(cp);
    for (const alt of faces.slice(1)) {
      if (g && g.id !== 0) break;
      f = alt;
      g = f.glyphForCodePoint(cp);
    }
    const k = size / f.unitsPerEm;
    if (g) {
      d += g.path.scale(k, -k).translate(cx, y).toSVG();
      cx += g.advanceWidth * k;
    }
  }
  return { d, width: cx - x };
}

const measureWith = (faces: readonly Font[]) => (s: string, size: number) =>
  run(s, size, 0, 0, faces).width;

const RULES = parseTokenCss(tokensCss);
const LAND = parseCellSvg(landSvg);
const ICE = parseCellSvg(iceSvg);

/** The card for a page, in a theme and a locale's fonts, as PNG bytes (an ArrayBuffer, a Response body). */
export async function renderCard(
  text: CardText,
  theme: string,
  locale: Locale,
): Promise<ArrayBuffer> {
  const page = resolveTokens(RULES, { theme });
  const dark = resolveTokens(RULES, { theme, island: true });
  const c = (tokens: Record<string, string>, name: string): Rgba =>
    parseColor(tokens[name] ?? '') ?? parseColor(page['--color-bg-night']!)!;
  const fill = (rgba: Rgba) => {
    const { fill: f, opacity } = svgColor(rgba);
    return opacity < 1 ? `fill="${f}" fill-opacity="${opacity}"` : `fill="${f}"`;
  };
  const cjk = cjkFont(locale);
  const pixel = cjk ? [font(PIXEL), cjk] : [font(PIXEL)];
  const code = cjk ? [font(CODE), cjk] : [font(CODE)];
  const w = WINDOW_BOX;
  const parts: string[] = [];
  const rect = (x: number, y: number, rw: number, rh: number, col: Rgba) =>
    parts.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" ${fill(col)}/>`);
  const path = (d: string, col: Rgba) => d && parts.push(`<path d="${d}" ${fill(col)}/>`);
  // Text in the code font keeps its anti-aliasing (the rest of the card is crisp pixels).
  const textPath = (d: string, col: Rgba) =>
    d && parts.push(`<path d="${d}" ${fill(col)} shape-rendering="geometricPrecision"/>`);

  // The ground, its graph paper and stars.
  rect(0, 0, CARD.width, CARD.height, c(page, '--color-bg-night'));
  const grid = c(page, '--color-border-line');
  for (let x = 0; x < CARD.width; x += 48)
    rect(x, 0, 1, CARD.height, [...grid.slice(0, 3), 0.35] as Rgba);
  for (let y = 0; y < CARD.height; y += 48)
    rect(0, y, CARD.width, 1, [...grid.slice(0, 3), 0.35] as Rgba);
  const sky = Number.parseFloat(page['--art-sky'] ?? '1');
  if (sky > 0) {
    const tones = ['--color-text-hi', '--color-accent-gold', '--color-accent-diamond'];
    for (const s of stars()) rect(s.x, s.y, s.size, s.size, c(page, tones[s.tone]!));
  }

  // The pixel Earth, from the globe's map, the Americas towards us.
  const kinds = {
    land: c(page, '--scene-grass'),
    water: c(page, '--scene-water'),
    ice: c(page, '--scene-ice'),
  };
  for (const cell of globeCells(LAND, ICE, -90)) {
    const base = kinds[cell.kind];
    rect(cell.x, cell.y, GLOBE.cell, GLOBE.cell, shade(base, cell.edge > 0.86 ? 0.72 : 1));
  }
  // The beacon under it and three voxel blocks around it.
  const block = (x: number, y: number, s: number, top: Rgba, side: Rgba) => {
    const f = isoCube(x, y, s);
    parts.push(`<polygon points="${f.left}" ${fill(shade(side, 0.8))}/>`);
    parts.push(`<polygon points="${f.right}" ${fill(shade(side, 0.62))}/>`);
    parts.push(`<polygon points="${f.top}" ${fill(top)}/>`);
  };
  block(GLOBE.cx, GLOBE.cy + GLOBE.r + 6, 40, c(page, '--scene-diamond'), c(page, '--scene-gold'));
  block(1118, 96, 46, c(page, '--color-block-grass'), c(page, '--color-block-dirt'));
  block(792, 548, 34, c(page, '--color-accent-gold'), c(page, '--color-accent-gold'));
  block(1135, 470, 34, c(page, '--color-block-stone'), c(page, '--color-block-stone'));

  // The terminal window: hard pixel shadow, title bar, then the page's command, title and line.
  rect(w.x + w.shadow, w.y + w.shadow, w.w, w.h, c(page, '--color-shadow-term'));
  rect(w.x - 3, w.y - 3, w.w + 6, w.h + 6, c(dark, '--color-border-edge'));
  rect(w.x, w.y, w.w, w.h, c(dark, '--color-bg-terminal'));
  rect(w.x, w.y, w.w, w.bar, c(dark, '--color-bg-panel'));
  rect(w.x, w.y + w.bar, w.w, 3, c(dark, '--color-border-line'));
  ['--term-dot-red', '--term-dot-yellow', '--term-dot-green'].forEach((t, i) =>
    rect(w.x + 22 + i * 24, w.y + w.bar / 2 - 7, 14, 14, c(dark, t)),
  );
  const barText = run(text.bar, 20, 0, 0, code);
  textPath(
    run(text.bar, 20, w.x + w.w / 2 - barText.width / 2 + 30, w.y + w.bar / 2 + 7, code).d,
    c(dark, '--color-text-mid'),
  );
  const left = w.x + w.pad;
  const inner = w.w - 2 * w.pad;
  let y = w.y + w.bar + 58;
  const dollar = run('$ ', 26, left, y, code);
  textPath(dollar.d, c(dark, '--color-accent-terminal-green'));
  textPath(run(text.cmd, 26, left + dollar.width, y, code).d, c(dark, '--color-text-hi'));
  y += 38;
  // One line when the title fits on one at a good size, else two (then the line about it has
  // less room).
  const oneLine = TITLE_SIZES.filter((size) => size >= 48).find(
    (size) => measureWith(pixel)(text.title, size) <= inner,
  );
  const title = oneLine
    ? { size: oneLine, lines: [text.title] }
    : fitText(text.title, inner, 2, TITLE_SIZES, measureWith(pixel));

  for (const line of title.lines) {
    y += title.size * 1.05;
    path(run(line, title.size, left + 4, y + 4, pixel).d, c(dark, '--color-heading-shadow'));
    path(run(line, title.size, left, y, pixel).d, c(dark, '--color-text-hi'));
  }
  // The line about the page fills what is left above the foot (as many lines as fit, at most 3).
  const footY = w.y + w.h - 30;
  y += 16;
  const room = Math.max(1, Math.min(3, Math.floor((footY - 34 - y) / (22 * 1.45))));
  const about = fitText(text.line, inner, room, [24, 22], measureWith(code));
  for (const line of about.lines) {
    y += about.size * 1.45;
    textPath(run(line, about.size, left, y, code).d, c(dark, '--color-text-mid'));
  }
  const foot = run(text.foot, 22, left, footY, code);
  textPath(foot.d, c(dark, '--color-accent-terminal-green'));
  rect(left + foot.width + 8, footY - 18, 12, 22, c(dark, '--color-accent-terminal-green'));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}" shape-rendering="crispEdges">${parts.join('')}</svg>`;
  const png = await sharp(Buffer.from(svg))
    .png({ palette: true, colours: 128, effort: 8 })
    .toBuffer();
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
}
