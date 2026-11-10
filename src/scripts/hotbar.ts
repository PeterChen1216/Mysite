/**
 * Scroll-spy and the phone's bars (PLAN-EXPERIENCE §8.2; the rules are src/lib/hotbar.ts).
 *
 * The section in view marks its link current (aria-current) in the desktop nav and in the
 * hotbar alike. On phones (below 768 px) the top bar and the hotbar slide away together as the
 * page scrolls down (html[data-bars="hidden"], transform only) and come back on the way up, at the
 * top and at the foot of the page, and while focus is in either bar, a dialog is open or the
 * copy toast shows (data-bars-pin). Hidden bars stay in the page and the accessibility tree: Tab
 * into them brings them back. Where the hotbar's names do not fit beside each other (the
 * narrowest phones, larger text), it shows its icons only (data-compact).
 *
 * Progressive enhancement: without JavaScript every link is a plain anchor and the bars stay put.
 */
import { barState, currentSection, type SectionBox } from '../lib/hotbar';
import { BARS } from '../motion/params';
import { PREFS_EVENT } from './prefs';

const html = document.documentElement;
const phone = matchMedia('(max-width: 767px)');

export function initBars(): void {
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      '.nav__links a[href*="#"], .hotbar a[data-spy]',
    ),
  ].filter((a) => a.hash.length > 1 && a.pathname === location.pathname);
  const ids = [...new Set(links.map((a) => a.hash.slice(1)))];
  const sections = ids
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  const bars = [...document.querySelectorAll<HTMLElement>('.nav, .hotbar')];
  const hotbar = document.querySelector<HTMLElement>('.hotbar');

  let state = { hidden: false, travel: 0 };
  let previous = scrollY;
  let current: string | null | undefined;
  let raf = 0;

  const pinned = () =>
    bars.some((b) => b.contains(document.activeElement)) ||
    document.querySelector('dialog[open]') !== null ||
    html.hasAttribute('data-bars-pin');

  const spy = () => {
    if (sections.length === 0) return;
    const boxes: SectionBox[] = sections.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.id, top: r.top, bottom: r.bottom };
    });
    const id = currentSection(boxes, {
      height: innerHeight,
      scroll: scrollY,
      maxScroll: document.documentElement.scrollHeight - innerHeight,
      line: BARS.spyLine,
    });
    if (id === current) return;
    current = id;
    for (const a of links) {
      if (a.hash.slice(1) === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };

  const slide = () => {
    const scroll = scrollY;
    if (!phone.matches) {
      state = { hidden: false, travel: 0 };
      previous = scroll;
      html.removeAttribute('data-bars');
      return;
    }
    state = barState(
      {
        scroll,
        previous,
        maxScroll: document.documentElement.scrollHeight - innerHeight,
        hidden: state.hidden,
        travel: state.travel,
        pinned: pinned(),
      },
      BARS,
    );
    previous = scroll;
    if (state.hidden) html.setAttribute('data-bars', 'hidden');
    else html.removeAttribute('data-bars');
  };

  /** Icons only wherever a slot's name does not fit (measured with the names showing). */
  const fit = () => {
    if (!hotbar) return;
    if (!phone.matches) {
      hotbar.removeAttribute('data-compact');
      return;
    }
    if (innerWidth < 375) {
      hotbar.setAttribute('data-compact', '');
      return;
    }
    hotbar.removeAttribute('data-compact');
    const tight = [...hotbar.querySelectorAll<HTMLElement>('.hotbar__slot')].some((slot) => {
      const label = slot.querySelector<HTMLElement>('.hotbar__label');
      return label !== null && label.getBoundingClientRect().width > slot.clientWidth;
    });
    hotbar.toggleAttribute('data-compact', tight);
  };

  const update = () => {
    raf = 0;
    spy();
    slide();
  };
  const request = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  addEventListener('scroll', request, { passive: true });
  addEventListener(
    'resize',
    () => {
      fit();
      request();
    },
    { passive: true },
  );
  phone.addEventListener('change', () => {
    fit();
    request();
  });
  // A larger text size can push the names past their slots.
  document.addEventListener(PREFS_EVENT, fit);
  // Focus into a hidden bar brings both back (Tab, a screen reader's cursor, a skip back).
  document.addEventListener('focusin', (e) => {
    if (bars.some((b) => b.contains(e.target as Node))) {
      state = { hidden: false, travel: 0 };
      html.removeAttribute('data-bars');
    }
  });
  void document.fonts?.ready.then(fit);
  fit();
  update();
}
