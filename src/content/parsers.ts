/**
 * YAML parsers for the content loaders so owners never have to write `id:` fields.
 * Pure functions (no `astro:*` imports) so they can be unit-tested.
 *
 * Astro's file() loader swallows exceptions thrown here and only logs a generic line, so every
 * error is also printed to stderr with the file name — that is the message the owner needs.
 */
import { isScalar, parseDocument, visit, type Document } from 'yaml';
import { copyKeyDiff, copyLeaves } from '../i18n/translations.ts';

type Entry = Record<string, unknown>;

function isRecord(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A value that a ` #` cut short: where it starts in the text, and what the owner wrote. */
export interface CutValue {
  offset: number;
  message: string;
}

/**
 * The classic owner trap: ` #` inside an unquoted value starts a comment and silently cuts the
 * text (`why: the #1 seat` → "the"). A trailing comment written as `# words` (space after #) stays
 * allowed. Shared by parseYaml (the build) and the content check (which adds the line).
 */
export function cutValues(doc: Document, text: string): CutValue[] {
  const cut: CutValue[] = [];
  visit(doc, {
    Pair(_, pair) {
      const node = pair.value;
      if (!isScalar(node) || node.type !== 'PLAIN' || !node.comment || !node.range) return;
      if (/^[ \t]+#\S/.test(text.slice(node.range[1]))) {
        cut.push({
          offset: node.range[0],
          message: `"${String(node.value)} #${node.comment.trim()}" was cut off at "#" — wrap the whole value in quotes`,
        });
      }
    },
  });
  return cut;
}

/** Parse YAML, rejecting syntax errors and values cut short by ` #` (cutValues). */
export function parseYaml(text: string): unknown {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw doc.errors[0];
  const [cut] = cutValues(doc, text);
  if (cut) throw new Error(cut.message);
  return doc.toJS();
}

function reported<T>(file: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    console.error(`✖ content/${file}: ${(error as Error).message}`);
    throw error;
  }
}

/** A YAML file holding one object (e.g. profile.yaml) → a single entry with a fixed id. */
export function singleton(id: string, file = `${id}.yaml`) {
  return (text: string): Entry[] =>
    reported(file, () => {
      const data = parseYaml(text);
      if (!isRecord(data)) throw new Error('expected key: value pairs at the top level');
      return [{ ...data, id }];
    });
}

/** A YAML file holding a list (e.g. experience.yaml) → entries with ids "1", "2", … in file order. */
export function list(file: string) {
  return (text: string): Entry[] =>
    reported(file, () => {
      const data = parseYaml(text);
      if (!Array.isArray(data)) throw new Error('expected a list (lines starting with "- ")');
      return data.map((item: unknown, index) => {
        if (!isRecord(item)) throw new Error(`item ${index + 1} must be key: value pairs`);
        return { ...item, id: String(item.id ?? index + 1) };
      });
    });
}

/**
 * A translated copy file (copy.zh-hans.yaml): one object with exactly the keys of copy.yaml —
 * a missing key fails the build (no silent English), so does a key copy.yaml lacks — plus its
 * `from:` and `draft:`, which may only name keys of copy.yaml. `english` gives copy.yaml parsed.
 */
export function translatedCopy(file: string, english: () => unknown) {
  return (text: string): Entry[] =>
    reported(file, () => {
      const data = parseYaml(text);
      if (!isRecord(data)) throw new Error('expected key: value pairs at the top level');
      const en = english();
      const { missing, extra } = copyKeyDiff(en, data);
      if (missing.length > 0)
        throw new Error(`missing keys (translate each one; nothing falls back to English): ${missing.join(', ')}`);
      if (extra.length > 0) throw new Error(`keys that copy.yaml does not have: ${extra.join(', ')}`);
      const keys = [...copyLeaves(en).keys()];
      const known = (k: string) => keys.some((key) => key === k || key.startsWith(`${k}.`));
      const from = isRecord(data.from) ? Object.keys(data.from) : [];
      const draft = Array.isArray(data.draft) ? data.draft.map(String) : [];
      const unknown = [...from.filter((k) => !keys.includes(k)), ...draft.filter((k) => !known(k))];
      if (unknown.length > 0)
        throw new Error(`\`from:\` / \`draft:\` name keys that copy.yaml does not have: ${unknown.join(', ')}`);
      return [{ ...data, id: 'copy' }];
    });
}
