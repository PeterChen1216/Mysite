import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parse } from 'yaml';
import { loadSiteConfig } from '../../site.config.mjs';
import { liveLocales, pagePath, type SitePage } from '../../src/i18n/routing';
import { downloadName, resumeInfo } from '../../src/lib/resume';
import { schemaProblems } from '../../src/lib/schema-org';
import { personJsonLd } from '../../src/lib/seo';
import { LOCALE_PAGES, LOCALE_STATES, STAGE, V2 } from './site';

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
    // The hero and Contact (the nav's opens it in a tab); X4: a phone has its own hero button and
    // Contact key in their place — two shown at any width, every one saving under the same name.
    await expect(page.locator(`a[href="${V2}resume.pdf"][download]:visible`)).toHaveCount(2);
    const buttons = page.locator(`a[href="${V2}resume.pdf"][download]`);
    await expect(buttons).toHaveCount(4);
    for (const button of await buttons.all())
      await expect(button).toHaveAttribute('download', name);
  });
});

// M5 (PLAN §11): what search engines are told, in the stage being tested — CI runs this suite on
// the preview build (main job) and on the launch build (launch job). src/lib/seo.ts.
test.describe('search engines: robots.txt, the sitemap and the Person JSON-LD', () => {
  const origin = `https://${loadSiteConfig().domain}`;
  const projectIds = readdirSync('content/projects')
    .filter((f) => /^[a-z0-9-]+\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''));

  test('robots.txt and the sitemap say what the stage is', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    if (STAGE === 'preview') {
      // The address is still the old site; v2 is closed to robots and nothing advertises it.
      expect(robots).toBe(`User-agent: *\nDisallow: ${V2}\n`);
      expect((await request.get('/sitemap.xml')).status()).toBe(404);
      expect((await request.get(`${V2}sitemap.xml`)).status()).toBe(404);
      return;
    }
    expect(robots).toBe(`User-agent: *\nDisallow: /legacy/\n\nSitemap: ${origin}/sitemap.xml\n`);
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
    );
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    // Exactly the live locales' pages — each home, directory and project page — and no preview
    // locale's (they are noindex, as they are out of hreflang).
    const pages: SitePage[] = [
      { kind: 'home' },
      { kind: 'projects' },
      ...projectIds.map((id) => ({ kind: 'project' as const, id })),
    ];
    const expected = liveLocales(LOCALE_STATES).flatMap((l) =>
      pages.map((p) => new URL(pagePath(l, p, '/'), origin).href),
    );
    expect([...locs].sort()).toEqual([...expected].sort());
    // Each one is served there, says it is that page, and may be indexed.
    for (const loc of locs) {
      const page = await request.get(new URL(loc).pathname);
      expect(page.status(), loc).toBe(200);
      const html = await page.text();
      expect(html, loc).toContain(`<link rel="canonical" href="${loc}">`);
      expect(html, loc).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
    }
  });

  test('after launch the preview addresses lead to the same pages at the root', async ({
    page,
    request,
  }) => {
    test.skip(STAGE === 'preview', 'before launch /v2/ is the preview itself');
    for (const [from, to] of [
      ['/v2/', '/'],
      ['/v2/projects/', '/projects/'],
      [`/v2/projects/${projectIds[0]}/`, `/projects/${projectIds[0]}/`],
      ['/v2/zh-hant/', '/zh-hant/'],
    ]) {
      const res = await request.get(from!);
      expect(res.status(), from).toBe(200);
      const html = await res.text();
      expect(html, from).toContain('<meta name="robots" content="noindex">');
      expect(html, from).toContain(`<link rel="canonical" href="${origin}${to}">`);
      await page.goto(from!);
      await page.waitForURL((u) => u.pathname === to);
      await expect(page.locator('main#main')).toBeVisible();
    }
    const pdf = await request.get('/v2/resume.pdf');
    expect(pdf.status()).toBe(200);
    expect(Buffer.compare(await pdf.body(), RESUME)).toBe(0);
  });

  test('each home page carries a valid Person, from content/ only; no other page does', async ({
    page,
  }) => {
    const profile = parse(readFileSync('content/profile.yaml', 'utf8'));
    const education = parse(readFileSync('content/education.yaml', 'utf8')) as Array<{
      school: string;
      url?: string;
      expected?: boolean;
    }>;
    const ld = () =>
      page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? 'null') as unknown));
    for (const { path } of LOCALE_PAGES) {
      await page.goto(path);
      const all = await ld();
      expect(all, path).toHaveLength(1);
      const person = all[0] as Record<string, unknown>;
      expect(schemaProblems(person), path).toEqual([]);
      expect(person).toEqual(
        personJsonLd({
          name: profile.name.display,
          fullName: profile.name.full,
          url: new URL(V2, origin).href,
          sameAs: profile.socials.map((s: { url: string }) => s.url),
          schools: education.map((e) => ({ name: e.school, url: e.url, current: !!e.expected })),
        }),
      );
    }
    for (const path of [`${V2}projects/`, `${V2}projects/${projectIds[0]}/`, `${V2}nowhere/`]) {
      await page.goto(path);
      expect(await ld(), path).toEqual([]);
    }
  });
});
