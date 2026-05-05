# Project Map

## Purpose

Whipify / Theme Factory AI converts React or static build artifacts into WordPress-ready outputs. The core product promise is native, maintainable WordPress output instead of brittle DOM persistence.

## Export Lanes

- Platinum/Gutenberg: canonical WordPress theme/plugin export, with Gutenberg-backed page content and separate global chrome editing.
- Elementor: additive native Elementor export lane using real WordPress pages, Elementor document data, scoped CSS, native widgets, and generated widgets where needed.
- Static Site: pure static output with SEO, forms, sitemap, robots, redirects, and interaction runtime.
- URL Capture: browser capture/certification flow that creates route and asset artifacts from public URLs.

## Key Entrypoints

- `index.tsx`: React app bootstrap.
- `App.tsx`: top-level app shell.
- `components/Dashboard.tsx`: main converter dashboard and major export orchestration.
- `utils/converter.ts`: Gutenberg/theme conversion support.
- `utils/plugintemplates.ts`: companion WordPress plugin templates.
- `utils/elementorConverter.ts`: Elementor document generation.
- `utils/elementorPluginTemplates.ts`: Elementor importer and generated widget runtime templates.
- `utils/whipifyFrontendEditor.ts`: frontend editor artifacts.
- `utils/whipifyQuickEditor.ts`: global Quick Editor artifacts.
- `utils/wordpress-content-registry.ts`: content registry/contract utilities.
- `scripts/*`: regression, smoke, and doctor checks.

## Current Active Work

Active focus is Elementor live visual-fidelity parity for the Edmonton page:

- Current Elementor page: `https://mikaily128.sg-host.com/edmonton/`
- Reference static page: `https://mikaily129.sg-host.com/edmonton/`
- Current live runtime path: generated theme visual-fidelity CSS/JS plus active `Whipify Elementor Importer` version `1.3.4`.
- The old `.tools/live-patches/000-whipify-edmonton-elementor-patch` flow is diagnostic history only; public verification shows no Edmonton patch CSS/JS is loaded.
- Importer `1.3.4` bundles generic visual-fidelity fallback assets, always enqueues its override JS on Whipify Elementor pages so older generated theme runtimes can be superseded, and always enqueues high-priority override CSS for older installed generated themes that need durable fixes such as pricing buttons, About fallback layout, source-layout metrics, footer button CTAs, breadcrumb offset, leading source icon SVG injection, four-column compact paragraph utility sizing, true `md:w-1/3` carousel widths, and source-like About counter animation.

## Latest Edmonton Evidence

- Evidence directory: `.tools/live-edmonton-1-3-4-verify-1777614786829`
- Section screenshot directory: `.tools/live-edmonton-section-pass-1777614339900`
- FAQ starts closed with `faqOpenCount=0`.
- Review carousel first card now measures `384px` wide with `flex-basis: 33.3333%`, matching the source/reference track.
- About counters initialize as `0+`, `0+`, `0+`, `0%`, `15+`, `100%` and settle to `10+`, `5,000+`, `500+`, `95%`, `15+`, `100%`.
- Cleanup note: obsolete inactive Edmonton patch plugin rows and old inactive importer rows remain visible in wp-admin, but public verification confirms active runtime assets come from importer `1.3.4`.

## Exclusions By Default

- `node_modules/`: dependency cache, not reviewed unless debugging dependency behavior.
- `dist/`: generated output, reviewed only when validating a build artifact.
- `.tools/`: mostly diagnostics/generated/live patches; review specific files only when they are active work artifacts.
