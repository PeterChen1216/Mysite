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
  };
}
