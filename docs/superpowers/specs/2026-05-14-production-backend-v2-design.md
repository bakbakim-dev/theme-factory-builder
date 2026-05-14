# Production Backend V2 Design

## Goal

Production Backend V2 hardens the local Admin Backend V1 into a tenant-aware backend contract. It does not claim the entire Whipify SaaS is production-complete, but it adds the backend security and data boundaries that must exist before billing, cloud queues, hosted WordPress sandboxes, or public deployment can be credible.

## Scope

V2 adds:

- Password-backed admin identities.
- Tenant/workspace records.
- Signed bearer tokens.
- Protected admin endpoints.
- Tenant-scoped projects and jobs.
- Tenant-scoped artifact reads.
- Startup support for auth-enabled local backend mode.
- Dashboard awareness for auth-required backends.

V2 intentionally does not add Stripe, public signup, email verification, cloud object storage, managed Postgres, remote workers, Kubernetes/deployment IaC, or hosted WordPress sandbox provisioning. Those are separate tracks that depend on these contracts.

## Architecture

The backend remains dependency-light and local-first so it can run inside this repo without a cloud account. The core boundary is now explicit:

- `server/admin-backend/auth.ts` owns password hashing, owner bootstrap, login, token signing, token verification, and session info.
- `server/admin-backend/jsonDatabase.ts` persists tenants, users, project-tenant links, and job-tenant links alongside the existing project/job records.
- `server/admin-backend/adminService.ts` exposes tenant-scoped project/job/artifact methods and keeps the V1 methods intact for local open-mode compatibility.
- `server/admin-backend/httpServer.ts` can run in open V1 mode or auth-required V2 mode.
- `scripts/start-admin-backend.mjs` enables auth when admin credential environment variables are present.
- `components/AdminBackendPanel.tsx` can detect an auth-required backend, login, store a local bearer token, and fetch stats with authorization.

## Data And Security Rules

- User passwords are never stored raw. They are salted and hashed with PBKDF2-SHA256.
- Session tokens are signed with an HMAC secret and include user ID, tenant ID, email, role, and expiry.
- The same admin email cannot be bootstrapped into a second tenant.
- Protected routes require `Authorization: Bearer <token>`.
- Tenant A cannot list, run, or read Tenant B projects, jobs, or artifacts.
- Artifact reads are authorized through tenant job ownership before content is returned.
- The local backend binds to `127.0.0.1`; it should not be exposed publicly.

## Environment

Auth mode is enabled by setting:

- `WHIPIFY_ADMIN_REQUIRE_AUTH=1`
- `WHIPIFY_ADMIN_TOKEN_SECRET`
- `WHIPIFY_ADMIN_EMAIL`
- `WHIPIFY_ADMIN_PASSWORD`
- `WHIPIFY_ADMIN_TENANT_NAME` optional
- `WHIPIFY_ADMIN_TENANT_SLUG` optional
- `WHIPIFY_ADMIN_DISPLAY_NAME` optional

Without those variables, the backend still supports the V1 open local mode for development compatibility.

## Verification

`npm run test:production-backend-v2` verifies:

- Tenant owner bootstrap.
- Password hashing without raw password persistence.
- Login success and failure.
- Token verification.
- Tenant-scoped project and job lists.
- Cross-tenant project/job denial.
- Tenant-scoped artifact reads.
- Protected HTTP endpoints returning `401` without a token.
- Login, `/me`, project creation, project listing, cross-tenant job denial, and artifact read over HTTP.
