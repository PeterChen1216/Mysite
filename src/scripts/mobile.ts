/**
 * The phone layout's controls (PLAN-EXPERIENCE §8.3–8.4, X4). Each is a progressive enhancement:
 * without JavaScript the phone page shows everything unfolded and every link works.
 *
 * - The hero terminal's `more ▾` / `less ▴` key: a disclosure (aria-expanded) that unfolds the
 *   lines a phone leaves folded (Hero.astro).
 * - Carousels (Projects.astro): native scroll-snap rows; the previous / next keys move the row by
 *   one card, the dots follow it, and on phones the row is named a carousel. Never automatic.
 * - Commit rows (GitLog.astro): their highlights are <details>, open in the markup; on phones all
 *   but the first are folded; wider, all are open.
 * - Tap-to-copy (Contact.astro): a copy key copies its address and says so on the key and in the
 *   toast above the hotbar (role="status"), which keeps the bars in view while it shows. Without
 *   the Clipboard API it tries the older copy command; failing that it selects the address, which
 *   stays a mailto link and selectable text.
 */
import { carouselEnds, carouselIndex, carouselScroll, type Row } from '../lib/carousel';
import { BARS } from '../motion/params';
import { resolved } from './prefs';

const phone = matchMedia('(max-width: 767px)');

/** `more ▾` / `less ▴`: unfold or fold the terminal it controls. */
function initFold() {
  document.addEventListener('click', (e) => {
    const key = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-fold]');
    if (!key) return;
    const target = document.getElementById(key.getAttribute('aria-controls') ?? '');
    const open = key.getAttribute('aria-expanded') !== 'true';
    key.setAttribute('aria-expanded', String(open));
    target?.toggleAttribute('data-open', open);
  });
}

/** One carousel: its row of cards and the keys and dots under it. */
function initCarousel(track: HTMLElement) {
  const keys = document.querySelector<HTMLElement>(`[data-carousel-keys="${track.id}"]`);
  if (!keys) return;
  const prev = keys.querySelector<HTMLButtonElement>('[data-carousel-step="-1"]');
  const next = keys.querySelector<HTMLButtonElement>('[data-carousel-step="1"]');
  const dots = [...keys.querySelectorAll<HTMLElement>('.carousel__dots > *')];
  const cards = () => [...track.children].filter((c) => c instanceof HTMLElement) as HTMLElement[];

  const row = (): Row => {
    const [a, b] = cards();
    const step = a && b ? b.offsetLeft - a.offsetLeft : (a?.offsetWidth ?? 0);
    return {
      scroll: track.scrollLeft,
      maxScroll: track.scrollWidth - track.clientWidth,
      step,
      count: cards().length,
    };
  };
  /** Name it a carousel where it is one (phones), and nothing extra elsewhere. */
  const role = () => {
    if (phone.matches) {
      track.setAttribute('role', 'region');
      track.setAttribute('aria-roledescription', 'carousel');
      track.setAttribute('aria-label', track.dataset.carouselLabel ?? '');
    } else for (const a of ['role', 'aria-roledescription', 'aria-label']) track.removeAttribute(a);
  };
  let raf = 0;
  const sync = () => {
    raf = 0;
    const r = row();
    const at = carouselIndex(r);
    dots.forEach((d, i) => d.toggleAttribute('data-on', i === at));
    const ends = carouselEnds(r);
    // aria-disabled, not disabled: a key that reaches the end keeps the focus it has.
    prev?.setAttribute('aria-disabled', String(ends.atStart));
    next?.setAttribute('aria-disabled', String(ends.atEnd));
  };
  const request = () => {
    if (!raf) raf = requestAnimationFrame(sync);
  };
  track.addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  phone.addEventListener('change', () => {
    role();
    request();
  });
  keys.addEventListener('click', (e) => {
    const key = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-carousel-step]');
    if (!key || key.getAttribute('aria-disabled') === 'true') return;
    const r = row();
    const to = carouselScroll(r, carouselIndex(r) + Number(key.dataset.carouselStep));
    // Smooth at full motion; at once otherwise (calm, off, reduced motion, paused).
    const smooth =
      resolved().motion === 'full' && !document.documentElement.hasAttribute('data-paused');
    track.scrollTo({ left: to, behavior: smooth ? 'smooth' : 'auto' });
  });
  // A card that takes focus (Tab, a screen reader) comes whole into view at the row's start.
  track.addEventListener('focusin', (e) => {
    if (!phone.matches) return;
    const card = cards().find((c) => c.contains(e.target as Node));
    if (!card) return;
    const left = card.offsetLeft - (cards()[0]?.offsetLeft ?? 0);
    if (Math.abs(track.scrollLeft - left) > 1) track.scrollTo({ left, behavior: 'auto' });
  });
  role();
  sync();
}

/** Fold the commit rows on phones (all but the first); open them all on wider screens. */
function initCommitFolds() {
  const folds = [...document.querySelectorAll<HTMLDetailsElement>('[data-commit-fold]')];
  if (folds.length === 0) return;
  const apply = () =>
    folds.forEach((d, i) => {
      d.open = !phone.matches || i === 0;
    });
  phone.addEventListener('change', apply);
  apply();
}

/** Copy `text`: the Clipboard API, else the older copy command over a selection of `source`. */
async function copyText(text: string, source: Element | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No Clipboard API here (an insecure page, an old browser, a refusal): select it instead.
  }
  const selection = getSelection();
  if (!source || !selection) return false;
  selection.selectAllChildren(source);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

function initCopy() {
  const toast = document.querySelector<HTMLElement>('[data-toast]');
  const html = document.documentElement;
  let timer = 0;
  document.addEventListener('click', async (e) => {
    const key = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-copy-email]');
    if (!key) return;
    const text = key.dataset.copyEmail ?? '';
    const link = key.parentElement?.querySelector('a[href^="mailto:"]') ?? null;
    // Failing both, the address stays selected for the system's own copy (nothing said).
    if (!(await copyText(text, link))) return;
    for (const k of document.querySelectorAll('[data-copy-email][data-done]'))
      k.removeAttribute('data-done');
    key.setAttribute('data-done', '');
    if (toast) {
      const icon = key.querySelector('.contact__copied-icon')?.cloneNode(true);
      const ok = document.createElement('span');
      ok.className = 'toast__ok';
      ok.textContent = toast.dataset.ok ?? '';
      const what = document.createElement('span');
      what.className = 'toast__what';
      what.textContent = ` ${toast.dataset.copied ?? ''} ${text}`;
      toast.replaceChildren(...(icon ? [icon] : []), ok, what);
      toast.setAttribute('data-on', '');
      html.setAttribute('data-bars-pin', '');
      html.removeAttribute('data-bars');
    }
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      key.removeAttribute('data-done');
      toast?.removeAttribute('data-on');
      html.removeAttribute('data-bars-pin');
      // Emptied a moment later, once it has faded (an empty region announces nothing).
      window.setTimeout(() => {
        if (!toast?.hasAttribute('data-on')) toast?.replaceChildren();
      }, 400);
    }, BARS.toastMs);
  });
}

export function initMobile(): void {
  initFold();
  initCommitFolds();
  initCopy();
  for (const track of document.querySelectorAll<HTMLElement>('[data-carousel]'))
    initCarousel(track);
}
