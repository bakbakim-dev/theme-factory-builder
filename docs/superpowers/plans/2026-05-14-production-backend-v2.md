# Production Backend V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-aware authentication and protected backend contracts for the Whipify admin backend.

**Architecture:** Extend Admin Backend V1 instead of rewriting it. Add an auth module, tenant-aware JSON persistence, tenant-aware service methods, protected HTTP endpoints, startup auth bootstrap, and dashboard login awareness.

**Tech Stack:** TypeScript, Node `http`, Node `crypto`, JSON persistence, React dashboard, existing SaaS core pipeline.

---

### Task 1: Regression First

**Files:**
- Create: `scripts/production-backend-v2-regression.mjs`
- Modify: `package.json`

- [x] Add `npm run test:production-backend-v2`.
- [x] Add a regression that compiles backend modules and fails because `server/admin-backend/auth.ts` does not exist.
- [x] Verify red with `npm run test:production-backend-v2`.

### Task 2: Auth And Tenant Contracts

**Files:**
- Modify: `server/admin-backend/types.ts`
- Create: `server/admin-backend/auth.ts`

- [x] Add tenant, user, public user, role, record-link, and auth-context types.
- [x] Add PBKDF2 password hashing.
- [x] Add tenant owner bootstrap.
- [x] Add login and invalid-login handling.
- [x] Add signed bearer token creation and verification.
- [x] Add session info lookup.

### Task 3: Tenant Persistence

**Files:**
- Modify: `server/admin-backend/jsonDatabase.ts`

- [x] Upgrade JSON snapshot shape to version 2.
- [x] Preserve old project/job reads through normalization.
- [x] Add tenant/user persistence.
- [x] Add project-tenant and job-tenant links.
- [x] Add tenant-scoped project/job read and write methods.

### Task 4: Tenant Service Layer

**Files:**
- Modify: `server/admin-backend/adminService.ts`

- [x] Keep V1 open-mode methods intact.
- [x] Add tenant-scoped project creation.
- [x] Add tenant-scoped job execution.
- [x] Add tenant-scoped project/job lists.
- [x] Add tenant-scoped stats.
- [x] Add tenant-scoped artifact reads.

### Task 5: Protected HTTP API

**Files:**
- Modify: `server/admin-backend/httpServer.ts`

- [x] Add optional auth service and `requireAuth` mode.
- [x] Add `POST /api/admin/auth/login`.
- [x] Add `GET /api/admin/me`.
- [x] Protect stats, projects, jobs, job creation, and artifacts when auth is required.
- [x] Return `401` for missing/invalid token.
- [x] Return `404` for cross-tenant project and artifact access.

### Task 6: Startup And Dashboard

**Files:**
- Modify: `scripts/start-admin-backend.mjs`
- Modify: `components/AdminBackendPanel.tsx`
- Modify: `.gitignore`

- [x] Compile the auth module in the startup wrapper.
- [x] Bootstrap admin owner from environment variables.
- [x] Enable protected mode when credentials/auth env vars are present.
- [x] Add dashboard login controls for auth-required backend mode.
- [x] Ignore local `storage/` runtime data.

### Task 7: Verification And Save

**Files:**
- Modify: `codex-work/*`

- [x] Run `npm run test:production-backend-v2`.
- [x] Run V1/backend and converter regression commands.
- [x] Run build.
- [x] Run auth-enabled backend smoke.
- [x] Run dashboard auth smoke.
- [x] Update ledgers.
- [x] Commit and push.
