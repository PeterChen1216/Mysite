import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { STAGE, V2 } from './site';

const RESUME = readFileSync('content/resume/Resume.pdf');

test.describe('Pages artifact layout', () => {
  test('legacy site is kept at /legacy/', async ({ page }) => {
    await page.goto('/legacy/');
    await expect(page).toHaveTitle('Zhicheng (Peter) Chen');
    await expect(page.locator('#my-title')).toContainText("Informatics: Data Science, UW 27'");
  });

  test('legacy stays at / until launch, then v2 takes over', async ({ page }) => {
    await page.goto('/');
    if (STAGE === 'preview') {
      await expect(page.locator('#my-title')).toContainText("Informatics: Data Science, UW 27'");
    } else {
      await expect(page.locator('main#main')).toBeVisible();
    }
  });

  for (const path of [`${V2}resume.pdf`, '/work/Resume.pdf', '/legacy/work/Resume.pdf']) {
    test(`${path} serves content/resume/Resume.pdf`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/pdf');
      expect(Buffer.compare(await res.body(), RESUME)).toBe(0);
    });
  }
});
