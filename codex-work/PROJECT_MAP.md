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

Active focus is SaaS Core V1 productization. The Elementor V81 live parity build track is complete locally and recorded in `NEXT_PROMPT.md`.

SaaS Core V1 adds a local-first product foundation around the converter:

- Project model for uploaded/captured sites.
- Conversion job lifecycle.
- Intake analysis for routes, assets, page archetypes, section signals, risk flags, and lane suitability.
- QA report scoring for editability, visual readiness, source-of-truth checks, warnings, and release status.
- Artifact manifest tracking.
- Browser-storage-compatible project persistence.
- Dashboard panel mounted above the existing converter.
- V2 local pipeline slice for uploaded/static site files, artifact storage, and reusable local job execution.
- Admin Backend V1 for local API operations, JSON database persistence, filesystem artifact storage, admin stats, and dashboard backend status checks.
- Production Backend V2 for tenant/workspace records, password-backed admin users, signed bearer tokens, protected admin endpoints, tenant-scoped project/job APIs, and tenant-scoped artifact reads.
- Production Infrastructure V3 for migrations, audit logs, subscription state, rate limiting, queue records, signed artifact URL contracts, sandbox preview records, readiness reporting, and deployment artifacts.
- Admin Console V1 for operator-facing pages across overview, projects, jobs, artifacts, reports, sandboxes, billing, audit logs, settings/provider health, team, support, and API keys.

This is not full hosted SaaS yet. Production Infrastructure V3 adds tested provider seams, but real external vendors still need to be wired in for Stripe, managed database hosting, cloud object storage, remote workers, and hosted WordPress provisioning.

## Latest Elementor Evidence

- Active live importer recorded from the V81 pass: `Whipify Elementor Importer 1.3.81`.
- Targeted visual evidence: `logs/regression-2026-05-07/visual-parity-v81-final-targeted-20260513/summary.json`.
- Broad crawl evidence: `logs/regression-2026-05-07/visual-parity-v81-final-broader-crawl-25-20260513/summary.json`.
- V81 broad crawl compared 25 pages across 2 viewports with `failureCount: 0`.

## Exclusions By Default

- `node_modules/`: dependency cache, not reviewed unless debugging dependency behavior.
- `dist/`: generated output, reviewed only when validating a build artifact.
- `.tools/`: mostly diagnostics/generated/live patches; review specific files only when they are active work artifacts.
