# Fusion Pixel (CJK pixel font)

The pixel face for Chinese headings, labels and terminal text on `/zh-hans/` and `/zh-hant/`
(PLAN-EXPERIENCE §5.5, PLAN §13 ADR-017).

- **Font:** Fusion Pixel 12px Proportional, version 2024.05.12, by TakWolf — the `zh_hans` cut
  (Fontsource package `@fontsource/fusion-pixel-12px-proportional-sc` 5.3.0) for Simplified and
  the `zh_hant` cut (`@fontsource/fusion-pixel-12px-proportional-tc` 5.3.0) for Traditional. This
  release has no Hong Kong cut. Upstream: https://github.com/TakWolf/fusion-pixel-font
- **Licence:** SIL Open Font License 1.1 — [`LICENSE.txt`](LICENSE.txt), exactly as the packages
  ship it. Fusion Pixel includes glyphs from Ark Pixel, Galmuri and the M+ / JF Dot fonts; their
  notices are in the same file. Reserved Font Names: "Fusion Pixel", "Ark Pixel".
- **What this site changes (a Modified Version under OFL §3):** at build time
  (`src/integrations/cjk-fonts.ts`) each cut is subset to the characters on its own locale's page
  and renamed to **zhic Pixel SC** / **zhic Pixel TC**, so no modified file carries a reserved
  name. The copyright, licence text and licence URL records of the font are kept, and the build
  writes this licence next to the served fonts (`_astro/cjk/LICENSE-fusion-pixel.txt`). Nothing
  else is changed. The fonts are self-hosted; the source packages are dev dependencies only.
