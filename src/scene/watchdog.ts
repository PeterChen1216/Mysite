/**
 * Frame-time watchdog and adaptive resolution (PLAN-EXPERIENCE §7.5, PLAN §6.4). Pure state
 * machines fed with frame timestamps by the renderer.
 *
 * Watchdog: three consecutive seconds under 40 fps → one resolution step down (1 → 0.75 → 0.5 of
 * the base pixel ratio); still under at the lowest step → drop to tier 2 (remembered for the
 * session by the caller). Only continuous rendering is judged, and the renderer says which frames
 * are: a frame that follows the previous judged one without a break — asked for by that frame, the
 * tab visible all along — is judged however long it took, so a device drawing two frames a second
 * is as slow as it looks. A frame after a break (the tab was hidden, the scene was paused or had
 * nothing to draw) starts a new measuring window instead; a wait is never a slow frame. (Until M5
 * a gap over 250 ms was taken for a break, so a device under 4 fps was never judged at all.)
 * A single long stall (a sleep, a debugger) costs at most one bad window, never a step on its own.
 *
 * Adaptive resolution: while the camera moves, a frame over 20 ms renders the next frames one
 * step lower still; after a second at rest the base step returns.
 */
export const WATCHDOG = {
  minFps: 40,
  windowMs: 1000,
  badWindows: 3,
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
  /** Windows judged so far (for the tests and the HUD). */
  windows: number;
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
  windows: 0,
});

/**
 * One rendered frame at time `now` (ms). `continuous`: it follows the previous judged frame with no
 * break in rendering (see above); false starts a new window at this frame.
 */
export function watchdogFrame(
  s: WatchdogState,
  now: number,
  continuous: boolean,
  cfg: typeof WATCHDOG = WATCHDOG,
): { state: WatchdogState; action: WatchdogAction } {
  if (s.dropped) return { state: s, action: 'none' };
  if (s.windowStart === null || !continuous || s.last === null || now < s.last)
    return { state: { ...s, windowStart: now, frames: 0, last: now }, action: 'none' };
  const frames = s.frames + 1;
  const elapsed = now - s.windowStart;
  if (elapsed < cfg.windowMs) return { state: { ...s, frames, last: now }, action: 'none' };
  const fps = (frames * 1000) / elapsed;
  const bad = fps < cfg.minFps ? s.bad + 1 : 0;
  const next: WatchdogState = {
    ...s,
    frames: 0,
    windowStart: now,
    last: now,
    fps,
    bad,
    windows: s.windows + 1,
  };
  if (bad < cfg.badWindows) return { state: next, action: 'none' };
  if (s.step < cfg.ladder.length - 1)
    return { state: { ...next, step: s.step + 1, bad: 0 }, action: 'lower' };
  return { state: { ...next, dropped: true }, action: 'drop' };
}

/**
 * The renderer's side: which frames are continuous. A frame is when the frame before it asked for
 * it (requestAnimationFrame from inside the loop, not from a scroll or a theme change after the
 * loop had stopped), that frame was judged, and the tab stayed visible in between. Pausing,
 * settling with nothing to draw, a window over the page and a hidden tab all end the chain, so the
 * next frame opens a new window.
 */
export interface FrameChain {
  /** The pending frame was asked for by the frame before it. */
  asked: boolean;
  /** The last frame fed the watchdog. */
  judged: boolean;
}

export const initialChain = (): FrameChain => ({ asked: false, judged: false });

/** A frame was requested: by the running loop (`fromLoop`), or by an event. */
export const chainRequest = (c: FrameChain, fromLoop: boolean): FrameChain => ({
  ...c,
  asked: c.asked || fromLoop,
});

/** The tab was hidden or shown: whatever comes next starts over. */
export const chainBreak = (): FrameChain => initialChain();

/** A frame starts: whether it continues the chain; it is not judged until `chainJudged`. */
export const chainFrame = (c: FrameChain): { continuous: boolean; chain: FrameChain } => ({
  continuous: c.asked && c.judged,
  chain: { asked: false, judged: false },
});

/** The frame fed the watchdog. */
export const chainJudged = (c: FrameChain): FrameChain => ({ ...c, judged: true });

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
