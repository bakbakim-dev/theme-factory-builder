# Admin Console V1 Design

## Goal

Admin Console V1 turns the previous backend status panel into an operator console for the Whipify SaaS backend. It gives admins a single place to inspect projects, jobs, artifacts, reports, sandboxes, billing state, audit logs, provider readiness, team/role boundaries, support controls, and API-key/secret policy.

## Scope

Admin Console V1 includes:

- Overview dashboard.
- Project list with search/filter/status.
- Project detail panel.
- Jobs and queue page with worker run-next action.
- Artifacts page with signed URL action.
- Conversion report viewer.
- Sandbox preview manager.
- Billing/subscription screen.
- Audit log viewer.
- Settings/provider health page.
- Worker health, incident, rate-limit, and notification panels.
- Team/user management view.
- Support and carefully-disabled impersonation policy panel.
- API key and secret-management policy panel.
- Role-based permission guidance.

## Provider Honesty

The UI is fully surfaced, but it does not pretend unavailable external providers are connected. Stripe, managed DB, S3/R2/GCS, remote workers, hosted WordPress provisioning, observability, and secret managers are represented as provider-pending panels until real credentials/providers are wired.

## Data Flow

The console uses the existing V3 backend:

- `/api/admin/health`
- `/api/admin/auth/login`
- `/api/admin/me`
- `/api/admin/stats`
- `/api/admin/projects`
- `/api/admin/jobs`
- `/api/admin/audit-events`
- `/api/admin/billing/subscription`
- `/api/admin/sandbox-previews`
- `/api/admin/production/readiness`
- `/api/admin/artifacts/:id/signed-url`
- `/api/admin/projects/:id/sandbox-previews`
- `/api/admin/worker/run-next`

## Verification

`npm run test:admin-console-v1` starts an auth-enabled V3 backend, seeds a project/job/billing/sandbox, opens the dashboard in Playwright, logs in, verifies every Admin Console page exists, exercises project search/detail, creates a signed artifact URL, verifies the report viewer, audit logs, provider/worker/rate-limit/incident/notification panels, support/impersonation policy, and API key page.
