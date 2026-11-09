/**
 * YAML parsers for the content loaders so owners never have to write `id:` fields.
 * Pure functions (no `astro:*` imports) so they can be unit-tested.
 *
 * Astro's file() loader swallows exceptions thrown here and only logs a generic line, so every
 * error is also printed to stderr with the file name — that is the message the owner needs.
 */
import { isScalar, parseDocument, visit } from 'yaml';

type Entry = Record<string, unknown>;

function isRecord(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse YAML, rejecting syntax errors and the classic owner trap where ` #` inside an unquoted
 * value starts a comment and silently cuts the text (`why: the #1 seat` → "the").
 * A trailing comment written as `# words` (space after #) stays allowed.
 */
export function parseYaml(text: string): unknown {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw doc.errors[0];
  visit(doc, {
    Pair(_, pair) {
      const node = pair.value;
      if (!isScalar(node) || node.type !== 'PLAIN' || !node.comment || !node.range) return;
      const after = text.slice(node.range[1]);
      if (/^[ \t]+#\S/.test(after)) {
        throw new Error(
          `"${String(node.value)} #${node.comment.trim()}" was cut off at "#" — wrap the whole value in quotes`,
        );
      }
    },
  });
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
