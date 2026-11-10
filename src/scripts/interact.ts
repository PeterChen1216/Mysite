/**
 * The hover & interaction catalogue (PLAN-EXPERIENCE §6), the rows that need a little script:
 * one set of delegated listeners for the whole page. Each row has its pointer, keyboard and touch
 * inputs as the table gives them; the looks are CSS (hover styles inside `@media (hover: hover)`,
 * so touch screens never keep a hover). Timings: src/motion/params.ts HOVER.
 *
 *  1 voxel block  — enter (mouse) or tap: a two-frame squash, a burst in the block's own colours,
 *                   a bob back. At graphics tier 3 the hero's blocks are the WebGL scene's: the
 *                   (hidden) DOM blocks still say where each is, and the scene squashes its own.
 *  2 card         — the grid spotlight follows the pointer; a touch press lifts it like a hover.
 *  6 commit row   — enter / focus / tap: the rail segment to the next commit lights.
 *  8 nav link     — the pixel underline slides to the link under the pointer or focus.
 *  9 MC button    — the press-down (`:active`) also on iOS, which needs a touch listener for it.
 * 13 external link — the status line at the bottom of the window shows where it goes.
 * 16 back to spawn — a block falls while the page scrolls up behind it.
 *
 * Motion: bursts and punches only at motion "full" (burstsAllowed); calm keeps every state change
 * (lift, lit rail, underline, status line) without the movement, as `off` does.
 */
import { externalHost, filterRgb, paletteOf, rgbCss } from '../lib/interact';
import { HOVER } from '../motion/params';
import { burst } from './particles';
import { burstsAllowed, resolved } from './prefs';

const html = document.documentElement;
const hoverable = matchMedia('(hover: hover) and (pointer: fine)');
/** A press that moved further than this is a scroll, not a tap. */
const TAP_SLOP = 10;

/* ── 1 · voxel block: punch ──────────────────────────────────────────────── */

const BLOCK = 'img.voxel';
/** A block that is decoration, not part of a control (the nav logo's block is the logo). */
const punchable = (el: Element | null): el is HTMLImageElement =>
  !!el && el.matches(BLOCK) && !el.closest('a, button, [role="slider"]');

const palettes = new Map<string, string[]>();
/** The block's own colours: the most used ones of its picture, through the theme's art filter. */
function blockColours(img: HTMLImageElement): string[] {
  const filter = getComputedStyle(img).filter;
  const key = `${img.currentSrc || img.src}|${filter}`;
  const known = palettes.get(key);
  if (known) return known;
  let colours: string[] = [];
  try {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (g && img.complete && img.naturalWidth > 0) {
      g.drawImage(img, 0, 0, 32, 32);
      colours = paletteOf(g.getImageData(0, 0, 32, 32).data, 3).map((rgb) =>
        rgbCss(filterRgb(rgb, filter === 'none' ? '' : filter)),
      );
    }
  } catch {
    colours = []; // a tainted or unreadable picture: the theme's accents instead
  }
  if (colours.length) palettes.set(key, colours);
  return colours;
}

/** Squash the picture (CSS: html.motion img.voxel[data-punch]); burst from its centre. */
function punch(img: HTMLImageElement, sceneIndex?: number) {
  if (!burstsAllowed()) return;
  const r = img.getBoundingClientRect();
  const colours = blockColours(img);
  burst(
    r.left + r.width / 2,
    r.top + r.height / 2,
    colours.length ? colours : undefined,
    HOVER.punch.particles,
  );
  if (sceneIndex !== undefined) {
    document.dispatchEvent(new CustomEvent('zhic:punch', { detail: { block: sceneIndex } }));
    return;
  }
  if (img.hasAttribute('data-punch')) return;
  img.setAttribute('data-punch', '');
  const done = () => img.removeAttribute('data-punch');
  img.addEventListener('animationend', done, { once: true });
  // If no animation runs (it was cancelled), the mark still goes.
  setTimeout(done, HOVER.punch.ms + 100);
}

/**
 * Tier 3: the WebGL scene draws the hero stage's blocks and hides the DOM ones, which receive no
 * pointer events while hidden; their boxes still say where each block is.
 */
function initScenePunch() {
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!stage) return;
  const blocks = [...stage.querySelectorAll<HTMLElement>('.stage__block')];
  let inside = -1;
  stage.addEventListener(
    'pointermove',
    (e) => {
      if (html.dataset.scene !== 'live' || e.pointerType !== 'mouse') {
        inside = -1;
        return;
      }
      const hit = blocks.findIndex((b) => {
        const r = b.getBoundingClientRect();
        return (
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        );
      });
      if (hit >= 0 && hit !== inside) {
        const img = blocks[hit]!.querySelector<HTMLImageElement>(BLOCK);
        if (img) punch(img, hit);
      }
      inside = hit;
    },
    { passive: true },
  );
  stage.addEventListener('pointerleave', () => (inside = -1), { passive: true });
}

/* ── 2 · card: the spotlight; 6 · commit row: the rail segment ───────────── */

/** Where the spotlight sits in its card: centred on the pointer (transform only). */
function moveSpot(card: HTMLElement, e: PointerEvent) {
  const spot = card.querySelector<HTMLElement>(':scope > .card__spot');
  if (!spot) return;
  const r = card.getBoundingClientRect();
  const half = HOVER.card.spotPx / 2;
  spot.style.translate = `${Math.round(e.clientX - r.left - half)}px ${Math.round(e.clientY - r.top - half)}px`;
}

/** The lit rail of a commit row reaches the next commit's node (measured when it lights). */
function measureRail(row: HTMLElement) {
  const node = row.querySelector<HTMLElement>('.commit__node');
  const next = (row.nextElementSibling as HTMLElement | null)?.querySelector<HTMLElement>(
    '.commit__node',
  );
  if (!node) return;
  const a = node.getBoundingClientRect();
  const rowTop = row.getBoundingClientRect().top;
  const from = a.top + a.height / 2 - rowTop;
  const to = next
    ? next.getBoundingClientRect().top + next.offsetHeight / 2 - rowTop
    : row.offsetHeight; // the last commit: to the end of its own row
  row.style.setProperty('--rail-from', `${Math.round(from)}px`);
  row.style.setProperty('--rail-len', `${Math.max(0, Math.round(to - from))}px`);
}

/** One row lit by touch at a time (a tap elsewhere puts it out). */
let tappedRow: HTMLElement | null = null;
function lightRow(row: HTMLElement | null) {
  if (tappedRow && tappedRow !== row) delete tappedRow.dataset.active;
  tappedRow = row;
  if (row) {
    measureRail(row);
    row.dataset.active = '';
  }
}

/* ── 8 · nav link: the sliding underline ─────────────────────────────────── */

function initNavUnderline() {
  // Beside the list, not in it (a list holds only its items).
  const list = document.querySelector<HTMLElement>('.nav__links');
  if (!list) return;
  const bar = document.createElement('span');
  bar.className = 'nav__underline';
  bar.setAttribute('aria-hidden', 'true');
  list.append(bar);
  const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
  let hovered: HTMLAnchorElement | null = null;
  const place = () => {
    const focused = links.find((a) => a === document.activeElement && a.matches(':focus-visible'));
    const target =
      hovered ?? focused ?? links.find((a) => a.getAttribute('aria-current') === 'true');
    if (!target) {
      bar.dataset.on = 'false';
      return;
    }
    const lr = list.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const fresh = bar.dataset.on !== 'true';
    // Where it was is where it slides from; the first time it simply appears.
    if (fresh) bar.style.transition = 'none';
    // Just under the link (its own box has an edge when lit).
    bar.style.translate = `${Math.round(r.left - lr.left)}px ${Math.round(r.bottom - lr.top + 3)}px`;
    bar.style.width = '1px';
    bar.style.scale = `${Math.round(r.width)} 1`;
    bar.dataset.on = 'true';
    if (fresh) {
      void bar.offsetWidth;
      bar.style.removeProperty('transition');
    }
  };
  for (const a of links) {
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovered = a;
      place();
    });
    a.addEventListener('pointerleave', () => {
      hovered = null;
      place();
    });
    a.addEventListener('focus', place);
    a.addEventListener('blur', () => requestAnimationFrame(place));
  }
  // The current section changes as the page scrolls (src/scripts/scrollspy.ts).
  new MutationObserver(place).observe(list, {
    attributes: true,
    subtree: true,
    attributeFilter: ['aria-current'],
  });
  addEventListener('resize', place, { passive: true });
}

/* ── 13 · external link: the status line ────────────────────────────────── */

let line: HTMLElement | null = null;
function statusLine(host: string | null) {
  if (!host) {
    if (line) line.dataset.on = 'false';
    return;
  }
  if (!line) {
    line = document.createElement('div');
    line.className = 'linkline';
    line.setAttribute('aria-hidden', 'true');
    line.dataset.surface = 'dark'; // a dark object in the light themes, as terminals are
    document.body.append(line);
  }
  line.textContent = `↗ ${host}`;
  void line.offsetWidth;
  line.dataset.on = 'true';
}
const hostOfLink = (el: Element | null) => {
  const a = el?.closest<HTMLAnchorElement>('a[href]');
  return a ? externalHost(a.href, location.origin) : null;
};

/* ── 16 · back to spawn ──────────────────────────────────────────────────── */

function spawn(link: HTMLAnchorElement) {
  // Calm and off (and pause, reduced motion): the jump is instant and nothing falls.
  if (!burstsAllowed()) return;
  const src = link.dataset.spawnBlock;
  if (src) {
    const r = link.getBoundingClientRect();
    const block = document.createElement('img');
    block.className = 'spawn-block';
    block.alt = '';
    block.setAttribute('aria-hidden', 'true');
    block.src = src;
    block.style.left = `${Math.round(r.left + r.width / 2 - 24)}px`;
    block.style.top = `${Math.round(r.top - 56)}px`;
    document.body.append(block);
    block.addEventListener('animationend', () => block.remove(), { once: true });
    setTimeout(() => block.remove(), HOVER.spawn.fallMs + 200);
  }
  // The anchor's own jump, smoothly (focus and the next Tab start at the top, as for any anchor).
  html.style.scrollBehavior = 'smooth';
  const restore = () => html.style.removeProperty('scroll-behavior');
  addEventListener('scrollend', restore, { once: true });
  setTimeout(restore, 2000);
}

/* ── 10 · player card: copy the handle ──────────────────────────────────── */

async function copyHandle(key: HTMLButtonElement) {
  const text = key.dataset.copy ?? '';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return; // no clipboard here (an insecure page, a refusal): nothing was copied, nothing said
  }
  const word = key.textContent;
  const status = key.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
  key.textContent = key.dataset.copied ?? word;
  key.dataset.done = '';
  if (status) status.textContent = key.dataset.copied ?? '';
  setTimeout(() => {
    key.textContent = word;
    delete key.dataset.done;
    if (status) status.textContent = '';
  }, 1600);
}

/* ── 12 · the terminal's prompt key ─────────────────────────────────────── */

/** The hero terminal's `$ █` line becomes a key; the prompt itself loads on first use. */
function initPromptKey() {
  const line = document.querySelector<HTMLElement>('[data-prompt]');
  if (!line) return;
  let name: string;
  try {
    name = (JSON.parse(line.dataset.prompt ?? '') as { open: string }).open;
  } catch {
    return;
  }
  const key = document.createElement('button');
  key.type = 'button';
  key.className = 'hero__prompt';
  key.setAttribute('aria-label', name);
  key.append(...line.childNodes);
  line.append(key);
  line.removeAttribute('aria-hidden');
  key.addEventListener('click', () => {
    void import('./prompt').then((m) => m.openPrompt(line, key));
  });
}

/* ── wiring ──────────────────────────────────────────────────────────────── */

export function initInteractions(): void {
  // 1 · blocks under a mouse.
  let overBlock: Element | null = null;
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target as Element | null;
      const block = punchable(t) ? t : null;
      if (block && block !== overBlock) punch(block);
      overBlock = block;
    },
    { passive: true },
  );
  initScenePunch();

  // Taps (touch): 1 punch a block, 2 press a card, 6 light a commit row.
  let down: { x: number; y: number; card: HTMLElement | null } | null = null;
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      const t = e.target as Element | null;
      const card = t?.closest<HTMLElement>('.card') ?? null;
      down = { x: e.clientX, y: e.clientY, card };
      if (card) card.dataset.press = '';
    },
    { passive: true },
  );
  const release = () => {
    if (down?.card) delete down.card.dataset.press;
  };
  document.addEventListener('pointercancel', () => {
    release();
    down = null;
  });
  document.addEventListener(
    'pointermove',
    (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP) release();
    },
    { passive: true },
  );
  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType !== 'touch' || !down) return;
      const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) <= TAP_SLOP;
      release();
      down = null;
      if (!tap) return;
      const t = e.target as Element | null;
      if (punchable(t)) punch(t);
      lightRow(t?.closest<HTMLElement>('.commit') ?? null);
      // 10 · the player card: a tap shows what a hover shows, until a tap elsewhere.
      const card = document.querySelector<HTMLElement>('.stage__card');
      if (card && !t?.closest('.stage__copy')) {
        if (card.contains(t)) card.toggleAttribute('data-active');
        else card.removeAttribute('data-active');
      }
    },
    { passive: true },
  );
  // 10 · the name tag's key copies the handle.
  document.addEventListener('click', (e) => {
    const key = (e.target as Element | null)?.closest<HTMLButtonElement>('.stage__copy');
    if (key) void copyHandle(key);
  });
  // 9 · iOS Safari applies :active only where a touch listener is (MC buttons press down).
  document.addEventListener('touchstart', () => {}, { passive: true });

  // 2 · the card spotlight, under a mouse.
  if (hoverable.matches)
    document.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        const card = (e.target as Element | null)?.closest<HTMLElement>('.card');
        if (card) moveSpot(card, e);
      },
      { passive: true },
    );

  // 6 · a commit row lights from the mouse or keyboard focus too.
  document.addEventListener('pointerover', (e) => {
    const row = (e.target as Element | null)?.closest<HTMLElement>('.commit');
    if (row && e.pointerType === 'mouse') measureRail(row);
  });
  // 13 · the status line names the host of the external link under the mouse, or else of the one
  // with keyboard focus (a mouse resting elsewhere does not hide the focused one's).
  let hoverHost: string | null = null;
  let focusHost: string | null = null;
  const showHost = () => statusLine(hoverHost ?? focusHost);
  document.addEventListener('focusin', (e) => {
    const t = e.target as Element | null;
    const row = t?.closest<HTMLElement>('.commit');
    if (row) measureRail(row);
    focusHost = hostOfLink(t);
    showHost();
  });
  document.addEventListener('focusout', () => {
    focusHost = null;
    showHost();
  });
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      hoverHost = hostOfLink(e.target as Element | null);
      showHost();
    },
    { passive: true },
  );

  // 8 · the nav underline.
  initNavUnderline();
  // 12 · the terminal's prompt.
  initPromptKey();

  // 16 · back to spawn (the link keeps its own jump; this only makes it smooth and drops a block).
  document.addEventListener('click', (e) => {
    const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a.foot__top');
    if (link && !e.defaultPrevented && resolved().motion === 'full') spawn(link);
  });
}
