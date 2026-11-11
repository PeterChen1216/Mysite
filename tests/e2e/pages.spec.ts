// M3 pages (PLAN §4.1, §8 M3): each project's own page and the projects directory in every locale,
// reachable by deep link and by plain links without JavaScript; their head links follow X2's
// locale rules; and the 404 ("chunk not found") in the language of the address. The windows that
// show the same content over the home page: tests/e2e/windows.spec.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadSiteConfig } from '../../site.config.mjs';
import { stripComments } from '../../src/content/guards';
import { LOCALES } from '../../src/i18n/locales';
import { hreflangLinks, ogImagePath, pagePath, type SitePage } from '../../src/i18n/routing';
import { THEMES } from '../../src/prefs/model';
import { contentFor } from './locale';
import { LOCALE_PAGES, LOCALE_STATES, STAGE, V2 } from './site';

const ORIGIN = `https://${loadSiteConfig().domain}`;

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

const straight = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
/** A Markdown body's lines as text (list markers, comments and emphasis dropped). */
const bodyLines = (md: string) =>
  stripComments(md)
    .split('\n')
    .map((l) =>
      l
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^\s*[-*]\s+/, '')
        .replace(/[*_`]/g, '')
        .trim(),
    )
    .filter(Boolean);

for (const { locale, lang, state } of LOCALE_PAGES)
  test.describe(`project pages and the directory (${locale})`, () => {
    const { copy, projects } = contentFor(locale);
    const path = (page: SitePage) => pagePath(locale, page, V2);

    test('every project has its own page: one h1, its lang, everything its file says', async ({
      page,
    }) => {
      for (const p of projects) {
        const res = await page.goto(path({ kind: 'project', id: p.id }));
        expect(res?.status(), p.id).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(String(p.fm.title));
        const article = page.locator(`[data-project="${p.id}"]`);
        const text = straight(await article.innerText());
        for (const line of bodyLines(p.body)) expect(text, p.id).toContain(straight(line));
        if (p.fm.tagline) expect(text).toContain(straight(String(p.fm.tagline)));
        for (const s of (p.fm.stack as string[]) ?? []) expect(text).toContain(s);
        // An English body on a translated page is marked as English.
        if (p.bodyEnglish) await expect(article.locator('.pd__body')).toHaveAttribute('lang', 'en');
        const links = (p.fm.links ?? {}) as Record<string, unknown>;
        for (const url of [links.appstore, links.repo, links.live].filter(Boolean))
          await expect(article.locator(`a[href="${url}"]`)).toHaveCount(1);
        // The way back: the directory and home.
        await expect(
          page.getByRole('navigation', { name: copy.windows.crumbs_label }).getByRole('link'),
        ).toHaveCount(2);
      }
    });

    test('head links: its own canonical, hreflang of the same project, noindex in preview', async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'head links do not depend on the device');
      for (const pageKind of [
        { kind: 'projects' },
        { kind: 'project', id: projects[0]!.id },
      ] as SitePage[]) {
        await page.goto(path(pageKind));
        const canonical = new URL(path(pageKind), ORIGIN).href;
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
        await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
          'content',
          LOCALES[locale].og,
        );
        const robots = page.locator('meta[name="robots"]');
        if (state === 'preview') await expect(robots).toHaveAttribute('content', 'noindex');
        else await expect(robots).toHaveCount(0);
        const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
          els.map((el) => ({
            hreflang: el.getAttribute('hreflang')!,
            href: el.getAttribute('href')!,
          })),
        );
        expect(links).toEqual(hreflangLinks(locale, LOCALE_STATES, ORIGIN, V2, pageKind));
      }
    });

    test('the directory lists every project, each linking to its page', async ({ page }) => {
      await page.goto(path({ kind: 'projects' }));
      await expect(page.locator('h1')).toHaveText(copy.windows.directory_heading);
      for (const p of projects)
        await expect(
          page.getByRole('link', { name: String(p.fm.title), exact: true }),
        ).toHaveAttribute('href', path({ kind: 'project', id: p.id }));
    });

    test('from the home page: each title and `more ▸` are plain links there', async ({ page }) => {
      await page.goto(path({ kind: 'home' }));
      for (const p of projects)
        await expect(page.locator(`#project-${p.id} a[data-project-link]`)).toHaveAttribute(
          'href',
          path({ kind: 'project', id: p.id }),
        );
      await expect(page.locator('#projects .sh__more')).toHaveAttribute(
        'href',
        path({ kind: 'projects' }),
      );
    });

    test('the language row of a project page goes to the same project', async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'one run is enough');
      const id = projects[0]!.id;
      await page.goto(path({ kind: 'project', id }));
      await page.locator('body').press(',');
      const row = page
        .getByRole('dialog', { name: copy.prefs.heading })
        .getByRole('navigation', { name: copy.prefs.lang.legend });
      for (const link of await row.getByRole('link').all()) {
        const l = (await link.getAttribute('data-lang-pick')) as keyof typeof LOCALES;
        await expect(link).toHaveAttribute('href', pagePath(l, { kind: 'project', id }, V2));
      }
    });

    test('axe: a project page and the directory', async ({ page }) => {
      for (const p of [path({ kind: 'project', id: 'clock-stamp' }), path({ kind: 'projects' })]) {
        await page.goto(p);
        expect(await blockingViolations(page), p).toEqual([]);
      }
    });
  });

test.describe('share cards (Open Graph images)', () => {
  test.skip(({ isMobile }) => isMobile, 'files and head tags do not depend on the device');
  for (const { locale } of LOCALE_PAGES)
    test(`${locale}: every page names its card, 1200 × 630, drawn at build time`, async ({
      page,
      request,
    }) => {
      const { projects, copy, site } = contentFor(locale);
      const pages: SitePage[] = [
        { kind: 'home' },
        { kind: 'projects' },
        ...projects.map((p) => ({ kind: 'project' as const, id: p.id })),
      ];
      for (const kind of pages) {
        await page.goto(pagePath(locale, kind, V2));
        const url = new URL(ogImagePath(locale, kind, V2), ORIGIN).href;
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', url);
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
          'content',
          'summary_large_image',
        );
        const title = await page.title();
        await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
          'content',
          copy.og.alt.replace('{title}', title).replace('{domain}', String(site.domain)),
        );
      }
      // The files: the cards of every page, and the home page's in every theme.
      const files = [
        ...pages.map((kind) => ogImagePath(locale, kind, V2)),
        ...THEMES.filter((t) => t !== 'night').map((t) =>
          ogImagePath(locale, { kind: 'home' }, V2, t),
        ),
      ];
      for (const file of files) {
        const res = await request.get(file);
        expect(res.status(), file).toBe(200);
        expect(res.headers()['content-type']).toBe('image/png');
        const png = await res.body();
        // The PNG header: width and height at bytes 16–23.
        expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([1200, 630]);
      }
    });
  test('the 404 has no card (it is never shared)', async ({ page }) => {
    await page.goto(`${V2}nowhere`);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });
});

test.describe('without JavaScript every project is a plain link away and reads in full', () => {
  test.use({ javaScriptEnabled: false });
  for (const { locale, path } of LOCALE_PAGES)
    test(locale, async ({ page }) => {
      const { projects, copy } = contentFor(locale);
      for (const p of projects) {
        await page.goto(path);
        await page.locator(`#project-${p.id} a[data-project-link]`).click();
        await expect(page).toHaveURL(pagePath(locale, { kind: 'project', id: p.id }, V2));
        const text = straight(await page.locator('main').innerText());
        for (const line of bodyLines(p.body)) expect(text).toContain(straight(line));
      }
      await page.goto(path);
      await page.locator('#projects .sh__more').click();
      await expect(page).toHaveURL(pagePath(locale, { kind: 'projects' }, V2));
      await expect(page.locator('h1')).toHaveText(copy.windows.directory_heading);
    });
});

test.describe('404: chunk not found', () => {
  for (const { locale, lang, path } of LOCALE_PAGES)
    test(`${locale}: in the language of the address, one h1, home in that locale`, async ({
      page,
    }) => {
      const { copy } = contentFor(locale);
      const res = await page.goto(`${path}no/such/chunk/`);
      expect(res?.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      // M5: the tab's title in that language too.
      await expect(page).toHaveTitle(
        copy.not_found.page_title.replace(/\{\s*domain\s*\}/, loadSiteConfig().domain),
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      const h1 = page.locator('h1:visible');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(copy.not_found.heading);
      await expect(page.locator('.nf__lang:visible')).toContainText(`${path}no/such/chunk/`);
      const home = page.locator('.nf__home:visible');
      await expect(home).toHaveAccessibleName(
        `${copy.not_found.home} — ${copy.not_found.home_label}`,
      );
      await expect(home).toHaveAttribute('href', path);
      await expect(page.locator('.nf__projects:visible')).toHaveAttribute(
        'href',
        pagePath(locale, { kind: 'projects' }, V2),
      );
      expect(await blockingViolations(page)).toEqual([]);
    });

  test('outside the site before launch (the old site is at the root): home is the root', async ({
    page,
  }) => {
    test.skip(STAGE !== 'preview', 'after launch every address is inside the site');
    const res = await page.goto('/no-such-old-page');
    expect(res?.status()).toBe(404);
    const { copy } = contentFor('en');
    await expect(page.locator('.nf__home:visible')).toHaveAttribute('href', '/');
    await expect(page.locator('.nf__logo:visible')).toHaveAttribute('href', '/');
    expect(copy.not_found.home).toBeTruthy();
    await expect(page.locator('.nf__projects:visible')).toHaveCount(0);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('English, and its links lead into the site', async ({ page }) => {
      const res = await page.goto(`${V2}zh-hans/missing`);
      expect(res?.status()).toBe(404);
      const { copy } = contentFor('en');
      await expect(page.locator('h1:visible')).toHaveText(copy.not_found.heading);
      await expect(page.locator('.nf__home:visible')).toHaveAttribute('href', V2);
    });
  });
});
