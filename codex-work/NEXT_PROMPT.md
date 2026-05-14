DONE

Completed Admin Console V1 for the Whipify / Theme Factory AI SaaS productization track.

Current verified state:
- Admin Console V1 replaces the narrow backend status panel.
- The console includes pages for Overview, Projects, Jobs, Artifacts, Reports, Sandboxes, Billing, Audit Logs, Settings/provider health, Team, Support, and API Keys.
- Live V3-backed actions include login, project/job/artifact/report/audit/billing/preview/readiness fetches, signed artifact URL creation, sandbox preview creation, and worker run-next.
- Provider-dependent areas are visible and explicitly marked pending until real managed DB, Stripe, cloud storage, remote worker, hosted WordPress, observability, and secret providers are connected.

Verification evidence:
- `npm run test:admin-console-v1`: pass.
- `npm run build`: pass, with existing warnings for missing `/index.css` and large bundle size.
- `npm run test:production-infrastructure-v3`: pass.
- `npm run test:production-backend-v2`: pass.
- `npm run test:admin-backend`: pass.
- `npm run test:saas-core`: pass.
- `npm run test:gutenberg-parity`: pass.
- `npm run test:elementor-export`: pass.
- `npm run test:elementor-output-doctor`: pass.

If continuing later, use:
"Continue the deep Whipify project audit from `codex-work/NEXT_PROMPT.md`. Read `codex-work/PROJECT_MAP.md`, `FILE_REVIEW_STATUS.md`, `AUDIT_LEDGER.md`, `FIX_LEDGER.md`, and `TEST_LEDGER.md` first. Resume at the next unchecked file or unresolved issue. Do not restart from scratch."
