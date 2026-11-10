/**
 * View helpers for the Projects section (Projects.astro, ProjectFeatured.astro, ProjectCard.astro).
 * Every string here is built from one project's frontmatter plus interface labels from
 * content/copy.yaml; the formats are the content contract checked by tests/e2e/content.spec.ts.
 */
import { formatRange } from '../../lib/format';
import type { PageData } from '../../lib/page-data';

export type Project = PageData['projects'][number];
export type ProjectsCopy = PageData['copy']['projects'];
/**
 * copy.yaml `labels` used on the cards: status and platform words, the end of an ongoing
 * project, month words and the list separator.
 */
export type ProjectLabels = Pick<
  PageData['copy']['labels'],
  'status' | 'present' | 'platform' | 'months' | 'year_month' | 'list_separator'
>;

export interface ProjectLink {
  kind: 'appstore' | 'live' | 'repo' | 'other';
  url: string;
  label: string;
}

/** The voxel block a project stands for, by its first platform (Figma pairs this site, web, with
 * the Terminal block); the same on its card, in the directory and on its page. */
export type ProjectBlock = 'terminal' | 'bookshelf' | 'obsidian' | 'command' | 'gold';
const BLOCKS: Record<string, ProjectBlock> = {
  web: 'terminal',
  research: 'bookshelf',
  cli: 'obsidian',
  ios: 'command',
};
export const projectBlock = (p: Pick<Project, 'platform'>): ProjectBlock =>
  BLOCKS[p.platform[0] ?? ''] ?? 'gold';

export interface ProjectView {
  id: string;
  /** `project-<id>`: the card's id; `<id>-title` labels it. */
  anchor: string;
  year: string;
  platforms: string[];
  status: string;
  /** `2026 · iOS · shipped` — the card's first `.meta` line. */
  stat: string;
  /** `role · location · Mar 2026 – Present`, when the project has any of them. */
  when?: string | undefined;
  /** `Stack: SwiftUI, MapKit` — only when the project lists a stack. */
  stack?: string | undefined;
  links: ProjectLink[];
  /** The directory's second line: tagline, year and status (`Independent iOS App · 2026 · shipped`). */
  line: string;
}

export function projectView(p: Project, copy: ProjectsCopy, labels: ProjectLabels): ProjectView {
  const platforms = p.platform.map((x) => labels.platform[x] ?? x);
  const status = labels.status[p.status];
  const range = p.start && p.end ? formatRange(p.start, p.end, labels.present, labels) : undefined;
  const sep = labels.list_separator;
  const when = [p.role, p.location, range].filter(Boolean).join(' · ');
  const links: ProjectLink[] = [];
  if (p.links?.appstore)
    links.push({ kind: 'appstore', url: p.links.appstore, label: copy.link_appstore });
  if (p.links?.live) links.push({ kind: 'live', url: p.links.live, label: copy.link_live });
  if (p.links?.repo) links.push({ kind: 'repo', url: p.links.repo, label: copy.link_repo });
  for (const o of p.links?.other ?? []) links.push({ kind: 'other', url: o.url, label: o.label });
  return {
    id: p.id,
    anchor: `project-${p.id}`,
    year: String(p.year),
    platforms,
    status,
    stat: `${p.year} · ${platforms.join(sep)} · ${status}`,
    when: when || undefined,
    stack: p.stack.length > 0 ? `${copy.stack_label} ${p.stack.join(sep)}` : undefined,
    links,
    line: [p.tagline, String(p.year), status].filter(Boolean).join(' · '),
  };
}

/**
 * A project's neighbours in the page's order (featured first, then newest): the one before and
 * the one after, for the "more projects" links on its page.
 */
export function neighbours<T extends { id: string }>(
  list: readonly T[],
  id: string,
): { prev?: T | undefined; next?: T | undefined } {
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return {};
  return { prev: list[i - 1], next: list[i + 1] };
}

/**
 * A project page's meta description: the project's tagline, else the first line of its body as
 * written (Markdown marks removed), else the site's description — never words of our own.
 */
export function pageDescription(
  p: { tagline?: string | undefined; body?: string | undefined },
  fallback: string,
  max = 160,
): string {
  const first = (p.body ?? '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/[*_`[\]]/g, '')
        .trim(),
    )
    .find((l) => l && !l.startsWith('<!--'));
  const text = p.tagline?.trim() || first || fallback;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
