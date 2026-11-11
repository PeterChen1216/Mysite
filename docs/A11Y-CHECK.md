# A11Y-CHECK — the ten-minute manual pass

> PLAN-EXPERIENCE §4.2. Run before every merge that affects the live site (anything under `src/`
> or `content/copy.yaml`). Record the date, browser and result of each step in `docs/STATUS.md`
> ("A11Y-CHECK runs"). What CI already proves is listed at the end so this pass stays short.

Open the preview (`/v2/` before launch, `/` after) in a fresh private window.

## 1. Keyboard-only tour (2 min)
Put the mouse away.
1. `Tab` once: **Skip to content** appears top-left; `Enter` moves focus into the page.
2. Keep pressing `Tab` to the footer. Every stop shows a visible ring (gold in Night), the page
   scrolls to it, and the order follows the page from top to bottom.
3. On the hero globe: `←` `→` turn it 15°, `Page Up` / `Page Down` 90°, `Home` back. It holds
   still while focused.
4. On the player card: the real photo shows; `Esc` hides it again; focus stays.
5. Press `,` — the settings window opens with focus on the chosen theme. Arrow keys change the
   choice and the page changes behind it at once. `Tab` moves group to group. `Esc` closes it
   and focus returns to where you were.
6. Press `p` — every loop stops (globe, ticker, cursors, the phone's clock); `p` again resumes.
   The ⏸ key in the nav does the same and shows ▶ while paused.
7. In the window, set **Keyboard shortcuts → Off**: `,` and `p` now do nothing. Set it back.

## 2. Screen reader (3 min) — VoiceOver (macOS / iOS) and NVDA (Windows), one per release
1. Rotor / elements list → headings: one h1 (the hero headline), then the section h2s in order;
   card titles are h3.
2. Rotor → links: every link says where it goes; links that open a new tab end in
   "(opens in a new tab)".
3. Rotor → form controls: the settings window's groups read as "Theme", "Motion", "Text size",
   "Keyboard shortcuts", each choice with its name (not the `$ theme --set` skin).
4. The hero globe reads as a slider "Globe, turned 0°"; arrow keys change the value.
5. Decorative art (blocks, phone, terminal dots, cue glyphs ◆ ▶ ■) is silent; the ticker is
   readable but not announced as it scrolls.

## 3. Zoom and text (1 min)
1. Browser zoom 200 %: nothing is cut off or overlaps; no sideways scrolling.
2. Browser zoom 400 % (= 320 px wide): one column, all content reachable by vertical scrolling.
3. Settings → **Text size 130 %**: the type grows (the hero art and the phone keep their size);
   nothing is cut off.

## 4. Contrast modes (2 min)
1. **Windows High Contrast** (Settings → Accessibility → Contrast themes → Aquatic or Desert),
   Edge or Chrome: take one screenshot of the hero and one of the git log. Every button, nav key,
   link-button and the globe has a visible outline; the git log's nodes are drawn (squares,
   diamonds, a ring); ticker tags show their glyphs.
2. macOS **Increase contrast** (or `prefers-contrast: more` in DevTools): grey text becomes
   lighter, borders stronger, the cue glyphs appear.
3. macOS **Reduce transparency**: the nav, ticker and footer bars become solid.

## 5. Motion (1 min)
1. OS **Reduce motion** on, reload: nothing moves; the ticker scrolls by hand. Turn it on while
   the page is open: everything stops at once. Turn it off: loops resume, nothing replays.
2. Settings → Motion **Calm**: no intro, no sparks on hover, loops visibly slower.
3. Nothing flashes more than three times a second at any level.

## 6. Each theme, one glance (1 min)
Settings → Theme, at 1440 px and on a phone: **Night, Day, Mono dark, Mono light, Colour-blind
safe**, then **Auto** while switching the OS between light and dark. Check: text readable
everywhere; in Day the terminals, git log, chips and phone stay dark; in Mono the pictures are
grey; in Colour-blind safe and Mono the ticker tags and chips carry glyphs. Reload: the choice is
kept and appears without a flash. DevTools → Rendering → *Emulate vision deficiencies*
(protanopia, deuteranopia, tritanopia, achromatopsia) on Night and Colour-blind safe: adjacent
categories stay distinguishable.

## 7. Phone (1 min; the full device pass is §10)
- iPhone, Safari, VoiceOver on: swipe to the hotbar — it is announced as one navigation "Sections" with five links (about, projects, experience, contact, prefs); the current section's link says "current"; double-tap `prefs` opens the settings dialog and focus lands inside it.
- Scroll down: the top bar and the hotbar slide away; scroll up a little: both come back. With VoiceOver's cursor or a keyboard, moving into a hidden bar brings it back.
- The first screen: RÉSUMÉ and SAY HI are under the folded terminal, within thumb reach; `more ▾` unfolds the terminal.

## 8. Print (30 s)
`Ctrl/⌘-P` from any theme: black on white, no nav, ticker, hero art or phone; links followed by
their address; nothing contradicts `resume.pdf`.

## 9. Languages (1 min) — X2
1. Open `/zh-hans/` and `/zh-hant/`. Headings, labels and buttons are in the pixel CJK face (a
   12 px grid: crisp, not blurred); running text is in the system Chinese sans. At **12 px**
   (labels, chips, the hero badges) every character is legible — Traditional is denser; zoom to
   200 % if unsure.
2. While a language is a preview, the gold "草稿译文 / 草稿譯文" bar is on top of every page.
3. Press `,`: the language row lists each language in its own script; following one lands on the
   same section of the other page.
4. With a screen reader on a Chinese page, an untranslated fact (an English project, a skill
   name) is read in an English voice.

---

## 10. The phone matrix (X4; PLAN-EXPERIENCE §8.8) — once per milestone that touches the phone layout, ~20 min
**Not run yet (X4 was built and tested in emulation only: Chromium's Pixel 7 and WebKit's iPhone 13 in CI, 320–430 px). Record the result in docs/STATUS.md.**

| Device | Browser | Check |
|---|---|---|
| iPhone 12 / 13 mini (375–390) | Safari | the hotbar clears the home indicator (nothing under the bar); the address bar collapsing does not make the stars jump; rubber-band scroll at the top and the foot shows the page colour, no white; a tap on a hotbar slot goes there at once (no double-tap delay); the copy key on an email shows the toast and the address is on the clipboard |
| iPhone 15 Pro Max (430) | Safari | as above; the hero stage fills the column (globe 311 px); turn the phone: the tablet layout, nothing under the notch |
| Pixel 7 (412) | Chrome | `theme-color` follows the theme (the browser bar changes with Day / Night); the address bar collapsing does not resize the stars; carousel: swipe snaps to a card, the ◀ ▶ keys step it, the dots follow |
| A 2020 mid-range Android, 4 GB (e.g. Galaxy A51) | Chrome | lite mode is on (`document.documentElement.dataset.liteReason` is `memory` in the remote inspector): no rising motes; scrolling stays smooth |
| iPad (768 / 1024) | Safari | portrait 768: the tablet layout (top nav, no hotbar); landscape 1024: the desktop layout; no hover-only content |
| WeChat in-app browser | — | open zhic.me/v2/ from a chat: the page is fully usable with the hotbar hidden; the WeChat bar showing and hiding does not resize the stars |
| VoiceOver (iPhone) and TalkBack (Pixel) | — | §7 above; plus: the carousel is announced as a carousel, each card says "1 of 3"; an experience row's summary says "git show …, collapsed" and opens with a double-tap; the toast "[OK] copied …" is read out |

### What CI already checks (no need to repeat by hand)
| Contract row (§4.1) | Test |
|---|---|
| Keyboard: tab walk, order, visible ring, no trap; shortcuts off in fields and switchable | `tests/e2e/a11y.spec.ts`, `prefs.spec.ts` |
| Motion levels, pause-all incl. the phone clock, reduced motion mid-visit | `motion.spec.ts`, `robustness.spec.ts` |
| Reflow 320 px and ten widths, text spacing (1.4.12), text size 130 % | `robustness.spec.ts` |
| Target size 24 px (2.5.8); 44 px touch area for MC buttons | `a11y.spec.ts` |
| The phone layout (X4) at 320 / 360 / 390 / 412 / 430 and a landscape phone: no sideways scroll; the hotbar as one `<nav>` of five links, scroll-spy, hide and show, focus bringing it back, the safe-area inset; every control a 44 px target 8 px from the next; `axe` per width, locale and theme; the folded terminal, carousels and slot rows, `<details>` rows, tap-to-copy and its fallback, the city keys; lite mode; no WebGL on a phone | `mobile.spec.ts` (Pixel 7 in Chromium; iPhone 13 in WebKit on CI) |
| Contrast in every theme, more contrast, reduced transparency | `tests/unit/contrast.test.ts` |
| `axe` per theme, with the settings window open, without JavaScript | `themes.spec.ts`, `prefs.spec.ts`, `quality.spec.ts` |
| Forced colours: every control has a boundary | `themes.spec.ts` |
| Language attributes, Chinese runs marked; every locale's content, layout and `axe`; English fallbacks marked `lang="en"`; no character of the other Chinese script | `a11y.spec.ts`, `content.spec.ts`, `robustness.spec.ts`, `quality.spec.ts`, `i18n.spec.ts` |
| Hover content dismissible / hoverable / persistent (1.4.13) | `a11y.spec.ts` |
| Globe: keyboard twin of the drag (2.5.7) | `robustness.spec.ts` |
| Print styles | `a11y.spec.ts` |
