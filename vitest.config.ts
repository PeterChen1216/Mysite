import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Pure modules only; src/lib/content.ts needs astro:content and is covered by E2E.
      include: [
        'src/lib/format.ts',
        'src/lib/paths.ts',
        'src/lib/build-info.ts',
        'src/content/parsers.ts',
        'src/content/schema.ts',
      ],
      // PLAN §9.1: key utility functions ≥ 80 %.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
