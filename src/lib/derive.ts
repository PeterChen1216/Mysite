/**
 * Every fact shown on the voxel page is computed here from content/ (PLAN §2.4: no invented
 * facts). Section components only lay out what these pure functions return, so the rules are
 * unit-tested in one place (tests/unit/derive.test.ts).
 */
import { createHash } from 'node:crypto';
import { decodeHTML, decodeHTMLAttribute } from 'entities';
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
  /** Optional in education.yaml; the page fills it from copy.yaml `labels.gpa` (page-data.ts). */
  gpa_label?: string | undefined;
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

/** `2024-07`, `2024-09` → `2024-07 → 2024-09`; `present` → copy.yaml `labels.now`. */
export function logRange(start: string, end: string, nowLabel: string): string {
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
 * True when a string is only symbols or punctuation (`_`, `↓`, `▲`). Hero.astro hides a
 * highlighted part of the headline from screen readers when it is decoration like this (the
 * `[_]` cursor); `&` or `+` in the sentence or inside a highlighted phrase stays readable.
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
/** A label cut into glyphs, runs of whitespace and single other characters, left to right. */
const GLYPH_TOKENS = new RegExp(String.raw`${GLYPH}|\s+|[^]`, 'gu');
const IS_GLYPH = new RegExp(String.raw`^${GLYPH}$`, 'u');

/**
 * Split decorative symbols off the ends of a label (`▲ back to spawn` → lead `▲ `), so they can be
 * hidden from screen readers while the words stay readable. Ordinary punctuation such as
 * `(loading…)` belongs to the words. Linear in the label's length.
 */
export function glyphParts(label: string): { lead: string; text: string; trail: string } {
  const tokens = label.match(GLYPH_TOKENS) ?? [];
  const glyph = (i: number) => i >= 0 && i < tokens.length && IS_GLYPH.test(tokens[i]!);
  const space = (i: number) => i >= 0 && i < tokens.length && /^\s+$/.test(tokens[i]!);
  // Lead: glyphs from the start, each with the whitespace after it.
  let start = 0;
  while (glyph(start)) start += space(start + 1) ? 2 : 1;
  // Trail: glyphs from the end, each with the whitespace before it.
  let end = tokens.length;
  while (end - 1 >= start && glyph(end - 1)) end -= space(end - 2) && end - 2 >= start ? 2 : 1;
  const text = tokens.slice(start, end).join('');
  if (!text) return { lead: '', text: label, trail: '' };
  return { lead: tokens.slice(0, start).join(''), text, trail: tokens.slice(end).join('') };
}

// ---------------------------------------------------------------- now.md → ticker lines
/**
 * One HTML comment (`<!-->` and `<!--->` are empty ones), or one tag: `</`?, its name, then its
 * attributes up to the closing `>`. Quoted attribute values may hold `<` and `>` (Astro does not
 * escape them), so a whole tag is always read as one token. The name can't give characters back
 * and the attribute run is bounded, so stray `<word` text in raw HTML costs little.
 */
const HTML_TOKEN =
  /<!--(?:-?>|[\s\S]*?(?:-->|$))|<(\/?)([a-z][\w-]*)(?![\w-])((?:[^>"']|"[^"]*"|'[^']*'){0,4096})>/gi;
/** Elements that end one ticker item and start the next: each list item and paragraph is one. */
const BLOCK = new Set(
  'address article aside blockquote dd details div dl dt figcaption figure footer header hr li main nav ol p pre section summary table tbody tfoot thead tr ul'.split(
    ' ',
  ),
);
/** Elements that separate words within an item: a hard line break, table cells. */
const SPACE = new Set(['br', 'td', 'th']);
/** Elements dropped with their content: their text is not a status line. */
const DROP = new Set(['script', 'style', 'template']);
const HEADING = /^h[1-6]$/;

/** A tag's attributes in order: a name, then its value if it has one. */
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g;

/**
 * An attribute's decoded value (`''` when it has none), or undefined when the tag lacks it.
 * Attributes are read in order, so text inside another attribute's quoted value never matches.
 */
function attribute(attrs: string, name: string): string | undefined {
  const wanted = name.toLowerCase(); // attribute names are case-insensitive in HTML
  for (const m of attrs.matchAll(ATTRIBUTE))
    if (m[1]!.toLowerCase() === wanted) return decodeHTMLAttribute(m[2] ?? m[3] ?? m[4] ?? '');
  return undefined;
}

/** An image's text: its alt, also for a local image, whose alt Astro keeps in a marker attribute. */
function imageText(attrs: string): string {
  const alt = attribute(attrs, 'alt');
  if (alt !== undefined) return alt;
  const marker = attribute(attrs, '__ASTRO_IMAGE_');
  if (!marker) return '';
  try {
    const value: unknown = (JSON.parse(marker) as { alt?: unknown }).alt;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/**
 * now.md, as rendered by Astro's Markdown pipeline (the CommonMark + GFM used for every page),
 * → one plain line per list item or paragraph, for the ticker. Working from the rendered HTML
 * rather than the Markdown source means links, autolinks, reference links, emphasis, code spans
 * and escapes are already resolved exactly as Markdown defines them; character references are
 * decoded with the full HTML table. Headings (other than a list item's own), comments, footnotes
 * and scripts are dropped, an image becomes its alt text, and line breaks inside an item become
 * spaces. The HTML is read tag by tag, never re-parsed after text is added.
 */
export function nowLines(html: string): string[] {
  const lines: string[] = [];
  let line = '';
  const endItem = () => {
    const text = line.replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
    line = '';
  };
  const token = new RegExp(HTML_TOKEN.source, 'gi');
  let at = 0;
  let listDepth = 0; // inside a list item, a heading is the item's own text
  for (let m = token.exec(html); m; m = token.exec(html)) {
    line += decodeHTML(html.slice(at, m.index));
    at = token.lastIndex;
    const [, close, tag, attrs = ''] = m;
    if (!tag) continue; // a comment
    const name = tag.toLowerCase();
    const dropped =
      !close &&
      (DROP.has(name) ||
        (HEADING.test(name) && listDepth === 0) ||
        (name === 'section' && attribute(attrs, 'data-footnotes') !== undefined) ||
        (name === 'a' && attribute(attrs, 'data-footnote-ref') !== undefined));
    if (dropped) {
      // Skip to the end tag (none of these nest in rendered Markdown). Without one, as in a
      // status line that mentions a raw `<style>` tag, only the tag itself is left out.
      const end = new RegExp(String.raw`<\/${name}\s*>`, 'gi');
      end.lastIndex = at;
      if (!end.exec(html)) continue;
      at = end.lastIndex;
      token.lastIndex = at;
      // A heading or the footnotes block ends the item before it; a script inside one does not.
      if (HEADING.test(name) || name === 'section') endItem();
      continue;
    }
    if (name === 'li') listDepth = Math.max(0, listDepth + (close ? -1 : 1));
    if (BLOCK.has(name) || HEADING.test(name)) endItem();
    else if (SPACE.has(name)) line += ' ';
    else if (name === 'img') line += ` ${imageText(attrs)} `;
  }
  line += decodeHTML(html.slice(at));
  endItem();
  return lines;
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

/**
 * Which About cards content fills, and where every interest is shown:
 * - off the clock: the interests with an icon;
 * - AvGeek: when any list in aviation.yaml has entries (it then shows the aviation interest);
 * - now building: when a project is ongoing; without it the XP card has its column to itself;
 * - every other interest is listed on the whoami card, so none goes missing.
 */
export function aboutCards<I extends InterestLike>(input: {
  interests: I[];
  /** aviation.yaml: every array in it is a list the AvGeek card can show. */
  aviation: Record<string, unknown>;
  /** An ongoing project fills the now-building card. */
  building: boolean;
}): {
  offClock: I[];
  avgeek: boolean;
  aviationInterest: I | undefined;
  others: I[];
  /** The XP card alone in its column (no now-building card). */
  stackOne: boolean;
  areas: { lg: string[]; md: string[]; sm: string[] };
} {
  const avgeek = Object.values(input.aviation).some((v) => Array.isArray(v) && v.length > 0);
  const aviationInterest = input.interests.find((i) => i.tag === 'aviation');
  const offClock = input.interests.filter((i) => i.icon);
  const shown = new Set<I>([
    ...offClock,
    ...(avgeek && aviationInterest ? [aviationInterest] : []),
  ]);
  return {
    offClock,
    avgeek,
    aviationInterest,
    others: input.interests.filter((i) => !shown.has(i)),
    stackOne: !input.building,
    areas: aboutAreas({ off: offClock.length > 0, av: avgeek }),
  };
}

/** A word of the hero headline, or the space between two words. */
export type HeadlineToken =
  | { space: true }
  | {
      text: string;
      /** Inside `[brackets]`: drawn in the highlight colour. */
      hi: boolean;
      /** A highlighted part made only of symbols (the `[_]` cursor): hidden from screen readers. */
      deco: boolean;
      /** Position in the word-by-word intro. */
      i: number;
    };

/**
 * copy.yaml `hero.headline` lines → their words, numbered across lines for the word-by-word
 * intro. Only a highlighted part that is all symbols is decoration; `&` or `+` in the sentence
 * or inside a highlighted phrase (`[data & design]`) is read.
 */
export function headlineWords(lines: string[]): HeadlineToken[][] {
  let i = 0;
  return lines.map((line) =>
    highlightParts(line).flatMap((part) => {
      const deco = part.hi && isDecorative(part.text);
      return part.text
        .split(/(\s+)/)
        .filter(Boolean)
        .map((t): HeadlineToken =>
          /^\s+$/.test(t) ? { space: true } : { text: t, hi: part.hi, deco, i: i++ },
        );
    }),
  );
}

// ---------------------------------------------------------------- labels
export const PLATFORM_LABEL: Record<string, string> = {
  ios: 'iOS',
  web: 'Web',
  cli: 'CLI',
  research: 'Research',
};
/**
 * Project status words: copy.yaml `labels.status`. Interface words are always passed in, never
 * defaulted here, so a component that forgets them fails the type check instead of silently
 * showing built-in English.
 */
export type StatusLabels = Record<ProjectLike['status'], string>;
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
  prefix: string,
): string {
  return `${prefix} ${name}  ·  ${edu.short ?? edu.school} ${classYear(edu.end)}  ·  ${location}`;
}

/** `Zhicheng (Peter) Chen — Informatics · Data Science @ University of Washington, Seattle, class of ’27.` */
export function whoamiLine(fullName: string, edu: EducationLike, classOf: string): string {
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
  gpaLabel: string,
): string | undefined {
  if (!edu.gpa) return undefined;
  const gpa = `${gpaLabel} ${edu.gpa.split('/')[0]}`;
  const honor = latestHonor(honors);
  return honor ? `${gpa}  ★  ${honor.name} ${shortAcademicYear(honor.year)}` : gpa;
}

/** `Clock Stamp · iOS  [SHIPPED → App Store]` (store label and status words from copy.yaml). */
export function projectBadge(
  p: ProjectLike,
  appStoreLabel: string,
  statusLabels: StatusLabels,
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
  labels: StatusLabels,
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

/** The scrolling ticker: built only from content facts and now.md lines. */
export function tickerItems(input: {
  edu: EducationLike & { gpa_label: string };
  honors: HonorLike[];
  projects: ProjectLike[];
  experience: ExperienceLike[];
  interests: InterestLike[];
  now: string[];
  email?: string | undefined;
  tags: TickerTags;
  statusLabels: StatusLabels;
}): TickerItem[] {
  const items: TickerItem[] = [];
  const { edu, tags, statusLabels } = input;
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
export function experienceRows(experience: LoggedExperience[], nowLabel: string): LogRow[] {
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
  /** copy.yaml `labels.now` and `labels.expected`. */
  nowLabel: string;
  expectedLabel: string;
}): LogRow[] {
  const rows: LogRow[] = experienceRows(input.experience, input.nowLabel);
  for (const e of input.education) {
    rows.push({
      hash: pseudoHash(`${e.school}|${e.degree}|${e.start}`),
      head: false,
      dates: logRange(e.start, e.end, input.nowLabel),
      ...(e.expected ? { note: input.expectedLabel } : {}),
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
export function educationDates(e: EducationLike, expectedLabel: string): string {
  return `${formatYearMonth(e.start)} – ${formatYearMonth(e.end)}${e.expected ? ` ${expectedLabel}` : ''}`;
}
