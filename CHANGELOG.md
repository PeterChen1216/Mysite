# Changelog

<!-- Written by `pnpm changelog` (scripts/changelog.mjs) from the Git history after every deploy. Do not edit: the next deploy rewrites this file. -->

What changed on the site, newest first. The site now shows version `v0.1.0+20261110.f9fac4c` in its footer (`v<site.yaml version>+<date>.<commit>` of the last change to `content/`).

## 2026-11-10

### Features

- m4: the content check reads every file the way the build does, in the owner's words (e237276)
- m3: share cards (Open Graph images) per page, locale and theme; layout fixes (f9fac4c)
- m3: floating windows over the page, and scene stops 4–6 (WebGL share ≥ 60 %) (a60c105)
- m3: project pages, the projects directory and the 404, in every locale (250feea)
- x3: the hover & interaction catalogue, the tier 2 ambient layer, chunk-load transitions (7fa2610)
- scene: graphics tiers and the WebGL world for stops 1–3, behind the real page (ccd5295)
- i18n: pixel CJK type — Fusion Pixel subset per locale, renamed, and Chinese type tokens (1b2e533)
- i18n: three locales — routes, content model, drafts and preview states, Simplified drafts, Traditional conversion, staleness report (0450191)
- a11y: the contract's automatable rows — target size, text spacing, text size, lang, hover, tab walk, print (d5fcbea)
- motion: motion levels and pause-all tested; the hero globe turns from the keyboard (faefe28)
- themes: five themes for real — dark objects, redundant cues, art per theme, contrast tests (b5cc67f)
- prefs: the settings window (~/.config), its entry points, pause key and shortcuts (3a7cadc)
- ci: fail on a colour literal outside tokens.css (132a76f)
- projects: dial marks are airport codes — FRA, SEA, SHA (aaae04c)
- projects: the Clock Stamp phone shows the app's real clock face (65b63b7)

### Fixes

- x3: entrances when WebKit reports late; record short states in tests (1bdceeb)
- x3: phone city keys are 24 px targets at any time of day (4ece4bc)
- scene: turning the hero globe while paused redraws the Earth; share measured held, theme test pinned (5d1a308)
- scene: what CI's WebKit and fonts showed; the Earth as the DOM globe draws it; ADR-018 (981351a)
- i18n: layout findings that only CI's fonts showed — CJK dates column, tag spacing in WebKit, CLS test scope (b93f78e)
- x1: the WIP builds again — quoted copy notes, prefs listeners wired, globe finds its spin (3d79d54)
- legacy page loads clean; spelling in site copy (7c3fb3a)

### Other changes

- docs(m3): M3 Windows delivery notes; a size budget for the lazy windows chunk (e19a7dc)
- docs(x3): CI green on 1bdceeb, WebKit included; refreshed sizes (31e9882)
- docs(x3): X3 Interactions delivery notes — row table, verification, what is not done, Figma (10b8c53)
- docs(m2): CI green on 23cb131; the open WebKit question for a real Safari (9fa7190)
- test(scene): a theme change — assert the scene's own colours everywhere, the screen in Chromium (23cb131)
- test(scene): every-theme check without a pinned clock; the paused globe-turn fix has its test (768e421)
- docs(m2): M2 Scene delivery notes; WebKit-proof theme test; tier-3 suite variants in Chromium (cab24cc)
- perf(themes): Mono themes show grey copies of the background art instead of filtering it (6691017)
- docs(x2): X2 Languages summary, ADR-017, translation guide; résumé labels say English; Traditional names itself (0d4065d)
- perf(i18n): Lighthouse for every locale; Chinese pages as fast as English (b46cc93)
- test(i18n): the locale matrix — content, layout and axe for all three locales; languages spec (53ea516)
- test(prefs): the keyboard-only settings test skips WebKit, as the other Tab walks do (9cd2ecf)
- docs(x1): X1 Foundations summary, ADR-015/016, Night pixel check and Lighthouse results (00cb800)
- wip(x1): preferences model, head boot script, motion levels and pause-all — unfinished (ccb78e1)
- refactor(tokens): palette → semantic → component layers; every colour through tokens (6add29a)
- docs: the Traditional Chinese version is the Hong Kong one (owner decision R3-4) (dcac33f)
- docs: Chinese ships in both scripts — Simplified and Traditional (owner decision R3-1) (67214ab)
- docs: experience plan (themes, languages, a11y, hover, WebGL share, mobile) and audit status (500f2f2)
- refactor: tokenise repeated colours and the symbol font, drop dead workarounds (8b82a98)

## 2026-11-09

### Content

- migrate résumé 2026-11-03 (#3) (e6f033c)

### Other changes

- M1: voxel × terminal long page from Figma "Home — Voxel / 1440" (#4) (ab0d892)
- M0: Astro scaffold, content migration, CI and Pages deploy (#2) (ea935de)
