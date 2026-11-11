/**
 * Keeps the Clock Stamp phone (PhoneMockup.astro) on the real time. The page is built with a
 * fixed sample moment, which is what shows without JavaScript; this replaces it with now and
 * updates on each new minute. Elements carry `data-clock` and the zone in `data-tz`:
 *   time → 01:45 · hour → 01 · minute → 45 · date → Sat, Oct 24
 *   offset → +16h (from the zone in `data-home`) · hand → sets `--a`, the hand's angle on the dial
 * Pause-all (WCAG 2.2.2: auto-updating content) holds it; on resume it jumps to now.
 *
 * The hands' tags are keys (PLAN-EXPERIENCE §6 row 11): pointing at one, tapping it or giving it
 * keyboard focus selects its city — the name, offset, big time and date switch to it, the other
 * hands dim. A choice while paused shows that city at the held moment.
 */
import {
  dateLabel,
  dialAngle,
  hourLabel,
  minuteLabel,
  offsetLabel,
  timeLabel,
  zonedParts,
} from '../lib/world-clock';
import { MOTION_EVENT, isPaused } from './prefs';

/**
 * Start the phones under `root` (the page; or a project's window over it, M3). Returns what stops
 * them again (the window's copy goes when the window closes).
 */
export function initClocks(root: ParentNode = document): () => void {
  const els = [...root.querySelectorAll<HTMLElement>('[data-clock][data-tz]')];
  if (els.length === 0) return () => undefined;
  const ac = new AbortController();
  const on = { signal: ac.signal };
  /** The moment shown while paused. */
  let held: Date | null = null;

  const text = (el: HTMLElement, value: string) => {
    if (el.textContent !== value) el.textContent = value;
  };

  const update = () => {
    const now = held ?? new Date();
    for (const el of els) {
      const zone = el.dataset.tz!;
      const parts = zonedParts(now, zone);
      switch (el.dataset.clock) {
        case 'time':
          text(el, timeLabel(parts));
          break;
        case 'hour':
          text(el, hourLabel(parts));
          break;
        case 'minute':
          text(el, minuteLabel(parts));
          break;
        case 'date':
          text(el, dateLabel(parts));
          break;
        case 'offset':
          text(el, offsetLabel(now, zone, el.dataset.home ?? zone));
          break;
        case 'hand':
          el.style.setProperty('--a', `${dialAngle(parts).toFixed(2)}deg`);
          break;
      }
    }
  };

  // One timer, re-armed for the start of each minute, so the face never lags the real clock.
  let timer = 0;
  const tick = () => {
    window.clearTimeout(timer);
    timer = 0;
    if (isPaused()) return;
    held = null;
    update();
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  tick();
  document.addEventListener(
    MOTION_EVENT,
    () => {
      if (isPaused()) {
        held ??= new Date();
        window.clearTimeout(timer);
        timer = 0;
      } else if (!timer) tick();
    },
    on,
  );
  for (const phone of root.querySelectorAll<HTMLElement>('[data-phone]')) initPicker(phone, update);
  // Timers are throttled in a background tab: catch up as soon as the page is looked at again.
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden && !isPaused()) update();
    },
    on,
  );
  return () => {
    ac.abort();
    window.clearTimeout(timer);
  };
}

/**
 * The phone's city keys: the static tags become buttons in a named group, and the phone stops
 * being hidden from assistive technology (its pictures still are).
 *
 * On phones (X4) a row of 44 px keys under the phone (ProjectFeatured.astro `[data-city-keys]`) is
 * the way to pick a city from the keyboard or a screen reader: the hands' 24 px tags still answer
 * a tap, but they leave the Tab order and the accessibility tree there (one set of keys, not two).
 */
const phoneLayout = matchMedia('(max-width: 767px)');

function initPicker(phone: HTMLElement, update: () => void) {
  const dial = phone.querySelector<HTMLElement>('.dial');
  const tags = [...phone.querySelectorAll<HTMLElement>('.hand__tag[data-city-tz]')];
  if (!dial || tags.length < 2) return;
  phone.removeAttribute('aria-hidden');
  for (const child of phone.children) if (child !== dial) child.setAttribute('aria-hidden', 'true');
  for (const child of dial.children)
    if (!child.querySelector('.hand__tag[data-city-tz]')) child.setAttribute('aria-hidden', 'true');
  dial.setAttribute('role', 'group');
  dial.setAttribute('aria-label', dial.dataset.pickLabel ?? '');

  const keys = tags.map((tag) => {
    const key = document.createElement('button');
    key.type = 'button';
    for (const a of tag.attributes) key.setAttribute(a.name, a.value);
    key.append(...tag.childNodes);
    key.setAttribute('aria-label', tag.dataset.cityName ?? '');
    key.setAttribute('aria-pressed', String(tag.hasAttribute('data-selected')));
    tag.replaceWith(key);
    return key;
  });
  const shown = phone.querySelectorAll<HTMLElement>(
    '[data-clock="offset"], [data-clock="hour"], [data-clock="minute"], [data-clock="date"]',
  );
  const city = phone.querySelector<HTMLElement>('[data-clock-city]');

  const pick = (key: HTMLButtonElement) => {
    if (key.getAttribute('aria-pressed') === 'true' && dial.hasAttribute('data-picked')) return;
    const zone = key.dataset.cityTz!;
    for (const k of keys) {
      const on = k === key;
      k.setAttribute('aria-pressed', String(on));
      k.closest('.hand')?.toggleAttribute('data-picked', on);
    }
    dial.setAttribute('data-picked', '');
    for (const el of shown) el.dataset.tz = zone;
    if (city) city.textContent = key.dataset.city ?? '';
    update();
  };
  for (const key of keys) {
    key.addEventListener('click', () => pick(key));
    key.addEventListener('focus', () => pick(key));
    key.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') pick(key);
    });
  }

  // The phone's row of city keys (outside the phone, in its card), kept in step with the hands.
  const row = phone.parentElement?.querySelector<HTMLElement>('[data-city-keys]');
  if (!row) return;
  const rowKeys = [...row.querySelectorAll<HTMLButtonElement>('[data-city-key]')];
  const sync = () => {
    const zone = keys.find((k) => k.getAttribute('aria-pressed') === 'true')?.dataset.cityTz;
    for (const k of rowKeys) k.setAttribute('aria-pressed', String(k.dataset.cityKey === zone));
  };
  // As the hands' keys do: a tap, a click or the keyboard's focus picks the city.
  const pickRow = (k: HTMLButtonElement) => {
    const hand = keys.find((h) => h.dataset.cityTz === k.dataset.cityKey);
    if (hand) pick(hand);
    sync();
  };
  for (const k of rowKeys) {
    k.addEventListener('click', () => pickRow(k));
    k.addEventListener('focus', () => pickRow(k));
  }
  for (const key of keys) key.addEventListener('click', sync);
  const layout = () => {
    const narrow = phoneLayout.matches;
    if (narrow) dial.setAttribute('aria-hidden', 'true');
    else dial.removeAttribute('aria-hidden');
    for (const key of keys) key.tabIndex = narrow ? -1 : 0;
  };
  phoneLayout.addEventListener('change', layout);
  layout();
  sync();
}
