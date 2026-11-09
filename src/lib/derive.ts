/**
 * Every fact shown on the voxel page is computed here from content/ (PLAN §2.4: no invented
 * facts). Section components only lay out what these pure functions return, so the rules are
 * unit-tested in one place (tests/unit/derive.test.ts).
 */
import { createHash } from 'node:crypto';
import { formatYearMonth } from './format';

// ---------------------------------------------------------------- shapes (structural)
export interface EducationLike {
  school: string;
  short?: string | undefined;
  department?: string | undefined;
  degree: string;
  major?: string | undefined;
  track?: string | undefined;
  start: string;
  end: string;
  expected: boolean;
  gpa?: string | undefined;
  gpa_label: string;
  honors: string[];
}
export interface HonorLike {
  name: string;
  year: string;
}
export interface ExperienceLike {
  company: string;
  role: string;
  kind?: string | undefined;
  start: string;
  end: string;
  location: string;
}
export interface ProjectLike {
  id: string;
  title: string;
  tagline?: string | undefined;
  status: 'idea' | 'wip' | 'testflight' | 'shipped' | 'completed' | 'archived';
  platform: string[];
  featured: boolean;
  year: number;
  start?: string | undefined;
  end?: string | undefined;
  links?:
    | { appstore?: string | undefined; repo?: string | undefined; live?: string | undefined }
    | undefined;
}
export interface SocialLike {
  network: string;
  label: string;
  url: string;
}
export interface InterestLike {
  name: string;
  tag?: string | undefined;
  icon?: string | undefined;
  note?: string | undefined;
}

// ---------------------------------------------------------------- small formatters
/** `2027-03` → `’27`. */
export function classYear(end: string): string {
  return `’${end.slice(2, 4)}`;
}

/** `2025-2026` → `2025–26`; `2025` stays. */
export function shortAcademicYear(year: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(year);
  return m ? `${m[1]}–${m[2]!.slice(2)}` : year;
}

/** `https://github.com/PeterChen1216` → `github.com/PeterChen1216`. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/** The GitHub handle from the profile's GitHub link, if any. */
export function githubHandle(socials: SocialLike[]): string | undefined {
  const gh = socials.find((s) => s.network === 'github');
  return gh ? new URL(gh.url).pathname.split('/').filter(Boolean)[0] : undefined;
}

/** `2024-07`, `2024-09` → `2024-07 → 2024-09`; `present` → `now`. */
export function logRange(start: string, end: string): string {
  return `${start} → ${end === 'present' ? 'now' : end}`;
}

/** Deterministic 7-char pseudo commit hash for a log row (decoration, stable across builds). */
export function pseudoHash(seed: string): string {
  return createHash('sha1').update(seed).digest('hex').slice(0, 7);
}

/** Split a copy line with `[highlight]` markers into parts. */
export function highlightParts(line: string): Array<{ text: string; hi: boolean }> {
  const parts: Array<{ text: string; hi: boolean }> = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index), hi: false });
    parts.push({ text: m[1]!, hi: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), hi: false });
  return parts;
}

// ---------------------------------------------------------------- labels
export const PLATFORM_LABEL: Record<string, string> = {
  ios: 'iOS',
  web: 'Web',
  cli: 'CLI',
  research: 'Research',
};
export const STATUS_LABEL: Record<ProjectLike['status'], string> = {
  idea: 'idea',
  wip: 'in progress',
  testflight: 'TestFlight',
  shipped: 'shipped',
  completed: 'completed',
  archived: 'archived',
};
/** Progress bar cells (of 10) per status. */
export const STATUS_PROGRESS: Record<ProjectLike['status'], number> = {
  idea: 1,
  wip: 6,
  testflight: 8,
  shipped: 10,
  completed: 10,
  archived: 10,
};

// ---------------------------------------------------------------- facts for the page
/** Newest honor first (honors.yaml order is newest first; ties keep file order). */
export function latestHonor(honors: HonorLike[]): HonorLike | undefined {
  return [...honors].sort((a, b) => b.year.localeCompare(a.year))[0];
}

/** `// player: Peter Chen · UW iSchool ’27 · Seattle, Washington`. */
export function heroEyebrow(name: string, edu: EducationLike, location: string): string {
  return `// player: ${name}  ·  ${edu.short ?? edu.school} ${classYear(edu.end)}  ·  ${location}`;
}

/** `Zhicheng (Peter) Chen — Informatics · Data Science @ University of Washington, Seattle, class of ’27.` */
export function whoamiLine(fullName: string, edu: EducationLike): string {
  const what = [edu.major ?? edu.degree, edu.track].filter(Boolean).join(' · ');
  return `${fullName} — ${what} @ ${edu.school}, class of ${classYear(edu.end)}.`;
}

/** `GPA 3.84  ★  Dean’s List 2025–26`. */
export function gpaBadge(edu: EducationLike, honors: HonorLike[]): string | undefined {
  if (!edu.gpa) return undefined;
  const gpa = edu.gpa.split('/')[0];
  const honor = latestHonor(honors);
  return honor
    ? `GPA ${gpa}  ★  ${honor.name.replace(/^Annual /, '')} ${shortAcademicYear(honor.year)}`
    : `GPA ${gpa}`;
}

/** `Clock Stamp · iOS  [SHIPPED → App Store]`. */
export function projectBadge(p: ProjectLike): string {
  const platform = p.platform.map((x) => PLATFORM_LABEL[x] ?? x).join('/');
  const status = STATUS_LABEL[p.status].toUpperCase();
  const where = p.links?.appstore ? ' → App Store' : '';
  return `${p.title} · ${platform}  [${status}${where}]`;
}

/** The project shown as "now building": an ongoing one (end: present), featured first. */
export function nowProject<P extends ProjectLike>(projects: P[]): P | undefined {
  const ongoing = projects.filter((p) => p.end === 'present');
  return ongoing.find((p) => p.featured) ?? ongoing[0] ?? projects.find((p) => p.featured);
}

/** `[■■■■■■■■■■]` style bar for a status, plus the label. */
export function statusBar(status: ProjectLike['status']): {
  filled: number;
  total: number;
  label: string;
} {
  return { filled: STATUS_PROGRESS[status], total: 10, label: STATUS_LABEL[status] };
}

/** GPA as a fraction for the XP bar (`3.84/4.00` → 0.96). */
export function gpaRatio(gpa: string | undefined): number | undefined {
  if (!gpa) return undefined;
  const [have, max] = gpa.split('/').map(Number);
  return have && max ? Math.min(1, have / max) : undefined;
}

export interface TickerItem {
  tag: string;
  text: string;
}

/** The scrolling ticker: built only from content facts and now.md lines. */
export function tickerItems(input: {
  edu: EducationLike;
  honors: HonorLike[];
  projects: ProjectLike[];
  experience: ExperienceLike[];
  interests: InterestLike[];
  now: string[];
  email?: string | undefined;
}): TickerItem[] {
  const items: TickerItem[] = [];
  const { edu } = input;
  if (edu.gpa) {
    const honor = latestHonor(input.honors);
    items.push({
      tag: 'XP',
      text: `${edu.gpa_label} ${edu.gpa}${honor ? ` · ${honor.name.replace(/^Annual /, '')} ${shortAcademicYear(honor.year)}` : ''}`,
    });
  }
  for (const line of input.now) items.push({ tag: 'NOW', text: line });
  for (const x of input.experience.filter((e) => e.end === 'present' && e.kind !== 'volunteer')) {
    items.push({ tag: 'WORK', text: `${x.role} @ ${x.company}` });
  }
  for (const p of input.projects.filter((p) => p.featured)) {
    const platform = p.platform.map((x) => PLATFORM_LABEL[x] ?? x).join('/');
    items.push({ tag: platform.toUpperCase(), text: `${p.title} · ${STATUS_LABEL[p.status]}` });
  }
  items.push({
    tag: (edu.short ?? 'EDU').split(' ')[0]!.toUpperCase(),
    text: `${[edu.major, edu.track].filter(Boolean).join(' · ') || edu.degree} ${classYear(edu.end)}`,
  });
  for (const i of input.interests.filter((i) => i.tag)) {
    items.push({ tag: i.tag!.toUpperCase(), text: i.name });
  }
  if (input.email) items.push({ tag: 'PING', text: input.email });
  return items;
}

export type LogIcon = 'diamond' | 'command' | 'terminal' | 'bookshelf' | 'grass' | 'gold' | 'logo';

export interface LogRow {
  hash: string;
  head: boolean;
  dates: string;
  title: string;
  sub: string;
  icon: LogIcon;
  logo?: unknown;
  logoAlt?: string;
  sortKey: string;
}

/**
 * `git log` rows, newest first: HEAD (status), every experience entry (work and volunteer),
 * and each school. The oldest entry is labelled `init`.
 */
export function gitLog(input: {
  status: string;
  headHint: string;
  currentYear: number;
  experience: Array<ExperienceLike & { logo?: unknown; logo_alt?: string | undefined }>;
  education: EducationLike[];
}): LogRow[] {
  const rows: LogRow[] = input.experience.map((x) => ({
    hash: pseudoHash(`${x.company}|${x.role}|${x.start}`),
    head: false,
    dates: logRange(x.start, x.end),
    title: x.role,
    sub: `${x.company} · ${x.location}`,
    icon: x.logo
      ? 'logo'
      : x.kind === 'volunteer'
        ? 'grass'
        : x.end === 'present'
          ? 'command'
          : 'terminal',
    ...(x.logo ? { logo: x.logo, logoAlt: x.logo_alt ?? '' } : {}),
    sortKey: x.start,
  }));
  for (const e of input.education) {
    rows.push({
      hash: pseudoHash(`${e.school}|${e.degree}|${e.start}`),
      head: false,
      dates: logRange(e.start, e.end),
      title: [e.degree, e.track].filter(Boolean).join(' · '),
      sub: [e.school, e.department].filter(Boolean).join(' · '),
      icon: 'bookshelf',
      sortKey: e.start,
    });
  }
  rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const oldest = rows.at(-1);
  if (oldest) oldest.hash = 'init';
  return [
    {
      hash: 'HEAD -> main',
      head: true,
      dates: `${input.currentYear} →`,
      title: input.status,
      sub: input.headHint,
      icon: 'diamond',
      sortKey: '9999',
    },
    ...rows,
  ];
}

/** `ping` transcript lines for the contact terminal. */
export function pingLines(email: string): string[] {
  return [
    `PING peter (${email}): 56 data bytes`,
    `64 bytes from ${email}: icmp_seq=0 ttl=64 time=0.27 ms`,
    '--- 1 packet transmitted, 1 received, 0% packet loss ---',
  ];
}

/** `Sep 2023 – Mar 2027 (expected)`. */
export function educationDates(e: EducationLike): string {
  return `${formatYearMonth(e.start)} – ${formatYearMonth(e.end)}${e.expected ? ' (expected)' : ''}`;
}
