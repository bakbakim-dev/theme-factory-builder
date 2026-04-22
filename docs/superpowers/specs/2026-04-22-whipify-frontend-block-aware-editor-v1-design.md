# Whipify Frontend Block-Aware Editor v1

Date: 2026-04-22
Status: Approved for planning
Scope: WordPress / Platinum mode only

## Goal

Add a **frontend editing experience** for generated WordPress themes that feels like inline editing while staying fully synchronized with Gutenberg.

This editor must:

- work only for logged-in admins/editors
- use the WordPress admin bar as the entry point
- save page-level edits back into real Gutenberg block data
- save global chrome edits back into `whipify_quick_editor_settings`
- avoid output buffering and HTML shadow storage entirely

## Problem

The reference `wpconvert-editor.php` style solves the UX problem with:

- output buffering
- DOM-level edit targeting
- edits stored outside Gutenberg in `wp_options`
- HTML overrides applied at render time

That creates a second source of truth and will drift from Gutenberg.

This build already has a safer architecture:

- Gutenberg content lives in `post_content`
- global chrome values live in `whipify_quick_editor_settings`
- converted WordPress themes already generate theme PHP, chrome partials, and editor-aware block output

The missing piece is a frontend editing layer that writes into those same data stores rather than around them.

## Decision

Build a **Whipify Frontend Block-Aware Editor v1** with two synchronized editing lanes:

1. **Global chrome lane**
   - edits the same fields already managed by Whipify Quick Editor
   - saves into `whipify_quick_editor_settings`
2. **Page block lane**
   - supports a small whitelist of Gutenberg blocks on Pages only
   - saves directly into `post_content`

This is not a generic DOM editor.

## Target Platform

### Production baseline

Target **WordPress 6.9.4** as the safe production baseline.

Reason:

- 6.9.4 is the current maintained baseline
- WordPress 7.0 is still delayed because of Real-Time Collaboration architecture work

### Forward-looking compatibility

Design the architecture so it can later benefit from:

- Block Bindings
- Pattern Overrides for custom blocks
- newer content-only editing improvements

But do not require WordPress 7.0 for v1.

## Editing Scope

### In scope

#### Global chrome lane

- header primary CTA text
- header primary CTA URL
- header secondary CTA text
- header secondary CTA URL
- global phone number
- footer business name
- footer address lines
- footer contact line
- social profile URLs
- announcement bar text and URL if present

#### Page block lane

- **Pages only**
- **one selected block at a time**
- supported blocks:
  - `core/heading`
  - `core/paragraph`
  - `core/button`

Supported editable fields:

- `core/heading`
  - `content`
- `core/paragraph`
  - `content`
- `core/button`
  - `text`
  - `url`

### Explicitly out of scope

- Posts
- archives
- templates
- template parts
- synced patterns as a save target
- arbitrary DOM editing
- freeform `contenteditable`
- output-buffer HTML overrides
- HTML shadow storage in `wp_options`
- multi-block save sessions
- unsupported block best-effort editing

## Product Shape

### Entry point

Frontend editing is available only through the **WordPress admin bar**.

The admin bar adds a toggle such as:

- `Whipify Edit Mode`

When off:

- no overlays
- no frontend editing UI

When on:

- editable global chrome fields get edit affordances
- supported page blocks get hover outlines
- unsupported areas can show `Edit in Gutenberg`

### Editor surface

Use a **click-to-edit** interaction with a small floating side panel.

The side panel shows:

- editable field label
- current value
- save action
- cancel action
- `Edit in Gutenberg`

No raw inline editing in v1.

## Source of Truth

### Global chrome

Global chrome remains backed by:

`whipify_quick_editor_settings`

The frontend editor reuses the existing Quick Editor storage model and field names.

### Page content

Page-level text is saved back into:

- WordPress `post_content`
- the exact Gutenberg block attributes or content fields that already power the page

The frontend editor must never write page text into:

- `wp_options`
- a custom HTML override store
- output-buffer patches

## Architecture

### 1. Admin-only render-time instrumentation

This is the main architectural upgrade from the earlier design.

For logged-in admins with edit capability, inject edit metadata at **render time**, not only at export time.

Use:

- `render_block`
- block-specific `render_block_core/*` hooks where useful
- `WP_HTML_Tag_Processor`

Reason:

- safe markup mutation without regex
- no output buffering
- no need to permanently embed admin-only edit markers in public output
- easier to evolve as WordPress block rendering changes

### 2. Block-aware markers

For supported blocks, render-time instrumentation should add metadata such as:

- `data-whipify-editable="true"`
- `data-whipify-edit-scope="page-block"` or `global-chrome`
- `data-whipify-post-id`
- `data-whipify-block-name`
- `data-whipify-block-path`
- `data-whipify-field`
- `data-whipify-revision`

For global chrome slots, similar metadata should identify:

- scope: `global-chrome`
- field key: e.g. `phone`, `primary_cta_text`

### 3. Stable identity model

For v1 page blocks, identity should use:

- post ID
- block name
- block path
- field key
- revision or modified token

Optionally include a lightweight expected-value fingerprint.

Do not rely on `metadata.name` alone for v1 because it is not a universal per-instance identity for repeated arbitrary blocks.

### 4. Frontend overlay layer

The frontend editor UI should be admin-only and lightweight.

It may use:

- a small vanilla JS layer
- or the WordPress Interactivity API if that fits the generated theme integration cleanly

For v1, the priority is correctness and low conflict risk, not maximum visual ambition.

## Save Pipeline

### Global chrome save

Frontend chrome edits submit to a WordPress handler that updates:

`whipify_quick_editor_settings`

using the same sanitization and field rules as the admin-screen Quick Editor.

### Page block save

Frontend page-block edits submit:

- post ID
- block name
- block path
- field key
- new value
- revision token

Server flow:

1. verify nonce and capability
2. load latest post
3. compare revision / modified token
4. parse `post_content`
5. locate the target block by path
6. verify block name and field are supported
7. update only the allowed field
8. serialize blocks back to content
9. save post normally
10. return success payload including updated revision info

The save must create a normal WordPress revision.

## Concurrency and Conflicts

### Required protection

Do not allow silent overwrite.

Frontend edit mode should use:

- a save-time revision token check

and ideally also:

- Heartbeat-based editor lock warnings

If another user changes the page or holds the post lock:

- frontend save should fail closed
- prompt the user to refresh or open Gutenberg

### Conflict response

On conflict:

- no merge attempt in v1
- no hidden overwrite
- show clear message
- offer `Refresh` and `Edit in Gutenberg`

## Gutenberg Parity

The frontend editor should not be the only "safe editing" model.

Where converter-owned structures benefit from it, Gutenberg should mirror the same editing boundary through:

- locking
- `templateLock: "contentOnly"` where appropriate
- `role: "content"` on custom block attributes in future Whipify blocks

This ensures authors do not experience contradictory editing rules between Gutenberg and the frontend.

For v1, this is a design principle and selective implementation target, not a requirement to convert all existing content into content-only structures.

## Unsupported Elements

When edit mode is enabled and a user clicks an unsupported element:

- do not attempt best-effort DOM editing
- offer only `Edit in Gutenberg`

This keeps the contract honest and avoids drift.

## Security

Required:

- admin-only visibility for edit overlays
- capability checks on all save endpoints
- nonces for all save actions
- sanitization by field type
- no rendering of arbitrary unsanitized HTML from frontend editor inputs

## UX Details

### Admin bar

V1 should add:

- `Whipify Edit Mode` toggle

Optional future additions:

- open Quick Editor admin page
- open current page in Gutenberg

### Side panel behavior

One selected block or field at a time.

Panel actions:

- Save
- Cancel
- Edit in Gutenberg

Optional informational fields:

- block type
- route/page title
- last updated warning if stale

## Non-Goals

This spec does not include:

- live collaborative editing
- freeform visual page builder behavior
- editing every block type
- inline media management for page blocks
- archive/template/frontend theme builder editing
- replacing Gutenberg

## Testing Strategy

### Local regression coverage

Add generator-level and UI-level tests for:

- render-time admin instrumentation
- supported block marker generation
- global chrome frontend save behavior
- page block save behavior
- conflict rejection
- unsupported element fallback

### WordPress environment matrix

Add a WordPress Playground-based regression gate for:

- WordPress 6.9.4
- latest Gutenberg plugin
- WordPress 7.0 pre-release/nightly when practical

This is especially important because the feature depends on block rendering, editor parity, and evolving block capabilities.

### Manual sanity checks

On a disposable site:

1. enable frontend edit mode
2. edit a supported heading block
3. verify frontend and Gutenberg both reflect the same saved value
4. edit a global phone field
5. verify header/footer update globally
6. click unsupported content
7. verify only `Edit in Gutenberg` is offered
8. simulate post lock / revision change
9. verify save fails cleanly

## Why this is the right fit

This v1 gives the user the most important part of the `wpconvert` experience:

- edit from the frontend
- move quickly
- avoid digging through the editor for simple changes

But it does so in a WordPress-native way:

- no output buffering
- no HTML shadow edits
- no competing content store
- Gutenberg remains authoritative

That is the clearest path to a frontend editor that works **with** Gutenberg instead of fighting it.

## Recommended next step

Write an implementation plan for:

1. render-time admin instrumentation
2. admin bar edit-mode toggle
3. global chrome frontend save wiring
4. page block save endpoint and block update logic
5. conflict handling
6. Playground-based regression coverage
