/**
 * Frame-time watchdog and adaptive resolution (PLAN-EXPERIENCE §7.5, PLAN §6.4). Pure state
 * machines fed with frame timestamps by the renderer.
 *
 * Watchdog: three consecutive seconds under 40 fps → one resolution step down (1 → 0.75 → 0.5 of
 * the base pixel ratio); still under at the lowest step → drop to tier 2 (remembered for the
 * session by the caller). Only continuous rendering is judged: a gap (tab hidden, nothing to
 * draw) starts a new measuring window instead of counting as a slow frame.
 *
 * Adaptive resolution: while the camera moves, a frame over 20 ms renders the next frames one
 * step lower still; after a second at rest the base step returns.
 */
export const WATCHDOG = {
  minFps: 40,
  windowMs: 1000,
  badWindows: 3,
  /** A pause longer than this between frames is not a slow frame but no rendering. */
  gapMs: 250,
  ladder: [1, 0.75, 0.5],
  /** Adaptive: frame time that lowers the resolution while moving, and the rest that restores it. */
  slowFrameMs: 20,
  restMs: 1000,
} as const;

export interface WatchdogState {
  /** Index into WATCHDOG.ladder: the base resolution. */
  step: number;
  /** Consecutive slow windows at this step. */
  bad: number;
  windowStart: number | null;
  frames: number;
  last: number | null;
  /** Gave up: the caller drops the tier. */
  dropped: boolean;
  /** The last window's frame rate (for the HUD). */
  fps: number;
}

export type WatchdogAction = 'none' | 'lower' | 'drop';

export const initialWatchdog = (): WatchdogState => ({
  step: 0,
  bad: 0,
  windowStart: null,
  frames: 0,
  last: null,
  dropped: false,
  fps: 0,
});

/** One rendered frame at time `now` (ms). */
export function watchdogFrame(
  s: WatchdogState,
  now: number,
  cfg: typeof WATCHDOG = WATCHDOG,
): { state: WatchdogState; action: WatchdogAction } {
  if (s.dropped) return { state: s, action: 'none' };
  const gap = s.last !== null && now - s.last > cfg.gapMs;
  if (s.windowStart === null || gap)
    return { state: { ...s, windowStart: now, frames: 0, last: now }, action: 'none' };
  const frames = s.frames + 1;
  const elapsed = now - s.windowStart;
  if (elapsed < cfg.windowMs) return { state: { ...s, frames, last: now }, action: 'none' };
  const fps = (frames * 1000) / elapsed;
  const bad = fps < cfg.minFps ? s.bad + 1 : 0;
  const next: WatchdogState = { ...s, frames: 0, windowStart: now, last: now, fps, bad };
  if (bad < cfg.badWindows) return { state: next, action: 'none' };
  if (s.step < cfg.ladder.length - 1)
    return { state: { ...next, step: s.step + 1, bad: 0 }, action: 'lower' };
  return { state: { ...next, dropped: true }, action: 'drop' };
}

export interface AdaptiveState {
  /** Extra steps below the watchdog's base while moving (0 or 1). */
  extra: number;
  /** When the camera last moved (ms). */
  movedAt: number;
}

/** One frame of the adaptive resolution: how long it took, whether the camera moved. */
export function adaptiveFrame(
  s: AdaptiveState,
  now: number,
  frameMs: number,
  moving: boolean,
  cfg: typeof WATCHDOG = WATCHDOG,
): AdaptiveState {
  const movedAt = moving ? now : s.movedAt;
  if (moving && frameMs > cfg.slowFrameMs) return { extra: 1, movedAt };
  if (!moving && now - movedAt >= cfg.restMs) return { extra: 0, movedAt };
  return { extra: s.extra, movedAt };
}

/** The resolution factor for a base step plus the adaptive extra. */
export const resolutionScale = (step: number, extra: number, cfg: typeof WATCHDOG = WATCHDOG) =>
  cfg.ladder[Math.min(cfg.ladder.length - 1, step + extra)]!;
