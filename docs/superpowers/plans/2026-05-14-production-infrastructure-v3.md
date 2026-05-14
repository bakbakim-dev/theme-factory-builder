# Production Infrastructure V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tested production infrastructure seams around the Whipify admin backend.

**Architecture:** Extend the V2 auth/tenant backend with provider-ready local adapters for migrations, audit, billing, rate limiting, queue, artifact signing, sandbox previews, readiness, and deployment configuration.

**Tech Stack:** TypeScript, Node `http`, Node `crypto`, JSON adapter, React dashboard, Dockerfile/environment docs.

---

### Task 1: Regression First

- [x] Add `scripts/production-infrastructure-v3-regression.mjs`.
- [x] Add `npm run test:production-infrastructure-v3`.
- [x] Verify red against missing `server/admin-backend/productionInfra.ts`.

### Task 2: Persistent Records

- [x] Extend `server/admin-backend/types.ts` with migration, audit, subscription, queue, and sandbox preview records.
- [x] Extend `server/admin-backend/jsonDatabase.ts` with snapshot version 3 and V3 persistence methods.

### Task 3: Production Services

- [x] Add `server/admin-backend/productionInfra.ts`.
- [x] Implement idempotent migrations.
- [x] Implement tenant audit events.
- [x] Implement local subscription state.
- [x] Implement in-memory rate limiting.
- [x] Implement queue enqueue/run-next.
- [x] Implement signed artifact URLs.
- [x] Implement sandbox preview records.
- [x] Implement tenant readiness summary.

### Task 4: Protected HTTP Endpoints

- [x] Wire V3 services into `server/admin-backend/httpServer.ts`.
- [x] Add readiness, audit, billing, queued jobs, worker run-next, signed artifact URL, and sandbox preview endpoints.
- [x] Apply rate limiting to authenticated production requests.

### Task 5: Startup And Dashboard

- [x] Compile and instantiate V3 services in `scripts/start-admin-backend.mjs`.
- [x] Apply migrations on startup when V3 is enabled.
- [x] Display production readiness in `components/AdminBackendPanel.tsx`.

### Task 6: Deployment Artifacts

- [x] Add `.env.production.example`.
- [x] Add `Dockerfile.admin-backend`.
- [x] Add `docs/deployment/production-backend-v3.md`.

### Task 7: Verification And Save

- [x] Run V3 regression.
- [x] Run V2/V1/SaaS/converter regressions.
- [x] Run build.
- [x] Run V3 startup smoke.
- [x] Run dashboard production-readiness smoke.
- [x] Update ledgers.
- [x] Commit and push.
