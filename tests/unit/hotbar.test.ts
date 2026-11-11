// The phone's bars (PLAN-EXPERIENCE §8.2; src/lib/hotbar.ts): scroll-spy and hide / show.
import { describe, expect, it } from 'vitest';
import { barState, currentSection, END_SLACK_PX, type BarInput } from '../../src/lib/hotbar';
import { BARS } from '../../src/motion/params';

const VIEW = { height: 800, scroll: 1000, maxScroll: 5000, line: 0.4 };
/** Four sections, each 1000 px tall, the first starting `top` px below the view's top. */
const boxes = (top: number) =>
  ['about', 'projects', 'experience', 'contact'].map((id, i) => ({
    id,
    top: top + i * 1000,
    bottom: top + (i + 1) * 1000,
  }));

describe('currentSection (scroll-spy)', () => {
  it('is none above the first section (the hero)', () => {
    expect(currentSection(boxes(400), VIEW)).toBeNull();
    expect(currentSection(boxes(321), VIEW)).toBeNull();
  });
  it('is the last section whose top has passed the reading line', () => {
    expect(currentSection(boxes(320), VIEW)).toBe('about');
    expect(currentSection(boxes(-500), VIEW)).toBe('about');
    expect(currentSection(boxes(-700), VIEW)).toBe('projects');
    expect(currentSection(boxes(-2690), VIEW)).toBe('contact');
  });
  it('at the foot of the page, the last section on screen, even below the line', () => {
    const end = { ...VIEW, scroll: 5000 };
    // contact starts at 700: below the line (320), but the page cannot scroll further.
    const sections = boxes(-2300);
    expect(currentSection(sections, { ...VIEW, scroll: 4000 })).toBe('experience');
    expect(currentSection(sections, end)).toBe('contact');
    expect(currentSection(sections, { ...end, scroll: 5000 - END_SLACK_PX })).toBe('contact');
    // A last section scrolled past (only the footer on screen) is still the one shown.
    expect(currentSection(boxes(-4500), end)).toBe('contact');
  });
  it('a short page that cannot scroll uses the line', () => {
    expect(currentSection(boxes(100), { ...VIEW, scroll: 0, maxScroll: 0 })).toBe('about');
  });
  it('nothing to spy on', () => {
    expect(currentSection([], VIEW)).toBeNull();
  });
});

describe('barState (hide on the way down, show on the way up)', () => {
  const base: BarInput = {
    scroll: 600,
    previous: 600,
    maxScroll: 5000,
    hidden: false,
    travel: 0,
    pinned: false,
  };
  const step = (from: BarInput, to: number) =>
    ({
      ...from,
      ...barState({ ...from, previous: from.scroll, scroll: to }, BARS),
      scroll: to,
    }) as BarInput;

  it('hides once the page has moved down far enough in one go', () => {
    let s = step(base, 610);
    expect(s.hidden).toBe(false);
    s = step(s, 600 + BARS.hideAfterPx);
    expect(s.hidden).toBe(true);
  });
  it('comes back once the page has moved up far enough, and stays', () => {
    let s = step(base, 900);
    expect(s.hidden).toBe(true);
    s = step(s, 895);
    expect(s.hidden).toBe(true);
    s = step(s, 900 - BARS.showAfterPx);
    expect(s.hidden).toBe(false);
    s = step(s, 880);
    expect(s.hidden).toBe(false);
  });
  it('a turn of direction starts the count again', () => {
    let s = step(base, 620); // 20 down: not yet
    s = step(s, 615); // 5 up
    s = step(s, 635); // 20 down again: the count starts from the turn
    expect(s.hidden).toBe(false);
    s = step(s, 640);
    expect(s.hidden).toBe(true);
  });
  it('no movement keeps the state and the count', () => {
    const s = step({ ...base, hidden: true, travel: 40 }, 600);
    expect(s).toMatchObject({ hidden: true, travel: 40 });
  });
  it('always shows near the top and at the foot of the page', () => {
    expect(
      barState({ ...base, hidden: true, travel: 100, scroll: BARS.topPx, previous: 0 }, BARS)
        .hidden,
    ).toBe(false);
    expect(barState({ ...base, scroll: 4990, previous: 4900 }, BARS).hidden).toBe(false);
    expect(barState({ ...base, scroll: 4970, previous: 4900 }, BARS).hidden).toBe(true);
  });
  it('a pin (focus in a bar, a dialog, a toast) keeps them in view', () => {
    expect(barState({ ...base, scroll: 900, pinned: true }, BARS).hidden).toBe(false);
  });
});
