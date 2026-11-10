/**
 * Simplified or Traditional (PLAN-EXPERIENCE §5.5 acceptance; risk X-R9): which Han characters
 * belong to only one script, from OpenCC's own character tables (the opencc-data dev dependency,
 * with every alternative a character has — used by tests and `pnpm content:hant`, never by the
 * site). Node only.
 *
 * - Simplified-only: a character OpenCC converts to something else when going Simplified →
 *   Traditional, and that is never itself a Traditional form (发, 后 is not: 後 / 后 both exist;
 *   户 is not: it is Hong Kong's form of 戶).
 * - Traditional-only: a character OpenCC converts when going Traditional → Simplified, and that
 *   is never itself a Simplified form (發, 後, 裏).
 * A page in one script must not contain the other's only-characters, except names on the
 * allow-list (SCRIPT_ALLOW).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/** An OpenCC dictionary file (`a<TAB>b c` lines: a → b, or c; `#` comments) as a map. */
export function readTable(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [from, to = ''] = line.split('\t');
    if (from) map.set(from, to.trim().split(/\s+/).filter(Boolean));
  }
  return map;
}

const require = createRequire(import.meta.url);
const table = (name: string) =>
  readTable(readFileSync(require.resolve(`opencc-data/data/${name}.txt`), 'utf8'));
/** Simplified → its Traditional forms; Traditional → its Simplified forms; Hong Kong variants. */
const st = table('STCharacters');
const ts = table('TSCharacters');
const hk = table('HKVariants');
const values = (m: Map<string, string[]>) => new Set([...m.values()].flat());
const traditionalForms = new Set([...values(st), ...values(hk), ...ts.keys()]);
const simplifiedForms = new Set([...values(ts), ...st.keys()]);

export const isSimplifiedOnly = (c: string): boolean => st.has(c) && !traditionalForms.has(c);
export const isTraditionalOnly = (c: string): boolean => ts.has(c) && !simplifiedForms.has(c);

/**
 * Characters allowed on a page in the other script: names written that way on purpose. Empty
 * today; add a name's characters here (with a comment saying whose name) when one needs it.
 */
export const SCRIPT_ALLOW: Readonly<Record<'zh-hans' | 'zh-hant', string>> = {
  'zh-hans': '',
  'zh-hant': '',
};

/**
 * The characters in `text` that do not belong in `script`: Simplified-only ones in Traditional
 * text (`zh-hant`), Traditional-only ones in Simplified text (`zh-hans`).
 */
export function wrongScript(text: string, script: 'zh-hans' | 'zh-hant'): string[] {
  const wrong = script === 'zh-hant' ? isSimplifiedOnly : isTraditionalOnly;
  const allow = SCRIPT_ALLOW[script];
  return [
    ...new Set(
      [...text].filter((c) => /\p{Script=Han}/u.test(c) && wrong(c) && !allow.includes(c)),
    ),
  ];
}

/**
 * The places where a Simplified character could have become more than one Traditional one, as
 * `并 → 併 (並 併)` lines: what the owner should check in a converted draft (发 → 發 / 髮 …).
 * Character by character, so only for a conversion that kept the text's length (s2hk does).
 */
export function oneToMany(source: string, converted: string): string[] {
  const a = [...source];
  const b = [...converted];
  if (a.length !== b.length) return [];
  const out = new Set<string>();
  a.forEach((c, i) => {
    const targets = st.get(c);
    if (targets && targets.length > 1) out.add(`${c} → ${b[i]} (${targets.join(' ')})`);
  });
  return [...out];
}
