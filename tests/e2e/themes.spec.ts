// Themes (PLAN-EXPERIENCE §3): each selectable theme once at full motion (the pruned matrix of
// §9.1), "auto" following the device, the automatic contrast modes, and the rules that make Mono
// and the colour-blind theme work (cues, dark objects, art).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { THEMES } from '../../src/prefs/model';
import { V2 } from './site';

const KEY = 'zhic:prefs:v1';

/** Load the page with a stored choice, as a returning visitor would. */
async function visit(page: Page, prefs: object) {
  await page.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k!, v!);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [KEY, JSON.stringify(prefs)],
  );
  await page.goto(V2);
}

/** Sum of layout shifts so far (the page's whole life, buffered). */
const layoutShift = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as Array<PerformanceEntry & { value: number }>)
            total += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
  );

/** Whether the first match's cue glyph (a ::before from data-cue) is drawn. */
const cueShown = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el, '::before').display !== 'none');

const bg = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
/** Relative luminance of an `rgb(…)` string. */
function lum(rgb: string): number {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [
    number,
    number,
    number,
  ];
  const f = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

test.describe('every theme', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'one run per theme (PLAN-EXPERIENCE §9.1); mobile runs Night',
  );
  for (const theme of THEMES) {
    test(`${theme}: applied before first paint, no layout shift, axe clean`, async ({ page }) => {
      await visit(page, { theme });
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      await page.evaluate(() => document.fonts.ready);
      expect(await layoutShift(page)).toBeLessThanOrEqual(0.05);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(blocking).toEqual([]);
    });
  }
});

test.describe('auto and the device', () => {
  test('"auto" follows the device’s light/dark setting without a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await visit(page, { theme: 'auto' });
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('night');
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    await page.emulateMedia({ colorScheme: 'light' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('day');
    expect(await page.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('light');
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });

  test('Night stays for a visitor who has not chosen, whatever the device prefers (Q-T2)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(V2);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('night');
  });

  test('more contrast is honoured in every theme: stronger mid text, cues on', async ({ page }) => {
    await page.goto(V2);
    const mid = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-text-mid').trim(),
      );
    const before = await mid();
    expect(await cueShown(page, '.ticker [data-cue]')).toBe(false);
    await page.emulateMedia({ contrast: 'more' });
    expect(await mid()).not.toBe(before);
    expect(await cueShown(page, '.ticker [data-cue]')).toBe(true);
  });

  test('forced colours: every control keeps a visible boundary; the cues show', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(V2);
    await page.locator('body').press(',');
    const missing = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'button, .mc-btn, input, [role="slider"], .ticker[tabindex]',
        ),
      ]
        .filter((el) => el.getClientRects().length > 0)
        .filter((el) => {
          if (el instanceof HTMLInputElement) return getComputedStyle(el).appearance === 'none';
          const cs = getComputedStyle(el);
          const border = ['top', 'right', 'bottom', 'left'].some(
            (s) =>
              parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 &&
              cs.getPropertyValue(`border-${s}-style`) !== 'none',
          );
          const outline = parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none';
          return !border && !outline;
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(missing).toEqual([]);
    await page.keyboard.press('Escape');
    expect(await cueShown(page, '.ticker [data-cue]')).toBe(true);
  });
});

/**
 * The page background (sections/Background.astro): how many coloured pictures and how many grey
 * copies are drawn, how many pictures carry a CSS filter, and whether the grid's grey copy loaded.
 */
const backgroundArt = (page: Page) =>
  page.evaluate(() => {
    const drawn = (sel: string) =>
      [...document.querySelectorAll<HTMLImageElement>(sel)].filter(
        (img) => getComputedStyle(img).display !== 'none',
      );
    return {
      colour: drawn('.bg__art--colour').length,
      mono: drawn('.bg__art--mono').length,
      filtered: drawn('.bg img').filter((img) => getComputedStyle(img).filter !== 'none').length,
      // The grid's copy is always in view; the others load when they scroll or resize into it.
      gridLoaded: [...document.querySelectorAll<HTMLImageElement>('.bg__grid.bg__art--mono')].some(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    };
  });

test.describe('what makes the themes work', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Night shows the design as shipped: no cue glyphs, no filters', async ({ page }) => {
    await visit(page, { theme: 'night' });
    expect(await cueShown(page, '.ticker [data-cue]')).toBe(false);
    expect(await cueShown(page, '.chip[data-cue]')).toBe(false);
    expect(
      await page
        .locator('.voxel')
        .first()
        .evaluate((el) => getComputedStyle(el).filter),
    ).toBe('none');
    // The page background shows its coloured pictures; the grey copies are not even fetched.
    expect(await backgroundArt(page)).toEqual({
      colour: 5,
      mono: 0,
      filtered: 0,
      gridLoaded: false,
    });
  });

  test('Day: a light page whose terminals, git log and chips stay dark', async ({ page }) => {
    await visit(page, { theme: 'day' });
    expect(lum(await bg(page, 'html'))).toBeGreaterThan(0.8);
    for (const sel of ['.term', '.log', '.chip'])
      expect(lum(await bg(page, sel)), sel).toBeLessThan(0.05);
    expect(lum(await bg(page, '.card'))).toBeGreaterThan(0.8);
  });

  for (const theme of ['mono-dark', 'mono-light', 'cvd']) {
    test(`${theme}: tags, chips and commits differ by glyph and shape, not hue alone`, async ({
      page,
    }) => {
      await visit(page, { theme });
      const glyphs = await page
        .locator('.ticker__track:not(.ticker__track--dup) [data-cue]')
        .evaluateAll((els) =>
          els
            .filter((el) => getComputedStyle(el, '::before').display !== 'none')
            .map((el) => getComputedStyle(el, '::before').content),
        );
      expect(new Set(glyphs).size).toBeGreaterThanOrEqual(3);
      expect(await cueShown(page, '.chip[data-cue]')).toBe(true);
      const rotate = await page
        .locator('.commit--diamond .commit__node')
        .first()
        .evaluate((el) => getComputedStyle(el).rotate);
      expect(rotate).toBe('45deg');
      expect(
        await page
          .locator('.commit--init .commit__node')
          .evaluate((el) => getComputedStyle(el, '::after').display),
      ).not.toBe('none');
    });
  }

  test('Mono: pictures in greyscale, the globe’s land white on a dark ocean', async ({ page }) => {
    await visit(page, { theme: 'mono-dark' });
    expect(
      await page
        .locator('.voxel')
        .first()
        .evaluate((el) => getComputedStyle(el).filter),
    ).toContain('grayscale(1)');
    expect(
      await page
        .locator('.globe__strip img')
        .first()
        .evaluate((el) => getComputedStyle(el).filter),
    ).toBe('brightness(0) invert(1)');
    expect(
      await page.locator('.stage__photo').evaluate((el) => getComputedStyle(el).filter),
    ).toContain('grayscale(1)');
  });

  for (const theme of ['mono-dark', 'mono-light']) {
    test(`${theme}: the page background is grey copies of its pictures, with no filter to redo`, async ({
      page,
    }) => {
      await visit(page, { theme });
      await expect
        .poll(() => backgroundArt(page))
        .toEqual({ colour: 0, mono: 5, filtered: 0, gridLoaded: true });
    });
  }

  test('the theme-color follows the theme', async ({ page }) => {
    await visit(page, { theme: 'mono-light' });
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#fff');
    expect(await page.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('light');
  });
});
