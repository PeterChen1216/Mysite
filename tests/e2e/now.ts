// now.md expectations shared by the E2E suite and its unit tests (tests/unit/support.test.ts).
import { stripComments } from '../../src/content/guards';

/**
 * True when now.md has a list item that starts with a word (a letter or digit, after an
 * optional task box). Such an item always reaches the ticker. A heading, a link definition, an
 * empty item or one that starts with markup may give no ticker line, so only the former is
 * required to show up.
 */
export function hasWordBullet(markdown: string): boolean {
  return /^[ \t]{0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?[\p{L}\p{N}]/mu.test(
    stripComments(markdown),
  );
}
