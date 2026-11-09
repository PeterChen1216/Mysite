/**
 * Typed accessors for the content collections. Throws (failing the build) when a
 * required file is missing or empty, so a broken content/ never deploys silently.
 */
import { getCollection, getEntry, render, type CollectionKey } from 'astro:content';
import { assertCommentsClosed } from '../content/guards';
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
/** AvGeek data; `news` is shown newest first and capped at 5, so the owner can just append. */
export async function getAviation() {
  const data = required(await getEntry('aviation', 'aviation'), 'content/aviation.yaml').data;
  const news = [...data.news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return { ...data, news };
}

export async function getEducation() {
  return (await nonEmpty('education')).map((e) => e.data).sort(byStartDesc);
}

export async function getExperience() {
  return (await nonEmpty('experience')).map((e) => e.data).sort(byStartDesc);
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
  const hasBody = entry.body?.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!hasBody) return { Content: null };
  const { Content } = await render(entry);
  return { Content };
}

export { render };
