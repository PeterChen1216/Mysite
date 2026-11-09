// Pure content guards used at build time (no astro:* imports, unit-testable).

/**
 * An unclosed `<!--` in Markdown swallows everything after it in the rendered HTML while the
 * build stays green, so treat it as a build error.
 */
export function assertCommentsClosed(body: string | undefined, file: string): void {
  if (!body) return;
  const open = body.lastIndexOf('<!--');
  if (open !== -1 && body.indexOf('-->', open + 4) === -1) {
    throw new Error(`${file}: "<!--" is never closed with "-->" — it would hide the rest of the page`);
  }
}
