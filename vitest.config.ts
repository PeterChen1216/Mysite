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
        // M4: the content check's field pass (pnpm content:check).
        'src/content/check.ts',
        'src/prefs/model.ts',
        'src/prefs/boot.ts',
        'src/i18n/locales.ts',
        'src/i18n/translations.ts',
        'src/i18n/content-files.ts',
        'src/i18n/convert.ts',
        'src/i18n/fallback.ts',
        'src/i18n/routing.ts',
        'src/i18n/han-script.ts',
        'src/i18n/cjk-font.ts',
        'src/i18n/font-names.ts',
        'src/lib/theme-tokens.ts',
        'src/lib/cues.ts',
        'src/lib/mono-art.ts',
        // The hover & interaction catalogue and the tier 2 motion (X3).
        'src/lib/interact.ts',
        'src/lib/regions.ts',
        'src/lib/prompt.ts',
        'src/lib/ambient.ts',
        // M3: the 404's language and home, the windows' geometry and history.
        'src/lib/not-found.ts',
        'src/lib/windows.ts',
        'src/og/layout.ts',
        // The WebGL scene's pure parts (the renderer and GL plumbing are covered by E2E).
        'src/scene/tier.ts',
        'src/scene/math.ts',
        'src/scene/camera.ts',
        'src/scene/geo.ts',
        'src/scene/earth.ts',
        'src/scene/palette.ts',
        'src/scene/atlas.ts',
        'src/scene/world.ts',
        'src/scene/watchdog.ts',
        'src/scene/share.ts',
        'src/scene/airports.ts',
        // M3: stops 4–6 (the minecart, the beam, the live dial).
        'src/scene/path.ts',
        'src/scene/dial.ts',
      ],
      // PLAN §9.1: key utility functions ≥ 80 %, per file so one module can't hide behind others.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80, perFile: true },
    },
  },
});
