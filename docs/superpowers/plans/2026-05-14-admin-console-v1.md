# Admin Console V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow backend status panel with a multi-page admin/operator console.

**Architecture:** Keep the existing `AdminBackendPanel` mount point, but expand it into a tabbed Admin Console backed by the V3 HTTP API. Add a Playwright-style regression that seeds backend data, logs in, and verifies each console page.

**Tech Stack:** React, TypeScript, Tailwind classes, lucide-react icons, Node/Playwright regression script, V3 local backend.

---

### Task 1: Regression First

- [x] Add `scripts/admin-console-v1-regression.mjs`.
- [x] Add `npm run test:admin-console-v1`.
- [x] Verify red because the existing panel does not expose `Admin Console V1` pages.

### Task 2: Console Data Model

- [x] Fetch health, stats, readiness, projects, jobs, current user, audit events, subscription, and sandbox previews.
- [x] Derive artifacts from job manifests.
- [x] Keep login/token flow and saved-token handling.

### Task 3: Console Pages

- [x] Add Overview.
- [x] Add Projects with search/filter/status and detail panel.
- [x] Add Jobs/queue with worker run-next.
- [x] Add Artifacts with signed URL action.
- [x] Add Reports viewer.
- [x] Add Sandboxes manager.
- [x] Add Billing page.
- [x] Add Audit Logs page.
- [x] Add Settings/provider health, worker health, rate-limit, incident, and notifications.
- [x] Add Team/roles page.
- [x] Add Support/impersonation policy page.
- [x] Add API keys/secrets policy page.

### Task 4: Verification

- [x] Run `npm run test:admin-console-v1`.
- [x] Run `npm run build`.
- [x] Run production/backend/SaaS/Gutenberg/Elementor regressions.
- [x] Update ledgers.
- [x] Commit and push.
