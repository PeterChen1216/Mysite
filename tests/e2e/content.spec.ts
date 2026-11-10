import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { aboutCards, gridAreas, logRange } from '../../src/lib/derive';
import { formatRange, formatYearMonth } from '../../src/lib/format';
import { stripComments } from '../../src/content/guards';
import { copy, escapeRe } from './copy';
import { hasWordBullet } from './now';
import { V2 } from './site';

/**
 * Data-driven render check: every owner-provided string in content/ must be visible on the page.
 * Expected values are read from content/ at test time, so editing content never needs a test edit.
 */
const yaml = (name: string) => parse(readFileSync(`content/${name}`, 'utf8'));
const site = yaml('site.yaml');
const profile = yaml('profile.yaml');
const education: Record<string, unknown>[] = yaml('education.yaml');
const experience: Record<string, unknown>[] = yaml('experience.yaml');
const honors: Record<string, unknown>[] = yaml('honors.yaml');
const interests = yaml('interests.yaml');
const aviation = yaml('aviation.yaml');
const skills = yaml('skills.yaml');

const PLATFORM: Record<string, string> = copy.labels.platform;
const STATUS: Record<string, string> = copy.labels.status;
/** A project's date range as its card shows it (copy.yaml labels.present for ongoing work). */
const projectRange = (start: unknown, end: unknown) =>
  formatRange(String(start), String(end), copy.labels.present, copy.labels);

const straight = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
/** Markdown → visible text (links keep their label; list markers, comments and emphasis dropped). */
const mdText = (md: string) =>
  stripComments(md)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/[*_`]/g, '');
const mdBody = (file: string) => readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

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

test.describe('content/ renders completely', () => {
  test('profile, about, interests', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('h1')).toContainText(profile.name.display);
    const text = await visibleText(page);
    const publicEmails = profile.emails.filter((e: { public?: boolean }) => e.public);
    expect(
      missing(text, [
        profile.name.full,
        profile.tagline,
        profile.location,
        profile.status,
        ...publicEmails.map((e: { address: string }) => e.address),
        ...profile.socials.map((s: { label: string }) => s.label),
      ]),
    ).toEqual([]);
    // Every interest is on an About card (the ticker repeats some, so look in #about only).
    expect(
      missing(
        await visibleText(page, '#about'),
        interests.items.map((i: { name: string }) => i.name),
      ),
    ).toEqual([]);
    for (const paragraph of mdText(readFileSync('content/about.md', 'utf8')).split(/\n{2,}/)) {
      if (paragraph.trim()) expect(text).toContain(straight(paragraph));
    }
  });

  test('education, honors, experience', async ({ page }) => {
    await page.goto(V2);
    const text = await visibleText(page);
    const expected: unknown[] = [];
    for (const e of education) {
      expected.push(e.school, e.degree, e.track, e.minor, e.department);
      expected.push(
        `${formatYearMonth(String(e.start), copy.labels)} – ${formatYearMonth(String(e.end), copy.labels)}`,
      );
      if (e.gpa) expected.push(`${e.gpa_label ?? copy.labels.gpa}: ${e.gpa}`);
      expected.push(...((e.honors as string[]) ?? []), ...((e.coursework as string[]) ?? []));
    }
    for (const h of honors) expected.push(`${h.name}, ${h.org}, ${h.year}`, h.note);
    // Experience is a `git log` (M1): each commit reads role, then `company · location`, then
    // its dates as derive.logRange prints them (`2024-07 → 2024-09`; `present` → labels.now).
    for (const x of experience) {
      expected.push(
        `${x.role} ${x.company} · ${x.location} ${logRange(String(x.start), String(x.end), copy.labels.now)}`,
      );
      expected.push(...(x.highlights as string[]));
    }
    expect(missing(text, expected)).toEqual([]);
  });

  test('every project, scoped to its own card', async ({ page }) => {
    await page.goto(V2);
    // Project files, not their translations (projects/<id>.zh-hans.md).
    for (const file of readdirSync('content/projects').filter(
      (f) => f.endsWith('.md') && !/\.zh-han[st]\.md$/.test(f),
    )) {
      const id = file.replace(/\.md$/, '');
      const raw = readFileSync(`content/projects/${file}`, 'utf8');
      const fm = parse(/^---\n([\s\S]*?)\n---/.exec(raw)![1]!);
      const card = `#project-${id}`;
      const text = await visibleText(page, card);
      const body = mdText(mdBody(`content/projects/${file}`))
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
          ...(fm.stack ?? []),
          ...body,
        ]),
        card,
      ).toEqual([]);
      // The year · platform · status line and the role · location · dates line, exactly.
      const platforms = (fm.platform as string[]).map((p) => PLATFORM[p] ?? p).join(', ');
      await expect(page.locator(`${card} .meta`).first()).toHaveText(
        `${fm.year} · ${platforms} · ${STATUS[fm.status as string]}`,
      );
      if (fm.role || fm.location || (fm.start && fm.end)) {
        const line = [fm.role, fm.location, fm.start && fm.end && projectRange(fm.start, fm.end)]
          .filter(Boolean)
          .join(' · ');
        await expect(page.locator(`${card} .meta`, { hasText: line })).toHaveCount(1);
      }
      if (fm.stack?.length)
        await expect(
          page.locator(`${card} .meta`, { hasText: copy.projects.stack_label }),
        ).toHaveText(`${copy.projects.stack_label} ${fm.stack.join(', ')}`);
      const { other = [], ...named } = fm.links ?? {};
      for (const url of Object.values(named))
        await expect(page.locator(`${card} a[href="${url}"]`)).toHaveCount(1);
      for (const l of other as { label: string; url: string }[])
        await expect(page.locator(`${card} a[href="${l.url}"]`)).toHaveAccessibleName(
          new RegExp(`^${escapeRe(l.label)}(\\s|$)`),
        );
    }
  });

  test('work and volunteer entries land in their own sections', async ({ page }) => {
    await page.goto(V2);
    for (const x of experience) {
      const [mine, other] =
        x.kind === 'volunteer' ? ['#community', '#experience'] : ['#experience', '#community'];
      await expect(page.locator(mine)).toContainText(String(x.company));
      if ((await page.locator(other).count()) > 0)
        await expect(page.locator(other)).not.toContainText(String(x.company));
    }
  });

  test('every skill group and item', async ({ page }) => {
    await page.goto(V2);
    const groups = skills.groups as { name: string; items: unknown[]; basic?: unknown[] }[];
    await expect(page.locator('#skills dt')).toHaveText(groups.map((g) => g.name));
    await expect(page.locator('#skills dd')).toHaveText(
      groups.map(
        (g) =>
          g.items.map(String).join(', ') +
          (g.basic?.length ? `; ${copy.about.skills_basic} ${g.basic.join(', ')}` : ''),
      ),
    );
  });

  test('AvGeek panels show only what aviation.yaml has', async ({ page }) => {
    await page.goto(V2);
    const total = ['watching', 'seat_rules', 'favorite_cabins', 'news', 'fare_examples', 'tools']
      .map((k) => (aviation[k] ?? []).length)
      .reduce((a: number, b: number) => a + b, 0);
    const section = page.locator('#avgeek');
    if (total === 0) {
      await expect(section).toHaveCount(0);
      return;
    }
    for (const t of aviation.tools ?? [])
      await expect(section.locator(`a[href="${t.url}"]`)).toHaveAccessibleName(
        new RegExp(`^${escapeRe(t.name)}(\\s|$)`),
      );
    for (const r of aviation.seat_rules ?? []) await expect(section).toContainText(r);
  });

  test('head metadata comes from site.yaml', async ({ page }) => {
    await page.goto(V2);
    await expect(page).toHaveTitle(site.meta.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      site.meta.description,
    );
    if (site.meta.keywords?.length)
      await expect(page.locator('meta[name="keywords"]')).toHaveAttribute(
        'content',
        site.meta.keywords.join(', '),
      );
  });

  test('footer: copyright line, update note, automatic date and version', async ({ page }) => {
    await page.goto(V2);
    const footer = page.locator('footer');
    const holder = escapeRe(site.footer.copyright_holder);
    const rights = escapeRe(copy.footer.rights);
    await expect(footer).toContainText(
      new RegExp(`© ${site.footer.copyright_start}(–\\d{4})? ${holder}\\. ${rights}`),
    );
    if (site.footer.update_note) await expect(footer).toContainText(site.footer.update_note);
    await expect(footer.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(footer).toContainText(/v\d+\.\d+\.\d+\+\d{8}\.\w+/);
  });

  test('non-public emails appear nowhere in the HTML (DECISIONS Q6)', async ({ page }) => {
    await page.goto(V2);
    const html = (await page.content()).toLowerCase();
    for (const e of profile.emails.filter((x: { public?: boolean }) => !x.public))
      expect(html).not.toContain(e.address.toLowerCase());
  });

  test('now.md reaches the ticker: [NOW] items for its bullets, none when it is empty', async ({
    page,
  }) => {
    // Wiring only. How Markdown becomes plain text (links, code, entities…) is unit-tested in
    // tests/unit/derive.test.ts against Astro's real rendering of a now.md that uses it all.
    await page.goto(V2);
    const items = page
      .locator('.ticker__track')
      .first()
      .locator('.ticker__item', { hasText: `[${copy.ticker.tags.now}]` });
    const body = stripComments(readFileSync('content/now.md', 'utf8'));
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
    const projects = readdirSync('content/projects')
      .filter((f) => f.endsWith('.md') && !/\.zh-han[st]\.md$/.test(f))
      .map((f) =>
        parse(/^---\n([\s\S]*?)\n---/.exec(readFileSync(`content/projects/${f}`, 'utf8'))![1]!),
      );
    const cards = aboutCards({
      interests: interests.items,
      aviation,
      building: projects.some((p) => p.end === 'present'),
    });
    // The custom property each layout reads, and its grid on screen (quotes normalised).
    const areas = (rows: string[]) => gridAreas(rows).replace(/'/g, '"');
    for (const [width, rows] of [
      [1440, cards.areas.lg],
      [1024, cards.areas.md],
      [390, cards.areas.sm],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(V2);
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
    await page.goto(V2);
    await expect(page.locator(`.hero a[href="${V2}resume.pdf"]`)).toHaveCount(1);
  });
});
