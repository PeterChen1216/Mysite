/**
 * Preferences at run time (PLAN-EXPERIENCE §2): the settings window, the pause key and the
 * keyboard shortcuts change them here; the inline head script (src/prefs/boot.ts) applied the
 * saved ones before first paint with the same normalizePrefs / resolvePrefs.
 *
 * Every change ends in events on document, after <html> has its new attributes and classes:
 * `zhic:prefs` (anything changed: the settings window re-reads its form) and `zhic:motion`
 * (motion level, the device's reduced-motion setting or pause: the scripted loops — globe,
 * phone clock — follow it).
 *
 * The entry points (nav gear, footer `prefs`, the `,` key) open the settings window, whose code
 * is loaded on first use (src/scripts/settings.ts). The pause key (nav ⏸, or `p`) holds every
 * loop (WCAG 2.2.2). Single-key shortcuts work only when focus is not in a field and can be
 * turned off in the window (WCAG 2.1.4).
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
import { applyTier, contrastQuery } from './tier';

export const MOTION_EVENT = 'zhic:motion';
export const PREFS_EVENT = 'zhic:prefs';
/** The shortcut keys (copy.yaml prefs.keys.note names them). */
export const KEY_SETTINGS = ',';
export const KEY_PAUSE = 'p';

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

export const isPaused = (): boolean => html.hasAttribute('data-paused');

/** True while loops may run: motion full or calm, and not paused. */
export const loopsAllowed = (): boolean =>
  html.classList.contains('motion') && !isPaused() && !reduce.matches;

/** True when hover bursts may play: motion full, not paused. */
export const burstsAllowed = (): boolean =>
  loopsAllowed() && html.getAttribute('data-motion') === 'full';

function announce() {
  document.dispatchEvent(new CustomEvent(PREFS_EVENT));
  document.dispatchEvent(new CustomEvent(MOTION_EVENT));
}

function meta(name: string, value: string) {
  if (value) document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', value);
}

/** Put the current preferences on <html> (as the head script does at load). */
export function apply(): void {
  const r = resolved();
  html.setAttribute('data-theme', r.theme);
  html.setAttribute('data-motion', r.motion);
  // Loops run unless the motion level or the graphics tier (src/scene/tier.ts) says static.
  const tier = applyTier(r.motion).tier;
  html.classList.toggle('motion', r.motion !== 'off' && tier > 0);
  // The intro plays once, at load; a change of level never replays it.
  if (r.motion !== 'full') html.classList.remove('intro');
  if (r.scale === 1) html.style.removeProperty('--text-scale');
  else html.style.setProperty('--text-scale', String(r.scale));
  meta('theme-color', getComputedStyle(html).getPropertyValue('--color-bg-night').trim());
  meta('color-scheme', LIGHT_THEMES.includes(r.theme) ? 'light' : 'dark');
  // Both events, whatever changed: the loops re-check what may run (cheap).
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

/** Pause-all (WCAG 2.2.2): holds every loop until resumed. Not saved: it is for this visit. */
export function setPaused(on: boolean): void {
  if (on) {
    html.setAttribute('data-paused', '');
    html.classList.remove('intro'); // a held intro would leave words half drawn
  } else html.removeAttribute('data-paused');
  for (const key of document.querySelectorAll('[data-pause]'))
    key.setAttribute('aria-pressed', String(on));
  announce();
}

/** Open the settings window (loaded on first use), returning focus to `opener` on close. */
export async function openSettings(opener?: Element | null): Promise<void> {
  const { showSettings } = await import('./settings');
  showSettings(opener instanceof HTMLElement ? opener : null);
}

/** Focus is somewhere typing happens: shortcuts stay out of the way. */
function inField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
    null
  );
}

/** Follow the device and other tabs; wire the entry points and the shortcuts. */
export function initPrefs(): void {
  // The head script set the static tier; the others are decided here (they look the same).
  applyTier(resolved().motion);
  light.addEventListener('change', () => {
    if (prefs.theme === 'auto') apply();
  });
  reduce.addEventListener('change', apply);
  contrastQuery.addEventListener('change', apply);
  addEventListener('storage', (e) => {
    if (e.key !== PREFS_KEY && e.key !== null) return;
    prefs = load();
    apply();
  });

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const open = target?.closest('[data-prefs-open]');
    if (open) {
      e.preventDefault();
      void openSettings(open);
      return;
    }
    if (target?.closest('[data-pause]')) setPaused(!isPaused());
  });

  document.addEventListener('keydown', (e) => {
    if (!prefs.keys || e.defaultPrevented || e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey || inField(e.target)) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === KEY_SETTINGS) {
      e.preventDefault();
      void openSettings(document.activeElement);
    } else if (e.key.toLowerCase() === KEY_PAUSE) {
      e.preventDefault();
      setPaused(!isPaused());
    }
  });
}
