# SaaS Core V1 Design

## Goal

Build a repeatable SaaS foundation for Whipify without pretending the current local converter is already a full hosted platform. SaaS Core V1 turns conversion work into projects, jobs, analysis results, QA reports, artifact manifests, and dashboard summaries that can later move behind real auth, billing, storage, queues, and hosted WordPress sandboxes.

## Product Scope

SaaS Core V1 targets AI-generated/static marketing websites and build artifacts. It does not claim universal conversion for every arbitrary web app. It should support:

- ZIP/static build intake.
- Public URL/capture intake as a planned adapter shape.
- Existing artifact intake as a planned adapter shape.
- Gutenberg/Platinum, Elementor, and static output lanes as isolated targets.
- Project/job status tracking.
- Site analysis before conversion.
- QA report generation after conversion.
- Editability and visual-readiness scoring.
- Artifact manifest tracking for downloadable outputs.

## Non-Goals

V1 does not include production user auth, Stripe billing, cloud object storage, remote worker queues, hosted WordPress sandbox provisioning, or multi-tenant database migrations. The module boundaries must make those later changes straightforward.

## Architecture

The implementation is split into focused, framework-light modules:

- `utils/saas-core/types.ts`: canonical SaaS project, intake, job, analysis, QA, and artifact types.
- `utils/saas-core/analyzer.ts`: deterministic site/artifact analysis.
- `utils/saas-core/qa.ts`: deterministic QA/editability/report scoring.
- `utils/saas-core/orchestrator.ts`: project/job lifecycle and artifact manifest generation.
- `components/SaasCorePanel.tsx`: dashboard surface for the local SaaS foundation.
- `scripts/saas-core-regression.mjs`: Node regression coverage for analyzer, QA, and orchestrator.

The current dashboard remains the heavy local converter. SaaS Core V1 wraps that product model instead of replacing or mutating the Platinum/Gutenberg and Elementor lanes.

## Data Flow

1. User creates a project from an intake source.
2. The analyzer scans route count, asset count, page archetypes, section signals, interactive risk, and output-lane suitability.
3. The orchestrator creates a queued conversion job with selected lanes.
4. The job runs a deterministic local simulation that records the exact checks a production worker would run.
5. QA computes visual-readiness, editability, fallback risk, lane isolation status, and release recommendation.
6. The dashboard displays project status, job status, scores, warnings, and artifact manifest entries.

## Quality Gates

Each SaaS report must include:

- Native editability score.
- Visual readiness score.
- Unsupported/fallback risk count.
- Lane isolation status.
- Checks for Platinum/Gutenberg source-of-truth preservation.
- Checks for Elementor source-of-truth preservation.
- Explicit warnings when the site is not safe to market as fully native.

## Success Criteria

- A user can create a SaaS project locally from a synthetic or uploaded-style intake model.
- A job can move from queued to completed or failed with audit events.
- Analysis and QA reports are deterministic and test-covered.
- The dashboard has a visible SaaS readiness panel with scores and next actions.
- Existing Elementor and Gutenberg regression tests still pass.
- `NEXT_PROMPT.md`, ledgers, and the plan file identify this as a SaaS Core V1 foundation, not a full production SaaS.

## V2 Pipeline Extension

The first V2 slice connects the SaaS model to an executable local pipeline:

- Browser-selected site files can become a real `SaasIntakeSource`.
- HTML files are normalized into routes.
- CSS, JS, images, fonts, documents, and other files are normalized into assets.
- A local job runner creates lane-specific artifact manifests for Platinum/Gutenberg, Elementor, static output, and QA reports.
- Artifacts are stored through a swappable artifact store interface.
- The dashboard can run both the sample pipeline and uploaded-file pipeline.

This still does not provision hosted WordPress sandboxes or call cloud workers. It creates the local seam those systems can plug into.

## Admin Backend V1 Extension

The first backend slice moves the SaaS workflow beyond browser-only state:

- `server/admin-backend/jsonDatabase.ts` persists projects and jobs to local JSON files.
- `server/admin-backend/filesystemArtifactStore.ts` persists job artifacts and artifact manifests to the filesystem.
- `server/admin-backend/adminService.ts` creates projects from uploaded/static files, runs the local SaaS conversion job, and exposes admin stats.
- `server/admin-backend/httpServer.ts` exposes a local JSON API for health, stats, projects, jobs, project creation, and job execution.
- `scripts/start-admin-backend.mjs` compiles the TypeScript backend modules and starts the local API.
- `components/AdminBackendPanel.tsx` lets the dashboard check backend health and see operator stats.

This is intentionally local/dev-only. It has no production authentication, authorization, rate limiting, tenant isolation, billing, cloud object storage, or remote worker queue yet, so it must not be exposed publicly as a hosted SaaS backend.
