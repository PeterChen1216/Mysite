/**
 * The inline <head> script (BaseLayout): applies the stored preferences before the first paint,
 * so a returning visitor never sees the wrong theme, motion or text size (no flash, no layout
 * shift). Synchronous, no network, a few hundred bytes gzipped (scripts/check-js-budget.mjs counts
 * it). Without JavaScript none of this runs and the page is Night, static, at 100 % — the CSS
 * defaults.
 *
 * Sets on <html>: data-theme, data-motion, the `motion` class (loops may run: full or calm), the
 * `intro` class (the load sequence plays: full only), --text-scale (when not 100 %) and the `js`
 * class (settings and pause keys are shown); and the theme-color / color-scheme meta tags.
 */
import {
  LIGHT_THEMES,
  PREFS_CONFIG,
  PREFS_KEY,
  normalizePrefs,
  resolvePrefs,
  type Prefs,
  type PrefsConfig,
  type PrefsEnv,
  type Resolved,
  type Theme,
} from './model';

export interface BootConfig extends PrefsConfig {
  key: string;
  /** Page background per theme, for <meta name="theme-color">. */
  colors: Record<string, string>;
  light: readonly string[];
}

/**
 * Self-contained: it is serialised with Function#toString and inlined, so it may only use its
 * arguments and browser globals.
 */
export function bootPrefs(
  cfg: BootConfig,
  normalize: (raw: unknown, cfg: PrefsConfig) => Prefs,
  resolve: (p: Prefs, env: PrefsEnv) => Resolved,
): void {
  const d = document.documentElement;
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(cfg.key) || 'null');
  } catch {
    raw = null; // storage blocked or the value is not JSON: defaults
  }
  const r = resolve(normalize(raw, cfg), {
    light: matchMedia('(prefers-color-scheme: light)').matches,
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  d.setAttribute('data-theme', r.theme);
  d.setAttribute('data-motion', r.motion);
  if (r.motion !== 'off') d.classList.add('motion');
  if (r.motion === 'full') d.classList.add('intro');
  if (r.scale !== 1) d.style.setProperty('--text-scale', String(r.scale));
  d.classList.add('js');
  const meta = (name: string, value: string | undefined) => {
    const el = document.querySelector(`meta[name="${name}"]`);
    if (el && value) el.setAttribute('content', value);
  };
  meta('theme-color', cfg.colors[r.theme]);
  meta('color-scheme', cfg.light.indexOf(r.theme) >= 0 ? 'light' : 'dark');
}

/** The script text for BaseLayout: the three functions above and their data, called at once. */
export function bootScript(colors: Record<Theme, string>): string {
  const cfg: BootConfig = { ...PREFS_CONFIG, key: PREFS_KEY, colors, light: LIGHT_THEMES };
  return `(${bootPrefs.toString()})(${JSON.stringify(cfg)},${normalizePrefs.toString()},${resolvePrefs.toString()})`;
}
