# Night Canvas design system

## Overview

Night Canvas is a small public art observatory for people following Squeektoshi’s wheelwork. The central visual idea is a pixel wheel in a warm night sky: observed half-hours become colored radial stitches, with an original golden hamster below the wheel. The live artwork appears before the collection, followed by records and the explanation.

The implementation uses React, TypeScript, and plain CSS. `src/styles.css` is the source of truth for tokens and component styles; `src/art.ts` owns the pixel-art palette and geometry. The site is intentionally calm, with flat surfaces, modest rounded corners, a pixel display face, and readable sans-serif data. Light mode changes the interface to warm paper while keeping the artworks in their original night palette.

## Colors

Primitives and semantic aliases are defined at the start of `src/styles.css`. Components use the semantic tokens. Theme switching changes `data-theme` on the root; there is no competing media-query theme. Dark is the default, with a local preference for light mode.

| Semantic token          | Dark      | Light     | Role                                         |
| ----------------------- | --------- | --------- | -------------------------------------------- |
| `--color-bg`            | `#17141f` | `#faf5ec` | Page and controls without a filled surface   |
| `--color-surface`       | `#211b2b` | `#f4ebdf` | Live information, filters, typical-day panel |
| `--color-surface-hover` | `#282131` | `#eae0d3` | Selected neutral filters and neutral hover   |
| `--color-text`          | `#f6eddf` | `#302936` | Primary text and metrics                     |
| `--color-secondary`     | `#c0b1c5` | `#625466` | Supporting copy and labels                   |
| `--color-muted`         | `#b2a2b7` | `#6c5d6d` | Captions, units, coverage notes              |
| `--color-border`        | `#493c52` | `#d2c2ca` | Structural borders and separators            |
| `--color-accent`        | `#f0c88d` | `#72501f` | Filled primary action and moon mark          |
| `--color-accent-text`   | `#28202a` | `#fff5e1` | Text on the primary action                   |
| `--color-accent-hover`  | `#ffdaa0` | `#5b3f19` | Primary action hover                         |
| `--color-link`          | `#c9b4e5` | `#674b87` | Links, secondary brand detail, resting state |
| `--color-focus`         | `#f5d3a3` | `#674b87` | Keyboard perimeter                           |
| `--color-status`        | `#b7ccaa` | `#405c37` | Running signal text and square               |
| `--color-status-bg`     | `#2b332d` | `#dfe7d8` | Running signal surface                       |
| `--color-error`         | `#efb6a4` | `#884034` | Signal loss and request errors               |
| `--color-error-bg`      | `#39282e` | `#f1e0da` | Recoverable error surface                    |
| `--color-note`          | `#251f2e` | `#eee4e2` | Welfare and artwork notes                    |

The primitive palette is the plum, cream, lavender, and amber aliases actually consumed by these roles. Status has a text label as well as color. Resting uses the lavender foreground on the neutral selected surface; signal loss uses the error pair.

In Chromium, measured token pairs include body/page at **15.65:1 dark / 12.92:1 light**, muted/page at **7.56:1 / 5.65:1**, and muted/hover-surface at **6.47:1 / 4.70:1**. These describe the identified solid pairs, not every possible artwork pixel. See `artifacts/validation.md` for rendered scan coverage and its limits.

### Artwork colors

The scene’s fixed sky is `#181423`. `ART_COLORS` in `src/art.ts` is the activity ramp: `#796391`, `#a68ac6`, `#c1a5df`, `#e7b8c8`, `#e99b92`, `#f0ae73`, `#f5cd8a`, `#d9dfb1`. Recorded quiet pixels use `#51405f`; missing and future slots have dim, broken rings. The live accent is `#ffdc9c` and never enters a saved artwork.

The date seeds stars and a palette offset. Fourteen radial pixel-ring positions express the logarithmic intensity `min(1, log1p(work) / log1p(2500))`. The wheel has 48 half-hour slices, with midnight at the top. Noon-to-noon order is used for the typical-day heatmap and data tables. The heatmap uses the same activity ramp, with a hatched unknown state and readable values through selection and the table.

## Typography

The two local WOFF2 files are in `public/fonts/`, copied into `dist/fonts/` at build time. DM Sans provides a variable 400–700 range; the interface uses 400 and 600. Silkscreen uses its real 400 face for the wordmark and display headings. There are no network font requests. Both font licenses are included beside the files.

| Token             | Default size      | Main use                                        |
| ----------------- | ----------------- | ----------------------------------------------- |
| `--text-small`    | 14px / `0.875rem` | Labels, captions, button text, notes            |
| `--text-body`     | 16px / `1rem`     | Body copy, card dates, normal data              |
| `--text-subtitle` | 20px / `1.25rem`  | Live heading, compact section headings, metrics |
| `--text-heading`  | 24px / `1.5rem`   | Section headings and phone page title           |
| `--text-display`  | 32px / `2rem`     | Record values, artwork page title               |
| `--text-hero`     | 40px / `2.5rem`   | Desktop home heading                            |

Body line-height is 1.6; headings use 1.35, with 1.5 on longer phone artwork titles. The home heading has `-0.035em` tracking, reduced to `-0.02em` on phones. Data uses tabular numbers. Headings balance their lines; prose uses `text-wrap: pretty`. Descriptions have explicit measures, such as 65ch in About and 85ch for artwork explanations.

There is no critical-value truncation. Long values can wrap. The phone select is 16px to avoid input focus zoom. Enlarged text wraps navigation, filters, and action groups; narrow live statistics can become a single column. Source strings use natural capitalization; Silkscreen’s glyph design gives the display text its pixel character. Required live status labels use RUNNING / RESTING / SIGNAL LOST.

## Layout

`.shell` has a 1240px outer maximum with 40px desktop inline padding. The spacing tokens are 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, and 80px (`--space-1` through the implemented `--space-20`). Groups have larger gaps than the controls and labels within them. Content and controls share the shell edges.

| Breakpoint           | Implemented adaptation                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Above 70rem / 1120px | Live scene and 350px information column; three gallery columns; 48 heatmap columns                                               |
| At 70rem             | 32px shell padding; 330px live information column; 24 heatmap columns; artist annotation hidden                                  |
| At 53rem / 848px     | Live scene stacks above information; two gallery columns; compact header; two-column artwork statistics                          |
| At 38rem / 608px     | 20px shell padding; brand/utilities above a full navigation row; one gallery column; 12 heatmap columns; About and records stack |
| At 22rem / 352px     | 16px shell padding; smaller brand; tighter captions and data spacing                                                             |

The live artwork keeps its 16:9 source aspect when stacked. Phone gallery images use a modest 16:8 crop while keeping the hamster and wheel visible. The artwork page gives the image the full phone width, with actions inset inside the shell. Records and About become vertical reading flows on phones. Heatmap reading order is stated explicitly instead of displaying inaccurate time-axis positions when its rows wrap.

There is no sticky navigation or fixed action bar. Sections use a 24px scroll margin. Anchor navigation scrolls and focuses the destination heading; artwork routes focus their title. The skip link focuses the existing main region without changing an artwork hash. Data tables may scroll within their own `.table-wrap`; other content reflows.

Rendered checks cover 320, 390, 820, and 1440px in both themes, plus 200% CSS text enlargement at 320/390. This is text-size testing, not a claim of native browser zoom or physical-device coverage.

## Elevation & Depth

The interface has no box shadows, gradients, or nested card stacks. A one-pixel border gives gallery cards and the Tonight panel structure. Tonal fills group the information panel, heatmap, notices, and welfare note. Canvas captions have opaque night backplates so stars do not interfere with their text.

The skip link is the only raised navigation layer (`z-index: 10`). Canvas labels and the open icon sit within their artwork container. There are no dialogs, popovers, or overlays requiring a focus trap.

## Shapes

The three radius tokens are 6px for controls/notices, 10px for cards/heatmap, and 14px for large panels and welfare notes. Inner canvas radii account for the one-pixel outer border (9px or 13px). The appearance control is circular; pixel marks, legend swatches, and signal dots remain square or nearly square. The original 23-column hamster sprite is drawn as solid integer rectangles.

## Components

| Component/pattern               | Source               | Behavior and reuse                                                                                                                                                                      |
| ------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Artwork`                       | `src/components.tsx` | Takes a night, date, optional live measurement, and optional class. Draws a 480 × 270 scene, uses nearest-neighbor display, and describes known versus unavailable readings accessibly. |
| `paintScene`, `downloadArtwork` | `src/art.ts`         | Shared deterministic scene and 1200 × 675 PNG. Exports reserve a caption band and include date, observed stats, and squeekchain.com. Unknown nights cannot export.                      |
| `Hamster`, `MoonLogo`, `Icon`   | `src/components.tsx` | Original pixel mascot and moon mark; one SVG icon set with `currentColor`, 20px default size and 1.7 stroke. Icons beside text are decorative.                                          |
| `.button`, `.button-primary`    | `src/styles.css`     | Neutral and filled primary actions; 46px minimum height, or 40px compact. Real disabled states, visible focus, and a reserved download-feedback region.                                 |
| `Stat`                          | `src/components.tsx` | Semantic `dt`/`dd` group inside a parent `dl`; notes are inside the value. Unknown values remain textual.                                                                               |
| `ErrorNotice`                   | `src/components.tsx` | Stable polite status region with an automatic retry time, cooldown-gated Retry, and a retained-data explanation when relevant. The empty region exists before an error arrives.         |
| `Gallery`, `NightCard`          | `src/App.tsx`        | A semantic linked list with native filter buttons and sort select. Initially six nights; expand/show fewer; explicit loading, empty, unavailable, and missing-reading states.           |
| `Heatmap`                       | `src/App.tsx`        | 48 named native buttons with selected state and a stable status line; a native details disclosure exposes the same values in a table.                                                   |
| `ArtworkPage`                   | `src/App.tsx`        | Fragment route, focusable title, PNG download states, X draft link, statistics, and per-half-hour table. Invalid or expired dates provide a route back to the gallery.                  |
| `useResource`                   | `src/useResource.ts` | Polling, cancellation, freshness-independent transport errors, cooldowns, and retained in-memory data. This hook provides actual availability, never demo values.                       |

Targets are generally 44px or larger. The dense heatmap uses smaller cells with enough spacing for the 24px target/spacing criterion; it also provides the data table. Keyboard outlines are 3px with a 5px offset and use system Highlight in forced colors. `prefers-reduced-motion` removes transitions; the normal interaction motion is limited to a 150ms card lift/opacity change and a 120ms button press at scale 0.96. Theme changes are immediate because color properties have no transition.

## Do’s and Don’ts

- Start new content inside `.shell`, reuse the six-size scale and semantic colors, and keep one filled primary action in a group.
- Use real links for navigation, native controls for actions, and a focusable heading when adding a route or section. Keep the visible label in its accessible name.
- Keep art rendering in `src/art.ts`; preserve the dated, 48-bucket input and distinguish provisional live accents from saved output. Change `ART_VERSION` deliberately when changing the mapping.
- Keep unknown, partial, future, resting, and recorded zero distinct. Describe active windows as estimates, not exact running time.
- Keep required assets local and asset paths relative in the built export. Do not add wallet infrastructure, trackers, demo-data fallbacks, or automatic social posting.
- Rebuild the static export and check mobile layout, both themes, keyboard navigation, and the export after changing shared components.

## Method and attribution

The pinned Better Interface guide was applied during implementation and reviewed across accessibility, layout, writing, typography, colors, and UI. The consolidated coverage, corrected findings, and remaining verification limits are in `artifacts/validation.md`.

Design guidance is adapted from [Jakub Krehel’s Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. The documentation method is adapted from [Paul Bakaus’s Impeccable document reference](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), Apache-2.0, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. The retained license texts are in `artifacts/design-guidance-LICENSE.txt`.
