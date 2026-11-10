import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  admitParticles,
  entranceAllowed,
  externalHost,
  filterRgb,
  paletteOf,
  parseRgb,
  placeTooltip,
  rgbCss,
  rovingIndex,
  typeMs,
} from '../../src/lib/interact';
import { layerOffset, moteAt, motes, seeded, starAt, starLayers } from '../../src/lib/ambient';
import { THEME_ALIASES, runCommand, type PromptWords } from '../../src/lib/prompt';
import { AMBIENT, ENTER, HOVER, PARTICLES } from '../../src/motion/params';

describe('particles (PLAN-EXPERIENCE §6, acceptance E: at most 60 alive)', () => {
  it('admits a burst whole while there is room', () => {
    expect(admitParticles(0, 16, 60)).toEqual({ retire: 0, add: 16 });
    expect(admitParticles(44, 16, 60)).toEqual({ retire: 0, add: 16 });
  });
  it('retires the oldest to stay at the cap', () => {
    expect(admitParticles(48, 16, 60)).toEqual({ retire: 4, add: 16 });
    expect(admitParticles(60, 16, 60)).toEqual({ retire: 16, add: 16 });
  });
  it('never adds more than the cap, nor less than nothing', () => {
    expect(admitParticles(0, 100, 60)).toEqual({ retire: 0, add: 60 });
    expect(admitParticles(30, 100, 60)).toEqual({ retire: 30, add: 60 });
    expect(admitParticles(10, -3, 60)).toEqual({ retire: 0, add: 0 });
  });
  it('keeps any number of bursts within the cap', () => {
    let alive = 0;
    for (let i = 0; i < 20; i++) {
      const { retire, add } = admitParticles(alive, PARTICLES.count, PARTICLES.cap);
      alive = alive - retire + add;
      expect(alive).toBeLessThanOrEqual(PARTICLES.cap);
    }
    expect(alive).toBe(PARTICLES.cap);
  });
});

describe('colours of a block (row 1)', () => {
  it('reads hex and rgb() values', () => {
    expect(parseRgb('#7cbd4f')).toEqual([124, 189, 79]);
    expect(parseRgb('#fff')).toEqual([255, 255, 255]);
    expect(parseRgb('rgb(124, 189, 79)')).toEqual([124, 189, 79]);
    expect(parseRgb('rgb(124 189 79 / 0.5)')).toEqual([124, 189, 79]);
    expect(parseRgb('rgba(1, 2, 3, 0.4)')).toEqual([1, 2, 3]);
    expect(parseRgb('green')).toBeNull();
  });
  it('writes a canvas colour', () => {
    expect(rgbCss([124, 189, 79])).toBe('#7cbd4f');
    expect(rgbCss([0, 300, -4])).toBe('#00ff00');
  });
  it('applies the themes’ art filter as CSS does', () => {
    const grass: [number, number, number] = [124, 189, 79];
    // Colour themes: no filter, no change.
    expect(filterRgb(grass, '')).toEqual(grass);
    expect(filterRgb(grass, 'none')).toEqual(grass);
    // Mono: grey (equal channels), from the luminance weights, then the contrast.
    const grey = filterRgb(grass, 'grayscale(1)');
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
    expect(grey[0]).toBe(Math.round(0.2126 * 124 + 0.7152 * 189 + 0.0722 * 79));
    const mono = filterRgb(grass, 'grayscale(1) contrast(1.15)');
    expect(mono[0]).toBe(Math.round(((grey[0] / 255 - 0.5) * 1.15 + 0.5) * 255));
    expect(filterRgb([200, 10, 10], 'grayscale(50%)')[0]).toBeLessThan(200);
    // The globe's land filters: brightness(0) is black, then invert(1) white.
    expect(filterRgb(grass, 'brightness(0)')).toEqual([0, 0, 0]);
    expect(filterRgb(grass, 'brightness(0) invert(1)')).toEqual([255, 255, 255]);
    // A drop-shadow after it changes no colour.
    expect(filterRgb(grass, 'drop-shadow(rgb(0 0 0 / 0.35) 6px 6px 0px)')).toEqual(grass);
  });
  it('finds a picture’s own palette, most used first, ignoring see-through pixels', () => {
    const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];
    const data = [
      ...px(1, 2, 3),
      ...px(1, 2, 3),
      ...px(1, 2, 3),
      ...px(9, 9, 9),
      ...px(9, 9, 9),
      ...px(7, 7, 7),
      ...px(5, 5, 5, 0),
      ...px(5, 5, 5, 0),
      ...px(5, 5, 5, 0),
      ...px(5, 5, 5, 0),
    ];
    expect(paletteOf(data, 2)).toEqual([
      [1, 2, 3],
      [9, 9, 9],
    ]);
    expect(paletteOf(data)).toHaveLength(3);
    expect(paletteOf([])).toEqual([]);
  });
});

describe('roving focus (row 3)', () => {
  it('moves with the arrows, jumps with Home / End, stops at the ends', () => {
    expect(rovingIndex(0, 5, 'ArrowRight')).toBe(1);
    expect(rovingIndex(0, 5, 'ArrowDown')).toBe(1);
    expect(rovingIndex(4, 5, 'ArrowRight')).toBe(4);
    expect(rovingIndex(2, 5, 'ArrowLeft')).toBe(1);
    expect(rovingIndex(0, 5, 'ArrowUp')).toBe(0);
    expect(rovingIndex(3, 5, 'Home')).toBe(0);
    expect(rovingIndex(1, 5, 'End')).toBe(4);
  });
  it('ignores other keys and empty lists', () => {
    expect(rovingIndex(1, 5, 'Tab')).toBeNull();
    expect(rovingIndex(1, 5, 'a')).toBeNull();
    expect(rovingIndex(0, 0, 'ArrowRight')).toBeNull();
  });
});

describe('tooltip placement (WCAG 1.4.13: never over what it belongs to)', () => {
  const view = { width: 1000, height: 800 };
  const tip = { width: 200, height: 50 };
  const overlaps = (a: { left: number; top: number; width: number; height: number }, b: typeof a) =>
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height;
  it('rises above the anchor, centred, with a gap', () => {
    const anchor = { left: 400, top: 300, width: 100, height: 30 };
    const p = placeTooltip(anchor, tip, view, 6);
    expect(p).toEqual({ left: 350, top: 244, side: 'above' });
    expect(overlaps({ ...p, ...tip }, anchor)).toBe(false);
  });
  it('goes below when there is no room above', () => {
    const anchor = { left: 400, top: 20, width: 100, height: 30 };
    const p = placeTooltip(anchor, tip, view, 6);
    expect(p.side).toBe('below');
    expect(p.top).toBe(56);
    expect(overlaps({ ...p, ...tip }, anchor)).toBe(false);
  });
  it('stays inside the viewport sideways', () => {
    expect(placeTooltip({ left: 2, top: 300, width: 20, height: 20 }, tip, view).left).toBe(8);
    expect(placeTooltip({ left: 990, top: 300, width: 10, height: 20 }, tip, view).left).toBe(792);
  });
  it('stays above when neither side has room (it still never covers the anchor)', () => {
    const p = placeTooltip({ left: 400, top: 30, width: 100, height: 760 }, tip, view, 6);
    expect(p.side).toBe('above');
  });
});

describe('external links (row 13)', () => {
  const page = 'https://zhic.me/v2/';
  it('names the host a link leaves for', () => {
    expect(externalHost('https://github.com/PeterChen1216', page)).toBe('github.com');
    expect(externalHost('https://www.linkedin.com/in/x/', page)).toBe('linkedin.com');
    expect(externalHost('http://example.org/a', page)).toBe('example.org');
  });
  it('says nothing for the site itself, anchors, mail and junk', () => {
    expect(externalHost('/v2/resume.pdf', page)).toBeNull();
    expect(externalHost('#contact', page)).toBeNull();
    expect(externalHost('https://zhic.me/legacy/', page)).toBeNull();
    expect(externalHost('mailto:someone@example.org', page)).toBeNull();
    expect(externalHost('http://[::1', page)).toBeNull();
  });
});

describe('entrances (row 14 and the chunk-load transitions)', () => {
  const full = { motion: 'full' as const, paused: false, reduced: false, tier: 1 };
  it('the header types at motion full on any moving tier; the chunk-load needs tier 2', () => {
    expect(entranceAllowed(full, 'header')).toBe(true);
    expect(entranceAllowed(full, 'chunk')).toBe(false);
    expect(entranceAllowed({ ...full, tier: 2 }, 'chunk')).toBe(true);
    expect(entranceAllowed({ ...full, tier: 3 }, 'chunk')).toBe(true);
  });
  it('never at calm, off, paused, with reduced motion or at tier 0', () => {
    for (const s of [
      { ...full, motion: 'calm' as const },
      { ...full, motion: 'off' as const },
      { ...full, paused: true },
      { ...full, reduced: true },
      { ...full, tier: 0 },
    ]) {
      expect(entranceAllowed({ ...s, tier: Math.max(s.tier, 0) }, 'header')).toBe(false);
      expect(entranceAllowed({ ...s, tier: s.tier === 0 ? 0 : 3 }, 'chunk')).toBe(false);
    }
  });
  it('types a command per character, within limits', () => {
    expect(typeMs(1, HOVER.header)).toBe(HOVER.header.minMs);
    expect(typeMs(20, HOVER.header)).toBe(
      Math.max(HOVER.header.minMs, 20 * HOVER.header.msPerChar),
    );
    expect(typeMs(500, HOVER.header)).toBe(HOVER.header.maxMs);
  });
  it('the stagger and margins are positive', () => {
    expect(ENTER.staggerMs).toBeGreaterThan(0);
    expect(ENTER.dashUntil).toBeGreaterThan(0);
    expect(ENTER.dashUntil).toBeLessThan(1);
  });
});

describe('the ambient layer (tier 2, §7.4)', () => {
  it('is the same sky every time', () => {
    const a = seeded(3);
    const b = seeded(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seeded(4)()).not.toBe(seeded(3)());
    for (let i = 0, r = seeded(9); i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('three layers with the plan’s scroll factors, denser far away', () => {
    const layers = starLayers(1000, 1000, AMBIENT.factors, AMBIENT.density, AMBIENT.sizes);
    expect(layers.map((l) => l.factor)).toEqual([0.2, 0.5, 1]);
    expect(layers.map((l) => l.stars.length)).toEqual([...AMBIENT.density]);
    expect(layers[0]!.stars.length).toBeGreaterThan(layers[2]!.stars.length);
    for (const l of layers)
      for (const s of l.stars) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThan(1);
        expect(s.tone).toBeLessThan(3);
      }
    // A small view still has a star per layer; sizes default to 2.
    const tiny = starLayers(10, 10, [0.2], [1], []);
    expect(tiny[0]!.stars).toHaveLength(1);
    expect(tiny[0]!.size).toBe(2);
  });
  it('each layer moves by its factor of the scroll, wrapped to the view', () => {
    expect(layerOffset(0, 0.2, 800)).toBe(0);
    expect(layerOffset(100, 0.2, 800)).toBeCloseTo(20);
    expect(layerOffset(100, 1, 800)).toBe(100);
    expect(layerOffset(1000, 1, 800)).toBe(200);
    expect(layerOffset(-100, 1, 800)).toBe(700);
    expect(layerOffset(50, 1, 0)).toBe(0);
  });
  it('places stars on whole pixels inside the view', () => {
    const s = { x: 0.5, y: 0.1, tone: 0, alpha: 1 };
    expect(starAt(s, 0, 1000, 800)).toEqual({ x: 500, y: 80 });
    expect(starAt(s, 100, 1000, 800)).toEqual({ x: 500, y: 780 });
  });
  it('motes rise through their band, fading in and out, and come round again', () => {
    const [m] = motes(1, 2, 5);
    const at = (t: number) => moteAt(m!, t, 400, 800, 500, AMBIENT.moteRisePxPerS);
    const a = at(0);
    expect(a.y).toBeLessThanOrEqual(800);
    expect(a.y).toBeGreaterThanOrEqual(300);
    // Later it is higher (smaller y) until it wraps.
    const b = at(1);
    expect(b.y).toBeLessThanOrEqual(a.y);
    const period = 500 / (AMBIENT.moteRisePxPerS * m!.speed);
    expect(at(period).y).toBeCloseTo(a.y, -1);
    for (let t = 0; t < period; t += period / 20) {
      const p = at(t);
      expect(p.alpha).toBeGreaterThanOrEqual(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
    }
    expect(motes(AMBIENT.motes)).toHaveLength(AMBIENT.motes);
  });
});

const words: PromptWords = {
  help: ['help — this list', 'theme night | day — change the theme'],
  not_found: 'command not found: {cmd} — try help',
  theme_set: 'theme: {name}',
  opening: 'opening {name}…',
  whoami: 'Someone — Something @ Somewhere.',
  interests: 'a/   b/',
  sections: ['~/about', '~/projects'],
  resume: { href: '/v2/resume.pdf', name: 'resume.pdf' },
  themes: {
    night: 'Night',
    day: 'Day',
    'mono-dark': 'Mono dark',
    'mono-light': 'Mono light',
    cvd: 'Colour-blind safe',
    auto: 'Auto',
  },
};

describe('the terminal prompt (row 12): only what the page says', () => {
  it('help, whoami, ls, cat interests.txt', () => {
    expect(runCommand('help', words)).toEqual({ lines: words.help });
    expect(runCommand('  WHOAMI ', words)).toEqual({ lines: [words.whoami] });
    expect(runCommand('ls', words)).toEqual({ lines: ['~/about  ~/projects'] });
    expect(runCommand('cat interests.txt', words)).toEqual({ lines: [words.interests] });
    expect(runCommand('cat ~/interests.txt', words)).toEqual({ lines: [words.interests] });
  });
  it('open resume opens the résumé link', () => {
    expect(runCommand('open resume', words)).toEqual({
      lines: ['opening resume.pdf…'],
      action: { kind: 'open', href: '/v2/resume.pdf' },
    });
    expect(runCommand('open resume.pdf', words).action).toEqual({
      kind: 'open',
      href: '/v2/resume.pdf',
    });
  });
  it('theme takes the ids and the in-world names', () => {
    expect(runCommand('theme mono', words)).toEqual({
      lines: ['theme: Mono dark'],
      action: { kind: 'theme', theme: 'mono-dark' },
    });
    expect(runCommand('theme Paper', words).action).toEqual({ kind: 'theme', theme: 'mono-light' });
    expect(runCommand('theme prism', words).action).toEqual({ kind: 'theme', theme: 'cvd' });
    for (const [alias, theme] of Object.entries(THEME_ALIASES))
      expect(runCommand(`theme ${alias}`, words).action).toEqual({ kind: 'theme', theme });
    // An unknown theme shows how to use it.
    expect(runCommand('theme pink', words)).toEqual({ lines: [words.help[1]] });
  });
  it('clear and exit', () => {
    expect(runCommand('clear', words)).toEqual({ lines: [], action: { kind: 'clear' } });
    expect(runCommand('exit', words)).toEqual({ lines: [], action: { kind: 'exit' } });
    expect(runCommand('quit', words).action).toEqual({ kind: 'exit' });
  });
  it('anything else is not found (and an empty line is nothing)', () => {
    expect(runCommand('sudo rm -rf /', words)).toEqual({
      lines: ['command not found: sudo rm -rf / — try help'],
    });
    expect(runCommand('cat /etc/passwd', words).lines[0]).toMatch(/^command not found/);
    expect(runCommand('open sesame', words).lines[0]).toMatch(/^command not found/);
    expect(runCommand('   ', words)).toEqual({ lines: [] });
    expect(runCommand('x'.repeat(100), words).lines[0]!.length).toBeLessThan(80);
  });
});

describe('the catalogue’s keyframes stay in step with params.ts', () => {
  const css = readFileSync('src/styles/motion.css', 'utf8');
  it('the chunk-load border turns solid at ENTER.dashUntil', () => {
    const m = /@keyframes enter-solid\s*\{\s*0%,\s*(\d+)%/.exec(css);
    expect(Number(m?.[1]) / 100).toBe(ENTER.dashUntil);
  });
});
