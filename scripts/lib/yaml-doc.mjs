// YAML files edited by scripts (content:hant, content:stale --accept) without reformatting what
// the owner wrote: a file is only written with serializer options under which its unchanged text
// round-trips byte for byte (comments, quotes and flow lists kept); otherwise the script stops.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

/** Serializer options tried in turn; content/ uses both flow-list styles. */
const STYLES = [{ lineWidth: 0 }, { lineWidth: 0, flowCollectionPadding: false }];

/**
 * @param {string} text
 * @returns {import('yaml').ToStringOptions}
 */
export function styleOf(text) {
  for (const style of STYLES) if (parseDocument(text).toString(style) === text) return style;
  throw new Error('cannot be rewritten without reformatting it; edit it by hand');
}

/**
 * Open a YAML file for editing: its document and a save() that writes it in its own style.
 * @param {string} file absolute path
 */
export function openYaml(file) {
  const text = readFileSync(file, 'utf8');
  /** @type {import('yaml').ToStringOptions} */
  let style;
  try {
    style = styleOf(text);
  } catch (error) {
    throw new Error(`${file}: ${/** @type {Error} */ (error).message}`, { cause: error });
  }
  const doc = parseDocument(text);
  return {
    doc,
    /** The document as text, in the file's style. */
    text: () => doc.toString(style),
    save: () => {
      const out = doc.toString(style);
      if (out !== text) writeFileSync(file, out);
      return out !== text;
    },
  };
}

/**
 * A Markdown file's frontmatter as an editable YAML document, and the whole file back.
 * @param {string} text the file
 */
export function frontmatterDoc(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const yaml = m ? `${m[1]}\n` : '';
  const style = yaml ? styleOf(yaml) : STYLES[0];
  const doc = parseDocument(yaml);
  const rest = m ? text.slice(m[0].length) : text;
  return {
    doc,
    /** @returns {string} the file with the edited frontmatter */
    file: () => `---\n${doc.toString(style).replace(/\n$/, '')}\n---\n${rest}`,
  };
}
