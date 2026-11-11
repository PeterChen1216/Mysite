import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MONO_ART_SOURCES,
  MONO_CONTRAST,
  monoArtPath,
  monoColour,
  monoSvg,
} from '../../src/lib/mono-art';

const ROOT = join(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('monoColour: grayscale(1) contrast(1.15) on one colour', () => {
  it('keeps black, white and mid-grey where the filter keeps them', () => {
    expect(monoColour('#000000')).toBe('#000000');
    expect(monoColour('#FFFFFF')).toBe('#FFFFFF');
    expect(monoColour('#fff')).toBe('#FFFFFF');
    expect(monoColour('#808080')).toBe('#808080');
  });

  it('gives a grey of the colour’s luminance, pushed away from mid-grey', () => {
    // Pure green: luminance 0.7152 → (0.7152 − 0.5) × 1.15 + 0.5 = 0.7475 → 191.
    expect(monoColour('#00FF00')).toBe('#BFBFBF');
    // Pure blue: 0.0722 → 0.0080 → 2.
    expect(monoColour('#0000ff')).toBe('#020202');
    // The grid's navy is darker than mid-grey and gets darker still.
    expect(monoColour('#1C2340')).toBe('#161616');
  });

  it('clamps instead of leaving the range', () => {
    expect(monoColour('#FEFEFE')).toBe('#FFFFFF');
    expect(monoColour('#010101')).toBe('#000000');
  });

  it('refuses what is not a hex colour', () => {
    expect(() => monoColour('red')).toThrow(/Not a hex colour/);
    expect(() => monoColour('#12')).toThrow(/Not a hex colour/);
  });
});

describe('monoSvg', () => {
  it('converts fills and strokes and nothing else', () => {
    const svg =
      '<svg><g opacity="0.9" filter="url(#fade01)"><path d="M0 0H3V3H0Z" fill="#4AEDD9" stroke="#abc"/></g>' +
      '<use href="#abc"/><rect fill="white"/></svg>';
    expect(monoSvg(svg)).toBe(
      '<svg><g opacity="0.9" filter="url(#fade01)"><path d="M0 0H3V3H0Z" fill="#D4D4D4" stroke="#C1C1C1"/></g>' +
        '<use href="#abc"/><rect fill="white"/></svg>',
    );
  });

  it('fails on a colour notation it does not convert', () => {
    expect(() => monoSvg('<svg><rect fill="rgb(1 2 3)"/></svg>')).toThrow(/only hex colours/);
  });
});

describe('the committed grey copies', () => {
  it('are made with the filter the Mono themes use for other pictures', () => {
    const filters = [...read('src/styles/tokens.css').matchAll(/--art-filter:\s*([^;]*);/g)]
      .map(([, value]) => value!.trim())
      .filter(Boolean);
    expect(filters.length).toBeGreaterThan(0);
    for (const value of filters) expect(value).toBe(`grayscale(1) contrast(${MONO_CONTRAST})`);
  });

  it('sit next to their sources, in mono/', () => {
    expect(monoArtPath('src/assets/voxel/bg/grid.svg')).toBe('src/assets/voxel/bg/mono/grid.svg');
  });

  for (const source of MONO_ART_SOURCES) {
    it(`${monoArtPath(source)} is what \`pnpm art:mono\` writes`, () => {
      const target = monoArtPath(source);
      expect(existsSync(join(ROOT, target)), `${target} is missing: run pnpm art:mono`).toBe(true);
      expect(read(target), `${target} is out of date: run pnpm art:mono`).toBe(
        monoSvg(read(source)),
      );
    });

    it(`${source} holds colour, and its copy holds none`, () => {
      const hue = (svg: string) =>
        [...svg.matchAll(/(?:fill|stroke)="#([0-9a-f]{6})"/gi)].filter(
          ([, hex]) => new Set(hex!.toLowerCase().match(/../g)).size > 1,
        ).length;
      expect(hue(read(source))).toBeGreaterThan(0);
      expect(hue(read(monoArtPath(source)))).toBe(0);
    });
  }
});
