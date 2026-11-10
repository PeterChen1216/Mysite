/**
 * Typed accessors for the content collections. Throws (failing the build) when a
 * required file is missing or empty, so a broken content/ never deploys silently.
 *
 * Facts come back as written (English, with their translation blocks); src/lib/page-data.ts
 * localizes them per page. What only exists per language — the interface copy and the
 * translated Markdown files — is looked up here by locale.
 */
import { getCollection, getEntry, render, type CollectionKey } from 'astro:content';
import { assertCommentsClosed, stripComments } from '../content/guards';
import type { Copy, TranslatedCopy } from '../content/schema';
import { isLocale, type Locale, type TranslatedLocale } from '../i18n/locales';
import { BODY, copyLeaves, isDraft, type Block } from '../i18n/translations';
import { copyVars, fillCopy, nowLines, type EducationLike } from './derive';
import { byStartDesc } from './format';

function required<T>(entry: T | undefined, file: string): T {
  if (!entry) throw new Error(`${file} failed to parse or validate (see the error above)`);
  return entry;
}

async function nonEmpty<C extends CollectionKey>(collection: C) {
  const entries = await getCollection(collection);
  if (entries.length === 0) throw new Error(`Collection "${collection}" is empty`);
  return entries;
}

export const getSite = async () =>
  required(await getEntry('site', 'site'), 'content/site.yaml').data;
export const getProfile = async () =>
  required(await getEntry('profile', 'profile'), 'content/profile.yaml').data;
export const getInterests = async () =>
  required(await getEntry('interests', 'interests'), 'content/interests.yaml').data;

const COPY_FILES = {
  en: { collection: 'copy', file: 'content/copy.yaml' },
  'zh-hans': { collection: 'copy_zh_hans', file: 'content/copy.zh-hans.yaml' },
  'zh-hant': { collection: 'copy_zh_hant', file: 'content/copy.zh-hant.yaml' },
} as const satisfies Record<Locale, { collection: CollectionKey; file: string }>;

/** The values copy `{placeholders}` are filled from, in the page's language. */
export interface CopyVarsInput {
  displayName: string;
  location: string;
  domain: string;
  email: string;
  edu: EducationLike;
}

/**
 * A locale's interface copy with every page-wide `{placeholder}` filled (derive.fillCopy), so no
 * component can print a raw `{name}`; an unknown placeholder fails the build. `onDraft` hears of
 * the copy keys that are still drafts (the build fails on any in a live locale).
 */
export async function getCopy(
  locale: Locale,
  vars: CopyVarsInput,
  onDraft?: (where: string) => void,
): Promise<Copy> {
  const { collection, file } = COPY_FILES[locale];
  const entry = required(await getEntry(collection, 'copy'), file).data as TranslatedCopy;
  const { from: _from, draft, ...copy } = entry;
  if (draft === true) onDraft?.(`${file} (every key)`);
  else if (draft)
    for (const key of copyLeaves(copy).keys())
      if (isDraft({ draft }, key)) onDraft?.(`${file}: ${key}`);
  return fillCopy(copy as Copy, copyVars(vars));
}

/**
 * Each locale's `i18n` copy (its own name, its notices and first-visit suggestion), in its own
 * language: the language switch and the suggestions of every page show them. These lines take no
 * placeholders.
 */
export async function getLanguageWords(): Promise<Record<Locale, Copy['i18n']>> {
  const out = {} as Record<Locale, Copy['i18n']>;
  for (const [locale, { collection, file }] of Object.entries(COPY_FILES) as Array<
    [Locale, (typeof COPY_FILES)[Locale]]
  >) {
    const { i18n } = required(await getEntry(collection, 'copy'), file).data as TranslatedCopy;
    out[locale] = fillCopy(i18n, {}, 'i18n');
  }
  return out;
}

/**
 * The "(opens in a new tab)" note in the page's language (copy `labels.new_tab`), for the link
 * components; `locale` is Astro.currentLocale (English when there is none).
 */
export async function getNewTabLabel(locale: string | undefined): Promise<string> {
  const { collection, file } = COPY_FILES[isLocale(locale) ? locale : 'en'];
  return required(await getEntry(collection, 'copy'), file).data.labels.new_tab;
}

export const getSkills = async () =>
  required(await getEntry('skills', 'skills'), 'content/skills.yaml').data;

/** AvGeek data; `news` is shown newest first and capped at 5, so the owner can just append. */
export async function getAviation() {
  const data = required(await getEntry('aviation', 'aviation'), 'content/aviation.yaml').data;
  const news = [...data.news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return { ...data, news };
}

export async function getEducation() {
  return (await nonEmpty('education')).map((e) => e.data).sort(byStartDesc);
}

/** Work entries (everything except `kind: volunteer`), newest first. */
export async function getExperience() {
  const work = (await nonEmpty('experience'))
    .map((e) => e.data)
    .filter((e) => e.kind !== 'volunteer')
    .sort(byStartDesc);
  if (work.length === 0)
    throw new Error('content/experience.yaml has no work (non-volunteer) entries');
  return work;
}

/** Community / volunteer entries (`kind: volunteer`), newest first. May be empty. */
export async function getCommunity() {
  return (await getCollection('experience'))
    .map((e) => e.data)
    .filter((e) => e.kind === 'volunteer')
    .sort(byStartDesc);
}

export async function getHonors() {
  return (await nonEmpty('honors')).map((e) => e.data);
}

export async function getProjects() {
  const entries = await nonEmpty('projects');
  for (const e of entries) assertCommentsClosed(e.body, `content/projects/${e.id}.md`);
  return entries.sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      b.data.year - a.data.year ||
      a.data.title.localeCompare(b.data.title),
  );
}

/**
 * An entry of a twin collection by id, or undefined when there is no such file (getEntry would
 * warn, and a missing translation is normal: the English shows).
 */
async function twinEntry<C extends 'project_translations' | 'prose_translations'>(
  collection: C,
  id: string,
  file: string,
) {
  const entry = (await getCollection(collection)).find((e) => e.id === id);
  if (entry) assertCommentsClosed(entry.body, file);
  return entry;
}

/** A project's translation into `locale` (projects/<id>.<locale>.md), if there is one. */
export const getProjectTranslation = (id: string, locale: TranslatedLocale) =>
  twinEntry('project_translations', `${id}.${locale}`, `content/projects/${id}.${locale}.md`);

/** A Markdown body as a page shows it, with the language it is in when that differs. */
export interface Prose {
  /** Null when the file has no body (only comments). */
  Content: Awaited<ReturnType<typeof render>>['Content'] | null;
  /** `en` when a translated page shows the English file (no translation); else undefined. */
  lang: 'en' | undefined;
}

/** The translation of about.md / now.md into `locale`, if there is one. */
async function proseTwin(name: 'about' | 'now', locale: Locale) {
  if (locale === 'en') return undefined;
  return twinEntry('prose_translations', `${name}.${locale}`, `content/${name}.${locale}.md`);
}

/**
 * Rendered Markdown for about.md (or its translation into `locale`, when there is one; without
 * one the English text is shown and marked as English). `onDraft` hears of a draft translation.
 */
export async function getProse(
  name: 'about' | 'now',
  locale: Locale,
  onDraft?: (where: string) => void,
): Promise<Prose> {
  const english = await getEntry('prose', name);
  if (!english) throw new Error(`content/${name}.md is missing`);
  assertCommentsClosed(english.body, `content/${name}.md`);
  const twin = await proseTwin(name, locale);
  if (twin && isDraft(twin.data as Block, BODY)) onDraft?.(`content/${name}.${locale}.md`);
  const entry = twin ?? english;
  const hasBody = stripComments(entry.body ?? '').trim();
  if (!hasBody) return { Content: null, lang: undefined };
  const { Content } = await render(entry);
  return { Content, lang: locale !== 'en' && !twin ? 'en' : undefined };
}

/**
 * now.md as plain lines for the ticker: Astro's rendering of the file (or of its translation),
 * reduced to text by derive.nowLines. Empty when the file has nothing but comments. `english`
 * tells whether the lines are the English fallback on a translated page.
 */
export async function getNowLines(
  locale: Locale,
  onDraft?: (where: string) => void,
): Promise<{ lines: string[]; english: boolean }> {
  const english = await getEntry('prose', 'now');
  if (!english) throw new Error('content/now.md is missing');
  assertCommentsClosed(english.body, 'content/now.md');
  const twin = await proseTwin('now', locale);
  if (twin && isDraft(twin.data as Block, BODY)) onDraft?.(`content/now.${locale}.md`);
  const entry = twin ?? english;
  const hasBody = stripComments(entry.body ?? '').trim();
  const fallback = locale !== 'en' && !twin;
  if (!hasBody) return { lines: [], english: fallback };
  const html = entry.rendered?.html;
  if (html === undefined) throw new Error(`content/${entry.id}.md was not rendered as Markdown`);
  return { lines: nowLines(html), english: fallback };
}

export { render };
