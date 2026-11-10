/**
 * Graphics tiers (PLAN-EXPERIENCE §7.2): how much of the page is live, decided per visit from what
 * the visitor chose and what the device can do. Pure: the signals are read by
 * src/scripts/tier.ts, which also re-decides when the motion level changes.
 *
 * | Tier | Who | What |
 * | 0 static | no JS, motion off (or reduced motion), reduced data, `?tier=0` | the built page, still |
 * | 1 CSS/DOM | more contrast or forced colours, low-end devices, no or software WebGL, automated browsers | today's page and its CSS loops |
 * | 2 canvas | phones and tablets; a desktop whose frame rate the watchdog gave up on this session | as tier 1 until X3 adds the 2D ambient layer |
 * | 3 scene | desktops with hardware WebGL 2 | the WebGL world behind the content (src/scene/) |
 *
 * `?tier=0..3` forces a tier for testing (motion off and reduced data still win: a preference is
 * never overridden); `?tier=auto` decides as for a person, even in an automated browser.
 * A tier is never raised automatically mid-visit: the watchdog only lowers it, and only the
 * visitor's own change of motion level can bring the scene back.
 */
import type { MotionLevel } from '../prefs/model';

export type Tier = 0 | 1 | 2 | 3;

/** sessionStorage: the tier the watchdog lowered this visit to (PLAN-EXPERIENCE §7.5). */
export const TIER_SESSION_KEY = 'zhic:tier';

/** What a WebGL 2 probe found; null = not probed yet (the head script cannot probe). */
export type GlProbe = 'ok' | 'none' | 'software' | null;

export interface TierSignals {
  /** `?tier=`: a forced tier, 'auto' (decide as for a person), or null. */
  query: Tier | 'auto' | null;
  /** The resolved motion level (src/prefs/model.ts resolvePrefs). */
  motion: MotionLevel;
  /** prefers-reduced-data or Save-Data. */
  reducedData: boolean;
  /** prefers-contrast: more or forced-colors: active. The canvas ignores the system palette. */
  contrast: boolean;
  /** navigator.webdriver: test runners and crawlers get the plain page unless `?tier=` says. */
  automated: boolean;
  /** A desktop: fine pointer that can hover, and a viewport ≥ 1024 px (DECISIONS Q2: phones static). */
  desktop: boolean;
  /** deviceMemory ≤ 4 GB or ≤ 2 logical cores, where the browser says. */
  lowEnd: boolean;
  /** The tier the watchdog lowered this session to, if it did. */
  session: Tier | null;
  gl: GlProbe;
}

export type TierReason =
  | 'motion'
  | 'data'
  | 'query'
  | 'contrast'
  | 'automation'
  | 'watchdog'
  | 'device'
  | 'low-end'
  | 'no-webgl'
  | 'software'
  | 'candidate'
  | 'ok';

export interface TierChoice {
  tier: Tier;
  /** Why (shown by the `?debug=1` HUD and read by the tests). */
  reason: TierReason;
  /** Forced by `?tier=`: the watchdog may lower the resolution but not the tier. */
  forced: boolean;
}

const TIER_RE = /^[0-3]$/;

/** `?tier=` from a location.search string. */
export function parseTierQuery(search: string): Tier | 'auto' | null {
  const value = new URLSearchParams(search).get('tier');
  if (value === 'auto') return 'auto';
  return value !== null && TIER_RE.test(value) ? (Number(value) as Tier) : null;
}

/** A renderer string that names a software rasteriser (SwiftShader, llvmpipe, WARP …). */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|warp/i.test(renderer);
}

/** The tier for these signals (see the table above), and why. */
export function decideTier(s: TierSignals): TierChoice {
  const choice = (tier: Tier, reason: TierReason, forced = false): TierChoice => ({
    tier,
    reason,
    forced,
  });
  // The visitor's choices first: nothing overrides them.
  if (s.motion === 'off') return choice(0, 'motion');
  if (s.reducedData) return choice(0, 'data');
  if (typeof s.query === 'number') {
    // A forced scene still needs WebGL 2 (a software one is fine: that is what tests run on).
    if (s.query === 3 && s.gl === 'none') return choice(1, 'no-webgl', true);
    return choice(s.query, 'query', true);
  }
  if (s.contrast) return choice(1, 'contrast');
  if (s.session !== null) return choice(s.session, 'watchdog');
  if (s.automated && s.query !== 'auto') return choice(1, 'automation');
  if (!s.desktop) return choice(2, 'device');
  if (s.lowEnd) return choice(1, 'low-end');
  if (s.gl === 'none') return choice(1, 'no-webgl');
  if (s.gl === 'software') return choice(1, 'software');
  return choice(3, s.gl === 'ok' ? 'ok' : 'candidate');
}

/**
 * The head script's part (src/prefs/boot.ts): whether the page starts static (tier 0) for a
 * reason other than motion — `?tier=0` or reduced data — so no loop or intro starts before the
 * main script decides the rest. Self-contained (inlined with Function#toString).
 */
export function staticTier(search: string, reducedData: boolean): boolean {
  return reducedData || /[?&]tier=0(?:&|$)/.test(search);
}
