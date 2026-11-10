import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE, LANG_TAG, LOCALES } from '../../src/i18n/locales';
import { bootPrefs, bootScript } from '../../src/prefs/boot';
import {
  DEFAULT_PREFS,
  LIGHT_THEMES,
  MOTION_LEVELS,
  PREFS_CONFIG,
  PREFS_KEY,
  TEXT_SIZES,
  THEMES,
  normalizePrefs,
  resolvePrefs,
  type Prefs,
} from '../../src/prefs/model';

describe('stored preferences', () => {
  it('are one JSON value under a versioned key', () => {
    expect(PREFS_KEY).toBe('zhic:prefs:v1');
  });
  it('default to Night (Q-T2), motion and language following the device, 100 %, keys on', () => {
    expect(DEFAULT_PREFS).toEqual({
      theme: 'night',
      motion: 'auto',
      text: 100,
      lang: 'auto',
      keys: true,
    });
  });
  it('read nothing, garbage or a wrong shape as the defaults', () => {
    for (const raw of [null, undefined, 42, 'night', [], { theme: 7 }])
      expect(normalizePrefs(raw, PREFS_CONFIG)).toEqual(DEFAULT_PREFS);
  });
  it('keep every valid value and drop invalid ones field by field', () => {
    const p = normalizePrefs(
      { theme: 'mono-light', motion: 'calm', text: 130, lang: 'zh-hant', keys: false, extra: 1 },
      PREFS_CONFIG,
    );
    expect(p).toEqual({
      theme: 'mono-light',
      motion: 'calm',
      text: 130,
      lang: 'zh-hant',
      keys: false,
    });
    expect(
      normalizePrefs(
        { theme: 'sepia', motion: 'fast', text: 120, lang: 'zh', keys: 'no' },
        PREFS_CONFIG,
      ),
    ).toEqual(DEFAULT_PREFS);
  });
  it('accept "auto" for theme, motion and language', () => {
    expect(
      normalizePrefs({ theme: 'auto', motion: 'auto', lang: 'auto' }, PREFS_CONFIG),
    ).toMatchObject({ theme: 'auto', motion: 'auto', lang: 'auto' });
  });
  it('store language as auto or one of the locales, from the one locale list', () => {
    expect(PREFS_CONFIG.locales).toEqual(Object.keys(LOCALES));
    for (const locale of Object.keys(LOCALES))
      expect(normalizePrefs({ lang: locale }, PREFS_CONFIG).lang).toBe(locale);
  });
  it('list every choice once', () => {
    expect(THEMES).toEqual(['night', 'day', 'mono-dark', 'mono-light', 'cvd']);
    expect(MOTION_LEVELS).toEqual(['full', 'calm', 'off']);
    expect(TEXT_SIZES).toEqual([100, 115, 130]);
    expect(LIGHT_THEMES.every((t) => THEMES.includes(t))).toBe(true);
  });
});

describe('what a choice shows on a device', () => {
  const dark = { light: false, reduce: false };
  it('auto theme follows light/dark; a chosen theme ignores it', () => {
    const auto: Prefs = { ...DEFAULT_PREFS, theme: 'auto' };
    expect(resolvePrefs(auto, dark).theme).toBe('night');
    expect(resolvePrefs(auto, { ...dark, light: true }).theme).toBe('day');
    expect(resolvePrefs({ ...DEFAULT_PREFS, theme: 'cvd' }, { ...dark, light: true }).theme).toBe(
      'cvd',
    );
    // Night for everyone who has not chosen, whatever the device prefers.
    expect(resolvePrefs(DEFAULT_PREFS, { ...dark, light: true }).theme).toBe('night');
  });
  it('auto motion is full; reduced motion on the device always wins (off)', () => {
    expect(resolvePrefs(DEFAULT_PREFS, dark).motion).toBe('full');
    for (const motion of ['auto', ...MOTION_LEVELS] as const)
      expect(resolvePrefs({ ...DEFAULT_PREFS, motion }, { ...dark, reduce: true }).motion).toBe(
        'off',
      );
    expect(resolvePrefs({ ...DEFAULT_PREFS, motion: 'calm' }, dark).motion).toBe('calm');
  });
  it('text size becomes the --text-scale factor', () => {
    expect(TEXT_SIZES.map((text) => resolvePrefs({ ...DEFAULT_PREFS, text }, dark).scale)).toEqual([
      1, 1.15, 1.3,
    ]);
  });
});

/** A stand-in for the browser globals the head script touches. */
function fakeBrowser(stored: string | null, media: Record<string, boolean> = {}) {
  const attrs: Record<string, string> = {};
  const classes = new Set<string>();
  const style: Record<string, string> = {};
  const metas: Record<string, string> = { 'theme-color': '#0b0f1a', 'color-scheme': 'dark' };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k === PREFS_KEY ? stored : null),
  });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: media[q] ?? false }));
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (k: string, v: string) => (attrs[k] = v),
      classList: { add: (c: string) => classes.add(c) },
      style: { setProperty: (k: string, v: string) => (style[k] = v) },
    },
    querySelector: (sel: string) => {
      const name = /meta\[name="([\w-]+)"\]/.exec(sel)?.[1];
      return name && name in metas
        ? { setAttribute: (_: string, v: string) => (metas[name] = v) }
        : null;
    },
  });
  return { attrs, classes, style, metas };
}

const COLORS = {
  night: '#0b0f1a',
  day: '#f3efe4',
  'mono-dark': '#000',
  'mono-light': '#fff',
  cvd: '#0b0f1a',
} as const;
const CFG = { ...PREFS_CONFIG, key: PREFS_KEY, colors: COLORS, light: LIGHT_THEMES };

describe('the inline head script', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('with nothing stored: Night, full motion with the intro, 100 %, js', () => {
    const b = fakeBrowser(null);
    bootPrefs(CFG, normalizePrefs, resolvePrefs);
    expect(b.attrs).toEqual({ 'data-theme': 'night', 'data-motion': 'full' });
    expect([...b.classes].sort()).toEqual(['intro', 'js', 'motion']);
    expect(b.style).toEqual({});
    expect(b.metas).toEqual({ 'theme-color': '#0b0f1a', 'color-scheme': 'dark' });
  });
  it('applies a stored choice: theme, theme-color, color-scheme, calm, text size', () => {
    const b = fakeBrowser(JSON.stringify({ theme: 'day', motion: 'calm', text: 115 }));
    bootPrefs(CFG, normalizePrefs, resolvePrefs);
    expect(b.attrs).toEqual({ 'data-theme': 'day', 'data-motion': 'calm' });
    expect([...b.classes].sort()).toEqual(['js', 'motion']);
    expect(b.style).toEqual({ '--text-scale': '1.15' });
    expect(b.metas).toEqual({ 'theme-color': '#f3efe4', 'color-scheme': 'light' });
  });
  it('motion off or reduced motion: no motion class at all', () => {
    const b = fakeBrowser(JSON.stringify({ motion: 'full' }), {
      '(prefers-reduced-motion: reduce)': true,
    });
    bootPrefs(CFG, normalizePrefs, resolvePrefs);
    expect(b.attrs['data-motion']).toBe('off');
    expect([...b.classes]).toEqual(['js']);
  });
  it('auto theme reads the device light/dark setting', () => {
    const b = fakeBrowser(JSON.stringify({ theme: 'auto' }), {
      '(prefers-color-scheme: light)': true,
    });
    bootPrefs(CFG, normalizePrefs, resolvePrefs);
    expect(b.attrs['data-theme']).toBe('day');
  });
  it('survives a broken stored value or blocked storage', () => {
    const b = fakeBrowser('{not json');
    bootPrefs(CFG, normalizePrefs, resolvePrefs);
    expect(b.attrs['data-theme']).toBe('night');
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    bootPrefs(CFG, normalizePrefs, resolvePrefs);
    expect(b.attrs['data-theme']).toBe('night');
  });
  it('is self-contained: the inlined text runs on its own', () => {
    const b = fakeBrowser(JSON.stringify({ theme: 'mono-dark', text: 130 }));
    const script = bootScript(COLORS);
    new Function(script)();
    expect(b.attrs['data-theme']).toBe('mono-dark');
    expect(b.style['--text-scale']).toBe('1.3');
    expect(b.metas['theme-color']).toBe('#000');
    // X-R8: small and synchronous (the build gzips it; this is the raw text).
    expect(script.length).toBeLessThan(3000);
  });
});

describe('locales', () => {
  it('one list, English first and the default', () => {
    expect(Object.keys(LOCALES)).toEqual(['en', 'zh-hans', 'zh-hant']);
    expect(DEFAULT_LOCALE).toBe('en');
  });
  it('every lang attribute value is an exact BCP 47 tag, region subtag included', () => {
    expect(Object.values(LOCALES).map((l) => l.lang)).toEqual(['en', 'zh-Hans', 'zh-Hant-HK']);
    for (const { lang } of Object.values(LOCALES)) expect(lang).toMatch(LANG_TAG);
  });
  it('the tag pattern accepts language, script and region, and nothing malformed', () => {
    for (const ok of ['en', 'en-GB', 'zh-Hans', 'zh-Hant-HK', 'zh-HK', 'es-419', 'yue'])
      expect(ok).toMatch(LANG_TAG);
    for (const bad of ['', 'EN', 'zh_hant', 'zh-hant', 'zh-Hant-hk', 'english', 'zh-Hant-HK-x'])
      expect(bad).not.toMatch(LANG_TAG);
  });
});
