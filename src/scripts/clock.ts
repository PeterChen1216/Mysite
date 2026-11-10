/**
 * Keeps the Clock Stamp phone (PhoneMockup.astro) on the real time. The page is built with a
 * fixed sample moment, which is what shows without JavaScript; this replaces it with now and
 * updates on each new minute. Elements carry `data-clock` and the zone in `data-tz`:
 *   time → 01:45 · hour → 01 · minute → 45 · date → Sat, Oct 24
 *   offset → +16h (from the zone in `data-home`) · hand → sets `--a`, the hand's angle on the dial
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

export function initClocks(): void {
  const els = [...document.querySelectorAll<HTMLElement>('[data-clock][data-tz]')];
  if (els.length === 0) return;

  const text = (el: HTMLElement, value: string) => {
    if (el.textContent !== value) el.textContent = value;
  };

  const update = () => {
    const now = new Date();
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
  const tick = () => {
    update();
    setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  tick();
  // Timers are throttled in a background tab: catch up as soon as the page is looked at again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
}
