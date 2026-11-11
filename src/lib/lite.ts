/**
 * The phone's graphics (PLAN-EXPERIENCE §8.5–8.6, X4). Pure: src/scripts/tier.ts reads the signals,
 * src/scripts/ambient.ts and particles.ts follow the result; tests/unit/lite.test.ts covers them.
 *
 * Lite mode lightens the tier 2 page where the device asks to save: Save-Data, a battery running
 * low and not charging (where the browser tells: Chromium's Battery Status API; iOS's Low Power
 * Mode is not visible to a page), or at most 4 GB of memory. Then the ambient layer keeps its
 * still star field but no rising motes (its only loop) and draws at 1× pixel ratio, and a burst
 * flies fewer particles. Save-Data also makes the page static (tier 0, src/scene/tier.ts), which
 * is lighter still.
 */

export interface LiteSignals {
  /** navigator.connection.saveData (or prefers-reduced-data). */
  saveData: boolean;
  /** navigator.deviceMemory in GB, where the browser says. */
  deviceMemory?: number | undefined;
  /** navigator.getBattery(), where there is one and it answered. */
  battery?: { charging: boolean; level: number } | null | undefined;
}

export type LiteReason = 'data' | 'battery' | 'memory';

/** Battery left (0–1) at or under which an unplugged phone counts as saving (Android's saver starts at 15–20 %). */
export const LOW_BATTERY = 0.2;
/** Memory (GB) at or under which a device counts as low-end (§8.5). */
export const LOW_MEMORY_GB = 4;

export function liteMode(s: LiteSignals): { lite: boolean; reason: LiteReason | null } {
  if (s.saveData) return { lite: true, reason: 'data' };
  if (s.battery && !s.battery.charging && s.battery.level <= LOW_BATTERY)
    return { lite: true, reason: 'battery' };
  if (typeof s.deviceMemory === 'number' && s.deviceMemory <= LOW_MEMORY_GB)
    return { lite: true, reason: 'memory' };
  return { lite: false, reason: null };
}

export interface ViewSize {
  width: number;
  height: number;
}

/**
 * The size a full-screen canvas keeps (§8.6): captured once per width. A browser's address bar
 * sliding in or out, or an in-app browser hiding its own bars, changes only the height — the
 * canvas keeps the size it has (it is as tall as the tallest view, `lvh`); a new width (a turn of
 * the phone, a resized window) captures afresh.
 */
export function captureViewport(previous: ViewSize | null, next: ViewSize): ViewSize {
  if (previous && previous.width === next.width) return previous;
  return next;
}

/** At most this many particles fly at once on a phone or tablet (§8.5), and in lite mode. */
export function particleCap(
  cap: number,
  touch: boolean,
  lite: boolean,
  phoneCap: number,
  liteCap: number,
): number {
  if (lite) return Math.min(cap, liteCap);
  return touch ? Math.min(cap, phoneCap) : cap;
}
