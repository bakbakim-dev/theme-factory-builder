# Production Backend V3 Deployment Notes

Production Infrastructure V3 provides the backend seams needed before a hosted SaaS rollout:

- Admin auth and tenant isolation.
- Database migration records.
- Audit logs.
- Billing/subscription state.
- Rate limiting.
- Worker queue records.
- Signed artifact URLs.
- Sandbox preview records.
- Docker-ready admin backend process.

## Local Auth-Enabled Run

Copy `.env.production.example` to a private `.env.production.local` file and replace every secret.

PowerShell example:

```powershell
$env:WHIPIFY_ADMIN_REQUIRE_AUTH='1'
$env:WHIPIFY_ADMIN_TOKEN_SECRET='replace-with-a-long-random-secret'
$env:WHIPIFY_ADMIN_EMAIL='admin@example.com'
$env:WHIPIFY_ADMIN_PASSWORD='replace-with-a-strong-password'
$env:WHIPIFY_ADMIN_ENABLE_PRODUCTION_INFRA='1'
npm run admin:backend
```

## Docker Build

```powershell
docker build -f Dockerfile.admin-backend -t whipify-admin-backend:v3 .
docker run --env-file .env.production.local -p 8787:8787 -v whipify-admin-data:/data whipify-admin-backend:v3
```

## Current Provider Boundaries

The V3 code intentionally uses local/test providers for the pieces that require external accounts:

- Database: JSON adapter with migration records. Replace with managed Postgres/MySQL adapter before public SaaS.
- Artifact storage: signed URL contract backed by local artifact IDs. Replace with S3/R2/GCS object storage.
- Billing: subscription state contract. Replace provider writes with Stripe before paid launch.
- Sandbox previews: preview record/URL contract. Replace local provider with hosted WordPress provisioning.
- Worker queue: persisted queue records. Replace runner with a remote worker/queue such as BullMQ, SQS, Cloud Tasks, or equivalent.

These boundaries are now explicit and regression-covered, so the next tracks can swap providers without changing the dashboard/conversion contracts.
