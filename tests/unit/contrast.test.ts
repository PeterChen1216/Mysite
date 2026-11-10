// Contrast as a unit test over the token table (PLAN-EXPERIENCE §3.5, §9.1): every text token on
// every surface it can sit on, per theme, with and without "more contrast"; UI boundaries at 3:1.
// Text is held to 4.5:1 everywhere — also where large text would only need 3:1.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  luminance,
  over,
  parseColor,
  parseTokenCss,
  resolveTokens,
  type Rgba,
  type TokenContext,
} from '../../src/lib/theme-tokens';
import { CUE_GLYPH, cueFor } from '../../src/lib/cues';
import { THEMES } from '../../src/prefs/model';

const rules = parseTokenCss(readFileSync('src/styles/tokens.css', 'utf8'));
const color = (tokens: Record<string, string>, name: string): Rgba => {
  const c = parseColor(tokens[name] ?? '');
  if (!c) throw new Error(`${name} is not a colour: "${tokens[name]}"`);
  return c;
};
/** Ratio of a (possibly translucent) colour painted on an opaque surface. */
const ratio = (fg: Rgba, bg: Rgba) => contrastRatio(over(fg, bg), bg);

/** Text colours a component may use (tokens.css semantic layer; text-lo is decorative only). */
const TEXT = [
  '--color-text-hi',
  '--color-text-mid',
  '--color-text-bright',
  '--color-accent-terminal-green',
  '--color-accent-diamond',
  '--color-accent-gold',
  '--color-accent-enchant-text',
  '--color-accent-aqua',
  '--color-accent-redstone',
  '--color-link',
  '--color-link-hover',
] as const;

type Surfaces = Record<string, Rgba>;
/** The page's own surfaces: page, cards, inventory slots, and the translucent bars over the page. */
function pageSurfaces(t: Record<string, string>): Surfaces {
  const page = color(t, '--color-bg-night');
  return {
    page,
    panel: color(t, '--color-bg-panel'),
    slot: color(t, '--color-bg-slot'),
    nav: over(color(t, '--color-bg-nav'), page),
    bar: over(color(t, '--color-bg-bar'), page),
    ghost: over(color(t, '--color-bg-panel-ghost'), page),
  };
}
/** Inside a dark object (terminal, git log, chip, tooltip, settings window). */
function islandSurfaces(t: Record<string, string>, page: Rgba): Surfaces {
  const terminal = color(t, '--color-bg-terminal');
  const panel = color(t, '--color-bg-panel');
  return {
    terminal,
    'title bar': panel,
    'chip on terminal': over(color(t, '--color-tooltip-bg'), terminal),
    'chip on page': over(color(t, '--color-tooltip-bg'), page),
    'chip on card': over(color(t, '--color-tooltip-bg'), panel),
    tooltip: over(color(t, '--color-tooltip-bg-solid'), page),
  };
}

const MEDIA: Array<[string, TokenContext['media']]> = [
  ['', {}],
  [' + more contrast', { contrastMore: true }],
  [' + reduced transparency', { reducedTransparency: true }],
];

interface Pair {
  where: string;
  text: string;
  surface: string;
  ratio: number;
}
function pairs(): Pair[] {
  const out: Pair[] = [];
  for (const theme of THEMES)
    for (const [label, media] of MEDIA) {
      const root = resolveTokens(rules, { theme, media });
      const island = resolveTokens(rules, { theme, island: true, media });
      const page = color(root, '--color-bg-night');
      for (const [ctx, tokens, surfaces] of [
        ['page', root, pageSurfaces(root)],
        ['dark object', island, islandSurfaces(island, page)],
      ] as const)
        for (const text of [...TEXT, ...(ctx === 'dark object' ? ['--color-paper'] : [])])
          for (const [surface, bg] of Object.entries(surfaces))
            out.push({
              where: `${theme}${label}, ${ctx}`,
              text,
              surface,
              ratio: ratio(color(tokens, text), bg),
            });
    }
  return out;
}

describe('text contrast ≥ 4.5:1, every theme', () => {
  const all = pairs();
  const groups = [...new Set(all.map((p) => p.where))];
  it('covers every theme, both contexts and the contrast modes', () => {
    expect(groups).toHaveLength(THEMES.length * MEDIA.length * 2);
    expect(all.length).toBeGreaterThan(800);
  });
  // One test per theme × mode × context; a failure lists every pair under 4.5 with its ratio.
  it.each(groups)('%s', (where) => {
    const low = all
      .filter((p) => p.where === where && p.ratio < 4.5)
      .map((p) => `${p.text} on ${p.surface}: ${p.ratio.toFixed(2)}`);
    expect(low).toEqual([]);
  });
});

describe('UI boundaries ≥ 3:1', () => {
  for (const theme of THEMES) {
    const root = resolveTokens(rules, { theme });
    const island = resolveTokens(rules, { theme, island: true });
    it(`${theme}: the focus ring stands out from every surface it is drawn on`, () => {
      for (const [tokens, surfaces] of [
        [root, pageSurfaces(root)],
        [island, islandSurfaces(island, color(root, '--color-bg-night'))],
      ] as const)
        for (const [name, bg] of Object.entries(surfaces))
          expect(ratio(color(tokens, '--color-focus'), bg), name).toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: MC buttons — label 4.5:1 on the fill, the button's edge 3:1 on the page`, () => {
      const page = color(root, '--color-bg-night');
      for (const kind of ['stone', 'grass', 'hover', 'grass-hover']) {
        const bg = color(root, `--mc-${kind}-bg`);
        const fgName = kind === 'grass-hover' ? '--mc-grass-fg' : `--mc-${kind}-fg`;
        expect(ratio(color(root, fgName), bg), `${kind} label`).toBeGreaterThanOrEqual(4.5);
        const edge = Math.max(ratio(bg, page), ratio(color(root, '--mc-border'), page));
        expect(edge, `${kind} edge`).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${theme}: settings radios — the box and the checked mark on the window`, () => {
      const bg = color(island, '--color-bg-panel');
      expect(ratio(color(island, '--color-text-mid'), bg)).toBeGreaterThanOrEqual(3);
      expect(
        ratio(color(island, '--color-accent-terminal-green'), color(island, '--color-bg-terminal')),
      ).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('the themes are what they say', () => {
  const page = (theme: string) => color(resolveTokens(rules, { theme }), '--color-bg-night');
  it('Night is the page without JavaScript; CVD keeps its ground', () => {
    expect(resolveTokens(rules, { theme: null })['--color-bg-night']).toBe('#0b0f1a');
    expect(resolveTokens(rules, { theme: 'night' })['--color-bg-night']).toBe('#0b0f1a');
    expect(resolveTokens(rules, { theme: 'cvd' })['--color-bg-night']).toBe('#0b0f1a');
  });
  it('Day and Mono light are light pages; Night, Mono dark and CVD dark', () => {
    for (const t of ['day', 'mono-light']) expect(luminance(page(t))).toBeGreaterThan(0.8);
    for (const t of ['night', 'mono-dark', 'cvd']) expect(luminance(page(t))).toBeLessThan(0.02);
  });
  it('in Day the dark objects keep a dark ground (terminals stay dark)', () => {
    const island = resolveTokens(rules, { theme: 'day', island: true });
    expect(luminance(color(island, '--color-bg-terminal'))).toBeLessThan(0.02);
    expect(island['--color-text-hi']).toBe('#e6edf3');
  });
  it('Mono uses no hue: every colour token is a grey', () => {
    for (const theme of ['mono-dark', 'mono-light'])
      for (const ctx of [false, true]) {
        const t = resolveTokens(rules, { theme, island: ctx });
        for (const name of [...TEXT, '--color-bg-night', '--color-bg-panel', '--color-focus']) {
          const { r, g, b } = color(t, name);
          expect(Math.max(r, g, b) - Math.min(r, g, b), `${theme} ${name}`).toBeLessThanOrEqual(2);
        }
      }
  });
  it('the cues show everywhere but Night (and in Night with more contrast)', () => {
    const cue = (ctx: TokenContext) => resolveTokens(rules, ctx)['--cue-on'];
    expect(cue({ theme: 'night' })).toBe('0');
    for (const theme of THEMES.filter((t) => t !== 'night')) {
      expect(cue({ theme }), theme).toBe('1');
      expect(cue({ theme, island: true }), `${theme} dark object`).toBe('1');
    }
    expect(cue({ theme: 'night', media: { contrastMore: true } })).toBe('1');
    expect(cue({ theme: 'night', media: { forcedColors: true } })).toBe('1');
  });
  it('print is Mono light whatever the theme', () => {
    for (const theme of [null, ...THEMES]) {
      const t = resolveTokens(rules, { theme, media: { print: true } });
      expect(t['--color-bg-night']).toBe('#fff');
      expect(t['--color-text-hi']).toBe('#000');
    }
  });
});

describe('the token reader', () => {
  it('refuses selectors and media it does not model, so it cannot drift from tokens.css', () => {
    expect(() => resolveTokens(parseTokenCss('.card { --x: #000; }'), { theme: null })).toThrow(
      /not understood/,
    );
    expect(() =>
      resolveTokens(parseTokenCss('@media (min-width: 1px) { :root { --x: #000; } }'), {
        theme: null,
      }),
    ).toThrow(/not understood/);
  });
  it('resolves var() chains and fallbacks; leaves unknown variables as written', () => {
    const r = parseTokenCss(
      ':root { --a: #123456; --b: var(--a); --c: var(--nope, #fff); --d: var(--font-x); }',
    );
    expect(resolveTokens(r, { theme: null })).toMatchObject({
      '--b': '#123456',
      '--c': '#fff',
      '--d': 'var(--font-x)',
    });
    expect(() =>
      resolveTokens(parseTokenCss(':root { --a: var(--b); --b: var(--a); }'), { theme: null }),
    ).toThrow(/cycle/);
  });
  it('parses the colour forms tokens.css uses', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rgb(10 20 30 / 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor('red')).toBeNull();
    expect(contrastRatio(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 5);
  });
});

describe('redundant cues (WCAG 1.4.1)', () => {
  it('one distinct glyph per colour role', () => {
    const glyphs = Object.values(CUE_GLYPH);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
  it('the plan’s examples: [XP] ◆ (green), [NOW] ▶ (gold), [WORK] ■ (enchant)', () => {
    expect([cueFor('green'), cueFor('gold'), cueFor('enchant')]).toEqual(['◆', '▶', '■']);
  });
  it('tones of one colour share a glyph; neutral tones have none', () => {
    expect(cueFor('grass')).toBe(cueFor('green'));
    expect(cueFor('cyan')).toBe(cueFor('diamond'));
    expect(cueFor('redstone')).toBe('▲');
    expect(cueFor('white')).toBeUndefined();
  });
});
