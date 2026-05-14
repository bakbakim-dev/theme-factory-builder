# Production Infrastructure V3 Design

## Goal

Production Infrastructure V3 adds the next SaaS production seams around the Whipify admin backend: migrations, audit logs, billing/subscription state, rate limiting, worker queue records, signed artifact URLs, sandbox preview records, and deployment configuration.

This does not pretend external vendors are already connected. Instead, V3 creates tested provider boundaries with local/test adapters so Stripe, managed Postgres, S3/R2/GCS, queue workers, and hosted WordPress provisioning can be added without changing the core converter contracts.

## Scope

V3 includes:

- Database migration records and idempotent migration application.
- Tenant-scoped audit events.
- Tenant-scoped subscription/billing state.
- In-memory rate limiting for protected admin API requests.
- Tenant-scoped conversion queue records and a local worker runner.
- Signed artifact URL generation.
- Tenant-scoped WordPress sandbox preview records.
- Production readiness summary endpoint.
- Deployment env example, Dockerfile, and deployment notes.

## Non-Goals

V3 does not include real Stripe API calls, cloud object uploads, managed database hosting, remote worker infrastructure, DNS/proxy automation, or real hosted WordPress provisioning. Those are provider implementation tracks that now have explicit interfaces and tests to target.

## Architecture

- `server/admin-backend/productionInfra.ts` owns production service adapters for migrations, audit, billing, rate limiting, queue, signed artifact URLs, sandbox previews, and readiness.
- `server/admin-backend/types.ts` defines the new persistent record types.
- `server/admin-backend/jsonDatabase.ts` persists V3 records in the local JSON adapter.
- `server/admin-backend/httpServer.ts` exposes protected V3 endpoints when production infrastructure is configured.
- `scripts/start-admin-backend.mjs` enables V3 services when auth or `WHIPIFY_ADMIN_ENABLE_PRODUCTION_INFRA=1` is present.
- `components/AdminBackendPanel.tsx` displays production readiness when available.

## Verification

`npm run test:production-infrastructure-v3` proves:

- Migrations apply once and are idempotent.
- Subscription state can be created and required.
- Rate limiting denies excess tenant requests.
- Queue records enqueue and complete conversion jobs.
- Signed artifact URLs require tenant ownership.
- Sandbox preview records are tenant-scoped.
- Audit logs record billing, queue, artifact, and sandbox actions.
- Protected HTTP endpoints expose readiness, billing, audit, sandbox previews, and signed artifact URLs.
