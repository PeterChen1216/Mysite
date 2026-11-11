// Motion levels and pause-all (PLAN-EXPERIENCE §4.1, WCAG 2.2.2), in Night / English as the
// pruned matrix of §9.1 asks: full, calm, off, and the pause key holding every loop — CSS loops,
// the globe's spin and the Clock Stamp phone's live clock.
import { expect, test, type Page } from '@playwright/test';
import { minuteLabel, zonedParts } from '../../src/lib/world-clock';
import { runningAnimations, runningLoops } from './animations';
import { copy } from './copy';
import { V2 } from './site';

const KEY = 'zhic:prefs:v1';
const seed = (page: Page, prefs: object) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [KEY, JSON.stringify(prefs)]);
const html = (page: Page) =>
  page.evaluate(() => ({
    motion: document.documentElement.dataset.motion,
    classes: [...document.documentElement.classList].sort(),
  }));
/** Intro animations (the load sequence) that exist right now. */
const introAnimations = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => ((a as CSSAnimation).animationName ?? '').startsWith('intro-')).length,
  );
/** The ticker's loop length in ms. */
const tickerMs = (page: Page) =>
  page
    .locator('.ticker__track')
    .first()
    .evaluate((el) => Number(el.getAnimations()[0]?.effect?.getComputedTiming().duration ?? 0));
/**
 * From now on, the most pixels the hover-burst canvas has shown in any frame, read every frame (a
 * burst lives 300–400 ms: CI's WebKit beside the software-WebGL tests can answer a poll after it
 * is over). Returns the reader.
 */
async function watchBurstPixels(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __burstMax: number };
    w.__burstMax = 0;
    const until = performance.now() + 20_000;
    const read = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('.particles-layer');
      if (canvas && canvas.width > 1) {
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
        w.__burstMax = Math.max(w.__burstMax, n);
      }
      if (performance.now() < until) requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
  });
  return () => page.evaluate(() => (window as unknown as { __burstMax: number }).__burstMax);
}
/** Pixels drawn on the hover-burst canvas (0 when there is none). */
const burstPixels = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.particles-layer');
    if (!canvas) return 0;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
    return n;
  });

test.describe('motion levels', () => {
  test('full (the default): the intro plays, loops run, hover bursts', async ({
    page,
    isMobile,
  }) => {
    await page.goto(V2);
    expect(await html(page)).toEqual({ motion: 'full', classes: ['intro', 'js', 'motion'] });
    expect(await introAnimations(page)).toBeGreaterThan(0);
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    if (!isMobile) {
      const drawn = await watchBurstPixels(page);
      await page.locator('.hero .mc-btn').first().hover();
      await expect.poll(drawn).toBeGreaterThan(0);
    }
  });

  test('calm: no intro and no bursts; the loops run three times slower', async ({
    page,
    isMobile,
  }) => {
    await page.goto(V2);
    const full = await tickerMs(page);
    expect(full).toBeGreaterThan(0);

    await seed(page, { motion: 'calm' });
    await page.reload();
    expect(await html(page)).toEqual({ motion: 'calm', classes: ['js', 'motion'] });
    expect(await introAnimations(page)).toBe(0);
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    expect(await tickerMs(page)).toBeCloseTo(full * 3, 0);
    if (!isMobile) {
      const drawn = await watchBurstPixels(page);
      await page.locator('.hero .mc-btn').first().hover();
      await page.waitForTimeout(400);
      expect(await drawn()).toBe(0);
      expect(await burstPixels(page)).toBe(0);
    }
  });

  test('off: nothing moves, and the ticker scrolls by hand', async ({ page }) => {
    await seed(page, { motion: 'off' });
    await page.goto(V2);
    expect(await html(page)).toEqual({ motion: 'off', classes: ['js'] });
    await expect.poll(() => runningAnimations(page), { timeout: 3000 }).toEqual([]);
    await expect(page.locator('.ticker')).toHaveCSS('overflow-x', 'auto');
    await expect(page.locator('.ticker__track--dup')).toBeHidden();
  });

  test('a level chosen while the page is open applies at once, and the intro never replays', async ({
    page,
  }) => {
    await page.goto(V2);
    await page.locator('body').press(',');
    const motion = page.getByRole('group', { name: copy.prefs.motion.legend, exact: true });
    const pick = (level: 'full' | 'off') =>
      motion
        .getByRole('radio', {
          name: `${copy.prefs.motion.options[level].name} ${copy.prefs.motion.options[level].note}`,
          exact: true,
        })
        .check();
    await pick('off');
    await expect.poll(() => runningAnimations(page), { timeout: 3000 }).toEqual([]);
    await pick('full');
    expect((await html(page)).classes).toEqual(['js', 'motion']);
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    expect(await introAnimations(page)).toBe(0);
  });
});

test.describe('pause-all (WCAG 2.2.2)', () => {
  const { home_zone: home, cities } = copy.projects.phone;
  const selected = cities.filter((c) => c.time_zone !== home)[0] ?? cities[0]!;
  const minute = (at: Date) => minuteLabel(zonedParts(at, selected.time_zone));

  test('the ⏸ key holds every loop, the globe and the phone’s clock; ▶ resumes them', async ({
    page,
  }) => {
    const start = new Date('2027-03-01T07:59:30Z');
    await page.clock.install({ time: start });
    await page.goto(V2);
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    const key = page.getByRole('button', { name: copy.prefs.pause_label, exact: true });
    await expect(key).toHaveAttribute('aria-pressed', 'false');
    await key.click();
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => runningLoops(page)).toBe(0);
    expect(
      await page
        .locator('.stage [data-globe-strip]')
        .evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running')),
    ).toBe(true);

    // The phone's clock stays where it was while paused…
    const clockMinute = page.locator('.phone [data-clock="minute"]');
    await expect(clockMinute).toHaveText(minute(start));
    await page.clock.fastForward(3 * 60_000);
    await expect(clockMinute).toHaveText(minute(start));
    // …and jumps to now when resumed.
    await key.click();
    await expect(key).toHaveAttribute('aria-pressed', 'false');
    await expect(clockMinute).toHaveText(minute(new Date(start.getTime() + 3 * 60_000)));
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
  });

  test('`p` does the same from the keyboard, also with motion off (the clock still updates there)', async ({
    page,
  }) => {
    const start = new Date('2027-03-01T07:59:30Z');
    await page.clock.install({ time: start });
    await seed(page, { motion: 'off' });
    await page.goto(V2);
    await page.locator('body').press('p');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-paused'))).toBe(
      true,
    );
    const clockMinute = page.locator('.phone [data-clock="minute"]');
    await page.clock.fastForward(2 * 60_000);
    await expect(clockMinute).toHaveText(minute(start));
    await page.locator('body').press('p');
    await expect(clockMinute).toHaveText(minute(new Date(start.getTime() + 2 * 60_000)));
  });
});
