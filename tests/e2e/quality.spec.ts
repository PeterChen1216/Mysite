import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { contentFor } from './locale';
import { LOCALE_PAGES, TIER_PAGES, open } from './site';

/** Serious or critical axe violations (WCAG 2.1 A/AA + best practice), one line each. */
async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

/** Serve the page with every <script> removed: the page as a visitor without JavaScript gets it. */
async function withoutScripts(page: Page, path: string) {
  await page.route(`**${path}`, async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    await route.fulfill({ response: res, body: html });
  });
}

// Every locale, in Night (PLAN-EXPERIENCE §9.1).
for (const { locale, path: V2 } of LOCALE_PAGES)
  test.describe(`accessibility & robustness (${locale})`, () => {
    const { copy } = contentFor(locale);
    test('axe: no serious or critical violations', async ({ page }) => {
      await page.goto(V2);
      expect(await blockingViolations(page)).toEqual([]);
    });

    test.describe('with reduced motion', () => {
      test.use({ reducedMotion: 'reduce' });
      test('axe: no serious or critical violations', async ({ page }) => {
        await page.goto(V2);
        expect(await blockingViolations(page)).toEqual([]);
      });
    });

    test('axe: no serious or critical violations without JavaScript', async ({ page }) => {
      await withoutScripts(page, V2);
      await page.goto(V2);
      expect(await page.evaluate(() => document.documentElement.classList.contains('motion'))).toBe(
        false,
      );
      expect(await blockingViolations(page)).toEqual([]);
    });

    test('all content is readable without JavaScript', async ({ browser, isMobile }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(V2);
      for (const id of ['about', 'education', 'honors', 'projects', 'experience', 'contact']) {
        // X4: on a phone the honors are listed in the Education card, under their school.
        const where = id === 'honors' && isMobile ? '#education .edu__honors--phone' : `#${id}`;
        await expect(page.locator(where).first()).toBeVisible();
      }
      await context.close();
    });

    test('skip link is the first tab stop and moves focus to main', async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === 'webkit', 'Safari does not Tab to links by default');
      await page.goto(V2);
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: copy.labels.skip_link, exact: true });
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
    });

    test('one h1 and no skipped heading levels', async ({ page }) => {
      await page.goto(V2);
      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1]!).toBeLessThanOrEqual(1));
    });

    test('no console errors and no failed requests', async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
      page.on('requestfailed', (r) => problems.push(`${r.url()} ${r.failure()?.errorText}`));
      page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
      await page.goto(V2, { waitUntil: 'networkidle' });
      expect(problems).toEqual([]);
    });
  });

// English in Night at every graphics tier (PLAN-EXPERIENCE §7, acceptance F; §9.1).
for (const { path, tier } of TIER_PAGES)
  test.describe(`accessibility at graphics tier ${tier}`, () => {
    test.skip(
      ({ isMobile, browserName }) => tier === 3 && (isMobile || browserName === 'webkit'),
      // CI's WebKit draws WebGL in software at 2–3 fps, starving the other workers; the scene's
      // own WebKit coverage is tests/e2e/scene.spec.ts.
      'tier 3 is the desktop scene; in WebKit it is covered by scene.spec.ts',
    );
    test('axe: no serious or critical violations', async ({ page }) => {
      await open(page, path);
      expect(await blockingViolations(page)).toEqual([]);
    });
    test('one h1, no skipped heading levels; the canvas is not in the tab order', async ({
      page,
    }) => {
      await open(page, path);
      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      for (const canvas of await page.locator('canvas').all()) {
        await expect(canvas).toHaveAttribute('aria-hidden', 'true');
        expect(await canvas.evaluate((el) => (el as HTMLElement).tabIndex)).toBeLessThan(0);
      }
    });
  });
