import { expect, test, type Page } from '@playwright/test';
import { aboutCards, gridAreas, logRange } from '../../src/lib/derive';
import { formatRange, formatYearMonth } from '../../src/lib/format';
import { stripComments } from '../../src/content/guards';
import { escapeRe } from './copy';
import { contentFor } from './locale';
import { hasWordBullet } from './now';
import { LOCALE_PAGES, V2 } from './site';

/**
 * Data-driven render check: every owner-provided string in content/ must be visible on the page —
 * on the page of every locale (PLAN-EXPERIENCE §5.5, §9.1), as that page shows it: the
 * translation, or the English fallback. Expected values are read from content/ at test time
 * (tests/e2e/locale.ts), so editing content never needs a test edit.
 */
const straight = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
/** Markdown → visible text (links keep their label; list markers, comments and emphasis dropped). */
const mdText = (md: string) =>
  stripComments(md)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/[*_`]/g, '');

async function visibleText(page: Page, selector = 'body') {
  return straight(await page.locator(selector).innerText());
}

/** Expected strings not found in the text (case-insensitive: the design upper-cases some labels). */
function missing(text: string, expected: unknown[]) {
  const haystack = text.toLowerCase();
  return expected
    .filter((e): e is string | number => typeof e === 'string' || typeof e === 'number')
    .map((e) => straight(String(e)))
    .filter((e) => !haystack.includes(e.toLowerCase()));
}

for (const { locale, path } of LOCALE_PAGES)
  test.describe(`content/ renders completely (${locale})`, () => {
    const {
      site,
      profile,
      education,
      experience,
      honors,
      interests,
      aviation,
      skills,
      copy,
      projects,
      about,
      now,
    } = contentFor(locale);
    const PLATFORM: Record<string, string> = copy.labels.platform;
    const STATUS: Record<string, string> = copy.labels.status;
    const sep = copy.labels.list_separator;
    /** A project's date range as its card shows it (labels.present for ongoing work). */
    const projectRange = (start: unknown, end: unknown) =>
      formatRange(String(start), String(end), copy.labels.present, copy.labels);
    type Rec = Record<string, unknown>;

    test('profile, about, interests', async ({ page }) => {
      await page.goto(path);
      const name = profile.name as { display: string; full: string };
      await expect(page.locator('h1')).toContainText(name.display);
      const text = await visibleText(page);
      const emails = profile.emails as Array<{ address: string; public?: boolean }>;
      expect(
        missing(text, [
          name.full,
          profile.tagline,
          profile.location,
          profile.status,
          ...emails.filter((e) => e.public).map((e) => e.address),
          ...(profile.socials as Array<{ label: string }>).map((s) => s.label),
        ]),
      ).toEqual([]);
      // Every interest is on an About card (the ticker repeats some, so look in #about only).
      expect(
        missing(
          await visibleText(page, '#about'),
          interests.items.map((i) => i.name as string),
        ),
      ).toEqual([]);
      for (const paragraph of mdText(about.body).split(/\n{2,}/)) {
        if (paragraph.trim()) expect(text).toContain(straight(paragraph));
      }
    });

    test('education, honors, experience', async ({ page }) => {
      await page.goto(path);
      const text = await visibleText(page);
      const expected: unknown[] = [];
      for (const e of education as Rec[]) {
        expected.push(e.school, e.degree, e.track, e.minor, e.department);
        expected.push(
          `${formatYearMonth(String(e.start), copy.labels)} – ${formatYearMonth(String(e.end), copy.labels)}`,
        );
        if (e.gpa) expected.push(`${e.gpa_label ?? copy.labels.gpa}: ${e.gpa}`);
        expected.push(...((e.honors as string[]) ?? []), ...((e.coursework as string[]) ?? []));
      }
      for (const h of honors as Rec[]) expected.push(`${h.name}, ${h.org}, ${h.year}`, h.note);
      // Experience is a `git log` (M1): each commit reads role, then `company · location`, then
      // its dates as derive.logRange prints them (`2024-07 → 2024-09`; `present` → labels.now).
      for (const x of experience as Rec[]) {
        expected.push(
          `${x.role} ${x.company} · ${x.location} ${logRange(String(x.start), String(x.end), copy.labels.now)}`,
        );
        expected.push(...(x.highlights as string[]));
      }
      expect(missing(text, expected)).toEqual([]);
    });

    test('every project, scoped to its own card', async ({ page }) => {
      await page.goto(path);
      for (const { id, fm, body: md } of projects) {
        const card = `#project-${id}`;
        const text = await visibleText(page, card);
        const body = mdText(md)
          .split('\n')
          .filter((l) => l.trim());
        expect(
          missing(text, [
            fm.title,
            fm.tagline,
            fm.year,
            fm.role,
            fm.location,
            ...(fm.start && fm.end ? [projectRange(fm.start, fm.end)] : []),
            ...((fm.stack as string[]) ?? []),
            ...body,
          ]),
          card,
        ).toEqual([]);
        // The year · platform · status line and the role · location · dates line, exactly.
        const platforms = (fm.platform as string[]).map((p) => PLATFORM[p] ?? p).join(sep);
        await expect(page.locator(`${card} .meta`).first()).toHaveText(
          `${fm.year} · ${platforms} · ${STATUS[fm.status as string]}`,
        );
        if (fm.role || fm.location || (fm.start && fm.end)) {
          const line = [fm.role, fm.location, fm.start && fm.end && projectRange(fm.start, fm.end)]
            .filter(Boolean)
            .join(' · ');
          await expect(page.locator(`${card} .meta`, { hasText: line })).toHaveCount(1);
        }
        const stack = (fm.stack as string[] | undefined) ?? [];
        if (stack.length)
          await expect(
            page.locator(`${card} .meta`, { hasText: copy.projects.stack_label }),
          ).toHaveText(`${copy.projects.stack_label} ${stack.join(sep)}`);
        const { other = [], ...named } = (fm.links ?? {}) as Rec;
        for (const url of Object.values(named))
          await expect(page.locator(`${card} a[href="${url}"]`)).toHaveCount(1);
        for (const l of other as { label: string; url: string }[])
          await expect(page.locator(`${card} a[href="${l.url}"]`)).toHaveAccessibleName(
            new RegExp(`^${escapeRe(l.label)}(\\s|$)`),
          );
      }
    });

    test('work and volunteer entries land in their own sections', async ({ page }) => {
      await page.goto(path);
      for (const x of experience as Rec[]) {
        const [mine, other] =
          x.kind === 'volunteer' ? ['#community', '#experience'] : ['#experience', '#community'];
        await expect(page.locator(mine)).toContainText(String(x.company));
        if ((await page.locator(other).count()) > 0)
          await expect(page.locator(other)).not.toContainText(String(x.company));
      }
    });

    test('every skill group and item', async ({ page }) => {
      await page.goto(path);
      const groups = skills.groups as { name: string; items: unknown[]; basic?: unknown[] }[];
      await expect(page.locator('#skills dt')).toHaveText(groups.map((g) => g.name));
      await expect(page.locator('#skills dd')).toHaveText(
        groups.map(
          (g) =>
            g.items.map(String).join(sep) +
            (g.basic?.length ? `; ${copy.about.skills_basic} ${g.basic.join(sep)}` : ''),
        ),
      );
    });

    test('AvGeek panels show only what aviation.yaml has', async ({ page }) => {
      await page.goto(path);
      const list = (k: string) => (aviation[k] ?? []) as Rec[];
      const total = ['watching', 'seat_rules', 'favorite_cabins', 'news', 'fare_examples', 'tools']
        .map((k) => list(k).length)
        .reduce((a: number, b: number) => a + b, 0);
      const section = page.locator('#avgeek');
      if (total === 0) {
        await expect(section).toHaveCount(0);
        return;
      }
      for (const t of list('tools'))
        await expect(section.locator(`a[href="${t.url}"]`)).toHaveAccessibleName(
          new RegExp(`^${escapeRe(String(t.name))}(\\s|$)`),
        );
      for (const r of (aviation.seat_rules ?? []) as string[])
        await expect(section).toContainText(r);
    });

    test('head metadata comes from site.yaml', async ({ page }) => {
      await page.goto(path);
      const meta = site.meta as { title: string; description: string; keywords?: string[] };
      await expect(page).toHaveTitle(meta.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        meta.description,
      );
      if (meta.keywords?.length)
        await expect(page.locator('meta[name="keywords"]')).toHaveAttribute(
          'content',
          meta.keywords.join(', '),
        );
    });

    test('footer: copyright line, update note, automatic date and version', async ({ page }) => {
      await page.goto(path);
      const footer = page.locator('footer');
      const foot = site.footer as Rec;
      const holder = escapeRe(String(foot.copyright_holder));
      const rights = escapeRe(copy.footer.rights);
      await expect(footer).toContainText(
        new RegExp(`© ${foot.copyright_start}(–\\d{4})? ${holder}\\. ${rights}`),
      );
      if (foot.update_note) await expect(footer).toContainText(String(foot.update_note));
      await expect(footer.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
      await expect(footer).toContainText(/v\d+\.\d+\.\d+\+\d{8}\.\w+/);
    });

    test('non-public emails appear nowhere in the HTML (DECISIONS Q6)', async ({ page }) => {
      await page.goto(path);
      const html = (await page.content()).toLowerCase();
      for (const e of (profile.emails as Array<{ address: string; public?: boolean }>).filter(
        (x) => !x.public,
      ))
        expect(html).not.toContain(e.address.toLowerCase());
    });

    test('now.md reaches the ticker: [NOW] items for its bullets, none when it is empty', async ({
      page,
    }) => {
      // Wiring only. How Markdown becomes plain text (links, code, entities…) is unit-tested in
      // tests/unit/derive.test.ts against Astro's real rendering of a now.md that uses it all.
      await page.goto(path);
      const items = page
        .locator('.ticker__track')
        .first()
        .locator('.ticker__item', { hasText: `[${copy.ticker.tags.now}]` });
      const body = now;
      if (!body.trim()) {
        await expect(items).toHaveCount(0);
        return;
      }
      if (hasWordBullet(body)) expect(await items.count()).toBeGreaterThan(0);
      for (const text of await items.allInnerTexts())
        expect(text.replace(`[${copy.ticker.tags.now}]`, '').trim()).not.toBe('');
    });

    test('the About grid holds exactly the cards content fills', async ({ page, isMobile }) => {
      test.skip(isMobile, 'desktop projects resize the viewport themselves');
      const cards = aboutCards({
        interests: interests.items as Array<{ name: string; tag?: string; icon?: string }>,
        aviation,
        building: projects.some((p) => p.fm.end === 'present'),
      });
      // The custom property each layout reads, and its grid on screen (quotes normalised).
      const areas = (rows: string[]) => gridAreas(rows).replace(/'/g, '"');
      for (const [width, rows] of [
        [1440, cards.areas.lg],
        [1024, cards.areas.md],
        [390, cards.areas.sm],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const grid = page.locator('.inv');
        expect(
          await grid.evaluate((el) => getComputedStyle(el).gridTemplateAreas),
          `${width}px`,
        ).toBe(areas(rows));
      }
      await expect(page.locator('.inv__stack--one')).toHaveCount(cards.stackOne ? 1 : 0);
      await expect(page.locator('.about-card--now')).toHaveCount(cards.stackOne ? 0 : 1);
      await expect(page.locator('.about-card--off')).toHaveCount(cards.offClock.length ? 1 : 0);
      await expect(page.locator('.about-card--av')).toHaveCount(cards.avgeek ? 1 : 0);
    });

    test('hero links to the résumé', async ({ page }) => {
      await page.goto(path);
      // One résumé for every language (PLAN-EXPERIENCE §5.3: English only unless the owner adds one).
      await expect(page.locator(`.hero a[href="${V2}resume.pdf"]`)).toHaveCount(1);
    });
  });
