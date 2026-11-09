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

/** `2024-07`, `2024-09` → `2024-07 → 2024-09`; `present` → `now` (label from copy.yaml). */
export function logRange(start: string, end: string, nowLabel = 'now'): string {
  return `${start} → ${end === 'present' ? nowLabel : end}`;
}

/**
 * A `{name}` placeholder: one word (letters, digits, `_`, `-`), spaces inside the braces allowed.
 * Text such as `{rotate:1b}` is not a placeholder and stays as written.
 */
const PLACEHOLDER = /\{\s*([\w-]+)\s*\}/g;

/**
 * Fill `{placeholders}` in an interface string from copy.yaml. An unknown or empty placeholder
 * fails the build, so a typo in copy.yaml can't put a raw `{name}` on the page. Names in `keep`
 * are left as they are, for templates that are filled later with their own values.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | undefined>,
  keep: readonly string[] = [],
  where = 'copy.yaml',
): string {
  return template.replace(PLACEHOLDER, (whole, key: string) => {
    if (keep.includes(key)) return whole;
    const value = vars[key];
    if (!value) throw new Error(`${where}: unknown or empty placeholder {${key}} in "${template}"`);
    return value;
  });
}

/**
 * Placeholders filled per use rather than page-wide, by copy.yaml key: `hero.avgeek_route` takes
 * {from} and {to} (its airports). Anywhere else they are unknown and fail the build.
 */
export const LOCAL_PLACEHOLDERS: Readonly<Record<string, readonly string[]>> = {
  'hero.avgeek_route': ['from', 'to'],
};

/**
 * Every string in copy.yaml with its page-wide `{placeholders}` filled (see fillTemplate).
 * `path` is the key of `value` in copy.yaml (`hero.avgeek_route`), used for LOCAL_PLACEHOLDERS
 * and in error messages.
 */
export function fillCopy<T>(value: T, vars: Record<string, string | undefined>, path = ''): T {
  if (typeof value === 'string')
    return fillTemplate(
      value,
      vars,
      LOCAL_PLACEHOLDERS[path] ?? [],
      path ? `copy.yaml ${path}` : 'copy.yaml',
    ) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => fillCopy(v, vars, path)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        fillCopy(v as unknown, vars, path ? `${path}.${k}` : k),
      ]),
    ) as T;
  return value;
}

/**
 * The values copy.yaml `{placeholders}` can use, all taken from content/. Optional education
 * fields fall back to a required one, so leaving a field out never breaks the build.
 */
export function copyVars(input: {
  displayName: string;
  location: string;
  domain: string;
  email: string;
  edu: EducationLike;
}): Record<string, string> {
  const first = input.displayName.split(' ')[0] || input.displayName;
  return {
    first,
    /** Lower-case first name, the "host" in the terminal prompts (`peter@zhic.me`, `ping peter`). */
    host: first.toLowerCase(),
    city: input.location.split(',')[0]?.trim() || input.location,
    domain: input.domain,
    email: input.email,
    major: input.edu.major ?? input.edu.degree,
    department: input.edu.department ?? input.edu.school,
    school: input.edu.school,
    short: input.edu.short ?? input.edu.school,
  };
}

/**
 * True when a string is only symbols or punctuation (`_`, `↓`, `▲`). Hero.astro hides such a
 * word from screen readers only when it is highlighted (the `[_]` cursor); a plain `&` or `+` in
 * the headline is part of the sentence and stays readable.
 */
export function isDecorative(text: string): boolean {
  return /^[^\p{L}\p{N}]+$/u.test(text.trim());
}

/**
 * One decorative glyph: a non-ASCII symbol (▲ ↓ ★ ✈ →, emoji) with any emoji presentation
 * selector and zero-width-joined parts (`✈️`, `👩‍💻`). ASCII symbols (`+ ~ < = > | ^`) are
 * never decoration: `C++` and `cd ~` keep them.
 */
const GLYPH = String.raw`(?:(?!\p{ASCII})[\p{So}\p{Sm}\p{Sk}][\u{FE0E}\u{FE0F}]?(?:\u{200D}(?!\p{ASCII})[\p{So}\p{Sm}\p{Sk}][\u{FE0E}\u{FE0F}]?)*)`;
// One glyph per repetition, so a long run of symbols can't make the match backtrack.
const LEAD_GLYPHS = new RegExp(String.raw`^(?:${GLYPH}\s*)*`, 'u');
const TRAIL_GLYPHS = new RegExp(String.raw`(?:\s*${GLYPH})*$`, 'u');

/**
 * Split decorative symbols off the ends of a label (`▲ back to spawn` → lead `▲ `), so they can be
 * hidden from screen readers while the words stay readable. Ordinary punctuation such as
 * `(loading…)` belongs to the words.
 */
export function glyphParts(label: string): { lead: string; text: string; trail: string } {
  const lead = LEAD_GLYPHS.exec(label)?.[0] ?? '';
  const rest = label.slice(lead.length);
  const trail = TRAIL_GLYPHS.exec(rest)?.[0] ?? '';
  const text = rest.slice(0, rest.length - trail.length);
  return text ? { lead, text, trail } : { lead: '', text: label, trail: '' };
}

// ---------------------------------------------------------------- now.md → ticker lines
/** An HTML tag whose name matches `names`; quoted attribute values may contain `>`. */
const tagsNamed = (names: string) =>
  new RegExp(String.raw`<\/?(?:${names})(?![\w-])(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi');
const ANY_TAG = tagsNamed('[a-z][\\w-]*');
/** Tags that start a new line of their own: each list item and paragraph is one ticker item. */
const BLOCK_TAGS = tagsNamed(
  'address|article|aside|blockquote|dd|details|div|dl|dt|figcaption|figure|footer|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|tfoot|thead|tr|ul',
);
/** Tags that separate words without starting a new item (a hard line break, table cells). */
const SPACE_TAGS = tagsNamed('br|td|th');

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
/** `&#x26;` `&#38;` `&amp;` → `&`; an unknown named reference stays as written. */
function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
    (whole: string, hex?: string, dec?: string, name?: string) => {
      if (name) return NAMED_ENTITIES[name] ?? whole;
      const cp = hex ? parseInt(hex, 16) : Number(dec);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    },
  );
}

/**
 * now.md, as rendered by Astro's Markdown pipeline (the CommonMark + GFM used for every page),
 * → one plain line per list item or paragraph, for the ticker. Working from the rendered HTML
 * rather than the Markdown source means links, autolinks, reference links, emphasis, code spans,
 * escapes and entities are already resolved exactly as Markdown defines them. Headings,
 * comments and footnotes are dropped, an image becomes its alt text, and line breaks inside an
 * item become spaces.
 */
export function nowLines(html: string): string[] {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(h[1-6]|script|style|template)\b[\s\S]*?<\/\1\s*>/gi, '\n')
    .replace(/<section\b[^>]*\sdata-footnotes\b[\s\S]*?<\/section\s*>/gi, '\n')
    .replace(/<sup\b[^>]*>\s*<a\b[^>]*\sdata-footnote-ref\b[\s\S]*?<\/sup\s*>/gi, '')
    .replace(tagsNamed('img'), (img) => {
      const alt = /\salt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(img);
      return ` ${alt?.[1] ?? alt?.[2] ?? ''} `;
    })
    .replace(/\s+/g, ' ')
    .replace(BLOCK_TAGS, '\n')
    .replace(SPACE_TAGS, ' ')
    .replace(ANY_TAG, '')
    .split('\n')
    .map((line) => decodeEntities(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
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

/**
 * Grid areas of the About bento for the cards that are there — off-the-clock (`off`) and AvGeek
 * (`av`) are optional — at three columns (≥ 1280 px), two (≥ 768) and one, so no cell is ever
 * left empty. One string per grid row.
 */
export function aboutAreas(has: { off: boolean; av: boolean }): {
  lg: string[];
  md: string[];
  sm: string[];
} {
  const side = [has.off && 'off', has.av && 'av'].filter((a): a is string => typeof a === 'string');
  return {
    lg: [
      'who who stack',
      ...(side.length === 2 ? [`edu ${side.join(' ')}`] : side.map((a) => `edu ${a} ${a}`)),
      'edu skills skills',
    ],
    md: [
      'who who',
      'stack stack',
      ...side.map((a) => `edu ${a}`),
      side.length > 0 ? 'skills skills' : 'edu skills',
    ],
    sm: ['who', 'stack', 'edu', ...side, 'skills'],
  };
}

/** Grid rows → a `grid-template-areas` value: `'who who stack' 'edu off av'`. */
export function gridAreas(rows: string[]): string {
  return rows.map((r) => `'${r}'`).join(' ');
}

// ---------------------------------------------------------------- labels
export const PLATFORM_LABEL: Record<string, string> = {
  ios: 'iOS',
  web: 'Web',
  cli: 'CLI',
  research: 'Research',
};
/** Project status words; the page passes copy.yaml `labels.status` (these are the defaults). */
export type StatusLabels = Record<ProjectLike['status'], string>;
export const STATUS_LABEL: StatusLabels = {
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

/** `// player: Peter Chen · UW iSchool ’27 · Seattle, Washington` (prefix from copy.yaml). */
export function heroEyebrow(
  name: string,
  edu: EducationLike,
  location: string,
  prefix = '// player:',
): string {
  return `${prefix} ${name}  ·  ${edu.short ?? edu.school} ${classYear(edu.end)}  ·  ${location}`;
}

/** `Zhicheng (Peter) Chen — Informatics · Data Science @ University of Washington, Seattle, class of ’27.` */
export function whoamiLine(fullName: string, edu: EducationLike, classOf = 'class of'): string {
  const what = [edu.major ?? edu.degree, edu.track].filter(Boolean).join(' · ');
  return `${fullName} — ${what} @ ${edu.school}, ${classOf} ${classYear(edu.end)}.`;
}

/**
 * `GPA 3.84  ★  Annual Dean’s List 2025–26` — the honor keeps its own name from content/; the
 * `GPA` label comes from copy.yaml.
 */
export function gpaBadge(
  edu: EducationLike,
  honors: HonorLike[],
  gpaLabel = 'GPA',
): string | undefined {
  if (!edu.gpa) return undefined;
  const gpa = `${gpaLabel} ${edu.gpa.split('/')[0]}`;
  const honor = latestHonor(honors);
  return honor ? `${gpa}  ★  ${honor.name} ${shortAcademicYear(honor.year)}` : gpa;
}

/** `Clock Stamp · iOS  [SHIPPED → App Store]` (store label and status words from copy.yaml). */
export function projectBadge(
  p: ProjectLike,
  appStoreLabel = 'App Store',
  statusLabels: StatusLabels = STATUS_LABEL,
): string {
  const platform = p.platform.map((x) => PLATFORM_LABEL[x] ?? x).join('/');
  const status = statusLabels[p.status].toUpperCase();
  const where = p.links?.appstore ? ` → ${appStoreLabel}` : '';
  return `${p.title} · ${platform}  [${status}${where}]`;
}

/**
 * The project shown as "now building": an ongoing one (end: present), featured first. None when
 * nothing is ongoing — a finished project must never be presented as current work.
 */
export function nowProject<P extends ProjectLike>(projects: P[]): P | undefined {
  const ongoing = projects.filter((p) => p.end === 'present');
  return ongoing.find((p) => p.featured) ?? ongoing[0];
}

/** `[■■■■■■■■■■]` style bar for a status, plus the label (copy.yaml `labels.status`). */
export function statusBar(
  status: ProjectLike['status'],
  labels: StatusLabels = STATUS_LABEL,
): {
  filled: number;
  total: number;
  label: string;
} {
  return { filled: STATUS_PROGRESS[status], total: 10, label: labels[status] };
}

/** GPA as a fraction for the XP bar (`3.84/4.00` → 0.96). */
export function gpaRatio(gpa: string | undefined): number | undefined {
  if (!gpa) return undefined;
  const [have, max] = gpa.split('/').map(Number);
  return have && max ? Math.min(1, have / max) : undefined;
}

export type TickerTone = 'green' | 'enchant' | 'gold' | 'diamond' | 'redstone';

export interface TickerItem {
  tag: string;
  text: string;
  /** Tag colour, following the design's ticker ([XP] green, [GEN-AI] purple, [iOS] gold…). */
  tone: TickerTone;
}

/** Interest tag → ticker colour (design: gen-ai/choir purple, aviation cyan, table-tennis red). */
const INTEREST_TONE: Record<string, TickerTone> = {
  'gen-ai': 'enchant',
  choir: 'enchant',
  aviation: 'diamond',
  'table-tennis': 'redstone',
  'vibe-coding': 'gold',
};

/** Ticker tag words (copy.yaml `ticker.tags`); platform and interest tags come from content. */
export interface TickerTags {
  xp: string;
  now: string;
  work: string;
  ping: string;
  edu: string;
}
const DEFAULT_TAGS: TickerTags = { xp: 'XP', now: 'NOW', work: 'WORK', ping: 'PING', edu: 'EDU' };

/** The scrolling ticker: built only from content facts and now.md lines. */
export function tickerItems(input: {
  edu: EducationLike;
  honors: HonorLike[];
  projects: ProjectLike[];
  experience: ExperienceLike[];
  interests: InterestLike[];
  now: string[];
  email?: string | undefined;
  tags?: TickerTags;
  statusLabels?: StatusLabels;
}): TickerItem[] {
  const items: TickerItem[] = [];
  const { edu } = input;
  const tags = input.tags ?? DEFAULT_TAGS;
  const statusLabels = input.statusLabels ?? STATUS_LABEL;
  if (edu.gpa) {
    const honor = latestHonor(input.honors);
    items.push({
      tag: tags.xp,
      text: `${edu.gpa_label} ${edu.gpa}${honor ? ` · ${honor.name} ${shortAcademicYear(honor.year)}` : ''}`,
      tone: 'green',
    });
  }
  for (const line of input.now) items.push({ tag: tags.now, text: line, tone: 'gold' });
  for (const x of input.experience.filter((e) => e.end === 'present' && e.kind !== 'volunteer')) {
    items.push({ tag: tags.work, text: `${x.role} @ ${x.company}`, tone: 'enchant' });
  }
  for (const p of input.projects.filter((p) => p.featured)) {
    const platform = p.platform.map((x) => PLATFORM_LABEL[x] ?? x).join('/');
    items.push({ tag: platform, text: `${p.title} · ${statusLabels[p.status]}`, tone: 'gold' });
  }
  items.push({
    tag: (edu.short?.split(' ')[0] || tags.edu).toUpperCase(),
    text: `${[edu.major, edu.track].filter(Boolean).join(' · ') || edu.degree} ${classYear(edu.end)}`,
    tone: 'diamond',
  });
  for (const i of input.interests.filter((i) => i.tag)) {
    items.push({
      tag: i.tag!.toUpperCase(),
      text: i.name,
      tone: INTEREST_TONE[i.tag!] ?? 'diamond',
    });
  }
  if (input.email) items.push({ tag: tags.ping, text: input.email, tone: 'green' });
  return items;
}

export type LogIcon = 'diamond' | 'command' | 'terminal' | 'bookshelf' | 'grass' | 'gold' | 'logo';

export interface LogRow {
  hash: string;
  head: boolean;
  /** `2024-07 → 2024-09`; kept on one line. */
  dates: string;
  /** Shown after the dates and free to wrap, e.g. `(expected)` for a degree in progress. */
  note?: string;
  title: string;
  sub: string;
  icon: LogIcon;
  logo?: unknown;
  logoAlt?: string;
  sortKey: string;
}

type LoggedExperience = ExperienceLike & { logo?: unknown; logo_alt?: string | undefined };

/** One `git log` row per experience entry, newest first (no HEAD / init markers). */
export function experienceRows(experience: LoggedExperience[], nowLabel = 'now'): LogRow[] {
  return experience
    .map((x): LogRow => ({
      hash: pseudoHash(`${x.company}|${x.role}|${x.start}`),
      head: false,
      dates: logRange(x.start, x.end, nowLabel),
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
    }))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/**
 * `git log` rows, newest first: HEAD (status), every experience entry passed in, and each
 * school. The oldest entry is labelled `init`.
 */
export function gitLog(input: {
  status: string;
  headHint: string;
  /** Dates column of the HEAD row (copy.yaml experience.head_dates) — never a build-time year. */
  headDates: string;
  experience: LoggedExperience[];
  education: EducationLike[];
  nowLabel?: string;
  expectedLabel?: string;
}): LogRow[] {
  const rows: LogRow[] = experienceRows(input.experience, input.nowLabel);
  for (const e of input.education) {
    rows.push({
      hash: pseudoHash(`${e.school}|${e.degree}|${e.start}`),
      head: false,
      dates: logRange(e.start, e.end, input.nowLabel),
      ...(e.expected ? { note: input.expectedLabel ?? '(expected)' } : {}),
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
      dates: input.headDates,
      title: input.status,
      sub: input.headHint,
      icon: 'diamond',
      sortKey: '9999',
    },
    ...rows,
  ];
}

/** `Sep 2023 – Mar 2027 (expected)`. */
export function educationDates(e: EducationLike, expectedLabel = '(expected)'): string {
  return `${formatYearMonth(e.start)} – ${formatYearMonth(e.end)}${e.expected ? ` ${expectedLabel}` : ''}`;
}
