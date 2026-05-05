# Whipify Frontend Block-Aware Editor v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WordPress frontend editing experience that feels like inline editing while staying synchronized with Gutenberg. Global chrome edits must continue to save into `whipify_quick_editor_settings`, while page-level edits on supported blocks must save back into real Gutenberg `post_content`.

**Architecture:** Extend the existing generated Quick Editor system instead of replacing it. Keep two editing lanes:
- **Global chrome lane** backed by the existing Quick Editor settings option
- **Page block lane** backed by block-aware, revision-safe updates to `post_content`

Admin-only render-time instrumentation will mark editable content for logged-in users, a lightweight frontend overlay will provide the UI, and generated WordPress handlers will save either option-backed chrome fields or block-backed page fields. No output buffering, no DOM shadow store, no HTML overrides in `wp_options`.

**Tech Stack:** React + TypeScript + Vite dashboard, JSZip theme packaging, generated PHP WordPress theme files, small admin-only frontend JS/CSS runtime, Node regression scripts, Playwright dashboard export tests, WordPress Playground CLI smoke coverage.

---

## File Structure

### New files
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyFrontendEditor.ts`
  - Owns generated frontend-editor PHP, JS, CSS, render-time instrumentation helpers, block save helpers, and runtime configuration payloads.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-regression.mjs`
  - Regression coverage for generated PHP/JS/CSS content, supported-block field mapping, revision token wiring, and save-endpoint presence.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-dashboard-ui.spec.mjs`
  - End-to-end dashboard export verification that the generated WordPress theme ZIP contains the frontend editor assets and handlers.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-playground.mjs`
  - Optional-but-planned Playground smoke harness for generated theme validation on WordPress 6.9.4 and newer environments.

### Modified files
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/components/Dashboard.tsx`
  - Inject generated frontend-editor PHP/JS/CSS into WordPress themes only, alongside the existing Quick Editor wiring.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts`
  - Expose reusable field metadata/defaults for the global chrome lane so the frontend editor and admin-screen Quick Editor share one settings contract.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/package.json`
  - Add regression, dashboard UI, and Playground smoke scripts for the frontend editor.

### Existing files to inspect while implementing
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/wordpress-chrome-context.ts`
  - Existing city-aware header/footer context routing that must remain intact when frontend editing touches global chrome.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-regression.mjs`
  - Existing Quick Editor regression pattern to extend rather than replace.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-dashboard-ui.spec.mjs`
  - Existing dashboard ZIP-export Playwright pattern to mirror for frontend editor coverage.

---

## Task 1: Build the frontend editor generator utility and regression coverage

**Files:**
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyFrontendEditor.ts`
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-regression.mjs`
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts`

- [ ] **Step 1: Write the failing regression first**

Create a Node regression script that imports the planned generator helpers and asserts the generated output contains the core architecture:
- admin-bar toggle registration
- admin-only render-time instrumentation hooks
- supported block whitelist definitions for:
  - `core/heading` -> `content`
  - `core/paragraph` -> `content`
  - `core/button` -> `text`, `url`
- page-block save endpoint
- global chrome save endpoint reuse
- nonce and revision token checks
- frontend runtime config with edit scopes `global-chrome` and `page-block`

Suggested assertions:

```js
import assert from 'node:assert/strict';
import {
  buildWhipifyFrontendEditorArtifacts,
  buildWhipifyFrontendEditorSupportMap,
} from '../utils/whipifyFrontendEditor.ts';
import { buildWhipifyQuickEditorDefaults } from '../utils/whipifyQuickEditor.ts';

const defaults = buildWhipifyQuickEditorDefaults({
  companyName: 'Duty Cleaners',
  telephone: '780-913-6565',
  ctaText1: 'Book Now',
  ctaLink1: '/book/',
});

const supportMap = buildWhipifyFrontendEditorSupportMap({
  hasHeaderSlots: ['primary_cta_text', 'phone'],
  hasFooterSlots: ['business_name'],
});

const artifacts = buildWhipifyFrontendEditorArtifacts({
  defaults,
  supportMap,
  themeSlug: 'duty-cleaners-theme',
});

assert.match(artifacts.php, /admin_bar_menu/);
assert.match(artifacts.php, /render_block/);
assert.match(artifacts.php, /WP_HTML_Tag_Processor/);
assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_block/);
assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_chrome/);
assert.match(artifacts.php, /core\/heading/);
assert.match(artifacts.php, /core\/paragraph/);
assert.match(artifacts.php, /core\/button/);
assert.match(artifacts.php, /post_content/);
assert.match(artifacts.php, /wp_create_nonce/);
assert.match(artifacts.js, /Whipify Edit Mode/);
assert.match(artifacts.js, /data-whipify-editable/);
assert.match(artifacts.js, /Edit in Gutenberg/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel/);

console.log('whipify frontend editor regression passed');
```

- [ ] **Step 2: Run the regression and verify it fails**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
FAIL because the new generator utility does not exist yet.

- [ ] **Step 3: Add the minimal utility with explicit lane separation**

Implement `utils/whipifyFrontendEditor.ts` with helpers that return generated artifacts rather than writing files directly.

The minimum API should look like:

```ts
export interface WhipifyFrontendEditorArtifacts {
  php: string;
  js: string;
  css: string;
}

export interface WhipifyFrontendEditorSupportMap {
  globalChrome: {
    header: string[];
    footer: string[];
    social: string[];
  };
  pageBlocks: Record<string, string[]>;
}

export const buildWhipifyFrontendEditorSupportMap = (...) => ...;
export const buildWhipifyFrontendEditorArtifacts = (...) => ...;
```

Keep the page-block whitelist narrow and hard-coded for v1.

- [ ] **Step 4: Expand the utility to include the full v1 contract**

The generated PHP should include:
- admin-bar toggle registration
- current-user/capability checks
- helper that decides whether frontend edit mode is enabled
- admin-only render-time instrumentation for supported blocks
- block path tracking helpers
- global chrome save endpoint that writes into `whipify_quick_editor_settings`
- page-block save endpoint that:
  - checks nonce
  - checks capability
  - loads latest post
  - validates revision token
  - parses `post_content`
  - updates only allowed block fields
  - serializes and saves
- conflict-safe JSON responses

The generated JS should include:
- admin-bar toggle wiring
- hover outlines
- one-selection-at-a-time behavior
- side panel UI
- `Edit in Gutenberg`
- separate save flows for `global-chrome` vs `page-block`

The generated CSS should include:
- overlay/outline styles
- side panel styles
- admin-only helper styles that do not alter public output

- [ ] **Step 5: Re-run the regression**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
PASS with `whipify frontend editor regression passed`

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  utils/whipifyFrontendEditor.ts \
  utils/whipifyQuickEditor.ts \
  scripts/whipify-frontend-editor-regression.mjs
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: scaffold frontend block-aware editor generator"
```

---

## Task 2: Integrate generated frontend-editor assets into WordPress theme export

**Files:**
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/components/Dashboard.tsx`
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyFrontendEditor.ts`
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-regression.mjs`

- [ ] **Step 1: Add the failing integration assertion to the regression**

Extend the regression script to verify that `Dashboard.tsx` now:
- imports the frontend editor generator
- builds artifacts only for WordPress mode
- injects generated PHP into `functions.php`
- writes generated JS/CSS into the exported theme

Suggested assertions:

```js
import fs from 'node:fs/promises';

const dashboardSource = await fs.readFile(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8');
assert.match(dashboardSource, /buildWhipifyFrontendEditorArtifacts/);
assert.match(dashboardSource, /whipify-frontend-editor\.js/);
assert.match(dashboardSource, /whipify-frontend-editor\.css/);
assert.match(dashboardSource, /tf_frontend_editor_save_block/);
```

- [ ] **Step 2: Run the regression and verify it fails**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
FAIL because the dashboard has not been wired yet.

- [ ] **Step 3: Wire the generator into the theme export**

In `Dashboard.tsx`:
- derive the frontend editor support map from:
  - existing Quick Editor slot support
  - the page-block whitelist for v1
- build frontend editor artifacts only for WordPress / Platinum output
- append generated PHP to the theme `functions.php`
- write:
  - `assets/whipify-frontend-editor.js`
  - `assets/whipify-frontend-editor.css`
- ensure `functions.php` enqueues or prints the assets only for logged-in admins with edit capability

- [ ] **Step 4: Keep public output clean**

The integration must ensure:
- public visitors do not receive edit markers
- public visitors do not load frontend editor runtime assets
- generated output for non-admin users remains unchanged

- [ ] **Step 5: Re-run integration verification**

Run:
- `node scripts/whipify-frontend-editor-regression.mjs`
- `npm.cmd run build`

Expected:
PASS for both

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  components/Dashboard.tsx \
  utils/whipifyFrontendEditor.ts
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: inject frontend editor assets into wordpress exports"
```

---

## Task 3: Implement the global chrome lane on the frontend

**Files:**
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyFrontendEditor.ts`
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts`
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-regression.mjs`

- [ ] **Step 1: Add failing assertions for the global chrome lane**

Regression should verify:
- generated PHP includes `wp_ajax_tf_frontend_editor_save_chrome`
- the save handler reuses Quick Editor sanitization rules
- JS recognizes `data-whipify-edit-scope="global-chrome"`
- side panel can render current value and save it

Example checks:

```js
assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_chrome/);
assert.match(artifacts.php, /whipify_quick_editor_settings/);
assert.match(artifacts.php, /sanitize_text_field/);
assert.match(artifacts.php, /esc_url_raw/);
assert.match(artifacts.js, /global-chrome/);
assert.match(artifacts.js, /primary_cta_text/);
```

- [ ] **Step 2: Run the regression and verify it fails**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
FAIL until the save path is implemented.

- [ ] **Step 3: Implement the frontend chrome save handler**

Generated PHP should:
- accept only logged-in users with `edit_theme_options`
- verify nonce
- accept only supported field keys
- sanitize by field type
- merge into `whipify_quick_editor_settings`
- return JSON with updated value

Generated JS should:
- open side panel for supported chrome nodes
- submit via `admin-ajax.php`
- update the live DOM on success
- keep one selected field at a time

- [ ] **Step 4: Re-run the regression**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
PASS

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  utils/whipifyFrontendEditor.ts \
  utils/whipifyQuickEditor.ts \
  scripts/whipify-frontend-editor-regression.mjs
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: add frontend quick editor chrome save flow"
```

---

## Task 4: Implement the page block lane with revision-safe Gutenberg updates

**Files:**
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyFrontendEditor.ts`
- Create or modify tests in: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-regression.mjs`

- [ ] **Step 1: Add failing page-block assertions**

Regression should verify:
- generated PHP includes `wp_ajax_tf_frontend_editor_save_block`
- supported block names and field mappings are explicit
- render-time instrumentation uses `render_block`
- generated PHP references `WP_HTML_Tag_Processor`
- save path references `parse_blocks` and `serialize_blocks`
- conflict handling checks revision or modified token

Example checks:

```js
assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_block/);
assert.match(artifacts.php, /parse_blocks/);
assert.match(artifacts.php, /serialize_blocks/);
assert.match(artifacts.php, /WP_HTML_Tag_Processor/);
assert.match(artifacts.php, /core\/heading/);
assert.match(artifacts.php, /core\/paragraph/);
assert.match(artifacts.php, /core\/button/);
assert.match(artifacts.php, /revision/);
```

- [ ] **Step 2: Run the regression and verify it fails**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
FAIL until the page-block lane is implemented.

- [ ] **Step 3: Implement render-time admin-only instrumentation**

Generated PHP should:
- hook into `render_block`
- instrument only when:
  - user is logged in
  - user can edit the current post
  - frontend edit mode is on or available
- instrument only supported blocks
- add:
  - `data-whipify-editable="true"`
  - `data-whipify-edit-scope="page-block"`
  - `data-whipify-post-id`
  - `data-whipify-block-name`
  - `data-whipify-block-path`
  - `data-whipify-field`
  - `data-whipify-revision`

Use `WP_HTML_Tag_Processor` to mutate the first meaningful element safely.

- [ ] **Step 4: Implement page-block update helpers**

Add generated PHP helpers to:
- walk parsed blocks by path
- verify block type matches
- update only allowed fields:
  - heading `content`
  - paragraph `content`
  - button `text`
  - button `url`
- reject unsupported fields
- preserve all other block content

Suggested flow:

```php
$blocks = parse_blocks( $post->post_content );
$target = tf_frontend_editor_update_block_by_path( $blocks, $block_path, $block_name, $field, $new_value );
if ( is_wp_error( $target ) ) { ... }
$updated_content = serialize_blocks( $blocks );
wp_update_post(
  array(
    'ID' => $post_id,
    'post_content' => $updated_content,
  )
);
```

- [ ] **Step 5: Add conflict handling**

Generated PHP should:
- compare incoming revision token or modified timestamp
- fail closed when stale
- return clear JSON response with a conflict reason

Generated JS should:
- show a friendly conflict message
- offer refresh / `Edit in Gutenberg`

- [ ] **Step 6: Re-run the regression**

Run:
`node scripts/whipify-frontend-editor-regression.mjs`

Expected:
PASS

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  utils/whipifyFrontendEditor.ts \
  scripts/whipify-frontend-editor-regression.mjs
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: add block-aware frontend page editing"
```

---

## Task 5: Add dashboard export verification, Playground smoke coverage, and final verification

**Files:**
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-dashboard-ui.spec.mjs`
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-frontend-editor-playground.mjs`
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/package.json`

- [ ] **Step 1: Write the failing dashboard ZIP-export test**

Create a Playwright test that:
- uploads a minimal fixture zip to the local dashboard
- completes a WordPress conversion
- downloads the theme ZIP
- asserts the ZIP contains:
  - `functions.php` with frontend-editor handlers
  - `assets/whipify-frontend-editor.js`
  - `assets/whipify-frontend-editor.css`
  - Quick Editor + frontend editor helper strings

Suggested assertions:

```js
expect(functionsPhp).toContain('tf_frontend_editor_save_block');
expect(functionsPhp).toContain('tf_frontend_editor_save_chrome');
expect(functionsPhp).toContain('render_block');
expect(runtimeJs).toContain('Whipify Edit Mode');
expect(runtimeJs).toContain('Edit in Gutenberg');
expect(runtimeCss).toContain('.whipify-frontend-editor-panel');
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run:
`npx playwright test scripts/whipify-frontend-editor-dashboard-ui.spec.mjs --reporter=line`

Expected:
FAIL until the new test is added and the exported zip contains the assets.

- [ ] **Step 3: Add package scripts**

Update `package.json` with:

```json
{
  "scripts": {
    "test:whipify-frontend-editor": "node scripts/whipify-frontend-editor-regression.mjs",
    "test:whipify-frontend-editor-dashboard-ui": "npx playwright test scripts/whipify-frontend-editor-dashboard-ui.spec.mjs --reporter=line",
    "test:whipify-frontend-editor-playground": "node scripts/whipify-frontend-editor-playground.mjs"
  }
}
```

- [ ] **Step 4: Add Playground smoke coverage**

Create a lightweight Playground script that:
- mounts a generated theme fixture
- boots WordPress 6.9.4
- verifies theme load does not fatally error
- checks that generated helper functions exist in the exported theme files

If full browser-side interaction in Playground is too heavy for the first pass, keep this as a file-level smoke harness plus a clearly documented follow-up.

- [ ] **Step 5: Run the full verification set**

Run:
- `npm.cmd run test:whipify-frontend-editor`
- `npm.cmd run test:whipify-frontend-editor-dashboard-ui`
- `npm.cmd run test:whipify-quick-editor`
- `npm.cmd run test:wordpress-chrome-context`
- `npm.cmd run test:whipify-forms-dashboard-ui`
- `npm.cmd run build`

If available and stable:
- `npm.cmd run test:whipify-frontend-editor-playground`

Expected:
PASS for all enabled checks

- [ ] **Step 6: Manual WordPress sanity check**

On a disposable WordPress install:

1. Activate the generated theme
2. Log in as an admin
3. Verify the admin bar shows `Whipify Edit Mode`
4. Turn it on and edit:
   - one global phone field
   - one heading block
5. Verify:
   - global phone change updates site-wide
   - heading change appears both on the frontend and in Gutenberg
6. Click unsupported content
7. Verify only `Edit in Gutenberg` is offered
8. Simulate a stale save and verify conflict handling

- [ ] **Step 7: Commit the verified tranche**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  components/Dashboard.tsx \
  package.json \
  utils/whipifyQuickEditor.ts \
  utils/whipifyFrontendEditor.ts \
  scripts/whipify-frontend-editor-regression.mjs \
  scripts/whipify-frontend-editor-dashboard-ui.spec.mjs \
  scripts/whipify-frontend-editor-playground.mjs
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: add frontend block-aware editor v1"
```

---

## Self-Review

### Spec coverage
- Admin-bar-only entry point: covered in Tasks 1-3.
- Global chrome lane backed by `whipify_quick_editor_settings`: covered in Task 3.
- Page block lane backed by real Gutenberg `post_content`: covered in Task 4.
- Supported block whitelist only: covered in Tasks 1 and 4.
- No output buffering / no shadow store: enforced in Tasks 1, 2, and 4.
- Conflict handling: covered in Task 4.
- Playground regression direction: covered in Task 5.

### Placeholder scan
- No `TBD` or open-ended placeholders remain.
- The only intentional flexibility is that Playground interaction depth may start as a smoke harness if full browser automation is too heavy for the first pass.

### Consistency check
- `Whipify Edit Mode` is the consistent frontend toggle label.
- `whipify_quick_editor_settings` remains the global settings option.
- `tf_frontend_editor_save_chrome` and `tf_frontend_editor_save_block` are the planned generated handlers.
- `utils/whipifyFrontendEditor.ts` is the single generator utility for the new frontend editing lane.
