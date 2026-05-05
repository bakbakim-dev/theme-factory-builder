# File Review Status

Status values: `reviewed`, `partially reviewed`, `needs second pass`, `fixed`, `blocked`, `excluded`.

| Path | Status | Notes |
| --- | --- | --- |
| `AGENTS.md` | fixed | Replaced with the full permanent deep continuous Whipify audit protocol, including phases, ledger formats, lane rules, verification rules, live visual checks, and stopping rules. |
| `codex-work/PROJECT_MAP.md` | fixed | Initialized current project map and active work context. |
| `codex-work/FILE_REVIEW_STATUS.md` | fixed | Initialized review tracking. |
| `codex-work/AUDIT_LEDGER.md` | fixed | Initialized audit tracking. |
| `codex-work/FIX_LEDGER.md` | fixed | Initialized fix tracking. |
| `codex-work/TEST_LEDGER.md` | fixed | Initialized test tracking. |
| `codex-work/NEXT_PROMPT.md` | fixed | Initialized continuation prompt. |
| `components/Dashboard.tsx` | partially reviewed | Reviewed and modified only Elementor visual-fidelity CSS/runtime areas, including service Feature Grid typography/footer/CTA, floating pricing CTA, fallback About-section structure selectors, source-layout Feature Grid body ordering assumptions, four-column `text-sm`/`text-xs` paragraph override specificity, `md:w-1/3` carousel width preservation, and About counter animation. Needs broader review before calling complete. |
| `utils/elementorPluginTemplates.ts` | partially reviewed | Reviewed and modified Elementor importer plugin template around generated widget runtime, importer bootstrap, visual-fidelity fallback assets, enqueue/body-class hooks, importer version `1.3.18`, high-priority About/pricing/source-layout overrides, Feature Grid footer button CTA overrides, breadcrumb offset overrides, leading source icon SVG injection, compact four-column paragraph override specificity, importer JS override enqueue, `md:w-1/3` carousel width preservation, About counter animation, generated widget class replacement, Elementor preview asset detection, Feature Grid editor-canvas editability annotations, SVG/Text Fragment/Neighborhood/Breadcrumbs/Trust Logo Row/Carousel Dots/Map Embed generated widgets, importer migration repair for known HTML fallback widgets, editor-only Map Embed iframe pointer-event hit-target fix, Feature Grid duplicate inline-edit metadata removal, and Feature Grid card shell-to-repeater-row click bridge with delayed Elementor preview wiring. Needs broader full-file audit before calling complete. |
| `scripts/elementor-export-regression.mjs` | partially reviewed | Reviewed and modified Elementor regression assertions for service Feature Grid typography/link/footer/CTA, footer button CTAs, breadcrumb offset, floating CTA, Edmonton live-patch settled stats, importer-bundled visual-fidelity fallback assets/guards, pricing CTA overrides, older imported About-section fallback selectors, Feature Grid source media/icon ordering, four-column compact paragraph utility overrides, importer JS override loading, true one-third carousel widths, source-like counter animation, generated widget replacement, Elementor preview asset loading, Feature Grid editor-canvas editability annotations, zero-HTML-fallback generated custom widget coverage for SVG icons, text fragments, neighborhood lists, breadcrumbs, logo rows, carousel dots, and map embeds, duplicate Feature Grid inline-edit metadata prevention, and Feature Grid card shell click/repeater focus bridge coverage. |
| `utils/elementorConverter.ts` | partially reviewed | Reviewed and modified Elementor conversion paths for fallback reduction only: standalone SVG icon conversion, text-only div conversion, complex service-area list conversion, Breadcrumbs, Trust Logo Row, Carousel Dots, Map Embed conversion, and focused route/manifest implications through tests. Needs broader full-file audit before calling complete. |
| `.tools/live-patches/000-whipify-edmonton-elementor-patch/000-whipify-edmonton-elementor-patch.php` | partially reviewed | Reviewed and modified live Edmonton patch deployment/runtime areas. Current local version is `1.0.38`; PHP lint passes. |
| `.tools/live-patches/000-whipify-edmonton-elementor-patch/patch.css` | partially reviewed | Reviewed and modified live Edmonton visual-fidelity CSS for service Feature Grid typography/footer/CTA and floating pricing CTA. |
| `.tools/live-patches/000-whipify-edmonton-elementor-patch/whipify-elementor-widgets.php` | partially reviewed | PHP-linted during Elementor live patch work; not fully audited. |
| `node_modules/` | excluded | Third-party dependency tree; review only if dependency behavior is directly implicated. |
| `dist/` | excluded | Generated output; review only for build artifact validation. |
## Verification Sweep Files - 2026-05-04

- path: scripts/static-output-smoke.mjs
- category: test
- lane/scope: static
- review status: fixed
- reason if ignored:
- notes: Reviewed during sequential verification after static smoke failed on stale/missing artifact paths. Updated to use current repo artifact input when present and fixture input when absent.
- related tests: npm run test:static-smoke

- path: scripts/static-dashboard-smoke.mjs
- category: test
- lane/scope: static / dashboard
- review status: fixed
- reason if ignored:
- notes: Reviewed after dashboard smoke fixture failed artifact contract. Updated fallback fixture to include top-level HTML and assets expected by `buildStaticSiteFromArtifactZip`.
- related tests: npm run test:static-dashboard-smoke

- path: scripts/static-dashboard-ui-flow.spec.mjs
- category: test
- lane/scope: static / dashboard
- review status: fixed
- reason if ignored:
- notes: Replaced old-root artifact/download paths with repo-root fixture/download handling and added top-level HTML files to the uploaded fixture artifact.
- related tests: npm run test:static-dashboard-ui

- path: scripts/whipify-forms-dashboard-ui.spec.mjs
- category: test
- lane/scope: forms / dashboard
- review status: fixed
- reason if ignored:
- notes: Replaced old-root download targets with repo-root `logs/` targets.
- related tests: npm run test:whipify-forms-dashboard-ui

- path: scripts/whipify-frontend-editor-dashboard-ui.spec.mjs
- category: test
- lane/scope: frontend editor / dashboard
- review status: fixed
- reason if ignored:
- notes: Replaced old-root download target with repo-root `logs/` target.
- related tests: npm run test:whipify-frontend-editor-dashboard-ui

- path: scripts/whipify-quick-editor-dashboard-ui.spec.mjs
- category: test
- lane/scope: Quick Editor / dashboard
- review status: fixed
- reason if ignored:
- notes: Replaced old-root download target with repo-root `logs/` target.
- related tests: npm run test:whipify-quick-editor-dashboard-ui

- path: scripts/elementor-output-doctor.mjs
- category: script
- lane/scope: Elementor / live verification
- review status: fixed
- reason if ignored:
- notes: Added live-page-only fallback diagnostics when public manifest is unavailable and reduced known false-positive layout mismatch checks for Elementor wrapper behavior.
- related tests: npm run test:elementor-output-doctor; npm run doctor:elementor -- https://mikaily128.sg-host.com/edmonton/ --max-pages=1 --fail-on-critical

- path: scripts/elementor-output-doctor-regression.mjs
- category: test
- lane/scope: Elementor / live verification
- review status: fixed
- reason if ignored:
- notes: Added regression coverage for fallback manifest pages.
- related tests: npm run test:elementor-output-doctor

## Focused Review Update - 2026-05-05 Standalone Feature Card Emitter

- path: utils/elementorConverter.ts
- category: source
- lane/scope: Elementor
- review status: fixed
- reason if ignored:
- notes: Reviewed Feature Grid DOM/headless emitters and changed them from one legacy `whipify_feature_grid` repeater widget to a section/grid container with standalone `whipify_feature_card` widgets per card. Verified Platinum/Gutenberg parity after the Elementor-only change.
- related tests: npm run test:elementor-export; npm run test:gutenberg-parity; npm run build

- path: utils/elementorPluginTemplates.ts
- category: source
- lane/scope: Elementor / generated importer plugin
- review status: fixed
- reason if ignored:
- notes: Added standalone Feature Card widget class, direct controls, visual-fidelity wrapper CSS, importer version bump to 1.3.19, media import support for `card_image`, and migration from legacy Feature Grid repeater widgets during import.
- related tests: npm run test:elementor-export; php -l generated importer PHP; live wp-admin activation/import; live editor verification

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor
- review status: fixed
- reason if ignored:
- notes: Added regression coverage for standalone Feature Card widget registration, direct card controls, converter output shape, legacy importer migration, and version marker bump.
- related tests: npm run test:elementor-export
