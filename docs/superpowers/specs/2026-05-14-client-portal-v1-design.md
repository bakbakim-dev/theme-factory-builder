# Client Portal V1 Design

## Purpose

Client Portal V1 makes the product feel like a customer-facing SaaS instead of an internal converter dashboard. It introduces the `Theme Convert` surface for non-technical users who are coming from AI website builders, static exports, React builds, or public URLs.

## Product Positioning

The portal explains Whipify in customer language:

- Paste or upload the site they already have.
- Choose an output: Platinum WordPress, Native Elementor, or Static SEO export.
- Watch the conversion pipeline.
- Review preview parity, editability, SEO, and downloadable artifacts.
- Open internal operator tools only when needed.

## Architecture

- `components/ClientPortal.tsx` is the customer-facing shell.
- `App.tsx` mounts `ClientPortal` first and moves `AdminBackendPanel`, `SaasCorePanel`, and `Dashboard` behind an explicit operator-tools toggle.
- Admin Console V1 remains unchanged as the internal operations surface.
- Existing converter/backend logic remains isolated; Client Portal V1 is a presentational SaaS shell over the existing tracks.

## UI Model

Primary customer sections:

- Top navigation with `Theme Convert` branding and customer destinations.
- Hero explaining AI/static/build-to-WordPress conversion.
- Start New Conversion with intake options for AI builder URL, static ZIP, React build folder, and public website crawl.
- Choose Output cards for Platinum WordPress, Native Elementor, and Static SEO export.
- Conversion Workflow timeline.
- Projects table.
- Report Snapshot for preview parity, editability score, and SEO handoff.
- Downloads, sandbox previews, and secure handoff cards.
- Operator-tools entry point for internal/admin features.

## Non-Goals

- Does not wire real Stripe, S3/R2/GCS, managed DB, remote workers, or WordPress provisioning.
- Does not change Gutenberg/Platinum or Elementor conversion semantics.
- Does not remove the existing converter dashboard.
- Does not claim full visual parity without the existing screenshot/QA evidence pipeline.

## Verification

- `npm run test:client-portal-v1` verifies the portal is visible first, customer language is present, intake/output/workflow sections exist, and operator tools can still be opened.
- `npm run test:admin-console-v1` verifies the admin console still works after being moved behind the operator-tools toggle.
- `npm run build` verifies the React app compiles for production.
