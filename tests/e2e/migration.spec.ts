import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { STAGE, V2 } from './site';

/**
 * PLAN M0: "现有 index.html 内容 100% 迁入". Every fact on the legacy page (legacy/index.html)
 * must be visible on the v2 page. Each entry is copied from the legacy HTML.
 */
const LEGACY_FACTS = [
  'Peter Chen',
  'Zhicheng (Peter) Chen',
  "Informatics: Data Science, UW 27'",
  'zchen75@uw.edu',
  // About
  'I am a Junior in University of Washington',
  'Information School Undergraduate Informatics major, by Data Science track',
  'Plan to graduate by the June of 2027',
  'I am a huge Tech fans, with unlimited passion on exploring the practical use of latest technology',
  "I'm always looking for related colaboration",
  'If you are interested to chat with me, feel free to drop me an email',
  // Interests
  'Generative AI with applications',
  'Aviation, everything about flight routes, seats, crafts, mileage plans',
  'Vibe Coder, about to release my first app named Clock Stamp on iOS AppStore, will be available in around April/May.',
  'Table-Tennis',
  'Choir',
  // Education
  'University of Washington, Seattle',
  'B.S. in Informatics',
  'Sep 2023 – Jun 2027',
  'GPA: 3.81/4.0',
  "Annual Dean's List (2024-2025)",
  // Honors
  "Annual Dean's List, University of Washington, 2024-2025",
  // Projects ("ShowCase, My Projects")
  'Time Stamp',
  '2026',
  // Experience
  'Operation Intern @ HashKey Global, Shanghai',
  'Jul 2024 – Sep 2024',
  // Footer
  'Peter Chen. All rights reserved.',
  'Expected to updated by each 2 weeks.',
];

const LEGACY_LINKS = [
  'https://github.com/PeterChen1216',
  'https://www.linkedin.com/in/peterchen1216/',
  'mailto:zchen75@uw.edu',
  'https://www.washington.edu/',
  'https://ischool.uw.edu/',
  'https://global.hashkey.com/en-US/',
];

test.describe('content migration', () => {
  test('every legacy fact appears on the v2 page', async ({ page }) => {
    await page.goto(V2);
    // Markdown renders typographic quotes (’ “ ”); compare on straight quotes.
    const text = (await page.locator('body').innerText())
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\s+/g, ' ');
    const missing = LEGACY_FACTS.filter((fact) => !text.includes(fact));
    expect(missing, `missing on ${V2}`).toEqual([]);
  });

  test('every legacy link target is present', async ({ page }) => {
    await page.goto(V2);
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(LEGACY_LINKS.filter((l) => !hrefs.includes(l))).toEqual([]);
  });

  test('the legacy list above really is in legacy/index.html', () => {
    // Guards the guard: if someone edits LEGACY_FACTS, they must still come from the old page.
    const legacy = readFileSync('legacy/index.html', 'utf8')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    const derived = new Set([
      'Sep 2023 – Jun 2027', // "Sep. 2023 - Jun. 2027" reformatted
      'Jul 2024 – Sep 2024', // "July. 2024 - Sept. 2024" reformatted
      "Annual Dean's List, University of Washington, 2024-2025", // trailing "." dropped
      'Peter Chen. All rights reserved.', // years now automatic
      'Operation Intern @ HashKey Global, Shanghai',
      'Information School Undergraduate Informatics major, by Data Science track', // empty link fixed
      'If you are interested to chat with me, feel free to drop me an email',
    ]);
    const notInLegacy = LEGACY_FACTS.filter((f) => !derived.has(f) && !legacy.includes(f));
    expect(notInLegacy).toEqual([]);
  });

  test('secondary email stays hidden (DECISIONS Q6)', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('body')).not.toContainText('peter_chen1216@163.com');
  });

  test('résumé PDF is served', async ({ request }) => {
    const res = await request.get(`${V2}resume.pdf`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('footer shows an automatic last-updated date and version', async ({ page }) => {
    await page.goto(V2);
    const footer = page.locator('footer');
    await expect(footer.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(footer).toContainText(/v\d+\.\d+\.\d+\+\d{8}\.\w+/);
  });
});

test.describe('legacy site', () => {
  test('is kept at /legacy/', async ({ page }) => {
    await page.goto('/legacy/');
    await expect(page).toHaveTitle('Zhicheng (Peter) Chen');
    await expect(page.locator('#my-title')).toContainText("Informatics: Data Science, UW 27'");
  });

  test('stays at / until launch, then v2 takes over', async ({ page }) => {
    await page.goto('/');
    if (STAGE === 'preview') {
      await expect(page.locator('#my-title')).toContainText("Informatics: Data Science, UW 27'");
    } else {
      await expect(page.locator('h1')).toHaveText('Peter Chen');
    }
  });

  test('old résumé URL keeps working', async ({ request }) => {
    const res = await request.get('/work/Resume.pdf');
    expect(res.status()).toBe(200);
  });
});
