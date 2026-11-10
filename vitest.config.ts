import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Pure modules only; src/lib/content.ts and page-data.ts need astro:content and are
      // covered by E2E.
      include: [
        'src/lib/format.ts',
        'src/lib/paths.ts',
        'src/lib/build-info.ts',
        'src/lib/derive.ts',
        'src/lib/world-clock.ts',
        'src/components/sections/projects-view.ts',
        'src/motion/params.ts',
        'src/content/parsers.ts',
        'src/content/guards.ts',
        'src/content/schema.ts',
        'src/prefs/model.ts',
        'src/prefs/boot.ts',
        'src/i18n/locales.ts',
        'src/lib/theme-tokens.ts',
        'src/lib/cues.ts',
      ],
      // PLAN §9.1: key utility functions ≥ 80 %, per file so one module can't hide behind others.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80, perFile: true },
    },
  },
});
