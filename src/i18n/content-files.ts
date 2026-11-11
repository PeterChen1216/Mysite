/**
 * content/ on disk, read for its translations: every translated field (a Unit) with the text it
 * is made from. Used by the content guard (drafts in a live locale), `pnpm content:stale` and
 * `pnpm content:hant`; the build reads the same files through Astro's collections and the same
 * rules (src/i18n/translations.ts). Node only (file access); relative imports carry `.ts`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { stripComments } from '../content/guards.ts';
import { TRANSLATED_LOCALES, type Locale, type TranslatedLocale } from './locales.ts';
import {
  BODY,
  PROJECT_FIELDS,
  PROSE_FILES,
  YAML_SPECS,
  copyLeaves,
  isDraft,
  objectsAt,
  sourceFor,
  translatedFields,
  type Block,
  type Unit,
} from './translations.ts';

/** A Markdown file split into its frontmatter (parsed) and body. */
export interface MarkdownFile {
  data: Record<string, unknown>;
  /** The frontmatter as written, without the `---` lines; null when there is none. */
  frontmatter: string | null;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function readMarkdown(text: string): MarkdownFile {
  const m = FRONTMATTER.exec(text);
  if (!m) return { data: {}, frontmatter: null, body: text };
  const data: unknown = parse(m[1]!) ?? {};
  return {
    data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
    frontmatter: m[1]!,
    body: text.slice(m[0].length),
  };
}

/** A Markdown body as a translation's source: comments removed, outer whitespace trimmed. */
export const bodyText = (body: string): string => stripComments(body).trim();

/** Twin file name: `about.md` → `about.zh-hans.md`. */
export const twinOf = (file: string, locale: TranslatedLocale): string =>
  file.replace(/\.md$/, `.${locale}.md`);

/** A twin's file name pattern (`clock-stamp.zh-hant.md`). */
export const TWIN = new RegExp(String.raw`\.(?:${TRANSLATED_LOCALES.join('|')})\.md$`);

const readYaml = (root: string, file: string): unknown =>
  existsSync(join(root, file)) ? parse(readFileSync(join(root, file), 'utf8')) : undefined;

const readMd = (root: string, file: string): MarkdownFile | undefined =>
  existsSync(join(root, file)) ? readMarkdown(readFileSync(join(root, file), 'utf8')) : undefined;

/** A readable name for an object in a list: its company, school, name … */
function labelOf(obj: Record<string, unknown>): string | undefined {
  for (const key of ['company', 'school', 'name', 'headline', 'code', 'aircraft', 'from'])
    if (typeof obj[key] === 'string' || typeof obj[key] === 'number') return String(obj[key]);
  return undefined;
}

/** `#2 (Merit Interactive Co., Ltd)`, `items #3 (Table-Tennis)`, `meta`. */
function placeOf(path: Array<string | number>, obj: Record<string, unknown>): string {
  const parts = path.map((p) => (typeof p === 'number' ? `#${p + 1}` : p));
  const label = typeof path.at(-1) === 'number' ? labelOf(obj) : undefined;
  return [parts.join(' '), label && `(${label})`].filter(Boolean).join(' ');
}

/** Every Markdown file a twin can translate: the prose files and each project. */
export function markdownSources(root: string): string[] {
  const projects = existsSync(join(root, 'projects'))
    ? readdirSync(join(root, 'projects'))
        .filter((f) => f.endsWith('.md') && !TWIN.test(f))
        .sort()
        .map((f) => `projects/${f}`)
    : [];
  return [...PROSE_FILES.map((n) => `${n}.md`), ...projects];
}

/** Twin files whose English original does not exist. */
export function orphanTwins(root: string): string[] {
  const out: string[] = [];
  for (const dir of ['', 'projects']) {
    if (!existsSync(join(root, dir))) continue;
    for (const f of readdirSync(join(root, dir))) {
      if (!TWIN.test(f)) continue;
      const rel = dir ? `${dir}/${f}` : f;
      if (!existsSync(join(root, rel.replace(TWIN, '.md')))) out.push(rel);
    }
  }
  return out;
}

/**
 * Every translated field in content/ (`root` is the content directory), in every translated
 * locale, with the text it is made from now.
 */
export function collectUnits(root: string): Unit[] {
  const units: Unit[] = [];
  const push = (
    file: string,
    where: string,
    key: string,
    blockPath: Array<string | number>,
    locale: TranslatedLocale,
    field: string,
    value: unknown,
    english: unknown,
    simplified: unknown,
    block: Block,
  ) => {
    const source = sourceFor(locale, english, simplified);
    units.push({
      file,
      where,
      key,
      blockPath,
      locale,
      field,
      value,
      source: source.value,
      sourceLocale: source.locale,
      from: block.from?.[field],
      draft: isDraft(block, field),
    });
  };

  for (const spec of YAML_SPECS) {
    const data = readYaml(root, spec.file);
    for (const { path, obj } of objectsAt(data, spec.at)) {
      const place = placeOf(path, obj);
      for (const locale of TRANSLATED_LOCALES) {
        const block = obj[locale] as Block | undefined;
        for (const field of translatedFields(block)) {
          const simplified = (obj['zh-hans'] as Block | undefined)?.[field];
          const where = [place, field].filter(Boolean).join(' › ');
          push(
            spec.file,
            where,
            `${spec.file} ${where}`,
            [...path, locale],
            locale,
            field,
            block![field],
            obj[field],
            simplified,
            block!,
          );
        }
      }
    }
  }

  const englishCopy = copyLeaves(readYaml(root, 'copy.yaml'));
  const simplifiedCopy = copyLeaves(readYaml(root, 'copy.zh-hans.yaml'));
  for (const locale of TRANSLATED_LOCALES) {
    const file = `copy.${locale}.yaml`;
    const data = readYaml(root, file) as Block | undefined;
    if (!data) continue;
    for (const [path, value] of copyLeaves(data))
      push(
        file,
        path,
        `copy.yaml ${path}`,
        [],
        locale,
        path,
        value,
        englishCopy.get(path),
        simplifiedCopy.get(path),
        data,
      );
  }

  for (const source of markdownSources(root)) {
    const english = readMd(root, source)!;
    const simplified = readMd(root, twinOf(source, 'zh-hans'));
    const fields = source.startsWith('projects/') ? Object.keys(PROJECT_FIELDS) : [];
    for (const locale of TRANSLATED_LOCALES) {
      const file = twinOf(source, locale);
      const twin = readMd(root, file);
      if (!twin) continue;
      const block = twin.data as Block;
      for (const field of fields)
        if (block[field] !== undefined)
          push(
            file,
            field,
            `${source} ${field}`,
            [],
            locale,
            field,
            block[field],
            english.data[field],
            simplified?.data[field],
            block,
          );
      push(
        file,
        BODY,
        `${source} ${BODY}`,
        [],
        locale,
        BODY,
        bodyText(twin.body),
        bodyText(english.body) || undefined,
        simplified && bodyText(simplified.body),
        block,
      );
    }
  }
  return units;
}

/** The units of one locale that are drafts. */
export const draftsIn = (units: readonly Unit[], locale: Locale): Unit[] =>
  units.filter((u) => u.locale === locale && u.draft);
