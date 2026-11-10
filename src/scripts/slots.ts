/**
 * Inventory slots (PLAN-EXPERIENCE §6 row 3): the skills and the coursework. Each list marked
 * `data-slots` becomes one roving-tabindex list — Tab reaches it once (its current slot), the
 * arrow keys move, Home / End jump — and a slot under the pointer, with focus or tapped shows its
 * enchant glint (motion full) and its tooltip: the slot's name over its group, place and count
 * (built into `data-tip` from copy.yaml about.slot_tip).
 *
 * One tooltip at a time (WCAG 1.4.13): it rises above the slot (below when there is no room),
 * never over it; it stays while the slot or the tooltip itself is hovered or the slot has focus;
 * Escape hides it until the pointer leaves or focus moves. The slot is described by it while it
 * shows. Without JavaScript the slots are plain text, as before.
 */
import { placeTooltip, rovingIndex } from '../lib/interact';
import { HOVER } from '../motion/params';
import { burstsAllowed } from './prefs';

const TIP_ID = 'slot-tip';

export function initSlots(): void {
  const lists = [...document.querySelectorAll<HTMLElement>('[data-slots]')];
  if (lists.length === 0) return;

  for (const list of lists) {
    const slots = [...list.querySelectorAll<HTMLElement>('[data-tip]')];
    slots.forEach((s, i) => (s.tabIndex = i === 0 ? 0 : -1));
    list.addEventListener('keydown', (e) => {
      const at = slots.indexOf(e.target as HTMLElement);
      if (at < 0) return;
      const to = rovingIndex(at, slots.length, e.key);
      if (to === null) return;
      e.preventDefault();
      slots[at]!.tabIndex = -1;
      slots[to]!.tabIndex = 0;
      slots[to]!.focus();
    });
    // Whichever slot was last focused is the list's stop next time.
    list.addEventListener('focusin', (e) => {
      const at = slots.indexOf(e.target as HTMLElement);
      if (at < 0) return;
      slots.forEach((s, i) => (s.tabIndex = i === at ? 0 : -1));
    });
  }

  let tip: HTMLElement | null = null;
  let shown: HTMLElement | null = null;
  let dismissed: HTMLElement | null = null;
  let hideTimer = 0;

  const make = () => {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.id = TIP_ID;
    tip.setAttribute('role', 'tooltip');
    tip.dataset.surface = 'dark';
    tip.innerHTML = '<span class="tip__name"></span><span class="tip__line"></span>';
    // Hoverable: moving onto the tooltip keeps it.
    tip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    tip.addEventListener('pointerleave', () => scheduleHide());
    document.body.append(tip);
    return tip;
  };

  const place = () => {
    if (!tip || !shown) return;
    const a = shown.getBoundingClientRect();
    const p = placeTooltip(
      { left: a.left, top: a.top, width: a.width, height: a.height },
      { width: tip.offsetWidth, height: tip.offsetHeight },
      { width: document.documentElement.clientWidth, height: innerHeight },
      HOVER.tooltip.gapPx,
    );
    tip.style.left = `${p.left}px`;
    tip.style.top = `${p.top}px`;
    tip.dataset.side = p.side;
  };

  const show = (slot: HTMLElement) => {
    clearTimeout(hideTimer);
    if (dismissed === slot) return;
    const t = tip ?? make();
    if (shown && shown !== slot) shown.removeAttribute('aria-describedby');
    shown = slot;
    t.querySelector('.tip__name')!.textContent = slot.textContent?.trim() ?? '';
    t.querySelector('.tip__line')!.textContent = slot.dataset.tip ?? '';
    slot.setAttribute('aria-describedby', TIP_ID);
    t.dataset.on = 'false';
    place();
    void t.offsetWidth;
    t.dataset.on = 'true';
    if (burstsAllowed() && !slot.hasAttribute('data-glint')) {
      slot.setAttribute('data-glint', '');
      const done = () => slot.removeAttribute('data-glint');
      slot.addEventListener('animationend', done, { once: true });
      setTimeout(done, HOVER.glintMs + 100);
    }
  };
  const hide = () => {
    clearTimeout(hideTimer);
    if (tip) tip.dataset.on = 'false';
    shown?.removeAttribute('aria-describedby');
    shown = null;
  };
  /** Give the pointer a moment to reach the tooltip (hoverable). */
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (shown && shown === document.activeElement) return; // focus keeps it
      if (tip?.matches(':hover') || shown?.matches(':hover')) return;
      hide();
    }, 200);
  };

  const slotOf = (t: EventTarget | null) =>
    t instanceof Element ? t.closest<HTMLElement>('[data-slots] [data-tip]') : null;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const slot = slotOf(e.target);
    if (slot) show(slot);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const slot = slotOf(e.target);
    if (slot && !slot.contains(e.relatedTarget as Node | null)) {
      if (dismissed === slot) dismissed = null;
      scheduleHide();
    }
  });
  // Focus: Tab, the arrow keys, or a tap (a tap focuses the slot).
  document.addEventListener('focusin', (e) => {
    const slot = slotOf(e.target);
    if (slot) show(slot);
  });
  document.addEventListener('focusout', (e) => {
    const slot = slotOf(e.target);
    if (!slot) return;
    if (dismissed === slot) dismissed = null;
    if (slot === shown && !slot.matches(':hover')) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !shown || e.defaultPrevented) return;
    dismissed = shown;
    hide();
  });
  addEventListener('scroll', place, { passive: true });
  addEventListener('resize', place, { passive: true });
}
