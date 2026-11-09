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

/**
 * One-off M0 acceptance check (PLAN M0 "现有 index.html 内容 100% 迁入"): every fact on the old page,
 * verbatim. Opt-in because the owner is expected to edit this wording afterwards:
 *   CHECK_LEGACY_MIGRATION=1 pnpm test:e2e --project=chromium migration
 */
test.describe('legacy → v2 migration (M0 acceptance, opt-in)', () => {
  test.skip(!process.env.CHECK_LEGACY_MIGRATION, 'set CHECK_LEGACY_MIGRATION=1 to run');

  const LEGACY_FACTS = [
    'Peter Chen',
    'Zhicheng (Peter) Chen',
    "Informatics: Data Science, UW 27'",
    'zchen75@uw.edu',
    'I am a Junior in University of Washington',
    'Information School Undergraduate Informatics major, by Data Science track',
    'Plan to graduate by the June of 2027',
    'I am a huge Tech fans, with unlimited passion on exploring the practical use of latest technology',
    "I'm always looking for related colaboration",
    'If you are interested to chat with me, feel free to drop me an email',
    'Generative AI with applications',
    'Aviation, everything about flight routes, seats, crafts, mileage plans',
    'Vibe Coder, about to release my first app named Clock Stamp on iOS AppStore, will be available in around April/May.',
    'Table-Tennis',
    'Choir',
    'University of Washington, Seattle',
    'B.S. in Informatics',
    'Sep 2023 – Jun 2027',
    'GPA: 3.81/4.0',
    "Annual Dean's List (2024-2025)",
    "Annual Dean's List, University of Washington, 2024-2025",
    'Operation Intern @ HashKey Global, Shanghai',
    'Jul 2024 – Sep 2024',
    'Expected to updated by each 2 weeks.',
  ];
  /** Facts whose wording was mechanically reformatted, not taken verbatim from the old HTML. */
  const REFORMATTED = new Set([
    'Sep 2023 – Jun 2027', // "Sep. 2023 - Jun. 2027"
    'Jul 2024 – Sep 2024', // "July. 2024 - Sept. 2024"
    "Annual Dean's List, University of Washington, 2024-2025", // trailing "." dropped
    'Operation Intern @ HashKey Global, Shanghai', // markup split across elements
    'Information School Undergraduate Informatics major, by Data Science track', // empty <a> fixed
    'If you are interested to chat with me, feel free to drop me an email',
  ]);
  const LEGACY_LINKS = [
    'https://github.com/PeterChen1216',
    'https://www.linkedin.com/in/peterchen1216/',
    'mailto:zchen75@uw.edu',
    'https://www.washington.edu/',
    'https://ischool.uw.edu/',
    'https://global.hashkey.com/en-US/',
    `${V2}resume.pdf`, // was work/Resume.pdf
  ];

  test('the fact list really comes from legacy/index.html', () => {
    const legacy = readFileSync('legacy/index.html', 'utf8')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    expect(LEGACY_FACTS.filter((f) => !REFORMATTED.has(f) && !legacy.includes(f))).toEqual([]);
  });

  test('every legacy fact and link is on the v2 page', async ({ page }) => {
    await page.goto(V2);
    const text = (await page.locator('body').innerText())
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ');
    expect(LEGACY_FACTS.filter((f) => !text.includes(f))).toEqual([]);
    await expect(page.locator('#project-time-stamp')).toContainText('2026');
    await expect(page.locator('#project-time-stamp')).toContainText(
      'Links will be update once publish in AppStore',
    );
    await expect(page.locator('footer')).toContainText(
      /© 2025(–\d{4})? Peter Chen\. All rights reserved\./,
    );
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(LEGACY_LINKS.filter((l) => !hrefs.includes(l))).toEqual([]);
    await expect(page).toHaveTitle('Zhicheng (Peter) Chen');
  });
});
