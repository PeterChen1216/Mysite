// content/ as the page of each locale shows it, for the suites that run per locale
// (PLAN-EXPERIENCE §9.1: all three locales in Night). Built with the site's own rules
// (src/i18n/translations.ts localize, src/lib/derive.ts fillCopy), so a test reads what a page
// must show — the translation, or the English fallback — without restating either.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { stripComments } from '../../src/content/guards';
import { readMarkdown } from '../../src/i18n/content-files';
import type { Locale } from '../../src/i18n/locales';
import { PROJECT_FIELDS, fieldsOf, localize, type Block } from '../../src/i18n/translations';
import { copyVars, fillCopy, type EducationLike } from '../../src/lib/derive';
import type { Copy } from '../../src/content/schema';

const yaml = (name: string) => parse(readFileSync(`content/${name}`, 'utf8'));
type Rec = Record<string, unknown>;

/** content/ for the page of `locale`; `fallbacks` lists every English text it shows, by file. */
export function contentFor(locale: Locale) {
  const fallbacks: Array<{ file: string; text: string }> = [];
  const hooks = (file: string) => ({
    mark: (text: string) => {
      fallbacks.push({ file, text });
      return text;
    },
  });
  const L = <T extends object>(obj: T, file: string, at?: string[]) =>
    localize(obj, fieldsOf(file, at), locale, hooks(file)) as Rec;
  const site = yaml('site.yaml');
  const profile = L(yaml('profile.yaml'), 'profile.yaml', []);
  const education = (yaml('education.yaml') as Rec[]).map((e) => L(e, 'education.yaml'));
  const experience = (yaml('experience.yaml') as Rec[]).map((e) => L(e, 'experience.yaml'));
  const honors = (yaml('honors.yaml') as Rec[]).map((e) => L(e, 'honors.yaml'));
  const interestsRaw = yaml('interests.yaml');
  const interests = {
    items: (interestsRaw.items as Rec[]).map((i) => L(i, 'interests.yaml', ['items', '*'])),
  };
  const skillsRaw = yaml('skills.yaml');
  const skills = {
    groups: (skillsRaw.groups as Rec[]).map((g) => L(g, 'skills.yaml', ['groups', '*'])),
  };
  const aviationRaw = yaml('aviation.yaml');
  const aviation = { ...L(aviationRaw, 'aviation.yaml', []) } as Rec;
  for (const key of ['watching', 'favorite_cabins', 'news', 'fare_examples'])
    aviation[key] = ((aviationRaw[key] ?? []) as Rec[]).map((x) =>
      L(x, 'aviation.yaml', [key, '*']),
    );
  const meta = L(site.meta, 'site.yaml', ['meta']);
  const footer = L(site.footer, 'site.yaml', ['footer']);

  /** A Markdown file in this locale: its translation when there is one, else the English. */
  const markdown = (file: string) => {
    const twin = locale === 'en' ? null : file.replace(/\.md$/, `.${locale}.md`);
    const used = twin && existsSync(`content/${twin}`) ? twin : file;
    const md = readMarkdown(readFileSync(`content/${used}`, 'utf8'));
    return { ...md, english: used === file && locale !== 'en' };
  };
  const projects = readdirSync('content/projects')
    .filter((f) => f.endsWith('.md') && !/\.zh-han[st]\.md$/.test(f))
    .map((f) => {
      const id = f.replace(/\.md$/, '');
      const english = readMarkdown(readFileSync(`content/projects/${f}`, 'utf8'));
      const page = markdown(`projects/${f}`);
      const fm = localize(
        english.data,
        PROJECT_FIELDS,
        locale,
        hooks(`projects/${f}`),
        page.english ? undefined : (page.data as Block),
      ) as Rec;
      return { id, fm, body: page.body, bodyEnglish: page.english };
    });
  const about = markdown('about.md');

  const edu = [...education].sort((a, b) => String(b.start).localeCompare(String(a.start)))[0]!;
  const primary = (profile.emails as Array<{ address: string; primary?: boolean }>).find(
    (e) => e.primary,
  )!;
  const raw = yaml(locale === 'en' ? 'copy.yaml' : `copy.${locale}.yaml`);
  delete raw.from;
  delete raw.draft;
  const copy: Copy = fillCopy(
    raw,
    copyVars({
      displayName: (profile.name as { display: string }).display,
      location: String(profile.location),
      domain: site.domain,
      email: primary.address,
      edu: edu as unknown as EducationLike,
    }),
  );
  return {
    locale,
    site: { ...site, meta, footer },
    profile,
    education,
    experience,
    honors,
    interests,
    skills,
    aviation,
    projects,
    about,
    copy,
    fallbacks,
    /** now.md (or its translation) without comments: empty when there is nothing to show. */
    now: stripComments(markdown('now.md').body),
  };
}

/** Each locale's own name (copy `i18n.name`), the same on every page. */
export const languageName = (locale: Locale): string => contentFor(locale).copy.i18n.name;
