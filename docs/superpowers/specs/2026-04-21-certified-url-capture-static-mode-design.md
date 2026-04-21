# Certified URL Capture for Static Site Mode

Date: 2026-04-21
Status: Approved for planning
Scope: Static Site mode only

## Summary

Add a new URL-based input mode to the converter that captures a public React site, reconstructs a synthetic build artifact, and then feeds that artifact into the existing Static Site export pipeline.

This mode is not a generic crawler. It is a certification-oriented capture system with three possible outcomes:

1. Certified artifact-equivalent static export
2. Needs more input before certification is possible
3. Uncertified best-effort static export

The system must fail closed for certification. It may only label an output as certified when it has enough evidence to support that claim. If it cannot prove completeness, it must either request additional user inputs or produce an explicitly uncertified export.

## Goals

- Support conversion from an arbitrary public React URL without requiring ZIP artifacts.
- Reuse the existing Static Site pipeline instead of creating a second export engine.
- Preserve ZIP mode as the highest-fidelity input path.
- Provide a strong, honest certification model rather than pretending all URLs are equally recoverable.
- Keep Platinum / WordPress mode untouched in this phase.

## Non-Goals

- Do not extend this phase to Platinum / WordPress mode.
- Do not claim universal true original build equivalence for all public URLs.
- Do not require a site-side helper or deployment-side agent in this phase.
- Do not replace ZIP mode as the gold-standard input path.

## Product Positioning

The converter will support two Static Site inputs:

- Build Artifact ZIP
- Public React URL (Certified Capture)

ZIP mode remains the highest-fidelity route because it has direct access to the deployed artifact. URL mode exists for cases where artifacts are unavailable. URL mode becomes strong by reconstructing a synthetic artifact and then using the same downstream pipeline as ZIP mode.

## Core Approach

### Recommended Architecture

```text
Public React URL
-> Deep Capture Engine
-> Synthetic Artifact Builder
-> Certification Engine
-> Existing Static Site Pipeline
```

This preserves a single downstream exporter. The new work is isolated to the input side.

### Why this approach

- It aligns with the current architecture in `utils/static-artifact.ts` and `utils/static-output.ts`.
- It avoids maintaining two divergent static exporters.
- It allows ZIP mode and URL mode to converge on a shared synthetic artifact contract.
- It creates a clean place for certification logic.

## System Components

### 1. Deep Capture Engine

The Deep Capture Engine is responsible for collecting enough evidence from a public URL to reconstruct a ZIP-like artifact.

#### Responsibilities

- Launch a real browser session.
- Instrument the page before app boot where possible.
- Capture final hydrated DOM per route.
- Discover routes from:
  - sitemap.xml
  - internal links
  - router state changes
  - bundle string inspection
  - canonical tags
  - navigation flows
- Capture network traffic:
  - fetch
  - XHR
  - GraphQL
  - relevant JSON boot payloads
- Capture loaded assets:
  - CSS
  - JS
  - images
  - fonts
  - icons
- Explore meaningful interactions:
  - tabs
  - accordions
  - pricing switches
  - menus
  - modals
  - carousels where content changes materially
- Record provenance and confidence evidence for every discovered route and state.

#### Capture stack

The local machine running the converter may require:

- Browser automation
- Local proxy / traffic recorder
- Optional browser profile or cookie import
- Optional route seed inputs

This heavier stack is acceptable because the user approved a stronger local setup in exchange for a better certification path.

### 2. Synthetic Artifact Builder

The Synthetic Artifact Builder converts raw capture evidence into a normalized internal package that mirrors the shape of ZIP-mode input.

#### Synthetic artifact contents

- Route manifest
- Normalized route HTML snapshots
- Route metadata
- Captured runtime data payloads
- Asset manifest
- Asset files or resolved references
- Interaction-derived state captures
- Capture evidence report
- Certification pre-check summaries

#### Route normalization rules

- Static Site mode enforces trailing slashes.
- Every route must normalize to `/path/` form.
- Synthetic artifact paths must match the same routing contract already used by Static Site mode.

#### Why artifact normalization matters

The goal is to let the existing static output pipeline treat ZIP and URL input similarly. This reduces downstream risk and keeps SEO/static behavior consistent across inputs.

### 3. Certification Engine

The Certification Engine determines whether the synthetic artifact is good enough to claim artifact-equivalent capture for Static Site export.

#### Certification principle

The system may certify only when it has enough evidence. It must never certify by assumption.

#### Certification outcomes

##### A. Certified

Requirements are sufficiently met and the system can proceed with a certified Static Site export.

##### B. Needs More Input

The system sees a plausible path to certification, but needs more help from the user, such as:

- sitemap URL
- auth cookies or logged-in browser profile
- route seeds
- extra crawl scope hints

##### C. Uncertified Best-Effort

The system cannot prove completeness even after escalation. It may still generate a usable export, but it must be clearly marked uncertified.

#### Certification checks

At minimum, certification should evaluate:

- Route discovery completeness
- Route HTML capture success
- Canonical and internal link consistency
- Asset resolution completeness
- Data payload availability for route-critical content
- Agreement between route title, canonical, and body intent
- Detection of major hidden or partially explored interactive states
- Presence of unresolved high-value errors
- Duplicate or fallback-content anomalies

Certification should be evidence-based, not a single score. The report should show which checks passed or failed and why.

### 4. Escalation Flow

When the engine cannot certify, it should not immediately fail or silently degrade. It should first attempt escalation.

#### Escalation inputs

- Sitemap URL
- Extra route seeds
- Cookie/header injection
- Crawl allowlists / deny lists
- Known protected paths

#### Escalation policy

1. Attempt autonomous capture
2. If blocked, ask for the smallest helpful extra input
3. Retry certification
4. If still uncertain, allow best-effort export but label it uncertified

This policy matches the approved user preference of "2 plus 3":

- best-effort export remains available
- extra guided input is requested first when it can materially improve coverage

## Dashboard UX

### New input mode

Under Static Site mode, the user can choose between:

- Build Artifact ZIP
- Public React URL (Certified Capture)

### URL Capture panel

Add a dedicated URL Capture section with:

- Public URL
- Optional sitemap URL
- Optional route seeds
- Optional auth cookies / session import
- Capture depth preset
- Interaction exploration toggle
- Bundle inspection toggle

### Certification status panel

Show a dedicated status area with:

- Certified
- Needs more input
- Uncertified best-effort

And supporting detail:

- routes discovered
- routes captured
- assets resolved
- interactive states explored
- blockers
- recommended next input if certification is not yet possible

### Relationship to Local SEO & AI Signals

The existing Static Site "Local SEO & AI Signals" panel remains unchanged. URL mode only changes how content is captured, not how SEO/static output settings are configured.

## File and Module Design

New modules should be isolated from the existing Static Site exporter.

### Proposed modules

- `utils/url-capture-types.ts`
- `utils/url-capture-common.ts`
- `utils/url-capture-browser.ts`
- `utils/url-capture-network.ts`
- `utils/url-capture-routes.ts`
- `utils/url-capture-interactions.ts`
- `utils/url-capture-bundles.ts`
- `utils/url-capture-artifact.ts`
- `utils/url-capture-certification.ts`
- `utils/url-capture-report.ts`

### Existing modules reused

- `utils/static-artifact.ts`
- `utils/static-output.ts`
- `utils/static-seo.ts`
- `utils/static-schema.ts`
- `utils/static-forms.ts`
- `utils/static-sitemap.ts`
- `utils/static-robots.ts`
- `utils/static-llms.ts`
- `utils/static-report.ts`

### Dashboard integration

`components/Dashboard.tsx` should branch URL input into the new URL-capture pipeline only when:

- output mode is `static-site`
- input mode is `public-url-certified`

ZIP-driven Static Site exports must remain unchanged.

## Synthetic Artifact Contract

The synthetic artifact should be shaped so it can be passed into the same kind of builder that currently consumes ZIP content.

### Required synthetic artifact fields

- `siteSlug`
- `routes`
- `routeHtmlByPath`
- `capturedAssets`
- `assetManifest`
- `captureMetadata`
- `certificationReport`

### Important invariants

- Route paths must already be normalized to trailing-slash form.
- Route HTML should represent the best known stable post-hydration state.
- Interactive states should be captured separately from the base route where useful.
- Asset references must retain enough information to rewrite them into the final static output.

## Certification Semantics

The product language must be precise.

### Allowed claim

"Certified artifact-equivalent for Static Site export"

Meaning:

- The system found enough evidence to treat the synthetic artifact as complete enough for the current Static Site pipeline.
- The system did not detect unresolved gaps large enough to undermine the export contract.

### Disallowed claim

"Guaranteed to be identical to the original source artifact"

That claim is too strong for arbitrary public URLs without cooperation from the source site.

## Testing Strategy

### Unit-level tests

- Route normalization
- Route discovery merging and deduplication
- Asset manifest generation
- Certification rule evaluation
- Escalation trigger logic

### Synthetic integration tests

- Mock React site with known route graph
- Hidden routes only discoverable via sitemap
- Tabs and accordions requiring interaction exploration
- Lazy-loaded sections requiring runtime data capture
- Partial asset failure cases

### Real-world smoke tests

Run against controlled public React sites with known output expectations and verify:

- route completeness
- interaction completeness
- asset completeness
- certification behavior

### Regression coverage

Add dedicated regression scripts comparable to the current Static Site smoke tests, but for:

- certification pass cases
- escalation-needed cases
- uncertified best-effort cases

## Risks

### Technical risks

- Some public sites will remain un-certifiable without extra hints.
- Interaction exploration can become expensive on complex apps.
- Bundle inspection may be noisy or brittle on heavily minified builds.
- Auth/session-based sites may require user-provided credentials or cookies.

### Product risks

- Users may misunderstand "certified" as "bit-for-bit identical."
- Users may expect certification on every URL.
- Runtime-heavy sites may take much longer to capture than ZIP mode.

### Mitigations

- Use exact certification language in the UI.
- Show why certification failed.
- Allow best-effort export when certification is not possible.
- Keep ZIP mode clearly labeled as the highest-fidelity input path.

## Implementation Phases

### Phase 1: Foundation

- Add URL input selection under Static Site mode
- Add URL capture types and skeleton modules
- Add synthetic artifact contract
- Add initial dashboard status model

### Phase 2: Deep capture

- Browser automation
- route discovery
- network capture
- asset capture
- initial interaction exploration

### Phase 3: Certification

- certification rule engine
- escalation path
- uncertified export labeling
- detailed reporting

### Phase 4: Hardening

- controlled public-site smoke tests
- performance tuning
- better bundle inspection
- stronger interaction coverage

## Recommendation

Proceed with Certified URL Capture for Static Site mode first.

This gives the converter:

- a strong no-artifact path
- shared downstream behavior with ZIP mode
- an honest certification model
- no disturbance to Platinum / WordPress mode

After this is proven in Static Site mode, the same capture and synthetic artifact work can later be evaluated for Platinum / WordPress mode if the product still needs it.
