// Pure content guards used at build time (no astro:* imports, unit-testable).

/**
 * A complete HTML comment as Markdown (CommonMark 0.31) and HTML read it: `<!-->` and `<!--->`
 * are empty comments, anything else runs to the first `-->`. scripts/check-content.mjs uses the
 * same pattern.
 */
const COMMENT = /<!--(?:-?>|[\s\S]*?-->)/g;

/** Text with its HTML comments removed. */
export function stripComments(text: string): string {
  return text.replace(COMMENT, '');
}

/**
 * An unclosed `<!--` in Markdown swallows everything after it in the rendered HTML while the
 * build stays green, so treat it as a build error.
 */
export function assertCommentsClosed(body: string | undefined, file: string): void {
  if (body && stripComments(body).includes('<!--')) {
    throw new Error(`${file}: "<!--" is never closed with "-->" — it would hide the rest of the page`);
  }
}
