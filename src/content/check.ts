/**
 * The content check's schema pass (`pnpm content:check`; PLAN §7.1 "写错字段名/日期格式，CI 立刻红").
 *
 * Every file under content/ is read the way the build reads it (src/content.config.ts: the same
 * YAML rules from parsers.ts, the same Zod schemas from schema.ts) and every problem is reported
 * so the owner can act on it without knowing the code: the file and line, which item, which field,
 * what is wrong and what to write instead — `content/experience.yaml:28: item 2 (Merit Interactive
 * Co., Ltd) → start: Use the YYYY-MM format, e.g. 2024-07 — you wrote "2026-1"`.
 *
 * The build runs the same schemas, so nothing passes here that the build rejects (a unit test
 * keeps the file table below in step with content.config.ts); this pass takes under a second and
 * finds every problem at once, where the build stops at the first. Node only (file access);
 * relative imports carry `.ts` so scripts/check-content.mjs can load it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { z } from 'astro/zod';
import { LineCounter, isMap, isPair, isScalar, parseDocument, type Document, type Node } from 'yaml';
import { TRANSLATED_LOCALES } from '../i18n/locales.ts';
import { PROSE_FILES } from '../i18n/translations.ts';
import { cutValues } from './parsers.ts';
import {
  aviationSchema,
  copySchema,
  educationSchema,
  experienceSchema,
  honorSchema,
  interestsSchema,
  profileSchema,
  projectSchema,
  projectTranslationSchema,
  proseSchema,
  proseTranslationSchema,
  siteSchema,
  skillsSchema,
  translatedCopySchema,
} from './schema.ts';

/** One problem: the file under content/, the line (1-based) when known, and what to do. */
export interface Problem {
  file: string;
  line?: number;
  text: string;
}

/** `content/<file>:<line>: <text>` — the form editors and terminals turn into a link. */
export const formatProblem = (p: Problem): string =>
  `content/${p.file}${p.line ? `:${p.line}` : ''}: ${p.text}`;

type Shape = 'object' | 'list';
type ImageSchema = z.ZodType<string>;
interface FileSpec {
  /** Under content/. */
  file: string;
  /** One object (profile.yaml) or a list of items (experience.yaml). */
  shape: Shape;
  schema: (image: () => ImageSchema) => z.ZodType;
}

/**
 * The YAML files the site reads, as src/content.config.ts loads them (`strictFile` + `singleton`
 * or `list`). tests/unit/content-check.test.ts fails if the two lists drift apart.
 */
export const YAML_FILES: readonly FileSpec[] = [
  { file: 'site.yaml', shape: 'object', schema: () => siteSchema },
  { file: 'profile.yaml', shape: 'object', schema: (image) => profileSchema(image) },
  { file: 'education.yaml', shape: 'list', schema: () => educationSchema },
  { file: 'experience.yaml', shape: 'list', schema: (image) => experienceSchema(image) },
  { file: 'honors.yaml', shape: 'list', schema: () => honorSchema },
  { file: 'interests.yaml', shape: 'object', schema: () => interestsSchema },
  { file: 'copy.yaml', shape: 'object', schema: () => copySchema },
  ...TRANSLATED_LOCALES.map(
    (l): FileSpec => ({ file: `copy.${l}.yaml`, shape: 'object', schema: () => translatedCopySchema }),
  ),
  { file: 'skills.yaml', shape: 'object', schema: () => skillsSchema },
  { file: 'aviation.yaml', shape: 'object', schema: () => aviationSchema },
];

const IMAGE = /\.(?:jpe?g|png|webp|avif|gif|svg)$/i;

/**
 * Stand-in for Astro's `image()`: a path relative to the file that names it, to an image that
 * exists (Astro resolves it the same way and fails the build when it is missing).
 */
export function imageAt(dir: string): () => ImageSchema {
  return () =>
    z.string().superRefine((path, ctx) => {
      if (/^[a-z]+:\/\//i.test(path))
        ctx.addIssue({
          code: 'custom',
          message: 'Use an image file in content/ (e.g. ./images/logo.webp), not a web address',
        });
      else if (!IMAGE.test(path))
        ctx.addIssue({
          code: 'custom',
          message: 'Use a .jpg, .png, .webp, .avif, .gif or .svg image',
        });
      else if (!existsSync(join(dir, path)))
        ctx.addIssue({
          code: 'custom',
          message: `There is no image at ${path} — put the file there, or fix the path (it starts from the folder of this file)`,
        });
    });
}

// ------------------------------------------------------------------ YAML positions

/** A parsed YAML text with its line numbers. */
interface Located {
  doc: Document;
  /** 1-based line in the file of a character offset in this text. */
  line: (offset: number) => number;
  /** Lines before this text in its file (a Markdown frontmatter starts after `---`). */
  before: number;
}

function locate(text: string, before = 0): Located {
  const counter = new LineCounter();
  const doc = parseDocument(text, { lineCounter: counter });
  return { doc, line: (offset) => counter.linePos(offset).line + before, before };
}

/** The node at `path`, or the deepest one that exists on the way there. */
function nodeAt(doc: Document, path: readonly PropertyKey[]): Node | null {
  for (let n = path.length; n >= 0; n--) {
    const node = n === 0 ? doc.contents : doc.getIn(path.slice(0, n) as unknown[], true);
    if (node && typeof node === 'object' && 'range' in node) return node as Node;
  }
  return null;
}

/** The line of `path` in the document; for a key that is not allowed, the line of that key. */
function lineOf(located: Located, path: readonly PropertyKey[], key?: string): number | undefined {
  const node = nodeAt(located.doc, path);
  if (key && isMap(node)) {
    const pair = node.items.find((p) => isPair(p) && isScalar(p.key) && p.key.value === key);
    const range = pair && isScalar(pair.key) ? pair.key.range : undefined;
    if (range) return located.line(range[0]);
  }
  return node?.range ? located.line(node.range[0]) : undefined;
}

/**
 * Advice for a YAML syntax error, by the yaml library's error code. The library's own text
 * (`Nested mappings are not allowed in compact mappings`) is accurate but written for programmers.
 */
const SYNTAX: Record<string, string> = {
  TAB_AS_INDENT: 'a tab is used to indent this line — YAML needs spaces',
  DUPLICATE_KEY: 'the same field is written twice here — keep one',
  BLOCK_AS_IMPLICIT_KEY:
    'text that contains ": " (a colon and a space) must be wrapped in quotes, e.g. role: "Intern: Summer"',
  MULTILINE_IMPLICIT_KEY:
    'a value runs onto the next line — wrap long text in quotes, or indent the next line further',
  BAD_INDENT: 'this line is indented differently from the lines around it — line it up with them',
  MISSING_CHAR: 'a closing quote or bracket is missing on this line',
  BAD_SCALAR_START:
    'a value cannot start with this character — wrap the whole value in quotes ("…")',
  UNEXPECTED_TOKEN:
    'something on this line cannot be read — check the indentation, and wrap text that contains ": " or " #" in quotes',
};

/**
 * The first syntax error only: the ones after it are usually its echo (one tab makes five errors),
 * and the owner fixes one line and runs the check again.
 */
function syntaxProblems(file: string, located: Located, text: string): Problem[] {
  const lines = text.split('\n');
  const problems: Problem[] = located.doc.errors.slice(0, 1).map((e) => {
    // A tab in the indentation surfaces under several codes; name it whatever the parser says.
    const source = e.linePos?.[0] ? (lines[e.linePos[0].line - 1] ?? '') : '';
    const code = /^ *\t/.test(source) ? 'TAB_AS_INDENT' : e.code;
    const advice = SYNTAX[code] ?? e.message.split('\n')[0]!.replace(/ at line \d+.*$/, '');
    return {
      file,
      line: e.linePos?.[0]?.line ? e.linePos[0].line + located.before : undefined,
      text: `this YAML cannot be read: ${advice}`,
    };
  });
  if (problems.length > 0) return problems;
  return cutValues(located.doc, text).map((c) => ({
    file,
    line: located.line(c.offset),
    text: c.message,
  }));
}

// ------------------------------------------------------------- Zod issues in words

/** Zod's own messages start like this; ours (in schema.ts) are already advice. */
const ZOD_DEFAULT = /^(?:Invalid|Too (?:big|small)|Unrecognized)/;

type Issue = z.core.$ZodIssue;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function valueAt(data: unknown, path: readonly PropertyKey[]): unknown {
  let v = data;
  for (const k of path) {
    if (Array.isArray(v) && typeof k === 'number') v = v[k];
    else if (isRecord(v)) v = v[k as string];
    else return undefined;
  }
  return v;
}

/** How a value the owner wrote is quoted back: `"2026-1"`, `2026`, `a list`. */
function shown(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}…` : value);
  if (Array.isArray(value)) return 'a list';
  if (isRecord(value)) return 'a block of fields';
  return String(value);
}

/** The keys an object schema allows at `path` (for "did you mean"), or none. */
export function keysAt(schema: z.ZodType, path: readonly PropertyKey[]): string[] {
  let s: z.core.$ZodType | undefined = schema;
  const unwrap = () => {
    for (let guard = 0; s && guard < 20; guard++) {
      const def = s._zod.def as unknown as Record<string, unknown> & { type: string };
      if (def.type === 'pipe') s = def.in as z.core.$ZodType;
      else if (['optional', 'default', 'prefault', 'nullable', 'readonly', 'catch'].includes(def.type))
        s = def.innerType as z.core.$ZodType;
      else return;
    }
  };
  for (const key of path) {
    unwrap();
    const def = s?._zod.def as unknown as Record<string, unknown> & { type: string };
    if (!def) return [];
    if (def.type === 'object' && typeof key === 'string')
      s = (def.shape as Record<string, z.core.$ZodType>)[key];
    else if (def.type === 'array' && typeof key === 'number') s = def.element as z.core.$ZodType;
    else return [];
  }
  unwrap();
  const def = s?._zod.def as unknown as Record<string, unknown> & { type: string };
  return def?.type === 'object' ? Object.keys(def.shape as object).filter((k) => k !== 'id') : [];
}

/** Edit distance, for "did you mean". */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length]!;
}

const KIND: Record<string, string> = {
  string: 'one line of text',
  number: 'a number such as 2026 (without quotes)',
  boolean: 'true or false',
  array: 'a list: one line per item, each starting with "- "',
  object: 'a block of "name: value" lines, indented under it',
};

/** What is wrong and what to write instead, for one Zod issue (`value` is what was written). */
export function explain(issue: Issue, value: unknown): string {
  const i = issue as unknown as Record<string, unknown> & { code: string; message: string };
  const custom = !ZOD_DEFAULT.test(i.message);
  const wrote = value === undefined ? '' : ` — you wrote ${shown(value)}`;
  if (value === undefined && (i.code === 'invalid_type' || i.code === 'invalid_union'))
    return custom && i.code === 'invalid_union'
      ? `this field is missing. ${i.message}`
      : 'this field is missing — add it';
  if (value === null) return 'this is empty — write the value after the colon, or delete the line';
  switch (i.code) {
    case 'invalid_type': {
      const expected = String(i.expected);
      if (expected === 'string' && (typeof value === 'number' || typeof value === 'boolean'))
        return `should be text, not ${shown(value)} — if ${shown(value)} is what you mean, put it in quotes: "${String(value)}"`;
      return `should be ${KIND[expected] ?? expected}${wrote}`;
    }
    case 'invalid_value': {
      const values = (i.values as unknown[]).map(String);
      if (custom) return `${i.message}${wrote}`;
      return values.length === 1
        ? `must be ${values[0]}${wrote}`
        : `use one of: ${values.join(', ')}${wrote}`;
    }
    case 'invalid_format': {
      if (custom) return `${i.message}${wrote}`;
      if (i.format === 'email') return `should be an email address, e.g. name@example.com${wrote}`;
      if (i.format === 'url')
        return `should be a full web address starting with https://${wrote}`;
      return `is not in the expected form${wrote}`;
    }
    case 'too_big':
    case 'too_small': {
      if (custom) return i.message;
      const big = i.code === 'too_big';
      const limit = Number(big ? i.maximum : i.minimum);
      if (i.origin === 'array') {
        const n = Array.isArray(value) ? value.length : 0;
        return big
          ? `has ${n} items; at most ${limit} are allowed — remove ${n - limit}`
          : `needs at least ${limit} item${limit === 1 ? '' : 's'}`;
      }
      if (i.origin === 'string') {
        const n = typeof value === 'string' ? value.trim().length : 0;
        if (!big && n === 0) return 'this is empty — write the text, or delete the line';
        return big
          ? `is ${n} characters long; at most ${limit} — shorten it`
          : `needs at least ${limit} characters`;
      }
      return `must be ${big ? 'at most' : 'at least'} ${limit}${wrote}`;
    }
    case 'invalid_union': {
      if (custom) {
        // A list with a wrong entry (`draft: [title]` where only `body` can be one): name the
        // choices the deeper branch knows, rather than "you wrote a list".
        const deeper = (i.errors as Issue[][])
          .flat()
          .find((e) => e.code === 'invalid_value' && e.path.length > 0);
        const choices =
          deeper?.code === 'invalid_value' ? ` (here: ${deeper.values.map(String).join(', ')})` : '';
        const scalar = typeof value !== 'object' ? wrote : '';
        return `${i.message}${choices}${scalar}`;
      }
      const branches = (i.errors as Issue[][])
        .map((errs) => (errs[0] ? explain(errs[0], value).replace(/ — you wrote .*$/, '') : ''))
        .filter(Boolean);
      return `${[...new Set(branches)].join('; or ')}${wrote}`;
    }
    case 'invalid_key':
    case 'invalid_element': {
      // A record's key that is not allowed: what was written is the key itself.
      const inner = (i.issues as Issue[] | undefined)?.[0];
      const key = i.code === 'invalid_key' ? (i.path as PropertyKey[]).at(-1) : undefined;
      return inner ? explain(inner, key ?? value) : i.message;
    }
    default:
      return i.message;
  }
}

/** A readable name for an item in a list: its company, school, name … */
function labelOf(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  for (const key of ['company', 'school', 'name', 'title', 'headline', 'address', 'label', 'network', 'code'])
    if (typeof item[key] === 'string' || typeof item[key] === 'number') {
      const label = String(item[key]);
      return label.length > 48 ? `${label.slice(0, 45)}…` : label;
    }
  if (typeof item.from === 'string' && typeof item.to === 'string') return `${item.from} → ${item.to}`;
  return undefined;
}

/** `item 2 (Merit Interactive Co., Ltd) → highlights → item 3`. */
export function placeOf(data: unknown, path: readonly PropertyKey[]): string {
  return path
    .map((key, n) => {
      if (typeof key !== 'number') return String(key);
      const label = labelOf(valueAt(data, path.slice(0, n + 1)));
      return `item ${key + 1}${label ? ` (${label})` : ''}`;
    })
    .join(' → ');
}

/** Problems with one parsed value against its schema; `base` is its path in the document. */
function schemaProblems(
  file: string,
  located: Located,
  schema: z.ZodType,
  data: unknown,
  base: readonly PropertyKey[],
  whole: unknown = data,
): Problem[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  const out: Problem[] = [];
  for (const issue of result.error.issues) {
    const path = issue.path as PropertyKey[];
    const full = [...base, ...path];
    if (issue.code === 'unrecognized_keys') {
      const allowed = keysAt(schema, path);
      for (const key of issue.keys) {
        const near = allowed
          .map((k) => ({ k, d: distance(k.toLowerCase(), key.toLowerCase()) }))
          .filter(({ k, d }) => d <= 2 || (k.length >= 3 && key.toLowerCase().startsWith(k)))
          .sort((a, b) => a.d - b.d)[0];
        const where = placeOf(whole, full);
        out.push({
          file,
          line: lineOf(located, full, key),
          text:
            `${where ? `${where}: ` : ''}"${key}" is not a field here — ` +
            (near ? `did you mean "${near.k}"?` : 'check the spelling') +
            (allowed.length > 0 ? ` (fields here: ${allowed.join(', ')})` : ''),
        });
      }
      continue;
    }
    const where = placeOf(whole, full);
    out.push({
      file,
      line: lineOf(located, full),
      text: `${where ? `${where}: ` : ''}${explain(issue, valueAt(data, path))}`,
    });
  }
  return out;
}

// ------------------------------------------------------------------ the files

function readText(root: string, file: string): string | null {
  const full = join(root, file);
  return existsSync(full) && statSync(full).isFile() ? readFileSync(full, 'utf8') : null;
}

const MISSING = 'the file is missing — the site needs it (restore it with `git checkout -- content/<file>`)';

/** One YAML file of YAML_FILES. */
export function checkYamlFile(root: string, spec: FileSpec): Problem[] {
  const text = readText(root, spec.file);
  if (text === null)
    return [{ file: spec.file, text: MISSING.replace('<file>', spec.file) }];
  const located = locate(text);
  const syntax = syntaxProblems(spec.file, located, text);
  if (syntax.length > 0) return syntax;
  const data: unknown = located.doc.toJS();
  const schema = spec.schema(imageAt(dirname(join(root, spec.file))));
  if (spec.shape === 'list') {
    if (!Array.isArray(data))
      return [
        { file: spec.file, line: 1, text: 'should be a list of items, each starting with "- " (see the guide)' },
      ];
    return data.flatMap((item, n) =>
      isRecord(item)
        ? schemaProblems(spec.file, located, schema, item, [n], data)
        : [{ file: spec.file, line: lineOf(located, [n]), text: `item ${n + 1} should be a block of "name: value" lines` }],
    );
  }
  if (!isRecord(data))
    return [{ file: spec.file, line: 1, text: 'should be a block of "name: value" lines' }];
  return schemaProblems(spec.file, located, schema, data, []);
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** One Markdown file: its frontmatter against `schema`. */
export function checkMarkdownFile(
  root: string,
  file: string,
  schema: (image: () => ImageSchema) => z.ZodType,
  needsFrontmatter: boolean,
): Problem[] {
  const text = readText(root, file);
  if (text === null) return [{ file, text: MISSING.replace('<file>', file) }];
  const match = FRONTMATTER.exec(text);
  if (!match) {
    if (text.startsWith('---'))
      return [{ file, line: 1, text: 'the block at the top opens with "---" but is never closed — add a "---" line after it' }];
    return needsFrontmatter
      ? [{ file, line: 1, text: 'needs its fields at the top, between two "---" lines (copy another project file to start)' }]
      : [];
  }
  const located = locate(match[1]!, 1);
  const syntax = syntaxProblems(file, located, match[1]!);
  if (syntax.length > 0) return syntax;
  const data: unknown = located.doc.toJS() ?? {};
  if (!isRecord(data))
    return [{ file, line: 2, text: 'the block between the "---" lines should be "name: value" lines' }];
  return schemaProblems(file, located, schema(imageAt(dirname(join(root, file)))), data, []);
}

const TWIN = new RegExp(String.raw`\.(?:${TRANSLATED_LOCALES.join('|')})\.md$`);

/** Every schema problem in content/ (`root`), file by file. */
export function checkContentFiles(root: string): Problem[] {
  const problems = YAML_FILES.flatMap((spec) => checkYamlFile(root, spec));
  for (const name of PROSE_FILES) {
    problems.push(...checkMarkdownFile(root, `${name}.md`, () => proseSchema, false));
    for (const l of TRANSLATED_LOCALES)
      if (existsSync(join(root, `${name}.${l}.md`)))
        problems.push(...checkMarkdownFile(root, `${name}.${l}.md`, () => proseTranslationSchema, false));
  }
  const projects = existsSync(join(root, 'projects'))
    ? readdirSync(join(root, 'projects'))
        .filter((f) => extname(f) === '.md')
        .sort()
    : [];
  if (projects.filter((f) => !TWIN.test(f)).length === 0)
    problems.push({ file: 'projects/', text: 'there is no project — the site needs at least one projects/<name>.md' });
  for (const f of projects)
    problems.push(
      ...(TWIN.test(f)
        ? checkMarkdownFile(root, `projects/${f}`, () => projectTranslationSchema, false)
        : checkMarkdownFile(root, `projects/${f}`, (image) => projectSchema(image), true)),
    );
  return problems;
}
