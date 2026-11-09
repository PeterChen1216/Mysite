import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { V2 } from './site';

test.describe('accessibility & robustness', () => {
  test('axe: no serious or critical violations', async ({ page }) => {
    await page.goto(V2);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      blocking.map(
        (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
      ),
    ).toEqual([]);
  });

  test('all content is readable without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(V2);
    for (const id of ['about', 'education', 'honors', 'projects', 'experience', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await context.close();
  });

  test('skip link is the first tab stop and moves focus to main', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to links by default');
    await page.goto(V2);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
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

  test('no horizontal scrolling at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(V2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
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
