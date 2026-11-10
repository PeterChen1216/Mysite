/**
 * Filling Traditional drafts from Simplified (PLAN-EXPERIENCE §5.4; `pnpm content:hant`). Pure:
 * the conversion function comes in (OpenCC `s2hk` in scripts/content-hant.mjs), so the rules are
 * unit-tested without it.
 *
 * The one rule that matters: a Traditional field that exists is never touched. Only fields the
 * Simplified side has and the Traditional side lacks are added, each converted, recorded with the
 * hash of the Simplified text it was made from, and marked as a draft.
 */
import { META_KEYS, sourceHash, translatedFields, type Block } from './translations.ts';

export type Convert = (text: string) => string;

/** A value with every text converted (a text, or a list of texts). */
export function convertValue<T>(value: T, convert: Convert): T {
  if (typeof value === 'string') return convert(value) as T;
  if (Array.isArray(value))
    return value.map((v: unknown) => (typeof v === 'string' ? convert(v) : v)) as T;
  return value;
}

/**
 * `draft:` after adding `added` fields: `true` stays `true`; a list grows; no draft becomes
 * `true` when the block is new (everything in it is unread), else the list of added fields.
 */
export function addDrafts(
  draft: Block['draft'],
  added: readonly string[],
  newBlock: boolean,
): Block['draft'] {
  if (added.length === 0) return draft;
  if (draft === true || newBlock) return true;
  const list = [...(draft ?? [])];
  for (const f of added) if (!list.includes(f)) list.push(f);
  return list;
}

/**
 * The Traditional block after filling it from the Simplified one: `added` lists the fields it
 * gained; every field it had is returned unchanged, whatever the Simplified side says now.
 * `undefined` when neither has anything to give.
 */
export function fillBlock(
  simplified: Block | undefined,
  traditional: Block | undefined,
  convert: Convert,
): { block: Block | undefined; added: string[] } {
  const added = translatedFields(simplified).filter(
    (f) => traditional?.[f] === undefined && !(META_KEYS as readonly string[]).includes(f),
  );
  if (added.length === 0) return { block: traditional, added };
  const block: Block = { ...(traditional ?? {}) };
  const from: Record<string, string> = {};
  for (const [k, v] of Object.entries(traditional?.from ?? {})) if (v) from[k] = v;
  for (const f of added) {
    block[f] = convertValue(simplified![f], convert);
    from[f] = sourceHash(simplified![f]);
  }
  block.from = from;
  block.draft = addDrafts(traditional?.draft, added, traditional === undefined);
  return { block, added };
}

/**
 * The copy keys (dotted paths) the Traditional copy file lacks, with their converted values and
 * the hashes of the Simplified texts they come from. Keys it has are left alone.
 */
export function missingCopy(
  simplified: ReadonlyMap<string, unknown>,
  traditional: ReadonlyMap<string, unknown>,
  convert: Convert,
): Array<{ path: string; value: unknown; from: string }> {
  return [...simplified]
    .filter(([path]) => !traditional.has(path))
    .map(([path, value]) => ({
      path,
      value: convertValue(value, convert),
      from: sourceHash(value),
    }));
}
