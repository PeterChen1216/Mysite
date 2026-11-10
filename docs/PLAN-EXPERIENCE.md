# zhic.me v2 — Experience plan: graphics, themes, languages, accessibility, hover, mobile

> Status: v0.1 draft · 2026-11-10 · extends [`PLAN.md`](PLAN.md) (charter, still authoritative for scope, guardrails and M0–M5) · owner decisions go to [`DECISIONS.md`](DECISIONS.md)
> Written after M1 shipped to `/v2/`. Owner feedback that triggered it: *more dynamic graphics and a larger WebGL share; themes (more languages, black/white, colour-blind, more accessibility); more hover design; a real plan for mobile.*
>
> Everything here obeys PLAN §2.4: no invented facts, no paid or closed assets, no heavy trackers, WebGL is never the only way to read content.

## 0. Summary

| # | Workstream | What it adds | First milestone |
|---|---|---|---|
| A | Preferences & tokens | One settings surface (theme, motion, language, text size); every colour through tokens | **X1** |
| B | Themes | Night (default), Day, Mono dark, Mono light, Colour-blind-safe; honours OS contrast settings | **X1** |
| C | Accessibility programme | WCAG 2.2 AA as a tested contract, plus pause-all, 200 % zoom, print | **X1** → every milestone |
| D | Languages | English + Chinese in **both scripts** (简体 and 繁體); structure ready for more | **X2** |
| E | Hover & interaction catalogue | A designed, consistent response for every interactive thing, with touch and keyboard twins | **X3** |
| F | Dynamic graphics / WebGL | Graphics tiers, one shared renderer, a stated share of the page that is live | **M2** (re-scoped) |
| G | Mobile build | Hotbar navigation, touch-first interactions, mobile graphics tiers, device matrix | **X4** |

Order: **X1 → X2 → M2 → X3 → M3 → X4 → M4 → M5** (§9). X1 comes first because themes, languages and motion preferences change every component; building the scene before them means building it twice.

---

## 1. Bounds

### 1.1 In scope
- The seven workstreams above, on the existing stack (Astro static, vanilla TS islands, GitHub Pages).
- Design in Figma first for anything visual (PLAN §15.7 "Figma is the contract"): theme tiles, hover storyboard, mobile frames.

### 1.2 Out of scope (unchanged from PLAN §1.4 unless noted)
- Server-side anything, accounts, comments, a CMS UI.
- Machine-translated content shipped without the owner reading it (§5.4).
- Per-visitor personalisation beyond the saved preferences in §2.
- A native app or an installable PWA (re-evaluate after X4; §8.7).

### 1.3 Budgets (tests, not aspirations — each becomes a CI check)
| Budget | Limit | Today (M1) |
|---|---|---|
| First-screen JS, gz | ≤ 180 KB | 2.7 KB |
| Lazy scene chunk, gz (WebGL) | ≤ 250 KB | — |
| CSS, gz (all themes included) | ≤ 45 KB (was 30) | 10.7 KB |
| Fonts, Latin, first screen | ≤ 150 KB | 111 KB |
| Fonts, CJK, per language, lazy | ≤ 160 KB (subset to used glyphs) | — |
| Mobile LCP (slow 4G) | ≤ 2.5 s | ≈ 0.8 s |
| CLS | ≤ 0.05 in every theme and language | 0 |
| Main-thread work per frame while animating | ≤ 8 ms desktop, ≤ 12 ms mobile | n/a |
| Live canvases at once | 1 WebGL + 1 2D overlay | 1 2D |
| Battery: nothing animates off screen or in a hidden tab | hard rule | holds |

### 1.4 Guardrails specific to this plan
1. **A preference is never a gate.** Any theme × language × motion level shows the same facts.
2. **Colour is never the only signal** (WCAG 1.4.1): status, tone and category always have a shape, glyph or word too. This is what makes the Mono and colour-blind themes possible.
3. **Hover is never the only way** (WCAG 2.1.1, 1.4.13): every hover effect has a focus twin and a touch twin, or it is pure decoration.
4. **Motion is opt-out at three levels**: OS setting, site switch, and per-loop pause when off screen.
5. **One renderer.** Sections do not create their own WebGL contexts (mobile browsers cap them, and each costs memory).

---

## 2. Workstream A — preferences & tokens

### 2.1 The settings surface
A terminal window, `~/.config` (opened from a key in the nav, from `prefs` in the footer, and by pressing `,`):

```
$ theme --set night|day|mono-dark|mono-light|cvd        [auto follows the OS]
$ motion --set full|calm|off                             [auto follows the OS]
$ lang --set en|zh-hans|zh-hant                          [auto follows the browser]
$ text --size 100|115|130
$ reset
```
It is a normal form underneath (radio groups, labelled, keyboard-operable); the command lines are its visual skin. Each row shows the current value and applies immediately.

### 2.2 Storage and first paint
- Stored in `localStorage` as one JSON value (`zhic:prefs:v1`); nothing is sent anywhere.
- Applied by the inline `<head>` script that already sets `html.motion`, before first paint: `data-theme`, `data-motion`, `lang`, `--text-scale`. No flash of the wrong theme, no layout shift.
- "auto" is the default for all four and means *follow the OS / browser*: `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, `prefers-reduced-motion`, `navigator.languages`.
- Without JavaScript the page is Night, English, static, exactly as today (plus the CSS-only media queries below).

### 2.3 Tokens (groundwork done on 2026-11-10)
- `src/styles/tokens.css` is the only place a colour value may appear. Done in this pass: semantic tokens for the colours that were hard-coded in several components, the symbol font stack, and particles reading tokens at run time.
- Still to move (X1): the Minecraft button palette, terminal traffic lights, shadows and glows (`rgb(0 0 0 / .6)`, `rgb(57 255 20 / .8)` …), `theme-color` meta, and the voxel block art (§3.4).
- New CI check: a lint rule that fails on a colour literal outside `tokens.css` (allow-list: SVG art, `transparent`, `currentColor`).
- Token layers: **palette** (raw values per theme) → **semantic** (`--color-text-hi`, `--color-surface-panel`, `--color-status-ok` …) → **component** (only where a component truly differs). Components use semantic tokens only.

**Acceptance (A):** preferences survive reload; first paint already has them (no flash, CLS 0); `axe` clean with the settings window open; works with keyboard only; the lint rule is in CI and green.

---

## 3. Workstream B — themes

### 3.1 The set
| Theme | For | Character |
|---|---|---|
| **Night** (default) | everyone; the design as shipped | navy void, neon accents |
| **Day** ("Overworld") | bright rooms, print-like reading | warm paper ground, white panels; **terminals stay dark** (a terminal is a dark object) |
| **Mono dark** | black/white preference, OLED, low-stimulus | pure black, white ink, greys; tone by pattern and weight |
| **Mono light** ("Paper") | black/white preference, e-ink, printing | white, black ink |
| **Colour-blind safe** | protan/deutan/tritan viewers | Night with accents remapped to the Okabe–Ito set |
| *(automatic)* High contrast | `prefers-contrast: more`, Windows `forced-colors` | system colours, borders on everything, no shadows-as-borders |

### 3.2 Proposed palettes (contrast computed, WCAG relative luminance; AA needs 4.5)
| Token | Night | Day | Mono dark | Mono light | CVD-safe |
|---|---|---|---|---|---|
| bg / panel | `#0b0f1a` / `#12172a` | `#f3efe4` / `#fffdf6` | `#000` / `#0e0e0e` | `#fff` / `#f4f4f4` | as Night |
| text hi | `#e6edf3` 16.2 | `#161b22` 15.1 | `#fff` 21 | `#000` 21 | as Night |
| text mid | `#8b949e` 6.2 | `#4b5563` 6.6 | `#b4b4b4` 10.1 | `#454545` 9.6 | as Night |
| ok / "terminal green" | `#39ff14` 14.1 | `#11730a` 5.3 | `#fff` | `#000` | `#00c896` 8.8 |
| info / "diamond" | `#4aedd9` 13.1 | `#0a6f69` 5.2 | `#e0e0e0` 15.9 | `#1f1f1f` 16.5 | `#56b4e9` 8.3 |
| highlight / "gold" | `#fcdb05` 13.9 | `#7a5c00` 5.4 | `#fff` | `#000` | `#f0e442` 14.5 |
| special / "enchant" (text) | `#b866f5` 5.7 | `#7422c4` 6.6 | `#cfcfcf` 13.5 | `#2b2b2b` 14.2 | `#cc79a7` 6.3 |
| alert / "redstone" | `#ff5555` 6.1 | `#b3261e` 5.7 | `#fff` | `#000` | `#ff7a1a` 7.3 |
| link | diamond 13.1 | `#0a5fa8` 5.7 | `#fff` + underline | `#000` + underline | `#56b4e9` 8.3 |

Ratios are against that theme's page background; every one also passes on its panel colour (lowest: Day "diamond" 5.2). In Day the dark terminals keep the Night accents (lowest 5.5 on `#10151c`). These are **proposals to be set in Figma first** (new variable modes on the `Voxel` collection), then synced to `tokens.css`.

### 3.3 Rules that make Mono and CVD work
- Ticker tags, chips, commit nodes and status words differ by **glyph/shape as well as hue**: `[XP]` ◆, `[NOW]` ▶, `[WORK]` ■ …; commit nodes square / diamond / ring; hands on the Clock Stamp dial get different line patterns (solid, dashed, dotted) in Mono.
- Links in running text are underlined in every theme (already true).
- Focus ring: 2 px gold in Night; in other themes the highest-contrast token; always ≥ 3:1 against both neighbours (WCAG 2.4.11/1.4.11).
- CVD check is part of design review: every palette is viewed through protanopia, deuteranopia and tritanopia simulation (Figma plugin or Chrome DevTools "Emulate vision deficiencies") and through greyscale; adjacent categories must stay distinguishable in all four.

### 3.4 Art in themes
- **Voxel blocks** (11 SVGs with baked colours): keep their colours in Night/Day/CVD (they are pictures, not UI). In Mono they render through one CSS filter (`grayscale(1) contrast(1.15)`); no second art set.
- **Globe**: land/ocean/ice read tokens (`--color-block-*`); Mono uses white land on black ocean (and the reverse).
- **Photo** (avatar): unchanged; Mono applies `grayscale(1)`.
- **WebGL scene**: reads a small theme object built from tokens (sky, fog, glow, land, water, accent ×3) and re-reads it on a theme change — no shader rebuild, uniforms only.
- **CRT filter** (scanlines, vignette): Night only by default; off in Day, Mono light and High contrast.

### 3.5 Tests
- Unit: a table-driven test computes the contrast of every (text token × surface token) pair per theme and fails under 4.5 (3.0 for large text and UI boundaries).
- E2E: `axe` runs once per theme; screenshot baselines at 390 and 1440 per theme; a test that toggling OS `prefers-color-scheme` under "auto" switches theme without reload.
- Lighthouse runs on Night and Day.

**Acceptance (B):** five themes selectable and remembered; "auto" follows OS light/dark and contrast; zero `axe` serious/critical in each; no colour literal outside tokens; Windows High Contrast shows every control with a visible boundary; printing (§4.5) uses Mono light regardless of the chosen theme.

---

## 4. Workstream C — accessibility programme

Target: **WCAG 2.2 AA**, verified by tests where a test can verify it and by a scripted manual pass where it cannot. M1 already passes automated checks; this makes the rest explicit.

### 4.1 Contract (each line has a test or a manual script)
| Area | Requirement | How verified |
|---|---|---|
| Keyboard | Everything operable; visible focus; logical order; no trap; shortcuts are single keys only when focus is not in a field, and can be turned off (2.1.4) | E2E tab walk; manual |
| Motion | `motion: full / calm / off`. *calm* = no parallax, no particles, no intro, loops slowed; *off* = static. A **pause-all** key (`⏸` in the nav, `Space` when the page body has focus) stops every loop (2.2.2) | E2E counts running animations per level |
| Zoom & reflow | 200 % text zoom and 400 % page zoom (320 px) without loss or two-way scrolling (1.4.4, 1.4.10); text-spacing overrides don't clip (1.4.12) | existing "no text cut off" suite, extended with a text-spacing run |
| Target size | Every pointer target ≥ 24 × 24 px, primary actions ≥ 44 × 44 on touch (2.5.8) | E2E measures boxes |
| Contrast | Text 4.5, large text and UI 3.0, in every theme | §3.5 |
| Screen readers | Landmarks, one `h1`, heading order, names for every control, decorative art hidden, live regions only where needed (the ticker is not live) | `axe` + a VoiceOver and an NVDA script, recorded per release |
| Language | `lang` on `<html>` and on any run in another language (3.1.1, 3.1.2) | E2E |
| Hover content | Dismissible, hoverable, persistent (1.4.13) | E2E on tooltips |
| Reduced transparency / data | `prefers-reduced-transparency` removes translucency; `prefers-reduced-data` (and `Save-Data`) skips the scene and web fonts beyond the first | E2E with emulation where supported |
| Timing | No time limits; nothing flashes more than 3 times a second (2.3.1) — the intro "name flash" from the scene plan must be checked against this | manual, frame count |
| Drag | Every drag has a click/keyboard alternative (2.5.7): globe (arrow keys turn it), windows (arrow keys move, in M3) | E2E |

### 4.2 The scripted manual pass (one page, `docs/A11Y-CHECK.md`, written in X1)
Ten minutes, run before each launch-affecting merge: keyboard-only tour; VoiceOver rotor headings and links; 200 % zoom; Windows High Contrast screenshot; reduced motion; each theme glance; phone screen reader on the hotbar.

### 4.3 Cognitive load
- The terminal conceit must not hide meaning: every command-styled label has a plain accessible name (already the pattern: `$ cat ~/about.md` is `aria-hidden`, the heading says what it is).
- A "plain" reading mode (`?plain=1`, PLAN §4.1) remains: no decoration, system fonts, same facts. It doubles as the print and reduced-data view.

### 4.4 Sound
None by default. If block sounds are ever added (PLAN §"micro-interactions"), they are off until switched on, never autoplay, and have a visible mute.

### 4.5 Print
`@media print`: Mono light, no backgrounds, links show their URL, sections avoid page breaks inside cards, the phone/scene/ticker are hidden. Goal: Ctrl-P gives a usable two-page summary that does not contradict `resume.pdf`.

**Acceptance (C):** the contract table is green in CI for the automated rows; `docs/A11Y-CHECK.md` exists and has been run once with results recorded in STATUS.

---

## 5. Workstream D — languages

### 5.1 Decided (owner, 2026-11-10 — DECISIONS R3-1)
**English (default) + Chinese in both scripts: Simplified (`zh-Hans`, 简体中文) and Traditional (`zh-Hant`, 繁體中文).** Three locales ship in X2. The structure stays ready for a fourth (日本語 is the natural next: the pixel font below has a Japanese cut). This replaces "English only for v2" in PLAN §1.4 / §5.4.

### 5.2 Architecture (static, no client-side translation)
- Routes: `/` (en), `/zh-hans/`, `/zh-hant/` — named by **script**, not region (`zh-cn` / `zh-tw` would wrongly tell a Singapore or Hong Kong reader the page is not for them). `lang` attributes are `zh-Hans` and `zh-Hant`. Astro i18n routing with `prefixDefaultLocale: false`; each page statically generated per locale. `/zh/` is not a page: it is listed nowhere and, if requested, 404s like any unknown path.
- `<link rel="alternate" hreflang>` pairs + `x-default`; `og:locale`; canonical per locale.
- The language choice in settings is three links (English · 简体中文 · 繁體中文), each to the same section on that locale (works without JS), each written in its own language with its own `lang`. "auto" only *suggests* on first visit (a dismissible one-line banner), it never redirects (redirects break sharing and crawlers). Mapping for the suggestion, from `navigator.languages` in order: `zh-Hant*`, `zh-TW`, `zh-HK`, `zh-MO` → Traditional; `zh-Hans*`, `zh-CN`, `zh-SG`, `zh-MY`, bare `zh` → Simplified.

### 5.3 Content model
| Kind | Where | Rule |
|---|---|---|
| Interface copy | `content/copy.yaml` → `content/copy.zh-hans.yaml`, `content/copy.zh-hant.yaml` | same keys, schema-checked; a missing key fails the build (no silent English) |
| Facts with no language (dates, GPA, URLs, stack names, IATA codes) | unchanged, single source | never duplicated |
| Facts with language (role titles, highlights, project bullets, about.md) | `zh-hans:` and `zh-hant:` siblings next to the English field, or `about.zh-hans.md` / `about.zh-hant.md` | **optional per field and per script**; a missing translation falls back to English, marked `lang="en"` so screen readers pronounce it correctly |
| Proper nouns (company, school, product names) | keep the official name; add the official local name only if one exists | owner decides per name |
| Résumé PDF | English only unless the owner supplies a second PDF | the button label says so |

### 5.4 Who writes the Chinese, and how the two scripts stay in step
- **Simplified is the source**, written or approved by the owner. Claude may draft, but a draft is committed with `draft: true` on the field and the content guard blocks it from `main` exactly like `TODO:` (PLAN §7.5). No machine translation reaches the live site unread.
- **Traditional is derived, then owned.** A script (`pnpm content:hant`, build-time only, OpenCC data as a dev dependency) converts every Simplified field that has no Traditional sibling and writes the result into the content files as `draft: true`. It converts **script only** (OpenCC `s2t`): characters change, wording does not, so it never rewrites 软件 into 軟體 or picks Taiwan over Hong Kong usage on the owner's behalf. The owner then reads it, fixes the handful of one-to-many characters a converter can get wrong (发 → 發 / 髮, 后 → 後 / 后, 干 → 乾 / 幹 / 干, 面 → 麵 / 面 …), adjusts wording if a regional flavour is wanted, and removes `draft`. From then on that Traditional text is hand-owned: the script never overwrites a field that exists.
- **Staleness is reported, not hidden.** Each translated field records the hash of the text it was made from. When the English changes, both Chinese fields are listed in a CI report; when the Simplified changes, its Traditional sibling is. A stale translation still shows (it is the owner's approved text) until updated; a missing one falls back to English with `lang="en"`.
- Proper nouns follow each script's own official form where one exists (華盛頓大學 / 华盛顿大学), otherwise stay in English — owner decides per name (Q-L2).

### 5.5 Type
- Pixel CJK: **Fusion Pixel** (SIL OFL; 12 px grid) for headings, labels and terminal text — its `zh_hans` cut on `/zh-hans/` and its `zh_hant` cut on `/zh-hant/`, never one for both: the same code point is drawn differently in each tradition (骨, 直, 门/門 radicals), and the wrong cut reads as a foreign font. Body in a system CJK sans for reading comfort: `PingFang SC`, `Noto Sans SC`, `Microsoft YaHei` for Simplified; `PingFang TC`, `Noto Sans TC`, `Microsoft JhengHei` for Traditional. The `lang` attribute must be exact so browsers pick the right glyph forms in fallback fonts too.
- Subset at build time to the glyphs actually used on the page (a script walks the built HTML per locale); budget ≤ 160 KB **per script**; each loaded only on its own locale.
- Line-height and tracking tokens get a per-locale override (CJK needs looser leading, no letter-spacing, no `text-transform: uppercase`).
- Layout tests (text not cut off, 10 widths) run per locale: Chinese strings are shorter but taller, and Traditional glyphs are denser at small pixel sizes (legibility check at 12 px in the manual pass); German-length strings are the stress case if a Latin language comes later.

**Acceptance (D):** `/zh-hans/` and `/zh-hant/` build from content with zero untranslated interface strings; untranslated facts are English with `lang="en"`; no Simplified-only character appears on `/zh-hant/` and no Traditional-only one on `/zh-hans/` (a test checks every Han character on each page against the other script's conversion table, with an allow-list for names); hreflang validates for all three locales + `x-default`; CLS ≤ 0.05 on both; font payload within budget; every E2E content test runs for both locales.

---

## 6. Workstream E — hover & interaction catalogue

Principle: the world reacts when touched, the same way everywhere. Each row is one designed behaviour with its three inputs. Timings live in `src/motion/params.ts` (PLAN §9.3); `calm` drops the motion and keeps the state change; `off` keeps only the state change.

| # | Element | Pointer (hover) | Keyboard (focus) | Touch | Effect | Budget |
|---|---|---|---|---|---|---|
| 1 | Voxel block (decor) | enter | — (decor) | tap | "punch": 2-frame squash, burst of particles **in the block's own colours**, block bobs back | 16 particles, 350 ms |
| 2 | Card | enter / move | focus-within | press | lifts 4 px on a harder shadow; edge takes the accent of its section; a faint grid spotlight follows the pointer inside | CSS only |
| 3 | Inventory slot (skills, coursework) | enter | focus (slots become a roving-tabindex list) | tap | enchant glint sweeps across; item tooltip rises with the group name and count | 1 tooltip at a time |
| 4 | Globe | enter / drag | arrow keys turn, `Home` resets | drag | slows, shows a lat/lon crosshair and the name of the region under the pointer; watched routes brighten | reuse globe loop |
| 5 | Route (AvGeek) | enter | focus | tap | the route draws itself on the globe, the plane runs it once, the "why" line types out | 1 route at a time |
| 6 | Commit row (git log) | enter | focus | tap | node pulses, rail segment lights to the next commit, hash turns into `git show <hash>`, highlights unfold if collapsed (mobile) | CSS + 1 class |
| 7 | Ticker | enter | focus | touch-hold | pauses (exists); the item under the pointer brightens | exists |
| 8 | Nav link | enter | focus | — | a pixel underline slides from the previous link; current section marker is a block cursor | CSS |
| 9 | MC button | enter | focus | press | exists (blue/yellow, 3 steps); add a 2 px press-down on `:active` for every kind | exists |
| 10 | Player card | enter | focus | tap | photo swap (exists) + XP bar fills + name tag shows the handle with a copy action | exists + 1 |
| 11 | Clock Stamp phone | enter a hand | Tab through cities | tap a hand | that city becomes the selected one: name, offset, big time and date switch to it; other hands dim | DOM only |
| 12 | Terminal window | click prompt | focus prompt | tap | becomes a tiny real prompt: `help`, `whoami`, `ls`, `open resume`, `theme mono` … (an easter egg with a real accessible form control) | lazy 3 KB |
| 13 | External link | enter | focus | — | arrow `↗` hops one pixel up-right; status line at the bottom of the window shows the destination host | CSS |
| 14 | Section header | scroll into view | — | — | the `$ command` types once, then the heading resolves (already the intro language; extend to every section, once per visit) | IntersectionObserver |
| 15 | Cursor | — | — | — | desktop only: a pixel crosshair over the scene and blocks, the normal cursor over text and controls (never hide the system cursor on text) | CSS `cursor: url()` |
| 16 | Footer "back to spawn" | enter | focus | tap | a block falls and the page scrolls up behind it (smooth-scroll, instant under `calm/off`) | exists + 1 |

Rules for all rows:
- Tooltips follow WCAG 1.4.13: stay while hovered, `Esc` dismisses, never cover the thing that triggered them.
- Hover styles are wrapped in `@media (hover: hover)` so touch devices never get "sticky hover".
- Nothing here changes layout (transform / opacity / colour only) → CLS stays 0.
- Each behaviour is drawn in Figma as a two-state component with a smart-animate hover, like `MCButton` and `HoverParticleCard` already are (page *Home — Voxel* → *✨ Motion & Interactions*), before it is coded.

**Acceptance (E):** all 16 rows implemented or explicitly deferred in STATUS; each has an E2E test for its keyboard twin; particles capped at 60 alive; frame budget holds on the reference laptop; `axe` clean with a tooltip open.

---

## 7. Workstream F — dynamic graphics and the WebGL share

### 7.1 Where the page is live today
Hero globe (CSS strip), orbit rings, intro sequence, ticker, hover particles (2D canvas), Clock Stamp phone (live DOM clock), AvGeek mini globe. No WebGL. Roughly **the first screen and two small islands** move; the other ~5,000 px are still.

### 7.2 Target: a stated share, by tier
"WebGL proportion" is defined as *the share of the page's scroll length during which a WebGL-rendered element is in view*.

| Tier | Who gets it | Live graphics | WebGL share |
|---|---|---|---|
| **0 — static** | no JS, `motion: off`, reduced-data, print | none; the built page | 0 % |
| **1 — CSS/DOM** | reduced motion (`calm`), low-end devices, any WebGL failure | today's M1 set, loops slowed | 0 % |
| **2 — canvas** | phones and tablets that pass the capability check | Tier 1 + 2D-canvas ambient layer (parallax star field, motes, section "chunk load" transitions) | 0 % (2D only) |
| **3 — scene** | desktops and capable tablets | Tier 2 + the WebGL world as a fixed backdrop the content scrolls over | **≥ 60 % desktop**, phased: 35 % at M2, 60 % at M3 |

The tier is chosen once in the `<head>` (capability check, PLAN §6.4), can be lowered at run time by the frame-time watchdog, and can be forced down by the visitor (`motion`). It is never raised automatically mid-visit.

### 7.3 What the WebGL world contains (re-scoped M2)
One fixed, full-viewport canvas behind the page; the camera moves along stops tied to scroll progress (the *Scroll-driven scene* in Figma). Content stays real DOM above it.

| Stop | Section | In view | Live detail |
|---|---|---|---|
| 1 | Hero | wide: voxel Earth on its beacon, islands, floating blocks | Earth turns; day/night terminator follows **the real time** (ties to Clock Stamp); motes rise |
| 2 | About | camera drops to the island: bookshelf (education), XP orbs (GPA), inventory chest (skills) | orbs drift toward the pointer; chest lid opens when Skills is in view |
| 3 | AvGeek | camera rises to orbit height | watched routes as great-circle arcs with voxel planes; radar sweep |
| 4 | Projects | a workbench: each project is a block that assembles as its card enters | Clock Stamp block shows the live dial as a texture |
| 5 | Experience | the commit rail becomes a rail track through the world; minecart at the current row | cart follows scroll |
| 6 | Contact | pull back to the whole world, beacon beam on | beam pulses with the ping line |

Rules:
- Geometry is instanced voxels and merged quads; textures are ≤ 64 px, procedural or drawn in-house (PLAN §12: nothing from Mojang).
- All colours from the theme object (§3.4); the scene exists in every theme.
- Adaptive resolution while scrolling; pause when the tab is hidden or the canvas is fully covered by an opaque panel.
- The DOM globe, blocks and phone remain as the Tier 1/2 presentation of the same ideas — the scene replaces them only at Tier 3, behind the same content.

### 7.4 More motion that needs no WebGL (Tier 2, ships with X3)
- **Chunk-load transitions**: as a section enters, its cards rise in a stagger and their borders "resolve" from dashed to solid (the Figma storyboard).
- **Parallax star field**: three layers on one 2D canvas, 0.2 / 0.5 / 1.0 scroll factors.
- **Live data dressing** built only from content: XP bar fills to the real GPA ratio, status bars fill to the real status, the day counter on "now building" counts from the project's real start date.
- **Project demos**: `demo:` on a project selects a live miniature. `world-clock` exists (Clock Stamp: a 24-hour dial on the real time, marks FRA / SEA / SHA). Next candidates, only when the owner supplies what they show: `latent-map` (X Community Notes: an animated factor scatter from data the owner exports), `pin-map` (Classmate Map).

### 7.5 Performance contract
- Reference devices: MacBook Air M1 (desktop), Pixel 7 and iPhone 12 (mobile).
- Tier 3: ≥ 55 fps at rest and while scrolling on the reference laptop; first scene frame ≤ 1.5 s after LCP; scene chunk ≤ 250 KB gz; GPU memory ≤ 96 MB.
- Watchdog: three consecutive seconds under 40 fps → step resolution down; still under → drop to Tier 2 and remember for the session.
- `?debug=1` HUD: fps, frame ms, tier, draw calls, pixel ratio (PLAN §9.3).

**Acceptance (F):** tiers selectable by query for testing (`?tier=0..3`); E2E runs the content suite at each tier; the WebGL share is measured by a test (scroll the page, sample whether the canvas has drawn) and meets the table; budgets hold.

---

## 8. Workstream G — mobile build plan

M1 is responsive and passes its tests at 320–430 px, but it is a desktop page that reflows. Mobile is ≥ 55 % of expected traffic (PLAN §3) and gets its own design.

### 8.1 Principles
1. Thumb first: primary navigation and actions in the bottom third.
2. One column, short sections, nothing that needs precision.
3. Motion is lighter, never absent by default (Tier 2), and never drains battery.
4. Same facts, same order of importance: name → what I do → proof (projects, experience) → contact.

### 8.2 Navigation: the hotbar
A fixed bottom bar styled as an inventory hotbar: five slots — **About, Projects, Experience, Contact, ⚙** — each a 48 × 48 px voxel icon with a label; the current section's slot is selected (scroll-spy, as the desktop nav). It hides on scroll down, returns on scroll up, respects `env(safe-area-inset-bottom)`. The top bar keeps only the logo and RÉSUMÉ. Screen readers get it as one `<nav>` with five links.

### 8.3 Section layouts at 360–430 px
| Section | Mobile design |
|---|---|
| Hero | headline (3 lines), one-line eyebrow, **RÉSUMÉ** and **SAY HI** side by side, then the terminal (collapsed to `whoami` + interests, "more" expands); the stage becomes a 280 px globe with four blocks, badges below it as a swipeable row |
| Ticker | kept, slower (30 px/s), pauses on touch |
| About | cards as a vertical stack; XP and Now side by side in two columns; coursework and skills as horizontally scrolling slot rows (snap), each row labelled |
| Projects | featured card first; the phone is centred and **tappable** (row 11 of §6); other projects as a snap carousel with position dots and a "list all" link |
| Experience | commit rows collapsed to title + dates; tap opens the highlights (a real `<details>`); the rail stays |
| Contact | big heading, one primary button, the others as an icon row; emails as tap-to-copy with a toast |
| Footer | two lines; "back to spawn" lives in the hotbar's logo slot |

### 8.4 Touch interaction rules
- Targets ≥ 44 × 44 px with ≥ 8 px spacing; no hover-only content; long-press never required.
- Carousels: native scroll-snap (no JS drag), buttons for previous/next, not auto-advancing.
- Globe: horizontal drag turns it, vertical drag scrolls the page (`touch-action: pan-y`, already set).
- Haptics: none (not reliably available on the web).

### 8.5 Mobile graphics
- Default Tier 2 (2D canvas ambient + DOM globe). DPR capped at 2; particles capped at 24; star field at 30 fps.
- Tier 3 on mobile (a lite scene: ≤ 600 instances, 2 camera stops, no post filter) only after the trigger in DECISIONS §16 fires, as milestone **X5**.
- Lite mode switches on automatically for `Save-Data`, battery saver where detectable, or `deviceMemory ≤ 4`.

### 8.6 Platform specifics (each has a test or a manual check)
- iOS Safari: viewport units — use `svh/lvh` deliberately, never `100vh` for full-height panels; bottom bar must clear the home indicator; no 300 ms tap delay (`touch-action: manipulation` on controls); rubber-band scroll must not reveal a different background colour (`html` background = scene foot colour).
- Android Chrome: address-bar collapse must not resize the canvas; `theme-color` follows the theme.
- In-app browsers (WeChat, QQ, X): they resize the page to hide their own bars — viewport-based sizes are captured once per width (as the reference site does), and the page must be fully usable with the hotbar hidden.
- Orientation: landscape phones get the tablet layout; nothing locks orientation.

### 8.7 PWA: not now
An install prompt and offline shell add maintenance for little benefit on a portfolio. Revisit after X4 with analytics (returning-visitor rate).

### 8.8 Device matrix
| Device | Browser | Role |
|---|---|---|
| iPhone 12 / 13 mini (375–390) | Safari | reference small iOS |
| iPhone 15 Pro Max (430) | Safari | large iOS |
| Pixel 7 (412) | Chrome | reference Android |
| A 2020 mid-range Android (e.g. Galaxy A51, 4 GB) | Chrome | low-end gate for Tier 2 |
| iPad (768 / 1024) | Safari | tablet both orientations |
| WeChat in-app browser | — | in-app gate |

CI covers 320 / 360 / 390 / 412 / 430 in Chromium and WebKit emulation; the real-device pass is manual, recorded in STATUS per milestone.

**Acceptance (G):** mobile frames exist in Figma (390 wide, every section, Night + one other theme) and the build matches them; Lighthouse mobile ≥ 95 on all four; LCP ≤ 2.5 s on slow 4G; every target ≥ 44 px; hotbar works with VoiceOver and TalkBack; no horizontal scroll at 320; the matrix has been run once.

---

## 9. Roadmap (replaces the order in PLAN §8 from M2 on; M0 and M1 are done)

| Milestone | Scope | Depends on | Effort | Acceptance |
|---|---|---|---|---|
| **X1 Foundations** | settings window, prefs storage + no-flash head script, remaining tokens + lint rule, five themes, forced-colors, motion levels + pause-all, print CSS, `docs/A11Y-CHECK.md` | Figma theme modes | ≤ 1 week | §2, §3, §4 |
| **X2 Languages** | i18n routing for en / zh-Hans / zh-Hant, `copy.zh-hans.yaml` + `copy.zh-hant.yaml`, per-field translations, the Simplified → Traditional draft script, staleness report, Fusion Pixel subset pipeline (two cuts), hreflang, locale test matrix | X1 (language lives in settings); owner's Simplified text and review of the Traditional | ≤ 1.5 weeks + owner writing and review time | §5 |
| **M2 Scene** (re-scoped) | graphics tiers + capability check, shared renderer, world for stops 1–3, theme-aware scene, watchdog, debug HUD | X1 | ≤ 1.5 weeks | §7 (35 % share), PLAN §8 M2 |
| **X3 Interactions** | the 16-row catalogue, Tier 2 ambient canvas, chunk-load transitions, live data dressing | X1; Figma hover components | ≤ 1 week | §6, §7.4 |
| **M3 Windows** | PLAN §8 M3 + scene stops 4–6 (60 % share), project detail pages, 404, OG images per locale and theme | M2, X3 | ≤ 1 week | PLAN §8 M3, §7 |
| **X4 Mobile** | hotbar, mobile section layouts, carousels, touch twins, mobile tiers, device matrix | X1–X3; Figma mobile frames | ≤ 1.5 weeks | §8 |
| **M4 Owner experience** | PLAN §8 M4 + content guide covers themes/languages (`copy.<lang>.yaml`, `draft:`) | X2 | ≤ 3 days | PLAN §8 M4 |
| **M5 Polish & launch** | PLAN §8 M5 | all | ≤ 4 days | PLAN §1.3 KPIs + this plan's budgets |
| *X5 Mobile scene* | lite WebGL on phones | DECISIONS §16 trigger | — | §8.5 |

Launch is independent of this table: `launched: true` can be flipped today (M1 is accepted); each milestone then ships to the live site as it lands.

### 9.1 How the result is assured (additions to PLAN §9)
- **Matrix, not one page.** CI's content, layout and `axe` suites run over `theme × locale × motion level × tier`, pruned to the pairs that can interact (≈ 14 runs, not 120): every theme once in English at full motion; all three locales in Night; each motion level and each tier in Night/English.
- **Contrast as a unit test** over the token table (§3.5).
- **Visual baselines** per theme and per locale at 390 and 1440, static (reduced motion, frozen clock) so they are deterministic — the method used on 2026-11-10 to prove the token cleanup changed no pixel.
- **Budgets in CI** (§1.3) including the new CSS and CJK font limits.
- **Design review gate**: no visual work is coded before its Figma node exists; PRs link it and attach side-by-side screenshots (existing PR template).

---

## 10. Open questions for the owner
| # | Question | Default if unanswered |
|---|---|---|
| ~~Q-L1~~ | **Answered 2026-11-10:** English + Chinese in both Simplified and Traditional (DECISIONS R3-1). 日本語 or others: not now. | — |
| Q-L3 | Traditional Chinese flavour: script-only conversion of your Simplified text (same wording, Traditional characters), or regional wording — Taiwan (軟體, 網路) or Hong Kong? | script-only, tagged `zh-Hant`, which you then review |
| Q-L2 | Will you write/approve the Simplified text yourself and review the generated Traditional (§5.4)? Should company and school names use official Chinese names where they exist? | owner writes Simplified and reviews Traditional; official names only |
| Q-T1 | Theme names: Night / Day / Mono dark / Mono light / Colour-blind safe — or in-world names (Night, Overworld, Bedrock, Paper, Prism)? | plain names in settings, in-world names as subtitles |
| Q-T2 | Should "auto" follow the OS light/dark setting, or should Night stay the default for everyone who has not chosen? | Night for everyone; OS contrast/forced-colors always honoured |
| Q-G1 | The WebGL share target (60 % of scroll on desktop by M3): right ambition, or more (the reference site is ~100 %)? | 60 % |
| Q-G2 | Scene stop 4 shows each project as a block; do you have app icons / screenshots for Clock Stamp to texture it (drop them in `content/artifacts/`)? | generic blocks |
| Q-H1 | Row 12 (a real mini-prompt in the hero terminal): fun, or too much? | build it, behind the easter-egg prompt click |
| Q-M1 | Hotbar slots: About, Projects, Experience, Contact, Settings — or Résumé instead of Settings? | as listed; Résumé stays in the top bar |
| Q-M2 | Which phones can you test on yourself (for the manual matrix)? | — |
| Q-A1 | Sound: never, or opt-in block sounds later? | never |

---

## 11. Risks
| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| X-R1 | The test matrix slows CI past 10 minutes | M | M | pruned pairs (§9.1); themes/locales in parallel jobs; screenshots only on PRs that touch `src/` |
| X-R2 | Themes multiply design debt (five palettes × every component) | H | M | semantic tokens only; Mono and CVD are remaps, not redesigns; contrast unit test |
| X-R3 | Chinese layout breaks pixel alignment (12 px grid vs 8/10 px labels) | M | M | per-locale type tokens; Fusion Pixel only at 12 px multiples; layout suite per locale |
| X-R4 | Translations go stale against English, or Traditional drifts from Simplified | H | M | source hashes on every translated field; a CI report lists what is stale in each script; fallback + `lang="en"` instead of blocking |
| X-R9 | Script conversion picks the wrong character (one Simplified form, several Traditional ones) or mixes scripts on a page | M | M | conversion output is always a draft the owner reads; the cross-script character test in acceptance (D); names on an allow-list |
| X-R5 | WebGL share goal fights the performance budget | M | H | tiers + watchdog; share is measured only at Tier 3; scene never blocks LCP |
| X-R6 | Hover catalogue becomes noise | M | M | one behaviour per element type; `calm` keeps state changes without motion; design review in Figma first |
| X-R7 | Mobile hotbar covers content or fights browser bars | M | M | hides on scroll down; safe-area insets; in-app browser check in the matrix |
| X-R8 | Settings add first-paint work | L | M | inline script < 1 KB, synchronous, no network; measured by the JS budget script |
