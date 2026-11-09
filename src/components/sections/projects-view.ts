/**
 * View helpers for the Projects section (Projects.astro, ProjectFeatured.astro, ProjectCard.astro).
 * Every string here is built from one project's frontmatter plus interface labels from
 * content/copy.yaml; the formats are the content contract checked by tests/e2e/content.spec.ts.
 */
import { PLATFORM_LABEL, STATUS_LABEL } from '../../lib/derive';
import { formatRange } from '../../lib/format';
import type { PageData } from '../../lib/page-data';

export type Project = PageData['projects'][number];
export type ProjectsCopy = PageData['copy']['projects'];

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

export function projectView(p: Project, copy: ProjectsCopy): ProjectView {
  const platforms = p.platform.map((x) => PLATFORM_LABEL[x] ?? x);
  const status = STATUS_LABEL[p.status];
  const when = [p.role, p.location, p.start && p.end ? formatRange(p.start, p.end) : undefined]
    .filter(Boolean)
    .join(' · ');
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
    stat: `${p.year} · ${platforms.join(', ')} · ${status}`,
    when: when || undefined,
    stack: p.stack.length > 0 ? `Stack: ${p.stack.join(', ')}` : undefined,
    links,
  };
}
