# Whipify Editor Experience Gap Roadmap

Date: 2026-04-23
Status: Approved for planning
Scope: WordPress / Platinum mode only

## Goal

Turn the current WordPress editing stack into a more visible, demo-theme-like experience without breaking the existing safe architecture.

The current build already has:

- global chrome editing
- frontend page editing
- Gutenberg-compatible converted blocks
- a Quick Editor
- a forms manifest/plugin flow

What is still missing is not raw capability alone. It is the editor experience, curation, and contract clarity that would make the build feel like a modern Gutenberg demo theme instead of a hybrid site with hidden powers.

This roadmap focuses on:

- making the editable contract explicit
- making the live editor feel powerful and obvious
- making Gutenberg reflect the same safe surface as the frontend editor
- adding the missing media/shared/pattern pieces in the right order

## Non-Negotiables

Keep these constraints intact:

- no output buffering
- no HTML shadow persistence
- no storing page body HTML in options
- no second source of truth for page body content
- Gutenberg remains authoritative for page content
- Block Bindings are selective, not a replacement for page content
- frontend editing is a UI layer over canonical WordPress data

## Problem

The live install now has more capability than it visibly communicates.

Examples:

- Quick Editor can now render real fields, but it still feels like a settings form
- frontend edit mode exposes many targets on Calgary, but it still feels subtle rather than builder-like
- Theme Factory blocks exist in the editor runtime, but Gutenberg still feels mostly stock
- the Site Editor loads, but it does not yet present a rich block-theme demo experience

The remaining gap is not another hidden subsystem. It is a stronger contract plus stronger editor presentation.

## Recommended Approach

Build this as a **contract-first, UI-second** program.

Why:

- The current weakness is not just UI polish
- Identity, provenance, and curation are still too implicit
- If we add more surfaces before the contract is stable, we will repeat the current problem of "capability exists, but it does not feel different"

The work should proceed in five phases.

## Phase 1: Make The Contract Explicit

### Goal

Create a semantic content registry that becomes the source of truth for what is editable.

### Key Changes

- formalize page-block targets, global chrome targets, shared content targets, and media targets in one registry
- replace heuristic Quick Editor detection with registry-driven field groups
- make every editable target carry provenance and a stable identity
- keep the current stores, but have them consume the registry rather than inferring fields ad hoc

### Why This Phase Comes First

This is the foundation for everything else.

Without a registry:

- Gutenberg curation stays implicit
- frontend targets remain difficult to explain
- Quick Editor remains a list of fields rather than a content contract

### Migration Notes

- keep `whipify_quick_editor_settings`
- keep `post_content`
- keep the current frontend and admin UX for now
- change the data source behind those UI layers first

## Phase 2: Make Page Editing Structurally Safe

### Goal

Replace the fragile page-block resolver with a stronger resolver model and make saves lock-aware.

### Key Changes

- move away from the flat render-order path model
- use a nested resolver / stronger target identity
- add field typing beyond plain text
- add safer sanitization for text, URL, and image targets
- add conflict handling and lock-aware saves
- keep page blocks limited to safe, page-local content

### Why This Phase Comes Second

The editor can only feel reliable if it knows exactly what block field it is editing.

If identity stays weak:

- repeated sections are risky
- nested blocks are risky
- any later builder-like UX will be built on sand

### Migration Notes

- preserve current save behavior as a fallback path during the transition
- move higher-confidence targets onto the new resolver first
- fail closed on ambiguous targets instead of guessing

## Phase 3: Make Gutenberg Match The Same Safe Surface

### Goal

Curate Gutenberg so it exposes the same safe editing boundaries as the frontend editor.

### Key Changes

- tighten converter-owned blocks with content-only and lock-aware behavior where appropriate
- expose `role: "content"` where the block schema supports it
- add Block Bindings for safe global/shared fields
- make the block library feel intentional instead of generic
- surface Theme Factory blocks as part of the editor contract, not just as runtime registrations

### Why This Phase Comes Third

The frontend editor should not feel more capable than Gutenberg in one direction and less capable in the other.

They need to present the same contract, or the experience will remain inconsistent.

### Migration Notes

- keep the existing block registrations
- tighten the editable surface gradually
- start with the most stable blocks first
- leave more complex blocks for later passes

## Phase 4: Make The Frontend Editor Feel Like A Builder

### Goal

Make live edit mode feel obvious and powerful, not just technically functional.

### Key Changes

- improve edit affordances for global chrome and page blocks
- make target selection and provenance clearer
- strengthen the visual feedback around editable elements
- move toward a more interactive shell for the frontend runtime
- keep the existing save paths and only upgrade the interaction layer

### Why This Phase Comes Fourth

The functionality is already there in parts. What is missing is the live experience.

This phase should make the user immediately understand:

- what is editable
- what scope it belongs to
- where it saves
- what is still handled in Gutenberg

### Migration Notes

- do not rewrite the save contract again
- keep the registry and resolver from earlier phases
- swap the shell/UI layer last

## Phase 5: Add The Missing Demo-Theme Pieces

### Goal

Close the remaining gap to a modern Gutenberg demo theme.

### Key Changes

- add media editing as a first-class lane
- add shared/repeated content editing
- add a real reusable pattern library
- add clearer template-part and site-editor guidance
- add more obvious demo-theme presentation around the editor surfaces

### Why This Phase Comes Last

These are important, but they depend on the contract and editor surface being stable first.

They should extend the system, not define it.

### Migration Notes

- introduce these as new target types and editor surfaces
- avoid rewriting the existing content flow
- keep page content canonical in Gutenberg

## What Should Stay

These parts of the current build are worth keeping:

- global chrome in `whipify_quick_editor_settings`
- page content in `post_content`
- the existing frontend edit mode toggle
- the Theme Factory block layer
- the forms manifest/plugin pattern
- the current no-output-buffering rule

## What Should Change First

The first changes should be:

1. semantic content registry
2. stronger target identity / resolver model
3. lock-aware saves and safer field typing
4. Gutenberg curation tied to the same contract
5. frontend presentation polish

## What Is Too Fragile To Keep

These behaviors should be treated as transitional, not final:

- heuristic field discovery
- flat render-order identity as the only resolver
- subtle frontend targets with no provenance explanation
- a stock-looking Gutenberg shell with hidden custom capabilities
- non-obvious demo-theme/pattern support

## Success Criteria

The roadmap is successful when:

- Calgary and similar pages expose clearly labeled global and page targets
- the frontend editor feels visibly useful when edit mode is on
- Gutenberg shows Theme Factory support in a more intentional, curated way
- the Site Editor and pattern surfaces feel like part of the product, not incidental WordPress defaults
- new capabilities do not require output buffering or a second page-content store

## Testing

Each phase should be covered by regression checks that verify:

- registry generation
- target identity
- save behavior
- lock handling
- Gutenberg parity
- frontend target visibility
- no regression in page content persistence

The goal is not just passing tests. It is proving the live editor surfaces now reflect the capabilities already present in the build.
