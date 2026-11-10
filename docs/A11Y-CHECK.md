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

## 7. Phone (1 min)
On a real phone with VoiceOver or TalkBack: swipe through the nav (the hotbar from X4 on); the
settings window opens from the gear key and every choice can be made; the pause key works.

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

### What CI already checks (no need to repeat by hand)
| Contract row (§4.1) | Test |
|---|---|
| Keyboard: tab walk, order, visible ring, no trap; shortcuts off in fields and switchable | `tests/e2e/a11y.spec.ts`, `prefs.spec.ts` |
| Motion levels, pause-all incl. the phone clock, reduced motion mid-visit | `motion.spec.ts`, `robustness.spec.ts` |
| Reflow 320 px and ten widths, text spacing (1.4.12), text size 130 % | `robustness.spec.ts` |
| Target size 24 px (2.5.8); 44 px touch area for MC buttons | `a11y.spec.ts` |
| Contrast in every theme, more contrast, reduced transparency | `tests/unit/contrast.test.ts` |
| `axe` per theme, with the settings window open, without JavaScript | `themes.spec.ts`, `prefs.spec.ts`, `quality.spec.ts` |
| Forced colours: every control has a boundary | `themes.spec.ts` |
| Language attributes, Chinese runs marked; every locale's content, layout and `axe`; English fallbacks marked `lang="en"`; no character of the other Chinese script | `a11y.spec.ts`, `content.spec.ts`, `robustness.spec.ts`, `quality.spec.ts`, `i18n.spec.ts` |
| Hover content dismissible / hoverable / persistent (1.4.13) | `a11y.spec.ts` |
| Globe: keyboard twin of the drag (2.5.7) | `robustness.spec.ts` |
| Print styles | `a11y.spec.ts` |
