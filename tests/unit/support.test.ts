import { describe, expect, it } from 'vitest';
import { hasWordBullet } from '../e2e/now';

describe('now.md E2E expectation', () => {
  it('requires ticker items only for list items that start with a word', () => {
    for (const md of [
      '- Shipping Clock Stamp 1.2',
      '* TA for INFO 180',
      '+ plus',
      '1. numbered',
      '2) numbered',
      '- [x] Done',
      '- [ ] To do',
      '  - nested',
      'A paragraph\n- Item',
      '- 2026 plans',
      '- 東京 trip',
    ])
      expect(hasWordBullet(md), md).toBe(true);
    for (const md of [
      '',
      '# Now',
      '- ',
      '-',
      '- ![](https://zhic.me/x.png)',
      '[cs]: https://apps.apple.com/app/id1',
      '- #',
      '- # Heading',
      '- **bold** start',
      '- [Link](https://x.y) start',
      '<!-- - commented out -->',
      '    - indented code',
      '> - quoted',
      '-no space',
    ])
      expect(hasWordBullet(md), md).toBe(false);
  });
});
