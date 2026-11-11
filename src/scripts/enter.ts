/**
 * Entrances, once per section per visit, as a section first comes into view:
 * - row 14 of the catalogue (PLAN-EXPERIENCE §6): the header's `$ command` types, then its heading
 *   resolves — the intro's language, for every section (motion full, any tier with loops);
 * - the chunk-load transition (§7.4, graphics tier 2 and 3): the section's cards rise in turn and
 *   their borders resolve from dashed to solid, and its data bars fill to their real values (the
 *   GPA's XP cells, the status bars of the building project) — what the cards already show.
 *
 * Nothing is hidden before it plays: the start states exist only while an entrance runs (CSS
 * animations that fill backwards, keyed on `data-enter`), so without JavaScript, with reduced
 * motion, at calm or off, while paused, or for a section already in view when the page opens, the
 * section simply is there. Pausing, or a change of motion level, during an entrance ends it at
 * once. Timings: src/motion/params.ts HOVER.header and ENTER.
 */
import { entranceAllowed, typeMs } from '../lib/interact';
import { ENTER, HOVER } from '../motion/params';
import { MOTION_EVENT, isPaused, resolved } from './prefs';
import { currentTier } from './tier';

const SECTIONS = '#about, #projects, #experience, #community, #contact';
const COMMAND = '.sh__cmd, .community__cmd, .contact__cmd';
/** What rises in a section's chunk-load: its cards and panels, in reading order. */
const CHUNKS = '.card, .log, .contact__term';
const CELLS = '.xp__cell--on, .now__cell--on, .pf__cell--on';

function state() {
  return {
    motion: resolved().motion,
    paused: isPaused(),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    tier: currentTier(),
  };
}

/** Play a section's entrance; returns how long it runs (0: none). */
function play(section: HTMLElement): number {
  const s = state();
  const kinds: string[] = [];
  let longest = 0;
  if (entranceAllowed(s, 'header')) {
    const cmd = section.querySelector<HTMLElement>(COMMAND);
    if (cmd) {
      const chars = (cmd.textContent ?? '').trim().length;
      const ms = typeMs(chars, HOVER.header);
      cmd.style.setProperty('--enter-steps', String(Math.max(1, chars)));
      section.style.setProperty('--enter-type', `${ms}ms`);
      kinds.push('header');
      longest = ms + HOVER.header.resolveMs;
    }
  }
  if (entranceAllowed(s, 'chunk')) {
    const chunks = [...section.querySelectorAll<HTMLElement>(CHUNKS)].filter(
      (el) => !el.parentElement?.closest(CHUNKS),
    );
    chunks.forEach((el, i) => el.style.setProperty('--chunk-i', String(i)));
    for (const bar of section.querySelectorAll<HTMLElement>('.xp__bar, .now__bar, .pf__bar'))
      bar
        .querySelectorAll<HTMLElement>(CELLS)
        .forEach((c, i) => c.style.setProperty('--cell-i', String(i)));
    if (chunks.length) {
      kinds.push('chunk');
      const cells = section.querySelectorAll(CELLS).length;
      longest = Math.max(
        longest,
        ENTER.ms + (chunks.length - 1) * ENTER.staggerMs,
        ENTER.ms / 2 + cells * ENTER.cellMs,
      );
    }
  }
  if (!kinds.length) return 0;
  section.dataset.enter = kinds.join(' ');
  return longest;
}

function end(section: HTMLElement) {
  delete section.dataset.enter;
}

/** The element the address's #fragment names, if any (a malformed one names none). */
function linkTarget(): HTMLElement | null {
  try {
    return location.hash
      ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
      : null;
  } catch {
    return null;
  }
}

export function initEntrances(): void {
  const sections = [...document.querySelectorAll<HTMLElement>(SECTIONS)];
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const running = new Set<HTMLElement>();
  // In view when the page opened (a tall screen, a deep link): simply there. Read now, not from the
  // observer's first report: WebKit can deliver that only after a visitor's first scroll.
  const opened = new Set(
    sections.filter((s) => {
      const r = s.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    }),
  );
  const linked = linkTarget()?.closest<HTMLElement>(SECTIONS);
  if (linked) opened.add(linked);
  let scrolled = false;
  addEventListener('scroll', () => (scrolled = true), { once: true, passive: true });
  let first = true;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const section = e.target as HTMLElement;
        io.unobserve(section);
        if (opened.has(section)) continue;
        // Still where the page opened (the layout settled after the reading above).
        if (first && !scrolled && e.boundingClientRect.top < innerHeight) continue;
        const ms = play(section);
        if (!ms) continue;
        running.add(section);
        setTimeout(() => {
          end(section);
          running.delete(section);
        }, ms + 50);
      }
      first = false;
    },
    { rootMargin: `0px 0px ${ENTER.marginPct}% 0px` },
  );
  for (const section of sections) io.observe(section);
  // Pause, calm, off or reduced motion during an entrance: it ends at once, at its end state.
  document.addEventListener(MOTION_EVENT, () => {
    const s = state();
    if (s.motion === 'full' && !s.paused && !s.reduced) return;
    for (const section of running) end(section);
    running.clear();
  });
}
