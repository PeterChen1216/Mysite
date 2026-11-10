/**
 * Preferences at run time (PLAN-EXPERIENCE §2): the settings window, the pause key and the
 * keyboard shortcuts change them here; the inline head script (src/prefs/boot.ts) applied the
 * saved ones before first paint with the same normalizePrefs / resolvePrefs.
 *
 * Every change that affects motion — a new level, the device's reduced-motion setting, pause —
 * ends in one `zhic:motion` event on document, after <html> has its new classes, so the scripted
 * loops (globe, phone clock) can follow.
 */
import {
  DEFAULT_PREFS,
  LIGHT_THEMES,
  PREFS_CONFIG,
  PREFS_KEY,
  normalizePrefs,
  resolvePrefs,
  type Prefs,
  type Resolved,
} from '../prefs/model';

export const MOTION_EVENT = 'zhic:motion';

const html = document.documentElement;
const light = matchMedia('(prefers-color-scheme: light)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function load(): Prefs {
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'), PREFS_CONFIG);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let prefs = load();

export const getPrefs = (): Prefs => prefs;

/** What the page shows now: the choice, resolved against the device's settings. */
export const resolved = (): Resolved =>
  resolvePrefs(prefs, { light: light.matches, reduce: reduce.matches });

/** True while loops may run: motion full or calm, and not paused. */
export const loopsAllowed = (): boolean =>
  html.classList.contains('motion') && !html.hasAttribute('data-paused') && !reduce.matches;

/** True when hover bursts may play: motion full, not paused. */
export const burstsAllowed = (): boolean =>
  loopsAllowed() && html.getAttribute('data-motion') === 'full';

const announce = () => document.dispatchEvent(new CustomEvent(MOTION_EVENT));

function meta(name: string, value: string) {
  document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', value);
}

/** Put the current preferences on <html> (as the head script does at load). */
export function apply(): void {
  const r = resolved();
  html.setAttribute('data-theme', r.theme);
  html.setAttribute('data-motion', r.motion);
  html.classList.toggle('motion', r.motion !== 'off');
  // The intro plays once, at load; a change of level never replays it.
  if (r.motion !== 'full') html.classList.remove('intro');
  if (r.scale === 1) html.style.removeProperty('--text-scale');
  else html.style.setProperty('--text-scale', String(r.scale));
  meta('theme-color', getComputedStyle(html).getPropertyValue('--color-bg-night').trim());
  meta('color-scheme', LIGHT_THEMES.includes(r.theme) ? 'light' : 'dark');
  announce();
}

function save() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked (private mode, site data off): the choice holds for this page only.
  }
}

/** Change some preferences, save them and show them at once. */
export function setPrefs(patch: Partial<Prefs>): void {
  prefs = normalizePrefs({ ...prefs, ...patch }, PREFS_CONFIG);
  save();
  apply();
}

/** Back to the defaults (and forget the saved value). */
export function resetPrefs(): void {
  prefs = { ...DEFAULT_PREFS };
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    // nothing saved, nothing to forget
  }
  apply();
}

export const isPaused = (): boolean => html.hasAttribute('data-paused');

/** Pause-all (WCAG 2.2.2): holds every loop until resumed. Not saved: it is for this visit. */
export function setPaused(on: boolean): void {
  if (on) {
    html.setAttribute('data-paused', '');
    html.classList.remove('intro'); // a held intro would leave words half drawn
  } else html.removeAttribute('data-paused');
  announce();
}

/** Follow the device (auto theme, reduced motion) and other tabs (storage) while open. */
export function initPrefs(): void {
  light.addEventListener('change', () => {
    if (prefs.theme === 'auto') apply();
  });
  reduce.addEventListener('change', apply);
  addEventListener('storage', (e) => {
    if (e.key !== PREFS_KEY && e.key !== null) return;
    prefs = load();
    apply();
  });
}
