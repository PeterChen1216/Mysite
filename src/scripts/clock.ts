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

export function initClocks(): void {
  const els = [...document.querySelectorAll<HTMLElement>('[data-clock][data-tz]')];
  if (els.length === 0) return;
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
  document.addEventListener(MOTION_EVENT, () => {
    if (isPaused()) {
      held ??= new Date();
      window.clearTimeout(timer);
      timer = 0;
    } else if (!timer) tick();
  });
  for (const phone of document.querySelectorAll<HTMLElement>('[data-phone]'))
    initPicker(phone, update);
  // Timers are throttled in a background tab: catch up as soon as the page is looked at again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isPaused()) update();
  });
}

/**
 * The phone's city keys: the static tags become buttons in a named group, and the phone stops
 * being hidden from assistive technology (its pictures still are).
 */
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
}
