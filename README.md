# Night Canvas

Squeektoshi’s nightly wheelwork becomes a deterministic pixel artwork: a wheel of 48 half-hour slices, with warmer colors and more rings as observed activity increases.

The finished static website is in **`dist/`**. It includes all runtime assets, local fonts, a favicon, and a 1200 × 675 share image. Serve that directory with any static host. No server-side application, wallet, credentials, or environment file is needed.

## Install, develop, and rebuild

Use Node.js 22.18 or later and npm.

```sh
npm ci
npm run dev
```

Build and inspect the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Open the preview URL printed by Vite. Rebuild `dist/` after changing source or public assets; the published artifact is the export, not the source. Vite uses `base: './'`. Navigation uses section anchors and `#/art/YYYY-MM-DD`, so it also works below a gateway subpath without server rewrites. Serve over HTTP(S), rather than opening `index.html` as a file.

## What is here

- **Tonight:** status every 15 seconds while the tab is visible, a current-speed/distance accent on the canvas, distance today, speed, RPM, and observed active windows.
- **Gallery:** one entry for each returned day in the 30-day window; newest/most-active ordering, activity filters, and an expandable collection. Six entries are shown initially.
- **Artwork pages:** a large image, statistics, the 48 underlying half-hours, local 1200 × 675 PNG generation, and an X post intent containing the artwork name, date, and the current page link. Sharing opens a draft; the app never posts.
- **Records:** the API’s greatest daily distance, longest active-day streak, block total when available, and an interactive typical-day heatmap with a readable data table.
- **About:** the mapping from data to art, source links, community-project disclosure, and Squeektoshi’s welfare note.

Dark mode is the default. The appearance button switches to light mode; only that preference is saved in local storage. There are no trackers, remote font requests, or wallet packages.

## Data and interpretation

The site reads the [published Squeekchain API](https://docs.squeekchain.com/developers/api/) directly:

- `https://api.squeekchain.com/v1/status`
- `https://api.squeekchain.com/v1/measurement/stats?range=30d`

The brief’s `rane` spelling is corrected to the documented `range` parameter. Both adapters require numeric `schemaVersion: 1` and check the fields this interface uses. Unsupported versions and malformed responses produce an error, not fabricated values.

A night starts at **12:00 UTC** and ends at the next noon; its date names the starting noon. Midnight appears at the top of the radial wheel. RPM is `rpmMilli / 1000`, speed is `speedMmPerSecond / 1000` in m/s, and distance is millimetres divided by 1,000,000 in km.

“Active hours” are **half-hours with any observed work × 0.5**, an estimate of active windows rather than exact running duration. The UI and export make this distinction. Partial readings remain partial, missing/future slots are unpainted, and unknown values never become numeric zero. Best half-hour means the greatest observed bucket, with chronological tie-breaking.

Stats refresh every five minutes, rather than on every live poll. The browser revalidates its HTTP cache. Hidden tabs pause requests; returning does not bypass the minimum interval or an active cooldown. HTTP 429/503 honors `Retry-After` (seconds or date); other failures use backoff. A 12-second request timeout, abort-on-unmount, stale-receipt check, and explicit fault handling keep the live status honest. A failed live request hides stale numeric values. Existing history stays visible with an error notice if a later refresh fails.

Saved art uses only the dated half-hour buckets. Golden live accents use current telemetry and are excluded from exports. The date seeds the stars and palette, with no random/time-based input in a saved scene. PNGs are generated in the browser with locally bundled fonts. `public/share.png` is a dated artwork made from actual public readings for 29 October 2026; it is a static share card, not a live-data fallback.

## Validation

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium webkit
npm run validate
```

The browser validator starts and closes its own foreground HTTP server at a `/preview/` subpath. It uses explicitly synthetic test fixtures, never runtime demo data, and writes evidence to `test/scratch/validation/`. Playwright browsers require their native OS libraries; the validator reports an unavailable WebKit runtime as a limitation. Native dependencies can be installed using Playwright’s documented `install-deps` command where permitted.

Worker results: production build and TypeScript check passed; **19 unit tests** passed. The full interaction, accessibility, design-probe, and visual-review results, including corrected findings and limitations, are recorded in [artifacts/validation.md](artifacts/validation.md). Browser checks include mobile/desktop reflow, both themes, 200% text enlargement, gallery controls, routes, downloads, sharing parameters, polling, and failure recovery. Automated checks are evidence from this worker, not an independent certification or a substitute for screen-reader/native-device testing.

The worker installed dependencies outside the repository to preserve the assignment’s protected `node_modules/` path. `NIGHT_CANVAS_MODULES` in `vite.config.js` and the validator supports that optional external toolchain; ordinary `npm ci` uses normal local resolution. No dependency directory, registry mirror, or package archive is included in the deliverable.

## Source map

| Path                   | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `src/App.tsx`          | Routes, Tonight, gallery, records, heatmap, About, artwork pages   |
| `src/art.ts`           | Deterministic pixel renderer, original hamster sprite, PNG export  |
| `src/data.ts`          | Schema/version guards, units, dates, observed statistics           |
| `src/useResource.ts`   | Public fetch lifecycle, polling, cooldowns, timeouts               |
| `src/components.tsx`   | Canvas, mascot, icons, statistics, notices, legend                 |
| `src/styles.css`       | Tokens, light/dark themes, responsive layouts, focus/motion states |
| `tests/`               | Pure-data/renderer tests and clearly identified synthetic fixtures |
| `scripts/validate.mjs` | Production-export browser interaction validation                   |
| `DESIGN.md`            | Implemented design system and reuse guidance                       |
| `artifacts/`           | Final screenshots and validation report                            |

Fonts are bundled under the SIL Open Font License; their notices live in `public/fonts/` and the exported `dist/fonts/`. The design methodology and its retained attribution are documented in `DESIGN.md`.
