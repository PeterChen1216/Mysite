// Share cards (src/og/layout.ts): wrapping and fitting the page's words, the pixel Earth from the
// globe's map, the voxel blocks, the stars; and where each card lives (src/i18n/routing.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ogImagePath } from '../../src/i18n/routing';
import {
  CARD,
  GLOBE,
  WINDOW_BOX,
  fitText,
  globeCells,
  isoCube,
  shade,
  stars,
  svgColor,
  wrapText,
} from '../../src/og/layout';
import { parseCellSvg } from '../../src/scene/earth';

/** A fixed-width measure: 10 px a character at size 10. */
const mono = (s: string, size = 10) => [...s].length * size;

describe('words on the card', () => {
  it('wraps at spaces, between CJK characters, and inside a word too long for a line', () => {
    expect(wrapText('Clock Stamp is a world clock', 120, mono)).toEqual([
      'Clock Stamp',
      'is a world',
      'clock',
    ]);
    expect(wrapText('潜在因子分析', 40, mono)).toEqual(['潜在因子', '分析']);
    expect(wrapText('X Community Notes 潜在因子', 90, mono)).toEqual([
      'X',
      'Community',
      'Notes 潜在因',
      '子',
    ]);
    expect(wrapText('abcdefghij', 40, mono)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrapText('   ', 40, mono)).toEqual([]);
  });
  it('the largest size that fits the lines allowed; else the smallest, cut with an ellipsis', () => {
    const m = (s: string, size: number) => mono(s, size);
    expect(fitText('Clock Stamp', 600, 1, [72, 60, 48], m)).toEqual({
      size: 48,
      lines: ['Clock Stamp'],
    });
    expect(fitText('Clock Stamp', 300, 2, [72, 60, 48, 36], m)).toEqual({
      size: 60,
      lines: ['Clock', 'Stamp'],
    });
    const cut = fitText('one two three four five six', 100, 1, [20, 10], m);
    expect(cut.size).toBe(10);
    expect(cut.lines).toHaveLength(1);
    expect(cut.lines[0]!.endsWith('…')).toBe(true);
    expect(m(cut.lines[0]!, 10)).toBeLessThanOrEqual(100);
  });
});

describe('colours and shapes', () => {
  it('shades a colour, keeps its alpha; writes it for SVG with its opacity', () => {
    expect(shade([0.5, 0.25, 1, 0.5], 0.5)).toEqual([0.25, 0.125, 0.5, 0.5]);
    expect(shade([0.8, 0.8, 0.8, 1], 2)).toEqual([1, 1, 1, 1]);
    expect(svgColor([1, 0, 0.5, 1])).toEqual({ fill: '#ff0080', opacity: 1 });
    expect(svgColor([0, 0, 0, 0.6])).toEqual({ fill: '#000000', opacity: 0.6 });
  });
  it('an isometric block: three faces meeting at its front corner', () => {
    const f = isoCube(100, 50, 40);
    expect(f.top.split(' ')).toHaveLength(4);
    expect(f.top.split(' ')[0]).toBe('100,50');
    expect(f.left).toContain('100,90');
    expect(f.right).toContain('100,90');
    expect(f.right).toContain('100,130');
  });
  it('stars stay off the window and on the card, the same on every build', () => {
    const s = stars();
    expect(s).toEqual(stars());
    expect(s).toHaveLength(70);
    const w = WINDOW_BOX;
    for (const p of s) {
      expect(p.x).toBeLessThan(CARD.width);
      expect(p.y).toBeLessThan(CARD.height);
      const inside =
        p.x > w.x - 12 && p.x < w.x + w.w + 24 && p.y > w.y - 12 && p.y < w.y + w.h + 24;
      expect(inside).toBe(false);
    }
  });
});

describe('the pixel Earth from the globe’s own map', () => {
  const land = parseCellSvg(readFileSync('src/assets/voxel/globe/land.svg', 'utf8'));
  const ice = parseCellSvg(readFileSync('src/assets/voxel/globe/ice.svg', 'utf8'));
  const cells = globeCells(land, ice, -90);
  it('a disc of cells, land and sea and ice', () => {
    for (const c of cells) {
      expect(
        Math.hypot(c.x + GLOBE.cell / 2 - GLOBE.cx, c.y + GLOBE.cell / 2 - GLOBE.cy),
      ).toBeLessThanOrEqual(GLOBE.r);
      expect(c.edge).toBeLessThanOrEqual(1);
    }
    const kinds = new Set(cells.map((c) => c.kind));
    expect(kinds).toEqual(new Set(['land', 'water', 'ice']));
    // Area of the disc, in cells (± the ragged edge).
    expect(cells.length).toBeGreaterThan(0.9 * ((Math.PI * GLOBE.r ** 2) / GLOBE.cell ** 2));
  });
  it('turning it shows another side', () => {
    const other = globeCells(land, ice, 90);
    expect(other.map((c) => c.kind)).not.toEqual(cells.map((c) => c.kind));
  });
});

describe('where each card lives', () => {
  it('one per page per locale, the theme in its name when it is not Night', () => {
    expect(ogImagePath('en', { kind: 'home' }, '/v2/')).toBe('/v2/og/en/home.png');
    expect(ogImagePath('zh-hant', { kind: 'projects' })).toBe('/og/zh-hant/projects.png');
    expect(ogImagePath('zh-hans', { kind: 'project', id: 'clock-stamp' }, '/v2')).toBe(
      '/v2/og/zh-hans/projects/clock-stamp.png',
    );
    expect(ogImagePath('en', { kind: 'home' }, '/', 'mono-light')).toBe(
      '/og/en/home.mono-light.png',
    );
  });
});
