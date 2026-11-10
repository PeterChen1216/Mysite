// Floating windows (M3; src/lib/windows.ts): docking, dragging within the desk, snapping, the
// move key (the keyboard twin of dragging), growing out of the key that opened a window, and which
// windows a history entry shows.
import { describe, expect, it } from 'vitest';
import {
  clampBox,
  dockedBox,
  growFrom,
  gutter,
  isTap,
  isWindowState,
  keyMove,
  snapBox,
  stateFor,
  wantedState,
  windowSteps,
  type Box,
} from '../../src/lib/windows';
import { WINDOW } from '../../src/motion/params';

const DESK = { width: 1440, height: 900 };
const box = (x: number, y: number, w = 600, h = 400): Box => ({ x, y, w, h });

describe('the dock', () => {
  it('centred in the content column, under the top of the page, up to the desk', () => {
    expect(gutter(1440)).toBe(64);
    expect(gutter(1920)).toBe((1920 - WINDOW.maxWidthPx) / 2);
    expect(gutter(1024)).toBe(32);
    expect(gutter(390)).toBe(16);
    const d = dockedBox(DESK, 500);
    expect(d).toEqual({ x: 64, y: 64, w: 1312, h: 500, maxH: 900 - 64 - 32 });
    expect(dockedBox(DESK, 5000).h).toBe(d.maxH); // its body scrolls
    const wide = dockedBox({ width: 1920, height: 1080 }, 300);
    expect(wide.w).toBe(WINDOW.maxWidthPx);
    expect(wide.x).toBe((1920 - WINDOW.maxWidthPx) / 2);
    const phone = dockedBox({ width: 390, height: 844 }, 300);
    expect(phone).toMatchObject({ x: 16, y: 16, w: 358 });
    expect(dockedBox({ width: 800, height: 500 }, 100).y).toBe(40); // 8 % of a short desk
  });
});

describe('dragging keeps the window whole on the desk', () => {
  it('clamps to the margins on every side', () => {
    const m = WINDOW.marginPx;
    expect(clampBox(box(-300, -50), DESK)).toMatchObject({ x: m, y: m });
    expect(clampBox(box(2000, 2000), DESK)).toMatchObject({ x: 1440 - m - 600, y: 900 - m - 400 });
    expect(clampBox(box(100, 100), DESK)).toMatchObject({ x: 100, y: 100 });
    // Larger than the desk: pinned to the top-left margin.
    expect(clampBox(box(500, 500, 2000, 1200), DESK)).toMatchObject({ x: m, y: m });
  });
  it('a press that hardly moved is a click (it closes the window)', () => {
    expect(isTap(0, 0)).toBe(true);
    expect(isTap(3, 2)).toBe(true);
    expect(isTap(6, 0)).toBe(false);
  });
});

describe('letting go: snapping to the dock and the edges', () => {
  const dock = box(64, 64, 600, 400);
  it('near its dock it docks again', () => {
    expect(snapBox(box(80, 50), dock, DESK)).toEqual({ box: box(64, 64), docks: ['home'] });
  });
  it('near an edge it sits flush against it; elsewhere it stays where it was let go', () => {
    const m = WINDOW.marginPx;
    expect(snapBox(box(20, 300), dock, DESK)).toEqual({ box: box(m, 300), docks: ['left'] });
    expect(snapBox(box(1440 - 600 - 20, 890 - 400 - 10), dock, DESK)).toEqual({
      box: box(1440 - m - 600, 900 - m - 400),
      docks: ['right', 'bottom'],
    });
    expect(snapBox(box(400, 12), dock, DESK)).toEqual({ box: box(400, m), docks: ['top'] });
    expect(snapBox(box(400, 300), dock, DESK)).toEqual({ box: box(400, 300), docks: [] });
  });
});

describe('the move key (WCAG 2.5.7: dragging has a keyboard twin)', () => {
  const at = box(400, 300);
  it('arrows move by a step, Shift further; the window stays on the desk', () => {
    expect(keyMove(at, 'ArrowRight', false, DESK)).toEqual(box(400 + WINDOW.keyStepPx, 300));
    expect(keyMove(at, 'ArrowLeft', true, DESK)).toEqual(box(400 - WINDOW.keyFarPx, 300));
    expect(keyMove(at, 'ArrowUp', false, DESK)).toEqual(box(400, 300 - WINDOW.keyStepPx));
    expect(keyMove(at, 'ArrowDown', true, DESK)).toEqual(box(400, 300 + WINDOW.keyFarPx));
    expect(keyMove(box(10, 10), 'ArrowLeft', true, DESK)).toEqual(box(WINDOW.marginPx, 10));
  });
  it('Home, Enter and Space put it back; other keys are not its business', () => {
    for (const key of ['Home', 'Enter', ' ']) expect(keyMove(at, key, false, DESK)).toBe('home');
    for (const key of ['Tab', 'Escape', 'a']) expect(keyMove(at, key, false, DESK)).toBeNull();
  });
});

describe('growing out of the key that opened it', () => {
  it('the transform that draws the window over the key', () => {
    expect(growFrom(box(300, 200, 60, 24), box(64, 64, 1312, 480))).toEqual({
      dx: 236,
      dy: 136,
      sx: 60 / 1312,
      sy: 24 / 480,
    });
    // A window not laid out yet doesn't divide by zero.
    expect(growFrom(box(0, 0, 10, 10), box(0, 0, 0, 0))).toMatchObject({ sx: 1, sy: 1 });
    expect(growFrom(box(0, 0, 0, 0), box(0, 0, 100, 100))).toMatchObject({ sx: 0.01, sy: 0.01 });
  });
});

describe('history: which windows an entry shows', () => {
  const none = { directory: false, project: null };
  it('opening the directory, a project, a project from the directory', () => {
    expect(stateFor({ kind: 'projects' }, none)).toEqual({
      zhicWindows: 1,
      directory: true,
      project: null,
    });
    expect(stateFor({ kind: 'project', id: 'a' }, none)).toEqual({
      zhicWindows: 1,
      directory: false,
      project: 'a',
    });
    expect(stateFor({ kind: 'project', id: 'a' }, { directory: true, project: null })).toEqual({
      zhicWindows: 1,
      directory: true,
      project: 'a',
    });
    expect(stateFor({ kind: 'home' }, { directory: true, project: 'a' })).toEqual({
      zhicWindows: 1,
      ...none,
    });
  });
  it('an entry that is not ours shows what its address is: the home page shows no window', () => {
    expect(isWindowState(null)).toBe(false);
    expect(isWindowState({ zhicWindows: 1, directory: false, project: null })).toBe(true);
    expect(wantedState(null, '/v2/', '/v2/')).toMatchObject(none);
    expect(wantedState({ other: 1 }, '/v2/projects/', '/v2/')).toMatchObject({
      directory: true,
    });
    expect(wantedState(null, '/v2/zh-hans/projects/a/', '/v2/')).toMatchObject({ project: 'a' });
    expect(wantedState(null, '/elsewhere', '/v2/')).toMatchObject(none);
    const ours = { zhicWindows: 1 as const, directory: true, project: 'b' };
    expect(wantedState(ours, '/v2/', '/v2/')).toBe(ours);
  });
  it('the steps keep the stacking: close from the top, open from the bottom', () => {
    const want = (directory: boolean, project: string | null) => ({
      zhicWindows: 1 as const,
      directory,
      project,
    });
    expect(windowSteps(none, want(true, 'a'))).toEqual([
      { do: 'open', window: 'directory' },
      { do: 'open', window: 'project', id: 'a' },
    ]);
    expect(windowSteps({ directory: true, project: 'a' }, want(false, null))).toEqual([
      { do: 'close', window: 'project' },
      { do: 'close', window: 'directory' },
    ]);
    expect(windowSteps({ directory: true, project: 'a' }, want(true, null))).toEqual([
      { do: 'close', window: 'project' },
    ]);
    // Another project in the same window.
    expect(windowSteps({ directory: false, project: 'a' }, want(false, 'b'))).toEqual([
      { do: 'close', window: 'project' },
      { do: 'open', window: 'project', id: 'b' },
    ]);
    // The directory comes back under an open project: the project closes and reopens on top.
    expect(windowSteps({ directory: false, project: 'a' }, want(true, 'a'))).toEqual([
      { do: 'close', window: 'project' },
      { do: 'open', window: 'directory' },
      { do: 'open', window: 'project', id: 'a' },
    ]);
    expect(windowSteps(none, want(false, null))).toEqual([]);
  });
});
