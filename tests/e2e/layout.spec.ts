import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parse } from 'yaml';
import { downloadName, resumeInfo } from '../../src/lib/resume';
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

  // M4: this version's own address, and the name a download is saved under (src/lib/resume.ts).
  const info = resumeInfo();
  for (const path of [
    `${V2}resume.pdf`,
    `${V2}${info.path}`,
    '/work/Resume.pdf',
    '/legacy/work/Resume.pdf',
  ]) {
    test(`${path} serves content/resume/Resume.pdf`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/pdf');
      expect(Buffer.compare(await res.body(), RESUME)).toBe(0);
    });
  }

  test('the download buttons save the résumé as <Name>-Resume-<date>.pdf', async ({ page }) => {
    const profile = parse(readFileSync('content/profile.yaml', 'utf8'));
    const name = downloadName(profile.name.display, info.date);
    expect(name).toMatch(/-Resume-\d{4}-\d{2}-\d{2}\.pdf$/);
    await page.goto(V2);
    const buttons = page.locator(`a[href="${V2}resume.pdf"][download]`);
    await expect(buttons).toHaveCount(2); // the hero and Contact; the nav's opens it in a tab
    for (const button of await buttons.all())
      await expect(button).toHaveAttribute('download', name);
  });
});
