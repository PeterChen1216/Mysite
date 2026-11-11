/**
 * Stops 4–6 (M3; PLAN-EXPERIENCE §7.3): what follows the page there. Pure.
 *
 * - The minecart (stop 5) sits at the current row of the git log: the row whose middle is nearest
 *   the middle of the view. As the page scrolls the current row changes and the cart rolls there.
 * - The beacon's beam (stop 6) pulses with the ping line: one pulse per ping, like `ping` once a
 *   second, flaring and fading.
 * - The camera's nearest stop, by name (the HUD, the keyboard-flight test).
 */
import type { Stop } from './camera';

/** The index of the value nearest `y` (the first of equals); -1 for none. */
export function nearestIndex(values: readonly number[], y: number): number {
  let best = -1;
  let dist = Infinity;
  values.forEach((v, i) => {
    const d = Math.abs(v - y);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

/** A ping every `periodMs` (scene time): the beam flares to 1, then fades over `decayMs`. */
export function beamPulse(timeMs: number, periodMs = 1000, decayMs = 280): number {
  const phase = ((timeMs % periodMs) + periodMs) % periodMs;
  return Math.exp(-phase / decayMs);
}

/** The beam's brightness: on at Contact (`on` 0–1 as the camera arrives), pulsing on a floor. */
export const beamLevel = (on: number, pulse: number): number =>
  Math.max(0, Math.min(1, on)) * (0.45 + 0.55 * pulse);

/** The stop the camera is nearest at a scroll position (by `at`), as an index into `stops`. */
export function nearestStop(scroll: number, stops: readonly Stop[]): number {
  return nearestIndex(
    stops.map((s) => s.at),
    scroll,
  );
}

/**
 * How far an assembling block has come: 0 before its card came into view, then up to 1 over
 * `ms`; at once (1) when the motion level has no movement.
 */
export function assembleProgress(
  startedAt: number | undefined,
  now: number,
  ms: number,
  moving: boolean,
): number {
  if (startedAt === undefined) return 0;
  if (!moving || ms <= 0) return 1;
  return Math.max(0, Math.min(1, (now - startedAt) / ms));
}
