/**
 * YAML parsers for Astro's `file()` loader so owners never have to write `id:` fields.
 * Pure functions (no `astro:*` imports) so they can be unit-tested.
 */
import { parse } from 'yaml';

type Entry = Record<string, unknown>;

function isRecord(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A YAML file holding one object (e.g. profile.yaml) → a single entry with a fixed id. */
export function singleton(id: string) {
  return (text: string): Entry[] => {
    const data: unknown = parse(text);
    if (!isRecord(data)) {
      throw new Error(`Expected a YAML mapping (key: value pairs) for "${id}"`);
    }
    return [{ ...data, id }];
  };
}

/** A YAML file holding a list (e.g. experience.yaml) → entries with ids "1", "2", … in file order. */
export function list(name: string) {
  return (text: string): Entry[] => {
    const data: unknown = parse(text);
    if (!Array.isArray(data)) {
      throw new Error(`Expected a YAML list (lines starting with "- ") in ${name}`);
    }
    return data.map((item: unknown, index) => {
      if (!isRecord(item)) {
        throw new Error(`Item ${index + 1} in ${name} must be a mapping (key: value pairs)`);
      }
      return { ...item, id: String(item.id ?? index + 1) };
    });
  };
}
