/**
 * Floating windows (M3; PLAN §5.2 and §6.4, Figma "Note — how the scene works"): the geometry of a
 * window on the desk — where it docks, how far it may be dragged, where it snaps when let go, how
 * the arrow keys move it, how it grows out of the key that opened it — and which windows a history
 * entry shows. Pure: src/scripts/windows.ts applies it.
 *
 * The rules (the simplest that satisfy the acceptance tests and the accessibility contract; PLAN
 * §13 ADR-020):
 * - The desk is the viewport. A window docks centred in the content column under the top of the
 *   page, as wide as that column (Figma "Directory — projects/"), its height its content's, up to
 *   the desk.
 * - Dragged by its bar (a fine pointer), it stays whole on the desk. Let go within `snap` px of its
 *   dock it docks again; near an edge it sits flush against that edge.
 * - Its move key is the keyboard twin (WCAG 2.5.7): arrows move it 16 px (Shift: 64), Home and
 *   Enter put it back in its dock.
 * - A press on the bar that does not move is a click: it closes the window, like Esc.
 */
import { routeOf, type SitePage } from '../i18n/routing';
import { WINDOW } from '../motion/params';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Desk {
  width: number;
  height: number;
}

/** The page's side gutter at a viewport width (global.css `--gutter`, the sections' paddings). */
export function gutter(width: number): number {
  if (width >= 1280) return Math.max(64, (width - WINDOW.maxWidthPx) / 2);
  return width >= 768 ? 32 : 16;
}

/**
 * Where a window docks on a desk, given the height its content wants: centred in the content
 * column, `top` from the top (64 px on a desktop, 16 on a phone), at most as tall as the desk
 * allows (`maxH`; its body scrolls beyond that).
 */
export function dockedBox(desk: Desk, contentH: number): Box & { maxH: number } {
  const side = gutter(desk.width);
  const w = Math.max(0, Math.min(WINDOW.maxWidthPx, desk.width - 2 * side));
  const top = desk.width >= 768 ? Math.min(64, Math.round(desk.height * 0.08)) : 16;
  const maxH = Math.max(0, desk.height - top - (desk.width >= 768 ? 32 : 16));
  return { x: Math.round((desk.width - w) / 2), y: top, w, h: Math.min(contentH, maxH), maxH };
}

/** Keep a window whole on the desk, `margin` px from every edge (pinned to the top-left margin
 * when it is larger than the desk). */
export function clampBox(box: Box, desk: Desk, margin: number = WINDOW.marginPx): Box {
  const maxX = desk.width - margin - box.w;
  const maxY = desk.height - margin - box.h;
  return {
    ...box,
    x: maxX < margin ? margin : Math.min(Math.max(box.x, margin), maxX),
    y: maxY < margin ? margin : Math.min(Math.max(box.y, margin), maxY),
  };
}

export type Dock = 'home' | 'left' | 'right' | 'top' | 'bottom';

/**
 * Where a window let go at `box` comes to rest: in its dock when it is within `snap` px of it;
 * otherwise kept on the desk and flush against any edge it is within `snap` px of.
 */
export function snapBox(
  box: Box,
  dock: Box,
  desk: Desk,
  snap: number = WINDOW.snapPx,
  margin: number = WINDOW.marginPx,
): { box: Box; docks: Dock[] } {
  if (Math.abs(box.x - dock.x) <= snap && Math.abs(box.y - dock.y) <= snap)
    return { box: { ...box, x: dock.x, y: dock.y }, docks: ['home'] };
  const b = clampBox(box, desk, margin);
  const docks: Dock[] = [];
  if (b.x - margin <= snap) {
    b.x = margin;
    docks.push('left');
  } else if (desk.width - margin - (b.x + b.w) <= snap) {
    b.x = Math.max(margin, desk.width - margin - b.w);
    docks.push('right');
  }
  if (b.y - margin <= snap) {
    b.y = margin;
    docks.push('top');
  } else if (desk.height - margin - (b.y + b.h) <= snap) {
    b.y = Math.max(margin, desk.height - margin - b.h);
    docks.push('bottom');
  }
  return { box: b, docks };
}

/**
 * The move key (the keyboard twin of dragging): an arrow moves the window by a step (`far` with
 * Shift), kept on the desk; Home or Enter (or Space) puts it back in its dock. Any other key: null.
 */
export function keyMove(box: Box, key: string, shift: boolean, desk: Desk): Box | 'home' | null {
  const step = shift ? WINDOW.keyFarPx : WINDOW.keyStepPx;
  const move: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  if (key === 'Home' || key === 'Enter' || key === ' ') return 'home';
  const d = move[key];
  return d ? clampBox({ ...box, x: box.x + d[0], y: box.y + d[1] }, desk) : null;
}

/** A press that moved no further than `slop` px is a click, not a drag. */
export const isTap = (dx: number, dy: number, slop: number = WINDOW.tapSlopPx): boolean =>
  Math.hypot(dx, dy) <= slop;

/**
 * The transform that draws a window (`to`, its top-left corner the transform origin) over the box
 * of the key that opened it (`from`): where it grows from and shrinks back to.
 */
export function growFrom(from: Box, to: Box): { dx: number; dy: number; sx: number; sy: number } {
  const s = (a: number, b: number) => (b > 0 ? Math.max(0.01, a / b) : 1);
  return { dx: from.x - to.x, dy: from.y - to.y, sx: s(from.w, to.w), sy: s(from.h, to.h) };
}

/* ── history ─────────────────────────────────────────────────────────────── */

/**
 * The windows a history entry shows. Opening a window pushes its page's address (the directory's,
 * a project's), so the address is real, Back closes it and Forward opens it again; reloading
 * there shows the page itself.
 */
export interface WindowState {
  zhicWindows: 1;
  directory: boolean;
  project: string | null;
}

export const isWindowState = (s: unknown): s is WindowState =>
  typeof s === 'object' && s !== null && (s as WindowState).zhicWindows === 1;

/** The entry for opening `page` from the windows open now (a project opened from the directory
 * keeps the directory under it). */
export function stateFor(
  page: SitePage,
  now: { directory: boolean; project: string | null },
): WindowState {
  if (page.kind === 'projects') return { zhicWindows: 1, directory: true, project: null };
  if (page.kind === 'project')
    return { zhicWindows: 1, directory: now.directory, project: page.id };
  return { zhicWindows: 1, directory: false, project: null };
}

/**
 * What an entry asks for: its state when it is one of ours; otherwise what its address shows on
 * this page (the home page itself, or nothing to change).
 */
export function wantedState(state: unknown, pathname: string, base: string): WindowState {
  if (isWindowState(state)) return state;
  const route = routeOf(pathname, base);
  return stateFor(route?.page ?? { kind: 'home' }, { directory: false, project: null });
}

export type Step =
  | { do: 'close'; window: 'project' | 'directory' }
  | { do: 'open'; window: 'directory' }
  | { do: 'open'; window: 'project'; id: string };

/**
 * The steps from the windows open now to the ones an entry shows, in an order that keeps their
 * stacking (the directory under a project): close from the top down, open from the bottom up.
 */
export function windowSteps(
  now: { directory: boolean; project: string | null },
  want: WindowState,
): Step[] {
  const steps: Step[] = [];
  const projectChanges = now.project !== want.project;
  const directoryChanges = now.directory !== want.directory;
  if (now.project && (projectChanges || directoryChanges))
    steps.push({ do: 'close', window: 'project' });
  if (now.directory && !want.directory) steps.push({ do: 'close', window: 'directory' });
  if (want.directory && !now.directory) steps.push({ do: 'open', window: 'directory' });
  if (want.project && (projectChanges || directoryChanges))
    steps.push({ do: 'open', window: 'project', id: want.project });
  return steps;
}
