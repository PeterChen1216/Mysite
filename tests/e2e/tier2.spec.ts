// Graphics tier 2 (PLAN-EXPERIENCE §7.2, §7.4): the 2D ambient layer — a three-layer parallax
// star field and motes — and the chunk-load transitions with the data bars filling. Forced with
// `?tier=2` (automated browsers get tier 1 by default).
import { expect, test, type Page } from '@playwright/test';
import { AMBIENT } from '../../src/motion/params';
import { V2, open } from './site';

const KEY = 'zhic:prefs:v1';
const TIER2 = `${V2}?tier=2`;
const seed = (page: Page, prefs: object) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [KEY, JSON.stringify(prefs)]);

interface AmbientStatus {
  frames: number;
  offsets: number[];
  scroll: number;
  motes: number;
  running: boolean;
  sky: boolean;
}
const ambient = (page: Page) =>
  page.evaluate(
    () =>
      (
        document.querySelector('canvas.ambient') as
          (HTMLCanvasElement & { ambientStatus?: unknown }) | null
      )?.ambientStatus ?? null,
  ) as Promise<AmbientStatus | null>;
const live = (page: Page) =>
  page.waitForFunction(() => {
    const s = (
      document.querySelector('canvas.ambient') as HTMLCanvasElement & {
        ambientStatus?: { frames: number };
      }
    )?.ambientStatus;
    return !!s && s.frames > 0;
  });

test.describe('the ambient layer (tier 2)', () => {
  test('one canvas behind the page, decorative; it replaces the still stars', async ({ page }) => {
    await page.goto(TIER2);
    await live(page);
    const canvas = page.locator('canvas.ambient');
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(
      await canvas.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          position: cs.position,
          z: cs.zIndex,
          events: cs.pointerEvents,
          tab: (el as HTMLElement).tabIndex,
        };
      }),
    ).toEqual({ position: 'fixed', z: '-1', events: 'none', tab: -1 });
    await expect(page.locator('.bg__stars').first()).toHaveCSS('visibility', 'hidden');
    // §1.3: one 2D overlay at most beside it (the hover layer), and no WebGL.
    expect(await page.locator('canvas.scene').count()).toBe(0);
    expect((await ambient(page))!.motes).toBeGreaterThan(0);
  });

  test('its three layers move at 0.2, 0.5 and 1.0 of the scroll', async ({ page }) => {
    await page.goto(TIER2);
    await live(page);
    const h = await page.evaluate(() => innerHeight);
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect.poll(async () => (await ambient(page))!.scroll).toBe(300);
    const s = (await ambient(page))!;
    expect(s.offsets.map((o) => Math.round(o))).toEqual(
      AMBIENT.factors.map((f) => Math.round((300 * f) % h)),
    );
  });

  test('pause holds the motes (a scroll still moves the stars); a hidden tab draws nothing', async ({
    page,
  }) => {
    await page.goto(TIER2);
    await live(page);
    await expect.poll(async () => (await ambient(page))!.running).toBe(true);
    await page.locator('body').press('p');
    await page.waitForTimeout(200);
    const held = (await ambient(page))!;
    expect(held.running).toBe(false);
    await page.waitForTimeout(400);
    expect((await ambient(page))!.frames).toBe(held.frames);
    await page.evaluate(() => window.scrollTo(0, 120));
    await expect.poll(async () => (await ambient(page))!.frames).toBeGreaterThan(held.frames);
    await page.locator('body').press('p');
    await expect.poll(async () => (await ambient(page))!.running).toBe(true);
    // Hidden: the page says so and stops asking for frames.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(150);
    const hidden = (await ambient(page))!.frames;
    await page.waitForTimeout(400);
    expect((await ambient(page))!.frames).toBe(hidden);
  });

  test('light themes have no night sky: it draws nothing there, and the stars stay hidden', async ({
    page,
  }) => {
    await seed(page, { theme: 'day' });
    await page.goto(TIER2);
    await live(page);
    expect((await ambient(page))!.sky).toBe(false);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-ambient'))).toBe(
      false,
    );
  });

  for (const [what, path, prefs] of [
    ['tier 1', `${V2}?tier=1`, {}],
    ['tier 0', `${V2}?tier=0`, {}],
    ['calm (no parallax, no particles)', TIER2, { motion: 'calm' }],
    ['motion off', TIER2, { motion: 'off' }],
  ] as const)
    test(`absent at ${what}`, async ({ page }) => {
      await seed(page, prefs);
      await page.goto(path);
      await page.waitForLoadState('load');
      await page.waitForTimeout(1200);
      expect(await page.locator('canvas.ambient').count()).toBe(0);
    });

  test('never beside the WebGL scene', async ({ page, isMobile, browserName }) => {
    test.skip(isMobile || browserName !== 'chromium', 'the desktop scene, in Chromium');
    await open(page, `${V2}?tier=3`);
    expect(await page.locator('canvas.ambient').count()).toBe(0);
  });

  test('a change of motion level brings it and takes it away without a reload', async ({
    page,
  }) => {
    await page.goto(TIER2);
    await live(page);
    const set = (motion: string) =>
      page.evaluate(
        ([k, m]) => {
          localStorage.setItem(k!, JSON.stringify({ motion: m }));
          window.dispatchEvent(new StorageEvent('storage', { key: k! }));
        },
        [KEY, motion],
      );
    await set('off');
    await expect(page.locator('canvas.ambient')).toHaveCount(0);
    await expect(page.locator('.bg__stars').first()).toHaveCSS('visibility', 'visible');
    await set('full');
    await live(page);
  });
});

test.describe('chunk-load transitions (tier 2 and up, motion full)', () => {
  test('cards rise in turn, borders resolve to solid, the data bars fill; then all is at rest', async ({
    page,
  }) => {
    await page.goto(TIER2);
    await page.evaluate(() => document.getElementById('about')!.scrollIntoView({ block: 'start' }));
    const about = page.locator('#about');
    await expect(about).toHaveAttribute('data-enter', /chunk/);
    const names = (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(await names('#about .card')).toEqual(
      expect.arrayContaining(['enter-rise', 'enter-solid']),
    );
    expect(await names('#about .xp__cell--on')).toContain('enter-cell');
    // In turn: each card waits a little longer than the one before.
    const delays = await page
      .locator('#about .card')
      .evaluateAll((els) =>
        els.map((el) => Number(el.getAnimations()[0]?.effect?.getTiming().delay ?? 0)),
      );
    expect(delays[1]).toBeGreaterThan(delays[0]!);
    await expect(about).not.toHaveAttribute('data-enter', { timeout: 4000 });
    await expect(page.locator('#education')).toHaveCSS('border-top-style', 'solid');
    await expect(page.locator('#education')).toHaveCSS('opacity', '1');
  });

  test('tier 1 types the header but loads no chunk', async ({ page }) => {
    await page.goto(`${V2}?tier=1`);
    await page.evaluate(() => document.getElementById('about')!.scrollIntoView({ block: 'start' }));
    await expect(page.locator('#about')).toHaveAttribute('data-enter', 'header');
  });

  test('reduced motion: nothing to wait for — the cards are simply there', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(TIER2);
    await page.evaluate(() => document.getElementById('about')!.scrollIntoView());
    await page.waitForTimeout(250);
    await expect(page.locator('#about')).not.toHaveAttribute('data-enter');
    await ctx.close();
  });
});
