/**
 * Floating windows over the home page (M3; PLAN §5.2, §8 M3): loaded on first use by
 * src/scripts/window-links.ts. Two windows (HomePage.astro):
 * - the projects directory, which Projects' `more ▸` grows into;
 * - a project's window, whose body is its own page's (fetched once, then kept), opened from a
 *   project's title on the page, in the directory, or from the project before or after it.
 *
 * Each has a real address: opening one pushes its page's address (the directory's, a project's),
 * Back closes it and Forward opens it again, and a reload there shows the page itself. Without
 * JavaScript the same links are plain links to those pages.
 *
 * Focus moves into a window when it opens (the directory's first project, a project's heading) and
 * back to what opened it when it closes. Esc, the close key and a click on the bar close it; the bar
 * drags it (fine pointer) and the move key moves it with the arrow keys (src/lib/windows.ts has
 * the rules). The windows are modal <dialog>s: the page behind is inert while one is open and
 * dims behind its backdrop; the scene holds its loops (html[data-window-open]).
 */
import { routeOf } from '../i18n/routing';
import {
  clampBox,
  dockedBox,
  growFrom,
  isTap,
  keyMove,
  snapBox,
  stateFor,
  wantedState,
  windowSteps,
  type Box,
  type Desk,
  type WindowState,
} from '../lib/windows';
import { WINDOW } from '../motion/params';
import { initClocks } from './clock';
import { isPaused, resolved } from './prefs';

type Kind = 'directory' | 'project';

interface Win {
  kind: Kind;
  dialog: HTMLDialogElement;
  /** Where the window sits; null while it is docked (it follows its dock on resize). */
  free: Box | null;
  /** What opened it: focus goes back there, and it grows from and shrinks to it. */
  opener: HTMLElement | null;
  /** The project shown (project window). */
  id: string | null;
  /** Stops the phone in a project's window. */
  stopClocks: (() => void) | null;
}

const html = document.documentElement;
const BASE = import.meta.env.BASE_URL;
const wins = new Map<Kind, Win>();
const pages = new Map<string, Promise<Document>>();
const pageTitle = document.title;
/** The address a project link points at, for each project shown so far. */
const projectHref = new Map<string, string>();

const motionOn = () =>
  resolved().motion === 'full' && !isPaused() && html.classList.contains('motion');
const desk = (): Desk => ({ width: innerWidth, height: innerHeight });

function win(kind: Kind): Win | null {
  const known = wins.get(kind);
  if (known) return known;
  const dialog = document.querySelector<HTMLDialogElement>(`dialog[data-window-kind="${kind}"]`);
  if (!dialog) return null;
  const w: Win = { kind, dialog, free: null, opener: null, id: null, stopClocks: null };
  wins.set(kind, w);
  bind(w);
  return w;
}

const isOpen = (kind: Kind) => !!wins.get(kind)?.dialog.open;
const openNow = () => ({
  directory: isOpen('directory'),
  project: isOpen('project') ? (wins.get('project')?.id ?? null) : null,
});

/* ── placing ─────────────────────────────────────────────────────────────── */

function place(w: Win) {
  const d = desk();
  const body = w.dialog.querySelector<HTMLElement>('[data-win-body]');
  const bar = w.dialog.querySelector<HTMLElement>('[data-win-bar]');
  const contentH = (bar?.offsetHeight ?? 0) + (body?.scrollHeight ?? 0) + 4;
  const dock = dockedBox(d, contentH);
  const s = w.dialog.style;
  s.setProperty('--win-w', `${dock.w}px`);
  s.setProperty('--win-h', `${dock.maxH}px`);
  const at = w.free ? clampBox({ ...w.free, w: dock.w, h: w.dialog.offsetHeight }, d) : dock;
  if (w.free) w.free = at;
  s.setProperty('--win-x', `${at.x}px`);
  s.setProperty('--win-y', `${at.y}px`);
  w.dialog.toggleAttribute('data-docked', !w.free);
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

function moveTo(w: Win, box: Box) {
  w.free = box;
  w.dialog.style.setProperty('--win-x', `${box.x}px`);
  w.dialog.style.setProperty('--win-y', `${box.y}px`);
  w.dialog.toggleAttribute('data-docked', false);
}

function dock(w: Win) {
  w.free = null;
  place(w);
}

/* ── growing and shrinking ───────────────────────────────────────────────── */

/** The opener as a box on screen, if it is there to grow from. */
function openerBox(w: Win): Box | null {
  const el = w.opener;
  if (!el?.isConnected) return null;
  const b = boxOf(el);
  return b.w > 0 && b.h > 0 && b.y < innerHeight && b.y + b.h > 0 ? b : null;
}

function grow(w: Win) {
  const from = openerBox(w);
  const body = w.dialog.querySelector<HTMLElement>('[data-win-body]');
  if (!from || !motionOn()) return;
  const t = growFrom(from, boxOf(w.dialog));
  const steps = `steps(${WINDOW.growSteps}, end)`;
  w.dialog.animate(
    [
      {
        transformOrigin: '0 0',
        transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.sx}, ${t.sy})`,
      },
      { transformOrigin: '0 0', transform: 'none' },
    ],
    { duration: WINDOW.growMs, easing: steps },
  );
  body?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1 }], {
    duration: WINDOW.growMs,
  });
  body?.animate([{ opacity: 0 }, { opacity: 1 }], {
    delay: WINDOW.growMs,
    duration: WINDOW.fadeMs,
    easing: 'steps(4, end)',
  });
}

async function shrink(w: Win) {
  const from = openerBox(w);
  if (!from || !motionOn()) return;
  const t = growFrom(from, boxOf(w.dialog));
  const a = w.dialog.animate(
    [
      { transformOrigin: '0 0', transform: 'none' },
      {
        transformOrigin: '0 0',
        transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.sx}, ${t.sy})`,
      },
    ],
    { duration: WINDOW.shrinkMs, easing: `steps(${WINDOW.growSteps}, end)` },
  );
  await a.finished.catch(() => undefined);
}

/* ── opening and closing ─────────────────────────────────────────────────── */

function show(w: Win) {
  if (!w.dialog.open) {
    w.dialog.showModal();
    html.setAttribute('data-window-open', '');
    document.dispatchEvent(new CustomEvent('zhic:windows'));
  }
  place(w);
}

async function hide(w: Win) {
  if (!w.dialog.open) return;
  await shrink(w);
  w.dialog.close();
}

/** After a window closed (by us or by the browser): focus, title, the scene, the phone. */
function closed(w: Win) {
  w.stopClocks?.();
  w.stopClocks = null;
  if (w.kind === 'project') {
    document.title = pageTitle;
    w.id = null;
  }
  if (![...wins.values()].some((x) => x.dialog.open)) {
    html.removeAttribute('data-window-open');
    document.dispatchEvent(new CustomEvent('zhic:windows'));
  }
  const back = w.opener;
  w.opener = null;
  if (back?.isConnected && !back.closest('dialog:not([open])')) back.focus();
}

function openDirectory(opener: HTMLElement | null) {
  const w = win('directory');
  if (!w) return;
  if (opener) w.opener = opener;
  show(w);
  grow(w);
  w.dialog.querySelector<HTMLElement>('a[data-project-link]')?.focus();
}

/** A project's page, fetched once: the source of its window's body. */
function fetchPage(href: string): Promise<Document> {
  let p = pages.get(href);
  if (!p) {
    p = fetch(href, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${href}`);
        return r.text();
      })
      .then((t) => new DOMParser().parseFromString(t, 'text/html'));
    pages.set(href, p);
    p.catch(() => pages.delete(href));
  }
  return p;
}

export function prefetch(href: string): void {
  void fetchPage(href).catch(() => undefined);
}

const hrefFor = (id: string): string =>
  projectHref.get(id) ??
  document.querySelector<HTMLAnchorElement>(`a[data-project-link="${CSS.escape(id)}"]`)?.href ??
  `${BASE}projects/${id}/`;

async function openProject(id: string, opener: HTMLElement | null) {
  const w = win('project');
  if (!w) return;
  const swapping = w.dialog.open && w.id !== id;
  if (opener) w.opener = opener;
  w.id = id;
  const slot = w.dialog.querySelector<HTMLElement>('[data-project-slot]')!;
  const loading = w.dialog.querySelector<HTMLElement>('[data-project-loading]');
  const failed = w.dialog.querySelector<HTMLElement>('[data-project-failed]');
  const href = hrefFor(id);
  projectHref.set(id, href);
  const title = w.dialog.querySelector<HTMLElement>('[data-win-title]');
  w.stopClocks?.();
  w.stopClocks = null;
  slot.replaceChildren();
  if (failed) failed.hidden = true;
  if (loading) loading.hidden = false;
  if (!swapping) {
    show(w);
    grow(w);
  }
  w.dialog.querySelector<HTMLElement>('[data-win-close]')?.focus();
  let doc: Document;
  try {
    doc = await fetchPage(href);
  } catch {
    if (w.id !== id) return;
    if (loading) loading.hidden = true;
    if (failed) {
      failed.hidden = false;
      const a = failed.querySelector<HTMLAnchorElement>('[data-project-failed-link]');
      if (a) {
        a.href = href;
        a.textContent = href;
      }
    }
    return;
  }
  if (w.id !== id) return; // another project was asked for meanwhile
  const source = doc.querySelector<HTMLElement>(`[data-project="${CSS.escape(id)}"]`);
  if (!source) return;
  const body = document.importNode(source, true);
  // In a window over the home page its heading is a second-level one (the page has its h1).
  const h1 = body.querySelector('h1');
  if (h1) {
    const h2 = document.createElement('h2');
    for (const a of h1.attributes) h2.setAttribute(a.name, a.value);
    h2.append(...h1.childNodes);
    h1.replaceWith(h2);
  }
  if (loading) loading.hidden = true;
  slot.replaceChildren(body);
  const heading = body.querySelector<HTMLElement>('h2[id]');
  if (heading) w.dialog.setAttribute('aria-labelledby', heading.id);
  if (title) title.textContent = doc.querySelector('[data-win-title]')?.textContent ?? '';
  document.title = doc.title || pageTitle;
  w.stopClocks = initClocks(body);
  place(w);
  heading?.focus();
}

/* ── history ─────────────────────────────────────────────────────────────── */

let syncing: Promise<void> = Promise.resolve();

/** Bring the windows in line with the current history entry. */
export function sync(): Promise<void> {
  syncing = syncing.then(async () => {
    const want = wantedState(history.state, location.pathname, BASE);
    const now = openNow();
    // Another project in the same window (the directory unchanged): its body is swapped in place.
    const swap = !!(now.project && want.project && now.directory === want.directory);
    for (const step of windowSteps(now, want)) {
      if (step.do === 'close') {
        const w = wins.get(step.window);
        if (step.window === 'project' && swap) continue;
        if (w?.dialog.open) await hide(w);
      } else if (step.window === 'directory') openDirectory(null);
      else await openProject(step.id, null);
    }
  });
  return syncing;
}

function push(state: WindowState, href: string) {
  if (location.href === new URL(href, location.href).href && history.state) return;
  history.pushState(state, '', href);
}

/** Close a window: through history when its entry is the current one (so Back stays honest). */
function requestClose(w: Win) {
  const state = history.state as WindowState | null;
  const shown = w.kind === 'directory' ? state?.directory : !!state?.project;
  if (state?.zhicWindows === 1 && shown) {
    history.back();
    return;
  }
  void hide(w);
}

/** A link was followed (src/scripts/window-links.ts calls this with the link). */
export async function openFromLink(a: HTMLAnchorElement): Promise<void> {
  const route = routeOf(new URL(a.href).pathname, BASE);
  if (!route || route.page.kind === 'home') {
    location.href = a.href;
    return;
  }
  const page = route.page;
  if (page.kind === 'projects') {
    const w = win('directory');
    if (w && !w.dialog.open) w.opener = a;
  } else if (page.kind === 'project') {
    projectHref.set(page.id, a.href);
    const w = win('project');
    // A neighbour opened inside the window keeps the window's first opener (the link is about to
    // be replaced).
    if (w && !w.dialog.open) w.opener = a;
  }
  push(stateFor(page, openNow()), a.href);
  await sync();
}

/* ── the bar, the keys ───────────────────────────────────────────────────── */

function bind(w: Win) {
  const { dialog } = w;
  const bar = dialog.querySelector<HTMLElement>('[data-win-bar]')!;
  const moveKey = dialog.querySelector<HTMLButtonElement>('[data-win-move]');
  const closeKey = dialog.querySelector<HTMLButtonElement>('[data-win-close]');

  // Esc: through history like the other ways of closing.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    requestClose(w);
  });
  // However it closed (by us, or by a browser that closes on a second Esc): focus, title, scene;
  // and if the current history entry still shows it, step back so Back stays honest.
  dialog.addEventListener('close', () => {
    closed(w);
    const state = history.state as WindowState | null;
    const shown = w.kind === 'directory' ? state?.directory : !!state?.project;
    if (state?.zhicWindows === 1 && shown) history.back();
  });
  closeKey?.addEventListener('click', () => requestClose(w));

  // The move key: arrows move the window, Home / Enter / Space put it back.
  moveKey?.addEventListener('keydown', (e) => {
    const r = keyMove(boxOf(dialog), e.key, e.shiftKey, desk());
    if (r === null) return;
    e.preventDefault();
    if (r === 'home') dock(w);
    else moveTo(w, r);
  });
  moveKey?.addEventListener('click', (e) => {
    if (e.detail === 0) return; // Enter / Space: handled on keydown
    dock(w);
  });

  // The bar: a drag moves the window (a fine pointer); a press that doesn't move closes it.
  let drag: { id: number; x: number; y: number; from: Box; moved: boolean } | null = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: boxOf(dialog), moved: false };
    if (e.pointerType !== 'touch') {
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || e.pointerType === 'touch') return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && isTap(dx, dy)) return;
    drag.moved = true;
    dialog.setAttribute('data-dragging', '');
    moveTo(w, clampBox({ ...drag.from, x: drag.from.x + dx, y: drag.from.y + dy }, desk()));
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    dialog.removeAttribute('data-dragging');
    if (cancelled) return;
    if (!moved) {
      requestClose(w);
      return;
    }
    const { box, docks } = snapBox(boxOf(dialog), dockedBox(desk(), dialog.offsetHeight), desk());
    if (docks.includes('home')) dock(w);
    else moveTo(w, box);
  };
  bar.addEventListener('pointerup', (e) => end(e, false));
  bar.addEventListener('pointercancel', (e) => end(e, true));

  // Inside a project's window: its neighbours open in the same window; the path above it goes to
  // the directory (opened over the page) or home (every window closes).
  dialog.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const a = target?.closest<HTMLAnchorElement>('a[data-crumb]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (a.dataset.crumb === 'projects') void openFromLink(a);
    else {
      push({ zhicWindows: 1, directory: false, project: null }, a.href);
      void sync();
    }
  });
  // The directory and the windows' own links are followed as windows: window-links.ts sends them
  // here; nothing else to do.
}

addEventListener('resize', () => {
  for (const w of wins.values()) if (w.dialog.open) place(w);
});
