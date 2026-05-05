# Whipify Editor Experience Gap Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current WordPress editing stack feel like a modern, curated demo theme by formalizing the content contract, strengthening editor identity and locking, and surfacing the existing capabilities in the live UI.

**Architecture:** Keep `post_content` authoritative for page body content and `whipify_quick_editor_settings` authoritative for global chrome. Add a semantic registry as the source of truth for what is editable, then use that registry to drive resolver-v2, Gutenberg curation, and the frontend editor shell. The implementation should tighten identity and provenance first, then expose the stronger contract more visibly in Gutenberg and on the frontend, and only then add missing media/shared/pattern lanes.

**Tech Stack:** React, TypeScript, Vite, WordPress PHP, Gutenberg block APIs, WordPress REST, `WP_HTML_Tag_Processor`, WordPress admin UI, Playwright regression tests.

---

## File Structure

These are the main files the plan will touch and what each one should own:

- `components/Dashboard.tsx`
  - conversion orchestration
  - registry aggregation
  - export packaging
  - dashboard feature wiring
- `utils/wordpress-content-registry.ts`
  - semantic content registry types and builders
  - registry finalization
  - compatibility projections for Quick Editor and frontend editor
- `utils/wordpress-edit-target.ts`
  - resolver-v2 target schema
  - target resolution and fallback rules
  - save-adapter input normalization
- `utils/whipifyQuickEditor.ts`
  - global chrome schema
  - Quick Editor field groups and sanitization
  - theme helper PHP generation for global chrome
- `utils/whipifyFrontendEditor.ts`
  - frontend editor runtime
  - page/global target instrumentation
  - save transport
  - edit-mode UI shell
- `utils/whipifyFrontendEditorPageBlockAdapter.ts`
  - page-block save/update adapter
  - nested block resolution logic
- `utils/whipifySiteContentBindings.ts`
  - binding-aware global chrome helpers
  - shared/global site-content rendering helpers
- `utils/plugintemplates.ts`
  - companion plugin PHP/JS template generation
  - Gutenberg parity and binding source output
- `scripts/*.mjs`
  - regression coverage for registry, resolver, Gutenberg parity, bindings, and frontend editor flows

---

### Task 1: Formalize the semantic content registry

**Files:**
- Create: `utils/wordpress-content-registry.ts`
- Modify: `components/Dashboard.tsx`
- Modify: `utils/whipifyQuickEditor.ts`
- Modify: `utils/whipifyFrontendEditor.ts`
- Test: `scripts/wordpress-content-registry-regression.mjs`

- [ ] **Step 1: Write the registry contract first**

Define a registry shape that can carry:
- page-block targets
- global chrome targets
- shared content targets
- media targets
- provenance labels
- stable ids
- field types
- scope
- source path / source token

Use a compact contract similar to:

```ts
type WordPressContentTargetScope = 'page-block' | 'global-chrome' | 'shared-content' | 'media';
type WordPressContentFieldType = 'plainText' | 'richText' | 'url' | 'tel' | 'mediaId' | 'imageAlt';
```

- [ ] **Step 2: Add failing regression coverage**

Add `scripts/wordpress-content-registry-regression.mjs` so it proves:
- registry generation includes the expected scopes
- Quick Editor compatibility data is derived from the registry
- frontend editor support map is derived from the same registry
- forms compatibility projections still exist

Run:
`node scripts/wordpress-content-registry-regression.mjs`

Expected:
- fail before the registry implementation exists
- pass once the registry is wired through `Dashboard.tsx`

- [ ] **Step 3: Implement registry aggregation in the dashboard**

`components/Dashboard.tsx` should:
- collect route, chrome, forms, and editor metadata into a single registry object
- finalize the registry once the conversion export is ready
- emit `assets/data/content-registry.json`
- emit `assets/data/content-registry.report.json`
- derive Quick Editor slot support from the registry instead of heuristic slot detection
- derive frontend support maps from the registry instead of separate ad hoc logic

- [ ] **Step 4: Run the registry regression and build**

Run:
`node scripts/wordpress-content-registry-regression.mjs`
`npm.cmd run build`

Expected:
- registry regression passes
- build succeeds
- registry files appear in the exported WordPress bundle

### Task 2: Replace flat page-block identity with resolver-v2

**Files:**
- Create: `utils/wordpress-edit-target.ts`
- Modify: `utils/whipifyFrontendEditor.ts`
- Modify: `utils/whipifyFrontendEditorPageBlockAdapter.ts`
- Modify: `utils/whipifyQuickEditor.ts`
- Test: `scripts/wordpress-edit-target-regression.mjs`

- [ ] **Step 1: Add the resolver-v2 contract**

Define a target schema that includes:
- target kind
- target scope
- post id
- block name
- full block path
- field key
- field type
- stable id or source token when available
- revision / lock token

Use this resolver precedence:
1. stable id if present
2. exact nested path
3. scoped fingerprint fallback
4. fail closed

- [ ] **Step 2: Add a failing regression for nested targets**

Add `scripts/wordpress-edit-target-regression.mjs` to prove:
- nested paths are not flattened
- ambiguous targets fail closed
- supported button/text/url targets resolve consistently
- unsupported target mutations are rejected

Run:
`node scripts/wordpress-edit-target-regression.mjs`

Expected:
- fail before resolver-v2 exists
- pass after the adapter and editor share the same target contract

- [ ] **Step 3: Route page-block saves through the adapter**

Update `utils/whipifyFrontendEditorPageBlockAdapter.ts` so it:
- resolves targets through resolver-v2
- updates the exact block field
- preserves saved markup for `serialize_blocks()`
- rejects ambiguous block matches
- keeps page-block scope Pages-only

Then update `utils/whipifyFrontendEditor.ts` to use the adapter for page-block saves.

- [ ] **Step 4: Run the resolver regression and frontend editor regression**

Run:
`node scripts/wordpress-edit-target-regression.mjs`
`node scripts/whipify-frontend-editor-regression.mjs`
`npm.cmd run build`

Expected:
- resolver regression passes
- frontend editor regression passes
- build succeeds without changing the page-content contract

### Task 3: Curate Gutenberg to match the same safe surface

**Files:**
- Modify: `utils/plugintemplates.ts`
- Modify: `utils/whipifyQuickEditor.ts`
- Modify: `utils/whipifyFrontendEditor.ts`
- Test: `scripts/gutenberg-parity-regression.mjs`
- Test: `scripts/block-bindings-regression.mjs`

- [ ] **Step 1: Add the first parity assertions**

Add `scripts/gutenberg-parity-regression.mjs` so it verifies:
- Theme Factory blocks are registered
- `theme-factory/button` exposes safe content binding support
- wrapper blocks use content-only / lock-aware settings where intended
- the editor contract is narrowed rather than widened

Run:
`node scripts/gutenberg-parity-regression.mjs`

Expected:
- pass only when the companion plugin exposes the intended curation contract

- [ ] **Step 2: Add selective Block Bindings**

Extend `utils/plugintemplates.ts` so the companion plugin registers a site-content binding source for safe global fields:
- primary CTA text / URL
- secondary CTA text / URL
- phone
- address
- business name

Keep bindings selective:
- globals and shared content only
- not every page paragraph by default

- [ ] **Step 3: Add curation hooks to the block templates**

Update block generation so:
- structural wrappers are content-only where appropriate
- content fields use `role: "content"` where supported
- complex or behavioral blocks stay locked down

This should make the editor feel intentional, not generic.

- [ ] **Step 4: Verify parity and bindings**

Run:
`node scripts/gutenberg-parity-regression.mjs`
`node scripts/block-bindings-regression.mjs`
`npm.cmd run build`

Expected:
- Theme Factory block curation is visible in the generated plugin
- binding support is available for the safe global fields
- build still succeeds

### Task 4: Make the frontend editor feel like a builder

**Files:**
- Modify: `utils/whipifyFrontendEditor.ts`
- Modify: `utils/whipifySiteContentBindings.ts`
- Modify: `components/Dashboard.tsx`
- Test: `scripts/whipify-frontend-editor-dashboard-ui.spec.mjs`
- Test: `scripts/whipify-frontend-editor-playground.mjs`

- [ ] **Step 1: Improve target provenance in the frontend runtime**

Make the frontend overlay show clearer distinctions for:
- global chrome
- page blocks
- shared/global site content
- unsupported content

The UI should make it obvious what is saved where.

- [ ] **Step 2: Strengthen visible edit affordances**

Make edit mode more obvious on the live page:
- clearer hover/selection states
- stronger target labels
- better chrome/global target visibility
- more obvious “Edit in Gutenberg” fallback for unsupported targets

- [ ] **Step 3: Keep the save contract stable while changing the shell**

Preserve the current save endpoints and target contract while refining the UI shell.

The user-facing change here is about clarity and presentation, not a new persistence model.

- [ ] **Step 4: Regenerate and inspect the live edit-mode UX**

Run:
`node scripts/whipify-frontend-editor-playground.mjs`
`npx playwright test scripts/whipify-frontend-editor-dashboard-ui.spec.mjs --reporter=line`

Expected:
- live pages show editable global chrome plus page-block targets more clearly
- edit mode feels more builder-like without breaking the existing save paths

### Task 5: Add media, shared content, and pattern support

**Files:**
- Modify: `utils/whipifyFrontendEditor.ts`
- Modify: `utils/whipifyFrontendEditorPageBlockAdapter.ts`
- Modify: `utils/whipifySiteContentBindings.ts`
- Modify: `utils/plugintemplates.ts`
- Modify: `components/Dashboard.tsx`
- Test: `scripts/site-content-binding-application-regression.mjs`
- Test: `scripts/whipify-frontend-editor-plugin-rest-regression.mjs`

- [ ] **Step 1: Add the first media lane**

Support `core/image` as a first-class editable target in the frontend editor and adapter path.

The save path should support:
- attachment id
- image URL
- alt text

- [ ] **Step 2: Add shared/repeated content targets**

Represent repeated or shared content explicitly in the registry so the system can distinguish:
- page-local copy
- shared content
- global site content

Use Block Bindings for shared/global values, not for arbitrary page text.

- [ ] **Step 3: Add the first pattern/reusable-section groundwork**

Introduce the data model and editor hooks needed for reusable patterns or template-part guidance, even if the full reusable section UX is intentionally limited in this phase.

- [ ] **Step 4: Verify the new lanes**

Run:
`node scripts/site-content-binding-application-regression.mjs`
`node scripts/whipify-frontend-editor-plugin-rest-regression.mjs`
`npm.cmd run build`

Expected:
- media and shared-content support are visible in the contract
- builds remain stable

### Task 6: Tighten dashboard export verification

**Files:**
- Modify: `components/Dashboard.tsx`
- Modify: `scripts/whipify-quick-editor-dashboard-ui.spec.mjs`
- Modify: `scripts/whipify-frontend-editor-dashboard-ui.spec.mjs`
- Modify: `scripts/static-dashboard-ui-flow.spec.mjs` if needed for export parity checks

- [ ] **Step 1: Add export-level checks for the new contract**

Make the dashboard export verification assert:
- registry files are emitted
- Quick Editor fields are present
- frontend chrome targets are emitted on generated themes
- Theme Factory block curation is preserved

- [ ] **Step 2: Add live UI smoke assertions**

Keep the Playwright checks focused on what an editor can actually see:
- Quick Editor fields
- frontend edit mode toggle
- Calgary page targets
- Gutenberg page load success

- [ ] **Step 3: Make the checks fail on missing surface area**

The regression tests should fail if:
- Quick Editor renders empty sections again
- global chrome targets disappear from exported themes
- frontend edit mode loses page-block or global-chrome targets
- Gutenberg parity or binding support regresses

---

## Verification Matrix

Use this matrix as the minimum release gate while implementing the plan:

- `node scripts/wordpress-content-registry-regression.mjs`
- `node scripts/wordpress-edit-target-regression.mjs`
- `node scripts/whipify-quick-editor-regression.mjs`
- `node scripts/whipify-frontend-editor-regression.mjs`
- `node scripts/whipify-frontend-editor-page-block-adapter-regression.mjs`
- `node scripts/whipify-frontend-editor-plugin-rest-regression.mjs`
- `node scripts/block-bindings-regression.mjs`
- `node scripts/gutenberg-parity-regression.mjs`
- `node scripts/site-content-binding-application-regression.mjs`
- `node scripts/whipify-quick-editor-dashboard-ui.spec.mjs`
- `node scripts/whipify-frontend-editor-dashboard-ui.spec.mjs`
- `node scripts/whipify-frontend-editor-playground.mjs`
- `npm.cmd run build`

## Notes On Scope

This plan intentionally does not try to rebuild the whole product at once.

It is focused on the current gap:

- capabilities already exist
- the live editor experience does not yet communicate them well enough

The fastest path to a more demo-theme-like result is to make the contract explicit, then expose that contract more clearly in Gutenberg and the frontend editor.
