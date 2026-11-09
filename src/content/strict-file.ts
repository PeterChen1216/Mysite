/**
 * A stricter `file()` loader. Astro's built-in one only *logs* when a file is missing or fails to
 * parse, and keeps whatever entries were cached from the previous build. This wrapper:
 *   - fails the build when the file does not exist,
 *   - clears cached entries first, so stale data can never render,
 *   - fails the build when parsing produced no entries.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { file } from 'astro/loaders';

type Parser = NonNullable<Parameters<typeof file>[1]>['parser'];

export function strictFile(path: string, parser: Parser): Loader {
  const inner = file(path, { parser });
  return {
    name: 'strict-file',
    load: async (context) => {
      const absolute = fileURLToPath(new URL(path, context.config.root));
      if (!existsSync(absolute)) throw new Error(`✖ ${path} is missing`);
      context.store.clear();
      await inner.load(context);
      if (context.store.keys().length === 0) {
        throw new Error(`✖ ${path} could not be read — see the error printed above`);
      }
    },
  };
}
