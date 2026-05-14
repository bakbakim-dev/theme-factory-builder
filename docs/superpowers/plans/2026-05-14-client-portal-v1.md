# Client Portal V1 Implementation Plan

## Scope

Build a customer-facing SaaS portal that appears before admin/operator tooling and frames Whipify as `Theme Convert`.

## Steps

1. Add a regression script that starts Vite and verifies the customer portal, conversion options, workflow, project/report/download surfaces, and operator-tools access.
2. Add `components/ClientPortal.tsx` with customer-first SaaS layout and language.
3. Update `App.tsx` to mount the portal first and move admin/backend/converter tools behind an operator-tools toggle.
4. Update the admin console regression to open operator tools before checking Admin Console V1.
5. Add `npm run test:client-portal-v1`.
6. Run targeted regressions and production build.

## Verification Commands

- `npm run test:client-portal-v1`
- `npm run test:admin-console-v1`
- `npm run test:saas-core`
- `npm run test:production-infrastructure-v3`
- `npm run test:production-backend-v2`
- `npm run test:admin-backend`
- `npm run build`
