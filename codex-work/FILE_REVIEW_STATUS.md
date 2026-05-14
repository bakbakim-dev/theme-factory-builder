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

## Focused Review Update - 2026-05-06 FAQ Answer Editor-Only Repair

- path: utils/elementorPluginTemplates.ts
- category: source
- lane/scope: Elementor / generated importer plugin
- review status: fixed
- reason if ignored:
- notes: Reviewed the FAQ accordion editor gap after a broad live patch regressed unrelated output. Added only FAQ-answer Text Editor injection, activation/import repair, and Elementor-preview-only visibility hooks. Confirmed standalone Feature Cards and zero HTML widgets were preserved.
- related tests: npm run test:elementor-export; npm run test:elementor-output-doctor; npm run test:gutenberg-parity; php -l generated importer PHP; live public/editor verification

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor
- review status: fixed
- reason if ignored:
- notes: Updated importer version assertions to 1.3.26 and added guards that the FAQ editor fix is implemented through scoped answer-widget injection and preview-only visibility hooks rather than broad public CSS/runtime changes.
- related tests: npm run test:elementor-export

## Focused Review Update - 2026-05-06 Homepage Elementor Visual Parity

- path: components/Dashboard.tsx
- category: source
- lane/scope: Elementor / generated theme CSS
- review status: fixed
- reason if ignored:
- notes: Reviewed homepage visual-fidelity CSS after the live Elementor homepage diverged from the static reference. Added durable generated-theme rules for normal-flow header chrome, 1280px header max width, logo/nav spacing, source `inline-flex` sizing, and location-card decorative bubble dimensions.
- related tests: npm run test:elementor-export; live homepage DOM/screenshot comparison

- path: utils/elementorPluginTemplates.ts
- category: source
- lane/scope: Elementor / generated importer plugin
- review status: fixed
- reason if ignored:
- notes: Mirrored the homepage header-flow, inline-flex, and location-bubble visual-fidelity rules into importer high-priority override CSS so active Elementor exports can be corrected through the importer package without relying on a separate patch plugin.
- related tests: npm run test:elementor-export; npm run test:elementor-output-doctor; php -l generated importer PHP; live wp-admin activation; live homepage verification

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor
- review status: fixed
- reason if ignored:
- notes: Added regression coverage for importer/theme version 1.3.46 homepage parity rules, including header normal-flow CSS, `inline-flex` fit-content restoration, and location-card decorative bubble sizing.
- related tests: npm run test:elementor-export

## Focused Review Update - 2026-05-06 Elementor Header/FAQ/Duplicate Content

- path: components/Dashboard.tsx
- category: source
- lane/scope: Elementor / generated theme chrome / generated visual-fidelity runtime
- review status: fixed
- reason if ignored:
- notes: Reviewed existing WordPress-theme input handling and live FAQ runtime after the user requested header, FAQ, and duplicate-content verification. Added source `header.php`/`footer.php` chrome extraction, PHP-safe setup data serialization, and Radix FAQ hydration in the Elementor visual-fidelity runtime.
- related tests: npm run test:elementor-export; npm run test:elementor-output-doctor; npm run test:gutenberg-parity; npm run build; PHP lint generated v2/v4 theme files; live 99-route crawl; live FAQ interaction check

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor
- review status: fixed
- reason if ignored:
- notes: Added regression assertions for WordPress-theme chrome extraction, generated `setup.php` JSON decoding, and Radix FAQ runtime hydration/one-open initialization.
- related tests: npm run test:elementor-export

## Focused Review Update - 2026-05-07 Elementor Header Routes, FAQ Scope, Locations, and Breadcrumbs

- path: components/Dashboard.tsx
- category: source
- lane/scope: Elementor / generated theme routing / generated theme CSS
- review status: fixed
- reason if ignored:
- notes: Reviewed the generated WordPress route fallback and menu rendering helpers after live header dropdowns and nested aliases still behaved incorrectly. Added default route-prefix detection from menu/route evidence, title-aware menu URL normalization, generic route fallback ordering, nested `/locations/*` fallback, and stronger generated breadcrumb spacing CSS.
- related tests: npm run test:elementor-export; npm run build; php -l generated functions.php; live route/menu/FAQ/location verification; live crawl

- path: utils/elementorPluginTemplates.ts
- category: source
- lane/scope: Elementor / generated importer plugin / visual-fidelity override CSS
- review status: fixed
- reason if ignored:
- notes: Added the stronger `.tf-elementor-breadcrumbs > .elementor-widget + .elementor-widget` spacing rule to importer-bundled visual-fidelity CSS so breadcrumb spacing survives Elementor widget margin resets in already-installed exports.
- related tests: npm run test:elementor-export; live locations breadcrumb metric verification

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor
- review status: fixed
- reason if ignored:
- notes: Added regression coverage for default route-prefix detection, title-aware menu normalization, child menu title passing, direct generic route fallback ordering, and breadcrumb child-widget spacing selectors.
- related tests: npm run test:elementor-export

## Elementor V41 Visual Parity Checkpoint - 2026-05-10

- path: components/Dashboard.tsx
- category: source
- lane/scope: Elementor / generated theme runtime
- review status: partially reviewed / fixed
- notes: Reviewed and modified the visual-fidelity runtime around recent-work card headers, `.text-accent` restoration, hero CTA layout, and guarded mobile-only long-form section rhythm repair. Not a full-file audit.
- related tests: `npm run test:elementor-export`; targeted live visual parity smoke.

- path: utils/elementorPluginTemplates.ts
- category: source
- lane/scope: Elementor / importer plugin template/runtime
- review status: partially reviewed / fixed
- notes: Reviewed and modified importer-bundled visual-fidelity runtime/CSS equivalents and bumped importer version to `1.3.52`. Not a full-file audit.
- related tests: `npm run test:elementor-export`; generated importer PHP lint; generated runtime `node --check`.

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor / regression harness
- review status: partially reviewed / fixed
- notes: Added assertions for recent-work card header repair, mobile rhythm repair, importer/runtime version, and eager-image visual parity harness behavior.
- related tests: `npm run test:elementor-export`.

- path: scripts/elementor-visual-parity-regression.mjs
- category: test
- lane/scope: Elementor / visual parity harness
- review status: partially reviewed / fixed
- notes: Updated screenshot capture to force eager image loading and wait for image load/decode before full-page screenshots.
- related tests: targeted and broader live visual parity runs.

## Elementor V81 SaaS Visual + Interaction Parity Checkpoint - 2026-05-13

- path: components/Dashboard.tsx
- category: source
- lane/scope: Elementor / generated theme runtime and visual-fidelity CSS
- review status: partially reviewed / fixed
- notes: Reviewed and modified only the Elementor visual-fidelity runtime/CSS areas needed for V81: move-out mobile service-card source heights, scoped Radix FAQ row-height repair, safer Radix accordion item lookup, FAQ answer fallback matching, and generated runtime boot order. Not a full-file audit.
- related tests: `npm run test:elementor-export`; `npm run test:gutenberg-parity`; `npm run build`; live visual parity and interaction smoke.

- path: utils/elementorPluginTemplates.ts
- category: source
- lane/scope: Elementor / generated importer plugin runtime and CSS
- review status: partially reviewed / fixed
- notes: Reviewed and modified importer-bundled Elementor runtime/CSS for active live deployments: importer version `1.3.81`, scoped move-out row-height repair, importer-bundled Radix FAQ hydrator, sibling-close behavior, token-overlap FAQ matching, and common move-out FAQ fallbacks for older generated `faq-data.js` payloads. Not a full-file audit.
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; generated importer PHP lint; live FAQ/tab/header smoke.

- path: scripts/elementor-export-regression.mjs
- category: test
- lane/scope: Elementor / regression harness
- review status: partially reviewed / fixed
- notes: Added regression assertions for importer version `1.3.81`, move-out source-height CSS, scoped Radix row-height repair, importer-bundled FAQ hydration, sibling-close behavior, boot order, and fallback FAQ answer mapping.
- related tests: `npm run test:elementor-export`.

- path: scripts/elementor-visual-parity-regression.mjs
- category: test
- lane/scope: Elementor / visual parity harness
- review status: partially reviewed / fixed
- notes: Updated live/reference visual parity harness to classify effectively blank reference pages instead of failing valid live pages against blank screenshots. This keeps broad SaaS crawl evidence honest when the reference domain serves empty pages for some routes.
- related tests: targeted and broader live visual parity runs.

## SaaS Core V1 Foundation - 2026-05-13

- path: docs/superpowers/specs/2026-05-13-saas-core-v1-design.md
- category: doc
- lane/scope: SaaS / product architecture
- review status: fixed
- notes: Added SaaS Core V1 design scope, architecture, data flow, quality gates, non-goals, and success criteria.
- related tests: Documentation reviewed during implementation; `npm run build`.

- path: docs/superpowers/plans/2026-05-13-saas-core-v1.md
- category: doc
- lane/scope: SaaS / implementation plan
- review status: fixed
- notes: Added implementation plan for SaaS Core V1 modules, dashboard surface, tests, and ledgers.
- related tests: `npm run test:saas-core`; `npm run build`.

- path: utils/saas-core/types.ts
- category: source
- lane/scope: SaaS / shared types
- review status: fixed
- notes: Added canonical typed models for SaaS intake, projects, jobs, analysis, QA reports, artifacts, and repositories.
- related tests: `npm run test:saas-core`.

- path: utils/saas-core/analyzer.ts
- category: source
- lane/scope: SaaS / intake analysis
- review status: fixed
- notes: Added deterministic route/page archetype, section signal, risk flag, and lane suitability analysis.
- related tests: `npm run test:saas-core`.

- path: utils/saas-core/qa.ts
- category: source
- lane/scope: SaaS / QA reporting
- review status: fixed
- notes: Added deterministic QA report scoring for editability, visual readiness, fallback ratio, source-of-truth checks, warnings, and release status.
- related tests: `npm run test:saas-core`.

- path: utils/saas-core/orchestrator.ts
- category: source
- lane/scope: SaaS / project and job orchestration
- review status: fixed
- notes: Added local project creation, conversion job lifecycle, artifact manifest support, failure handling, and memory/storage repositories.
- related tests: `npm run test:saas-core`.

- path: components/SaasCorePanel.tsx
- category: source
- lane/scope: SaaS / dashboard
- review status: fixed
- notes: Added local-first SaaS Core panel that runs a sample job, displays analysis/QA/artifacts, and persists to browser storage.
- related tests: local Playwright smoke; `npm run build`.

- path: App.tsx
- category: source
- lane/scope: dashboard
- review status: fixed
- notes: Mounted the SaaS Core panel above the existing converter without changing conversion behavior.
- related tests: local Playwright smoke; `npm run build`.

- path: scripts/saas-core-regression.mjs
- category: test
- lane/scope: SaaS / regression harness
- review status: fixed
- notes: Added regression coverage for analyzer, QA, job lifecycle, artifact manifest, and repository behavior.
- related tests: `npm run test:saas-core`.

## SaaS Core V2 Local Pipeline Slice - 2026-05-14

- path: utils/saas-core/intake.ts
- category: source
- lane/scope: SaaS / intake normalization
- review status: fixed
- notes: Added static-site file intake normalization, HTML-to-route extraction, title/section/widget detection, form/script detection, and asset classification.
- related tests: `npm run test:saas-core`; local Playwright upload smoke.

- path: utils/saas-core/artifactStore.ts
- category: source
- lane/scope: SaaS / artifact storage
- review status: fixed
- notes: Added memory artifact store, manifest extraction, byte sizing, and deterministic pseudo-hash support for local pipeline artifacts.
- related tests: `npm run test:saas-core`.

- path: utils/saas-core/jobRunner.ts
- category: source
- lane/scope: SaaS / local job runner
- review status: fixed
- notes: Added local job runner that starts jobs, writes lane artifacts, writes QA report artifacts, attaches checks, and completes/fails through the orchestrator.
- related tests: `npm run test:saas-core`; local Playwright upload smoke.

- path: utils/saas-core/orchestrator.ts
- category: source
- lane/scope: SaaS / job orchestration
- review status: fixed
- notes: Extended `completeConversionJob` to accept multiple artifacts while preserving the existing single-artifact input shape.
- related tests: `npm run test:saas-core`.

- path: components/SaasCorePanel.tsx
- category: source
- lane/scope: SaaS / dashboard
- review status: fixed
- notes: Replaced in-component sample completion with the reusable local pipeline runner and added multi-file upload intake flow.
- related tests: local Playwright upload smoke; `npm run build`.

## Admin Backend V1 - 2026-05-14

- path: server/admin-backend/types.ts
- category: source
- lane/scope: SaaS / admin backend / contracts
- review status: fixed
- notes: Added local admin database, create-project input, and admin stats contracts.
- related tests: `npm run test:admin-backend`.

- path: server/admin-backend/jsonDatabase.ts
- category: source
- lane/scope: SaaS / admin backend / persistence
- review status: fixed
- notes: Added JSON-backed project/job persistence with directory creation and snapshot loading.
- related tests: `npm run test:admin-backend`.

- path: server/admin-backend/filesystemArtifactStore.ts
- category: source
- lane/scope: SaaS / admin backend / artifact storage
- review status: fixed
- notes: Added filesystem-backed artifact storage for local job artifacts and manifests.
- related tests: `npm run test:admin-backend`.

- path: server/admin-backend/adminService.ts
- category: source
- lane/scope: SaaS / admin backend / orchestration
- review status: fixed
- notes: Added backend service methods for creating projects from files, running local conversion jobs, listing records, and computing stats.
- related tests: `npm run test:admin-backend`.

- path: server/admin-backend/httpServer.ts
- category: source
- lane/scope: SaaS / admin backend / HTTP API
- review status: fixed
- notes: Added dependency-light local JSON API for health, stats, projects, jobs, project creation, and job execution.
- related tests: `npm run test:admin-backend`; backend health smoke.

- path: scripts/start-admin-backend.mjs
- category: script
- lane/scope: SaaS / admin backend / tooling
- review status: fixed
- notes: Added startup wrapper that compiles backend TypeScript modules into `.tools/admin-backend-runtime` and starts the local API.
- related tests: backend health smoke.

- path: scripts/admin-backend-regression.mjs
- category: test
- lane/scope: SaaS / admin backend / regression
- review status: fixed
- notes: Added regression coverage for JSON persistence, filesystem artifacts, service job execution, stats, and HTTP endpoints.
- related tests: `npm run test:admin-backend`.

- path: components/AdminBackendPanel.tsx
- category: source
- lane/scope: SaaS / dashboard / admin backend
- review status: fixed
- notes: Added dashboard panel for checking local backend health and displaying operator stats.
- related tests: local Playwright smoke; `npm run build`.

- path: App.tsx
- category: source
- lane/scope: dashboard
- review status: fixed
- notes: Mounted `AdminBackendPanel` above the SaaS Core panel while preserving the existing converter surface.
- related tests: local Playwright smoke; `npm run build`.

- path: package.json
- category: config
- lane/scope: tooling
- review status: fixed
- notes: Added `test:admin-backend` and `admin:backend` scripts.
- related tests: `npm run test:admin-backend`; backend health smoke.

- path: utils/saas-core/types.ts
- category: source
- lane/scope: SaaS / shared contracts
- review status: fixed
- notes: Exported `SaasSiteFileInput` so browser intake and backend intake share the same file-input contract.
- related tests: `npm run test:saas-core`; `npm run test:admin-backend`.

- path: utils/saas-core/intake.ts
- category: source
- lane/scope: SaaS / intake normalization
- review status: fixed
- notes: Reused the shared `SaasSiteFileInput` contract without changing intake behavior.
- related tests: `npm run test:saas-core`; `npm run test:admin-backend`.

## Production Backend V2 - 2026-05-14

- path: server/admin-backend/auth.ts
- category: source
- lane/scope: SaaS / production backend / auth
- review status: fixed
- notes: Added tenant owner bootstrap, password hashing, login, signed bearer token verification, and session info lookup.
- related tests: `npm run test:production-backend-v2`.

- path: server/admin-backend/types.ts
- category: source
- lane/scope: SaaS / production backend / contracts
- review status: fixed
- notes: Added tenant, user, role, record-link, public-user, and auth-context contracts while preserving admin database/service contracts.
- related tests: `npm run test:production-backend-v2`; `npm run test:admin-backend`.

- path: server/admin-backend/jsonDatabase.ts
- category: source
- lane/scope: SaaS / production backend / persistence
- review status: fixed
- notes: Upgraded snapshot normalization to version 2 and added tenant/user/project-link/job-link persistence methods.
- related tests: `npm run test:production-backend-v2`; `npm run test:admin-backend`.

- path: server/admin-backend/adminService.ts
- category: source
- lane/scope: SaaS / production backend / tenant orchestration
- review status: fixed
- notes: Added tenant-scoped project/job/stats/artifact methods while keeping V1 open-mode methods.
- related tests: `npm run test:production-backend-v2`; `npm run test:admin-backend`.

- path: server/admin-backend/httpServer.ts
- category: source
- lane/scope: SaaS / production backend / protected HTTP API
- review status: fixed
- notes: Added optional auth-required mode, login, `/me`, protected admin endpoints, unauthenticated `401`, and cross-tenant `404` behavior.
- related tests: `npm run test:production-backend-v2`; backend auth smoke.

- path: scripts/production-backend-v2-regression.mjs
- category: test
- lane/scope: SaaS / production backend / regression
- review status: fixed
- notes: Added regression coverage for auth, tenant isolation, protected HTTP endpoints, and tenant-scoped artifact reads.
- related tests: `npm run test:production-backend-v2`.

- path: scripts/start-admin-backend.mjs
- category: script
- lane/scope: SaaS / production backend / startup
- review status: fixed
- notes: Added auth module compilation, auth-enabled env bootstrap, and auth-required server mode.
- related tests: auth-enabled backend smoke.

- path: components/AdminBackendPanel.tsx
- category: source
- lane/scope: SaaS / dashboard / admin backend auth
- review status: fixed
- notes: Added auth-required detection, login fields, local bearer-token storage, authorized stats requests, and rejected-token handling.
- related tests: dashboard auth smoke; `npm run build`.

- path: docs/superpowers/specs/2026-05-14-production-backend-v2-design.md
- category: doc
- lane/scope: SaaS / production backend / design
- review status: fixed
- notes: Documents V2 scope, non-goals, architecture, data/security rules, env variables, and verification.
- related tests: documentation review.

- path: docs/superpowers/plans/2026-05-14-production-backend-v2.md
- category: doc
- lane/scope: SaaS / production backend / plan
- review status: fixed
- notes: Tracks the V2 implementation checklist and verification steps.
- related tests: documentation review.

## Production Infrastructure V3 - 2026-05-14

- path: server/admin-backend/productionInfra.ts
- category: source
- lane/scope: SaaS / production infrastructure
- review status: fixed
- notes: Added migrations, audit, billing, rate limiting, queue, signed artifact URLs, sandbox previews, and readiness services.
- related tests: `npm run test:production-infrastructure-v3`.

- path: server/admin-backend/types.ts
- category: source
- lane/scope: SaaS / production infrastructure / contracts
- review status: fixed
- notes: Added migration, audit, subscription, queue, and sandbox preview records.
- related tests: `npm run test:production-infrastructure-v3`.

- path: server/admin-backend/jsonDatabase.ts
- category: source
- lane/scope: SaaS / production infrastructure / persistence
- review status: fixed
- notes: Added snapshot version 3 and persistence methods for V3 records.
- related tests: `npm run test:production-infrastructure-v3`.

- path: server/admin-backend/httpServer.ts
- category: source
- lane/scope: SaaS / production infrastructure / protected API
- review status: fixed
- notes: Added readiness, audit, billing, queue, worker run-next, signed artifact URL, and sandbox preview endpoints plus rate limiting.
- related tests: `npm run test:production-infrastructure-v3`.

- path: scripts/start-admin-backend.mjs
- category: script
- lane/scope: SaaS / production infrastructure / startup
- review status: fixed
- notes: Wires V3 services and applies migrations when auth/production infrastructure is enabled.
- related tests: V3 startup smoke.

- path: components/AdminBackendPanel.tsx
- category: source
- lane/scope: SaaS / dashboard / production readiness
- review status: fixed
- notes: Displays migration, billing, queue, preview, and audit readiness when exposed by the backend.
- related tests: dashboard production-readiness smoke; `npm run build`.

- path: .env.production.example
- category: config
- lane/scope: SaaS / deployment
- review status: fixed
- notes: Documents required auth and V3 production infrastructure environment variables.
- related tests: documentation review.

- path: Dockerfile.admin-backend
- category: config
- lane/scope: SaaS / deployment
- review status: fixed
- notes: Adds Docker build/run entrypoint for the admin backend.
- related tests: documentation review; startup smoke covers runtime command.

- path: docs/deployment/production-backend-v3.md
- category: doc
- lane/scope: SaaS / deployment
- review status: fixed
- notes: Documents local auth-enabled run, Docker run, and provider boundaries.
- related tests: documentation review.

## Admin Console V1 - 2026-05-14

- path: components/AdminBackendPanel.tsx
- category: source
- lane/scope: SaaS / admin UI
- review status: fixed
- notes: Expanded the backend status panel into a tabbed admin console with overview, projects, jobs, artifacts, reports, sandboxes, billing, audit logs, settings/provider health, team, support, and API key pages.
- related tests: `npm run test:admin-console-v1`; `npm run build`.

- path: scripts/admin-console-v1-regression.mjs
- category: test
- lane/scope: SaaS / admin UI / regression
- review status: fixed
- notes: Seeds an auth-enabled V3 backend and verifies console login, every page, project search/detail, signed URL action, report viewer, audit logs, settings/provider health, support policy, and API key page.
- related tests: `npm run test:admin-console-v1`.

- path: docs/superpowers/specs/2026-05-14-admin-console-v1-design.md
- category: doc
- lane/scope: SaaS / admin UI / design
- review status: fixed
- notes: Documents Admin Console V1 scope, provider honesty, data flow, and verification.
- related tests: documentation review.

- path: docs/superpowers/plans/2026-05-14-admin-console-v1.md
- category: doc
- lane/scope: SaaS / admin UI / plan
- review status: fixed
- notes: Tracks the Admin Console V1 implementation checklist.
- related tests: documentation review.

## Client Portal V1 - 2026-05-14

- path: components/ClientPortal.tsx
- category: source
- lane/scope: SaaS / client UI
- review status: fixed
- notes: Adds the customer-first `Theme Convert` portal with intake options, output modes, workflow, project workspace, report snapshot, downloads, sandbox previews, and operator-tools handoff.
- related tests: `npm run test:client-portal-v1`; `npm run build`.

- path: App.tsx
- category: source
- lane/scope: SaaS / app shell
- review status: fixed
- notes: Mounts Client Portal V1 first and moves Admin Console V1, SaaS Core, and the legacy converter dashboard behind the operator-tools toggle.
- related tests: `npm run test:client-portal-v1`; `npm run test:admin-console-v1`; `npm run build`.

- path: scripts/client-portal-v1-regression.mjs
- category: test
- lane/scope: SaaS / client UI / regression
- review status: fixed
- notes: Starts Vite, verifies customer portal sections and copy, verifies workflow test IDs, and confirms operator tools still open Admin Console V1.
- related tests: `npm run test:client-portal-v1`.

- path: scripts/admin-console-v1-regression.mjs
- category: test
- lane/scope: SaaS / admin UI / regression
- review status: fixed
- notes: Updated to open operator tools before validating Admin Console V1 after the client portal became the first app surface.
- related tests: `npm run test:admin-console-v1`.

- path: docs/superpowers/specs/2026-05-14-client-portal-v1-design.md
- category: doc
- lane/scope: SaaS / client UI / design
- review status: fixed
- notes: Documents Client Portal V1 scope, architecture, non-goals, and verification.
- related tests: documentation review.

- path: docs/superpowers/plans/2026-05-14-client-portal-v1.md
- category: doc
- lane/scope: SaaS / client UI / plan
- review status: fixed
- notes: Tracks Client Portal V1 implementation steps and verification commands.
- related tests: documentation review.

## Production Backend Blueprint - 2026-05-14

- path: utils/backendBlueprint.ts
- category: source
- lane/scope: SaaS / shared backend architecture
- review status: fixed
- notes: Shared recommended stack, SQL schema contract, and readiness evaluator for the hybrid backend recommendation.
- related tests: `npm run test:production-backend-blueprint`; `npm run build`.

- path: server/admin-backend/providerBlueprint.ts
- category: source
- lane/scope: SaaS / backend architecture
- review status: fixed
- notes: Re-exports the backend blueprint for server-side consumers and future backend wiring.
- related tests: `npm run test:production-backend-blueprint`.

- path: components/AdminBackendPanel.tsx
- category: source
- lane/scope: SaaS / admin UI
- review status: fixed
- notes: Added a `Backend Blueprint` operator page showing the recommended hybrid backend, provider readiness, schema contract, and UI inspiration cues.
- related tests: `npm run test:production-backend-blueprint`; `npm run test:admin-console-v1`; `npm run build`.

- path: scripts/production-backend-blueprint-regression.mjs
- category: test
- lane/scope: SaaS / backend architecture / regression
- review status: fixed
- notes: Verifies the recommended backend stack, SQL contract, readiness counts, and the new admin-console blueprint page.
- related tests: `npm run test:production-backend-blueprint`.

## Admin Ops UI V2 - 2026-05-14

- path: components/AdminBackendPanel.tsx
- category: source
- lane/scope: SaaS / admin UI / conversion operations
- review status: fixed
- notes: Added Command Center, Run Detail, Live Logs, Visual QA, Editability, and Support Timeline pages to make the admin backend UI Whipify-specific rather than generic CRUD/admin tooling.
- related tests: `npm run test:admin-ops-ui-v2`; `npm run test:admin-console-v1`; `npm run build`.

- path: scripts/admin-ops-ui-v2-regression.mjs
- category: test
- lane/scope: SaaS / admin UI / regression
- review status: fixed
- notes: Seeds a project/job/preview and verifies the new ops pages, quick actions, run timeline, structured logs, visual QA, editability, and support timeline surfaces.
- related tests: `npm run test:admin-ops-ui-v2`.

- path: scripts/admin-console-v1-regression.mjs
- category: test
- lane/scope: SaaS / admin UI / regression
- review status: fixed
- notes: Updated old tab navigation selectors to exact button names after adding `Support Timeline`.
- related tests: `npm run test:admin-console-v1`.
