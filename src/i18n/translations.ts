/**
 * Translations of content/ (PLAN-EXPERIENCE §5.3–5.4; PLAN §13 ADR-017): which fields have
 * language, how a translation records what it was made from, what a draft is, and how a page in
 * one locale picks its text. Pure: no file access and no Astro, so the build, the content guard
 * and the scripts (`pnpm content:hant`, `pnpm content:stale`) share one set of rules. Relative
 * imports carry their `.ts` extension so Node runs this file directly.
 *
 * Where translations live:
 * - YAML facts: a `zh-hans:` / `zh-hant:` block inside the object whose fields it translates
 *   (YAML_SPECS lists the objects and their fields). Facts without language (dates, GPA, URLs,
 *   stack names, airport codes, company and school names) stay single-source.
 * - Markdown: a twin file — `about.zh-hans.md` next to `about.md`, `projects/<id>.zh-hant.md` next
 *   to `projects/<id>.md` — whose body is the translation and whose frontmatter is the block.
 * - Interface copy: `copy.zh-hans.yaml` / `copy.zh-hant.yaml`, every key of `copy.yaml`, with the
 *   block's two meta keys at the top level.
 *
 * A block holds the translated fields plus two meta keys:
 * - `from:` field → the hash (sourceHash) of the text the translation was made from: English for
 *   Simplified; for Traditional, its Simplified sibling (English when there is none). When the
 *   source changes, `pnpm content:stale` lists the translation; it still shows until updated.
 * - `draft:` `true` (everything in the block) or a list of fields (in a copy file, a key also
 *   covers every key under it). A draft is unread machine or Claude output: allowed only in a
 *   `preview` locale (content/site.yaml `locales`); the guard and the build fail on a draft in a
 *   `live` one.
 * A field with no translation falls back to English, marked `lang="en"` on the page.
 */
import { createHash } from 'node:crypto';
import {
  TRANSLATED_LOCALES,
  type Locale,
  type LocaleStates,
  type TranslatedLocale,
} from './locales.ts';

/** A field's shape: one text, or a list of texts translated as a whole. */
export type Kind = 'text' | 'list';
/** The fields with language in one kind of object. */
export type Fields = Readonly<Record<string, Kind>>;

export interface YamlSpec {
  /** The file under content/. */
  file: string;
  /** Where its objects are: keys from the top, `*` for every item of a list. */
  at: readonly string[];
  fields: Fields;
}

/** Every YAML object that can carry translation blocks, and its fields with language. */
export const YAML_SPECS: readonly YamlSpec[] = [
  {
    file: 'site.yaml',
    at: ['meta'],
    fields: { title: 'text', description: 'text', keywords: 'list' },
  },
  { file: 'site.yaml', at: ['footer'], fields: { update_note: 'text' } },
  {
    file: 'profile.yaml',
    at: [],
    fields: { tagline: 'text', location: 'text', status: 'text', avatar_alt: 'text' },
  },
  {
    file: 'education.yaml',
    at: ['*'],
    fields: {
      degree: 'text',
      major: 'text',
      track: 'text',
      minor: 'text',
      gpa_label: 'text',
      honors: 'list',
      coursework: 'list',
    },
  },
  {
    file: 'experience.yaml',
    at: ['*'],
    fields: { role: 'text', location: 'text', highlights: 'list', logo_alt: 'text' },
  },
  { file: 'honors.yaml', at: ['*'], fields: { name: 'text', note: 'text' } },
  { file: 'interests.yaml', at: ['items', '*'], fields: { name: 'text', note: 'text' } },
  {
    file: 'skills.yaml',
    at: ['groups', '*'],
    fields: { name: 'text', items: 'list', basic: 'list' },
  },
  { file: 'aviation.yaml', at: [], fields: { seat_rules: 'list' } },
  { file: 'aviation.yaml', at: ['watching', '*'], fields: { why: 'text' } },
  { file: 'aviation.yaml', at: ['favorite_cabins', '*'], fields: { cabin: 'text', why: 'text' } },
  { file: 'aviation.yaml', at: ['news', '*'], fields: { headline: 'text' } },
  { file: 'aviation.yaml', at: ['fare_examples', '*'], fields: { notes: 'text' } },
];

/** The spec of one file's objects at one place (`fieldsOf('experience.yaml')`). */
export function fieldsOf(file: string, at: readonly string[] = ['*']): Fields {
  const spec = YAML_SPECS.find((s) => s.file === file && s.at.join('.') === at.join('.'));
  if (!spec) throw new Error(`no translation spec for ${file} at ${at.join('.') || '(top)'}`);
  return spec.fields;
}

/** Frontmatter fields with language in a project file; its body is translated too. */
export const PROJECT_FIELDS: Fields = {
  title: 'text',
  tagline: 'text',
  role: 'text',
  location: 'text',
  cover_alt: 'text',
};
/** The Markdown body of a translated file, as a field name in `from:` and `draft:`. */
export const BODY = 'body';
/** Markdown files under content/ translated as a whole, by twin files. */
export const PROSE_FILES = ['about', 'now'] as const;

/** The meta keys of a block (everything else in it is a translated field). */
export const META_KEYS = ['from', 'draft'] as const;

export interface Block {
  from?: Partial<Record<string, string>> | undefined;
  draft?: true | string[] | undefined;
  [field: string]: unknown;
}

/** `^[0-9a-f]{8}$`: the shape of a recorded source hash. */
export const HASH = /^[0-9a-f]{8}$/;

/**
 * The fingerprint of a translation's source: the first 8 hex digits of the SHA-256 of its JSON
 * (a text, or a list of texts as a whole). Only a change of wording changes it.
 */
export function sourceHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 8);
}

/** The translated fields of a block (its keys other than `from` and `draft`). */
export function translatedFields(block: Block | undefined): string[] {
  if (!block) return [];
  return Object.keys(block).filter(
    (k) => !(META_KEYS as readonly string[]).includes(k) && block[k] !== undefined,
  );
}

/**
 * Whether a field of a block is a draft: `draft: true` covers the whole block, a list names its
 * fields; a listed key also covers every key under it (`hero` covers `hero.headline`).
 */
export function isDraft(block: Block | undefined, field: string): boolean {
  const draft = block?.draft;
  if (!draft) return false;
  if (draft === true) return true;
  return draft.some((d) => field === d || field.startsWith(`${d}.`));
}

/** A block's draft fields. */
export function draftFields(block: Block | undefined): string[] {
  return translatedFields(block).filter((f) => isDraft(block, f));
}

/**
 * What a translation into `locale` is made from: English for Simplified; for Traditional, the
 * Simplified translation when there is one (`pnpm content:hant` converts it), else English.
 */
export function sourceFor(
  locale: TranslatedLocale,
  english: unknown,
  simplified: unknown,
): { value: unknown; locale: Locale } {
  if (locale === 'zh-hant' && simplified !== undefined)
    return { value: simplified, locale: 'zh-hans' };
  return { value: english, locale: 'en' };
}

/** How a page reports what it shows: marks English fallbacks, collects drafts. */
export interface LocalizeHooks {
  /** Wraps a fallback English text so the page can mark it `lang="en"` (src/i18n/fallback.ts). */
  mark: (text: string) => string;
  /** Called with the field of every draft shown (a live locale fails the build on any). */
  draft?: ((field: string) => void) | undefined;
}

/** An object without its translation blocks. */
export type Untranslated<T> = Omit<T, TranslatedLocale>;

const markValue = (value: unknown, mark: (t: string) => string): unknown =>
  typeof value === 'string'
    ? mark(value)
    : Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? mark(v) : v))
      : value;

/**
 * An object as a page in `locale` shows it: each field with language from the locale's block,
 * or the English value marked as a fallback; facts without language as they are. English pages
 * get the English object. Translation blocks are removed either way. `block` is the locale's
 * block when it is not inside the object (a translated file's frontmatter).
 */
export function localize<T extends object>(
  obj: T,
  fields: Fields,
  locale: Locale,
  hooks: LocalizeHooks,
  block: Block | undefined = (obj as Record<string, unknown>)[locale] as Block | undefined,
): Untranslated<T> {
  const source = obj as Record<string, unknown>;
  const out: Record<string, unknown> = { ...source };
  for (const l of TRANSLATED_LOCALES) delete out[l];
  if (locale === 'en') return out as Untranslated<T>;
  for (const field of Object.keys(fields)) {
    if (source[field] === undefined) continue; // nothing in English, nothing to show
    const translated = block?.[field];
    if (translated !== undefined) {
      out[field] = translated;
      if (isDraft(block, field)) hooks.draft?.(field);
    } else out[field] = markValue(source[field], hooks.mark);
  }
  return out as Untranslated<T>;
}

/** A path from YAML_SPECS `at` matched against a parsed file: every object there, with its path. */
export function objectsAt(
  root: unknown,
  at: readonly string[],
): Array<{ path: Array<string | number>; obj: Record<string, unknown> }> {
  let found: Array<{ path: Array<string | number>; value: unknown }> = [{ path: [], value: root }];
  for (const step of at) {
    found = found.flatMap(({ path, value }) => {
      if (step === '*')
        return Array.isArray(value) ? value.map((v, i) => ({ path: [...path, i], value: v })) : [];
      if (value && typeof value === 'object' && !Array.isArray(value))
        return [{ path: [...path, step], value: (value as Record<string, unknown>)[step] }];
      return [];
    });
  }
  return found
    .filter(
      (f): f is { path: Array<string | number>; value: Record<string, unknown> } =>
        !!f.value && typeof f.value === 'object' && !Array.isArray(f.value),
    )
    .map((f) => ({ path: f.path, obj: f.value }));
}

/**
 * The leaves of a copy file by dotted path (`hero.headline`, `nav.links`): strings, numbers and
 * lists (a list is one leaf). The meta keys at the top are skipped.
 */
export function copyLeaves(copy: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const walk = (value: unknown, path: string) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (!path && (k === 'id' || (META_KEYS as readonly string[]).includes(k))) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    } else out.set(path, value);
  };
  walk(copy, '');
  return out;
}

/**
 * A translated copy file against copy.yaml: the keys it lacks (no silent English) and the keys
 * copy.yaml does not have. Both empty when the two have the same keys.
 */
export function copyKeyDiff(
  english: unknown,
  translated: unknown,
): { missing: string[]; extra: string[] } {
  const en = copyLeaves(english);
  const tr = copyLeaves(translated);
  return {
    missing: [...en.keys()].filter((k) => !tr.has(k)),
    extra: [...tr.keys()].filter((k) => !en.has(k)),
  };
}

/** One translated field, wherever it lives, with what it was made from. */
export interface Unit {
  /** The file under content/ that holds the translation. */
  file: string;
  /** Where in it, for people: the object and the field (`#2 (HashKey Global) › role`). */
  where: string;
  /** The same field in every locale (`experience.yaml #2 … › role`, `copy hero.headline`). */
  key: string;
  /** The path of the block in the file (YAML), `[]` for a copy file or a twin's frontmatter. */
  blockPath: Array<string | number>;
  locale: TranslatedLocale;
  field: string;
  value: unknown;
  /** The current text it is made from, and its language. */
  source: unknown;
  sourceLocale: Locale;
  /** The recorded hash (`from:`), if any. */
  from?: string | undefined;
  draft: boolean;
}

export type Freshness =
  /** Its recorded source is the current one. */
  | 'fresh'
  /** The source changed since the translation was made. */
  | 'changed'
  /** No hash recorded: nobody knows what it was made from. */
  | 'unrecorded'
  /** Traditional made from a Simplified text that is itself out of date with English. */
  | 'via-simplified'
  /** Its source no longer exists (the English field was removed). */
  | 'orphaned';

/**
 * Whether a translation is up to date with its source (PLAN-EXPERIENCE §5.4). `simplifiedStale`:
 * for a Traditional unit made from Simplified, whether that Simplified unit is itself stale, so
 * an English change lists both Chinese texts.
 */
export function freshness(unit: Unit, simplifiedStale = false): Freshness {
  if (unit.source === undefined) return 'orphaned';
  if (!unit.from) return 'unrecorded';
  if (unit.from !== sourceHash(unit.source)) return 'changed';
  if (unit.sourceLocale === 'zh-hans' && simplifiedStale) return 'via-simplified';
  return 'fresh';
}

/** One line per draft in a live locale (the content guard and the build fail on any). */
export function liveProblems(units: readonly Unit[], live: readonly Locale[]): string[] {
  return units
    .filter((u) => u.draft && live.includes(u.locale))
    .map((u) => `content/${u.file}: ${u.where} (${u.locale}) is a draft, but ${u.locale} is live`);
}

/**
 * The build's gate (src/lib/page-data.ts): a page in a `live` locale that shows any draft fails
 * the build, naming each draft. A preview locale may show drafts — that is what it is for.
 */
export function assertNoDrafts(
  locale: Locale,
  states: LocaleStates,
  drafts: readonly string[],
): void {
  if (states[locale] !== 'live' || drafts.length === 0) return;
  throw new Error(
    `✖ ${locale} is live (content/site.yaml locales) but shows ${drafts.length} draft translation(s). ` +
      `Read them and remove their \`draft\`, or set ${locale}: preview:\n  ${drafts.join('\n  ')}`,
  );
}
