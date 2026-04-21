# Static Site Mode Design

Date: 2026-04-21
Repo: `C:\Users\Marketplace\Documents\theme-factory-ai-golden`
Status: Proposed and approved in conversation, awaiting final written-spec review before implementation

## Goal

Add a new dashboard output mode named `static-site` that exports a pure static website from a React/source zip without modifying or regressing the existing Platinum WordPress mode.

This new mode is intended to be the rankings-first option for:

- fast local SEO deployment
- strong crawlability and indexability
- strong AI crawler discoverability
- static hosting/CDN deployment

The existing WordPress/Platinum workflow remains the editor-first option for projects that require a client-facing WordPress editing experience.

## Non-Goals

The first implementation will not:

- replace or refactor Platinum WordPress mode
- make WordPress the authoring backend for Static Mode
- introduce a headless WordPress architecture
- add incremental static regeneration or deployment orchestration
- build a CMS synchronization layer

## Product Decision

The product will support at least two user-selectable export paths:

1. `gutenberg-native`
   - existing Platinum WordPress export
   - editable in WordPress
   - unchanged

2. `static-site`
   - new pure static export
   - no WordPress runtime required
   - deployable to CDN/static hosting
   - optimized for speed, crawlability, local SEO, and AI discoverability

## Why This Is The Right Architecture

This repo already contains:

- route scanning
- prerendered HTML discovery
- asset copying
- SEO settings collection
- per-route transformation
- sitemap/robots-like generation patterns
- QA/audit flow
- packaging/export flow

That makes a pure static export the least disruptive and highest-value addition. It also keeps the WordPress/editor workflow available without entangling the two output paths.

## High-Level Architecture

The current dashboard orchestration in `components/Dashboard.tsx` remains the control layer.

The new mode will branch from that orchestration but use a separate static generator pipeline.

### Shared Inputs

Shared with existing conversion flow:

- uploaded source/build zip
- detected routes
- SEO settings
- prerendered HTML pages
- extracted assets
- QA toggles

### Separate Static Outputs

Static Mode will not generate:

- `functions.php`
- WordPress templates
- companion block plugin
- block content files
- PHP setup/import scripts

Instead, it will generate a standalone static site zip.

## Static Output Structure

Proposed output structure:

```text
site-slug-static/
  index.html
  404.html
  about/index.html
  edmonton/index.html
  edmonton-pricing/index.html
  contact/index.html
  assets/
    css/
    js/
    img/
    fonts/
    data/
  sitemap.xml
  robots.txt
  llms.txt
  indexnow-key.txt
  _headers
  _redirects
  seo-audit-report.json
  static-export-report.json
```

### Deployment Safety Nets

The first implementation must also include:

- a compiled root `404.html` for CDN/router fallbacks
- strict absolute-URL normalization for SEO media and schema image/logo fields using the configured Static Site Base URL
- a dedicated dashboard panel named `Local SEO & AI Signals` to group Static Mode-only inputs such as Base URL, form keys/endpoints, coordinates, service areas, and AI/indexing toggles

### Routing Convention

Folder-based routing will be used:

- home page: `/index.html`
- nested pages: `/route/index.html`

This means the public canonical URL form is always trailing-slash style:

- `https://example.com/`
- `https://example.com/edmonton/`
- `https://example.com/edmonton-pricing/`

## Strict Trailing Slash Policy

Trailing slash consistency is mandatory in Static Mode.

The generator must enforce trailing slashes consistently across:

- `sitemap.xml`
- hardcoded `<link rel="canonical">`
- hreflang tags
- internal link rewriting
- redirect file generation
- `llms.txt` route references
- schema URL fields

Rules:

- root canonical: `https://domain.com/`
- page canonical: `https://domain.com/slug/`
- never emit mixed slash/no-slash variants
- internal links in generated HTML should point directly to trailing-slash URLs
- redirect rules should normalize no-slash URLs to slash URLs when host supports redirects

This avoids duplicate URL variants, edge cache fragmentation, and redirect loops.

## Static Generation Pipeline

### Step 1: Detect Mode

Add `static-site` as a new conversion mode in the dashboard selector.

### Step 2: Gather Inputs

Reuse the current flow to gather:

- theme/site slug
- route list
- prerendered route HTML
- shell HTML
- assets
- SEO settings

### Step 3: Build Route HTML

For each selected route:

- locate prerendered route HTML if present
- fall back to shell extraction path if needed
- rewrite asset URLs to static-relative or root-relative assets
- remove React runtime pieces not needed for static output
- preserve functional JavaScript only where needed for visible frontend interactions

### Step 4: Inject SEO Head Tags

Inject into each HTML file:

- `<title>`
- meta description
- canonical
- OG tags
- Twitter tags
- hreflang tags
- JSON-LD schema

### Step 5: Rewrite Internal Links

Rewrite internal route links to match the final static URL structure:

- `/edmonton/`
- `/calgary-pricing/`

No WordPress slug flattening logic should be used in this mode unless explicitly requested by route policy.

### Step 6: Rewrite Forms

Static forms must be transformed to API-based submissions.

### Step 7: Emit Global Files

Generate:

- `sitemap.xml`
- `robots.txt`
- `llms.txt`
- `indexnow-key.txt`
- `_headers`
- `_redirects`
- reports

### Step 8: Package Zip

Package the site into one deployable zip.

## SEO and AI SEO Requirements

Static Mode must ship with SEO features from day one because there is no WordPress plugin layer.

### 1. Per-Route Metadata

Every route must support:

- hardcoded title
- hardcoded meta description
- canonical
- OG title/description/image
- Twitter summary card metadata
- hreflang, if locale configuration exists

### 2. Sitemap

Generate a clean XML sitemap with:

- one entry per exported route
- trailing-slash URLs only
- canonical URL parity
- optional `lastmod` when available

### 3. Robots Policy

Generate `robots.txt` with:

- standard crawler allow
- explicit allow for:
  - `OAI-SearchBot`
  - `Google-Extended`
  - `PerplexityBot`
- sitemap declaration

If future business rules require selective disallowing, those rules should be additive rather than changing the default allow stance.

### 4. llms.txt

Generate `llms.txt` as Markdown-like plain text that clearly communicates local entity signals to AI systems.

It must automatically include:

- business name
- phone number
- street/city/region/country where available
- main service areas
- primary services
- key URLs

This file should emphasize entity clarity, not marketing fluff.

### 5. IndexNow

Generate:

- `indexnow-key.txt`
- an export report entry with the key value and submission guidance

Automatic submission is not required in v1, but the export must be ready for it.

## Schema Requirements

JSON-LD scripts must be injected into the `<head>` of generated HTML.

### Supported Schemas In v1

- `WebSite`
- `WebPage`
- `BreadcrumbList`
- `LocalBusiness`
- `Service`
- `FAQPage`

### LocalBusiness Requirements

The LocalBusiness generator must support:

- business name
- URL
- logo/image
- description
- telephone
- address
- `geo`
  - latitude
  - longitude
- `areaServed`
- price range
- sameAs social links

It should only emit when the required entity fields are sufficiently real and non-placeholder.

### Service Requirements

The Service generator must support:

- service name
- provider reference
- `areaServed`
- optional service type/category
- linkage to the business entity

### FAQPage Requirements

Only emit FAQPage schema when:

- valid question/answer pairs exist
- content is actually present on the route

No placeholder FAQ schema should ever be emitted.

## Geo-Targeted Entity Mapping

Local AI search and local SEO rely heavily on clean place/entity signals.

The static schema layer must explicitly model:

- NAP data
- lat/long coordinates
- service areas
- city/region references

Required data model additions for static mode:

- `latitude?: string`
- `longitude?: string`
- `areaServed?: string[]`
- optional service-area fallback derived from selected location/service pages if explicit values are not configured

If coordinates are missing, schema should omit `geo` rather than invent values.

## Forms Strategy

Static Mode cannot depend on PHP form handlers.

### v1 Default

Default provider: `Web3Forms`

Supported form modes:

1. `web3forms`
2. `formspree`
3. `custom-endpoint`

### Form Rewrite Behavior

For each detected form:

- replace local/PHP action with configured API endpoint
- preserve visible fields
- inject hidden metadata:
  - route
  - page title
  - site slug
- add lightweight success/error UI script

### Failure Policy

If no provider is configured:

- export still completes
- report must include a clear warning
- form should not silently look functional if it cannot submit

## CDN and Hosting Helpers

Static Mode should emit deployment-friendly config files.

### `_headers`

Include:

- cache policy for assets
- no-cache for HTML by default
- optional security headers where safe

### `_redirects`

Include:

- trailing-slash normalization
- optional internal route aliases
- support for canonical host behavior later

The first implementation should keep these generic and safe for common static hosts.

## Static Mode Modules

New modules to add:

```text
utils/static-output.ts
utils/static-seo.ts
utils/static-schema.ts
utils/static-forms.ts
utils/static-sitemap.ts
utils/static-robots.ts
utils/static-llms.ts
utils/static-indexnow.ts
utils/static-redirects.ts
utils/static-report.ts
```

### Module Responsibilities

#### `utils/static-output.ts`

Top-level orchestrator for static export.

Responsibilities:

- accept route content, SEO settings, assets, slug, and export config
- call lower-level static generators
- return emitted files + report data

#### `utils/static-seo.ts`

Build route-level head metadata blocks.

#### `utils/static-schema.ts`

Build JSON-LD payloads for supported schemas.

#### `utils/static-forms.ts`

Convert form markup to static-compatible API-post forms.

#### `utils/static-sitemap.ts`

Generate canonical sitemap XML.

#### `utils/static-robots.ts`

Generate robots.txt with AI crawler allowances.

#### `utils/static-llms.ts`

Generate `llms.txt` with entity-first business/service information.

#### `utils/static-indexnow.ts`

Generate key file and supporting metadata.

#### `utils/static-redirects.ts`

Generate `_redirects` and slash-normalization rules.

#### `utils/static-report.ts`

Generate static export diagnostics and SEO summary.

## Dashboard Changes

The dashboard UI should add a third option:

- WordPress / Platinum
- React SPA
- Static Site

The first implementation may leave `react-spa` in place if it already exists, but `static-site` becomes the new SEO-first output mode.

Additional Static Mode UI settings:

- static site base URL
- forms provider
- forms endpoint / access key
- coordinates
- service area list
- optional AI/IndexNow toggles

These settings must not interfere with Platinum mode behavior.

## File-Level Integration Plan

Minimal integration points:

- extend conversion mode type in `components/Dashboard.tsx`
- add `static-site` branch in export orchestration
- keep WordPress packaging untouched
- call `static-output.ts` only when `mode === 'static-site'`

## Testing Requirements

### Unit-Level Expectations

Test:

- canonical generation
- trailing slash normalization
- hreflang generation
- robots output
- llms.txt entity output
- schema generation with and without geo fields
- form rewriting

### Regression Expectations

Add static export fixtures for:

- home page with LocalBusiness schema
- service page with Service schema
- FAQ page with FAQPage schema
- route with alternate locale
- route with internal links
- contact form with Web3Forms rewrite

## Risks

### Technical Risks

- route URL mismatch between prerendered files and final folder structure
- internal links left in React-style format
- duplicate canonicals if trailing slash handling is inconsistent
- schema drift if entity settings are incomplete
- broken forms if provider settings are missing or partial

### Product Risks

- users may assume Static Mode is editable like WordPress
- users may deploy without configuring forms or business entity data

Mitigation:

- clear UI labeling
- explicit report warnings
- default-safe output

## Success Criteria

Static Mode v1 is successful if:

- user can select `static-site` in the dashboard
- export produces a deployable static zip
- generated pages include full SEO metadata
- schema is injected correctly
- sitemap/robots/llms/indexnow files are emitted
- forms are converted to API-based submission
- Platinum output remains unchanged

## Recommendation

Build Static Mode now as a separate export engine.

Do not attempt WordPress-authored static publishing in this first implementation.

That second layer can be added later once the pure static pipeline is stable and battle-tested.
