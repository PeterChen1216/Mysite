/**
 * Visitor preferences (PLAN-EXPERIENCE §2): what can be chosen, how a stored value is read, and
 * how a choice plus the device's settings becomes what the page shows. One JSON value in
 * localStorage under PREFS_KEY; nothing is sent anywhere.
 *
 * normalizePrefs and resolvePrefs run twice: inlined into <head> before first paint
 * (src/prefs/boot.ts, as their source text) and imported by src/scripts/prefs.ts. They must stay
 * self-contained — no imports, no module-level values — which is why the lists come in `cfg`.
 */
import { LOCALES } from '../i18n/locales.ts';

export const PREFS_KEY = 'zhic:prefs:v1';

/** Night is the design as shipped; Day keeps terminals dark; CVD = colour-blind safe (Okabe–Ito). */
export const THEMES = ['night', 'day', 'mono-dark', 'mono-light', 'cvd'] as const;
export type Theme = (typeof THEMES)[number];
/** Themes with a light page; the others are dark (color-scheme, theme-color). */
export const LIGHT_THEMES: readonly Theme[] = ['day', 'mono-light'];

/** full = everything; calm = no intro, no particles, loops slowed; off = static. */
export const MOTION_LEVELS = ['full', 'calm', 'off'] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

/** Text size in per cent. */
export const TEXT_SIZES = [100, 115, 130] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Prefs {
  /** 'auto' follows the device's light/dark setting (Night or Day). */
  theme: Theme | 'auto';
  /** 'auto' follows the device's reduced-motion setting (full or off). */
  motion: MotionLevel | 'auto';
  text: TextSize;
  /**
   * The visitor's language choice, stored for X2 (which adds the settings row and the per-locale
   * pages); 'auto' follows the browser. Not applied to the page: each page has its own `lang`.
   */
  lang: keyof typeof LOCALES | 'auto';
  /** Single-key shortcuts (`,` settings, `p` pause); WCAG 2.1.4 asks for a way to turn them off. */
  keys: boolean;
}

/**
 * Defaults for a visitor who has not chosen. Theme is Night, not 'auto' (open question Q-T2,
 * default answer: Night for everyone who has not chosen; contrast and forced colours are always
 * honoured by CSS); everything else follows the device.
 */
export const DEFAULT_PREFS: Prefs = {
  theme: 'night',
  motion: 'auto',
  text: 100,
  lang: 'auto',
  keys: true,
};

export interface PrefsConfig {
  themes: readonly string[];
  motions: readonly string[];
  sizes: readonly number[];
  locales: readonly string[];
  defaults: Prefs;
}

export const PREFS_CONFIG: PrefsConfig = {
  themes: THEMES,
  motions: MOTION_LEVELS,
  sizes: TEXT_SIZES,
  locales: Object.keys(LOCALES),
  defaults: DEFAULT_PREFS,
};

/** What the device says (matchMedia). */
export interface PrefsEnv {
  /** prefers-color-scheme: light */
  light: boolean;
  /** prefers-reduced-motion: reduce */
  reduce: boolean;
}

export interface Resolved {
  theme: Theme;
  motion: MotionLevel;
  /** --text-scale */
  scale: number;
}

/** A stored value (anything JSON.parse gave, or null) as valid Prefs; unknown fields dropped. */
export function normalizePrefs(raw: unknown, cfg: PrefsConfig): Prefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <T>(value: unknown, allowed: readonly unknown[], fallback: T): T =>
    allowed.indexOf(value) >= 0 ? (value as T) : fallback;
  const d = cfg.defaults;
  return {
    theme: pick(o.theme, ['auto'].concat(cfg.themes), d.theme),
    motion: pick(o.motion, ['auto'].concat(cfg.motions), d.motion),
    text: pick(o.text, cfg.sizes, d.text),
    lang: pick(o.lang, ['auto'].concat(cfg.locales), d.lang),
    keys: typeof o.keys === 'boolean' ? o.keys : d.keys,
  };
}

/**
 * The page a choice gives on this device. The device's reduced-motion setting always wins: it
 * can only lower motion, never be overridden into more of it.
 */
export function resolvePrefs(p: Prefs, env: PrefsEnv): Resolved {
  const theme: Theme = p.theme === 'auto' ? (env.light ? 'day' : 'night') : p.theme;
  const motion: MotionLevel = env.reduce ? 'off' : p.motion === 'auto' ? 'full' : p.motion;
  return { theme, motion, scale: p.text / 100 };
}
