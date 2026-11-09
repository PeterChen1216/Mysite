import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { formatRange, formatYearMonth } from '../../src/lib/format';
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

const straight = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
/** Markdown → visible text (links keep their label; list markers, comments and emphasis dropped). */
const mdText = (md: string) =>
  md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/[*_`]/g, '');
const mdBody = (file: string) => readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

async function visibleText(page: Page, selector = 'body') {
  return straight(await page.locator(selector).innerText());
}

function missing(text: string, expected: unknown[]) {
  return expected
    .filter((e): e is string | number => typeof e === 'string' || typeof e === 'number')
    .map((e) => straight(String(e)))
    .filter((e) => !text.includes(e));
}

test.describe('content/ renders completely', () => {
  test('profile, about, interests', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('h1')).toHaveText(profile.name.display);
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
        ...interests.items.map((i: { name: string }) => i.name),
      ]),
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
      expected.push(`${formatYearMonth(String(e.start))} – ${formatYearMonth(String(e.end))}`);
      if (e.gpa) expected.push(`GPA: ${e.gpa}`);
      expected.push(...((e.honors as string[]) ?? []), ...((e.coursework as string[]) ?? []));
    }
    for (const h of honors) expected.push(`${h.name}, ${h.org}, ${h.year}`, h.note);
    for (const x of experience) {
      expected.push(`${x.role} @ ${x.company}, ${x.location}`);
      expected.push(formatRange(String(x.start), String(x.end)));
      expected.push(...(x.highlights as string[]));
    }
    expect(missing(text, expected)).toEqual([]);
  });

  test('every project, scoped to its own card', async ({ page }) => {
    await page.goto(V2);
    for (const file of readdirSync('content/projects').filter((f) => f.endsWith('.md'))) {
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
          ...(fm.start ? [formatRange(String(fm.start), String(fm.end ?? 'present'))] : []),
          ...(fm.stack ?? []),
          ...body,
        ]),
        card,
      ).toEqual([]);
      const { other = [], ...named } = fm.links ?? {};
      for (const url of Object.values(named))
        await expect(page.locator(`${card} a[href="${url}"]`)).toHaveCount(1);
      for (const l of other as { label: string; url: string }[])
        await expect(page.locator(`${card} a[href="${l.url}"]`)).toHaveText(l.label);
    }
  });

  test('work and volunteer entries land in their own sections', async ({ page }) => {
    await page.goto(V2);
    for (const x of experience) {
      const section = x.kind === 'volunteer' ? '#community' : '#experience';
      await expect(page.locator(section)).toContainText(String(x.company));
    }
  });

  test('every skill group and item', async ({ page }) => {
    await page.goto(V2);
    const text = await visibleText(page, '#skills');
    for (const g of skills.groups as { name: string; items: unknown[] }[]) {
      expect(missing(text, [g.name, ...g.items]), g.name).toEqual([]);
    }
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
      await expect(section.locator(`a[href="${t.url}"]`)).toHaveText(t.name);
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
    const holder = site.footer.copyright_holder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(footer).toContainText(
      new RegExp(`© ${site.footer.copyright_start}(–\\d{4})? ${holder}\\. All rights reserved\\.`),
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

  test('hero links to the résumé', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator(`.hero a[href="${V2}resume.pdf"]`)).toHaveCount(1);
  });
});
