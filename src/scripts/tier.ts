/**
 * The graphics tier at run time (PLAN-EXPERIENCE §7.2; the rules are src/scene/tier.ts). Reads the
 * signals once, keeps what the WebGL probe and the watchdog learn, and re-decides whenever the
 * motion level changes (src/scripts/prefs.ts apply): `html[data-tier]` and `[data-tier-reason]`.
 * Tier 0 holds every loop as motion "off" does (no `motion` class).
 */
import type { MotionLevel } from '../prefs/model';
import {
  TIER_SESSION_KEY,
  decideTier,
  parseTierQuery,
  type Tier,
  type TierChoice,
  type TierSignals,
} from '../scene/tier';

const html = document.documentElement;

function sessionTier(): Tier | null {
  try {
    const v = sessionStorage.getItem(TIER_SESSION_KEY);
    return v === '1' || v === '2' ? (Number(v) as Tier) : null;
  } catch {
    return null;
  }
}

const nav = navigator as Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};
const query = parseTierQuery(location.search);
const contrast = matchMedia('(prefers-contrast: more), (forced-colors: active)');

const signals: Omit<TierSignals, 'motion' | 'contrast'> = {
  query,
  reducedData:
    matchMedia('(prefers-reduced-data: reduce)').matches || Boolean(nav.connection?.saveData),
  automated: nav.webdriver === true,
  desktop: matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth >= 1024,
  lowEnd:
    (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2),
  session: sessionTier(),
  gl: null,
};

/** The tier for a motion level, with everything else as known now. */
export function tierFor(motion: MotionLevel): TierChoice {
  return decideTier({ ...signals, motion, contrast: contrast.matches });
}

/** Write the tier for `motion` on <html>; returns it. */
export function applyTier(motion: MotionLevel): TierChoice {
  const c = tierFor(motion);
  html.dataset.tier = String(c.tier);
  html.dataset.tierReason = c.reason;
  return c;
}

/** The tier on <html> now. */
export const currentTier = (): Tier => Number(html.dataset.tier ?? 1) as Tier;

/** What the WebGL probe found (src/scripts/scene-loader.ts). */
export function setGlProbe(gl: TierSignals['gl']): void {
  signals.gl = gl;
}

/**
 * The watchdog lowered the tier: remember it for the rest of the session (§7.5). It outranks a
 * forced `?tier=` for the rest of this page (it only gives up when `?debug=slow` lets it).
 */
export function lowerForSession(tier: Tier): void {
  signals.session = tier;
  signals.query = null;
  try {
    sessionStorage.setItem(TIER_SESSION_KEY, String(tier));
  } catch {
    // Storage blocked: this page only.
  }
}

/** `?debug=1`: the scene shows its HUD (PLAN §9.3). */
export const debugMode = (): string | null => new URLSearchParams(location.search).get('debug');

/** The contrast media query, so a change to it re-decides the tier. */
export const contrastQuery = contrast;
