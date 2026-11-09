/**
 * Typed accessors for the content collections. Throws (failing the build) when a
 * required file is missing or empty, so a broken content/ never deploys silently.
 */
import { getCollection, getEntry, render, type CollectionKey } from 'astro:content';
import { assertCommentsClosed, stripComments } from '../content/guards';
import { copyVars, fillCopy, nowLines } from './derive';
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

/**
 * copy.yaml with every page-wide `{placeholder}` filled from content (derive.fillCopy), so no
 * component can print a raw `{name}`; an unknown placeholder fails the build.
 */
export async function getCopy() {
  const [entry, profile, education, site] = await Promise.all([
    getEntry('copy', 'copy'),
    getProfile(),
    getEducation(),
    getSite(),
  ]);
  const copy = required(entry, 'content/copy.yaml').data;
  const email = (profile.emails.find((e) => e.primary) ?? profile.emails[0])?.address ?? '';
  return fillCopy(
    copy,
    copyVars({
      displayName: profile.name.display,
      location: profile.location,
      domain: site.domain,
      email,
      edu: education[0]!,
    }),
  );
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

/** Rendered markdown for about.md / now.md (`Content` is null when the file has no body). */
export async function getProse(name: 'about' | 'now') {
  const entry = await getEntry('prose', name);
  if (!entry) throw new Error(`content/${name}.md is missing`);
  assertCommentsClosed(entry.body, `content/${name}.md`);
  const hasBody = stripComments(entry.body ?? '').trim();
  if (!hasBody) return { Content: null };
  const { Content } = await render(entry);
  return { Content };
}

/**
 * now.md as plain lines for the ticker: Astro's rendering of the file, reduced to text by
 * derive.nowLines. Empty when the file has nothing but comments.
 */
export async function getNowLines() {
  const entry = await getEntry('prose', 'now');
  if (!entry) throw new Error('content/now.md is missing');
  assertCommentsClosed(entry.body, 'content/now.md');
  const hasBody = stripComments(entry.body ?? '').trim();
  if (!hasBody) return [];
  const html = entry.rendered?.html;
  if (html === undefined) throw new Error('content/now.md was not rendered as Markdown');
  return nowLines(html);
}

export { render };
