import assert from 'node:assert/strict';
import {
  buildWhipifyFrontendEditorArtifacts,
  buildWhipifyFrontendEditorSupportMap,
} from '../utils/whipifyFrontendEditor.ts';
import { buildWhipifyQuickEditorDefaults } from '../utils/whipifyQuickEditor.ts';

const defaults = buildWhipifyQuickEditorDefaults({
  primaryCtaText: 'Book Now',
  primaryCtaUrl: '/contact/',
  phone: '(555) 123-4567',
  businessName: 'Duty Cleaners',
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

assert.match(artifacts.php, /tf_frontend_editor_enqueue_assets/);
assert.match(artifacts.php, /wp_add_inline_script/);
assert.match(artifacts.php, /tf_frontend_editor_render_chrome_text/);
assert.match(artifacts.php, /tf_frontend_editor_revision_token_for_post/);
assert.match(artifacts.php, /tf_frontend_editor_handle_toggle_request/);
assert.match(artifacts.php, /whipify_frontend_editor_toggle/);
assert.match(artifacts.php, /tf_frontend_editor_target_descriptor/);
assert.match(artifacts.php, /data-whipify-provenance-label/);
assert.match(artifacts.php, /data-whipify-target-label/);
assert.match(artifacts.php, /data-whipify-open-target/);
assert.match(artifacts.js, /Whipify Edit Mode/);
assert.match(artifacts.js, /isEnabled: false/);
assert.match(artifacts.js, /updatePanelSummary/);
assert.match(artifacts.js, /data-whipify-action="edit-source"/);
assert.match(artifacts.js, /data-whipify-action="move-up"/);
assert.match(artifacts.js, /data-whipify-action="move-down"/);
assert.match(artifacts.js, /data-whipify-action="remove-block"/);
assert.match(artifacts.js, /data-whipify-role="provenance-badge"/);
assert.match(artifacts.js, /data-whipify-role="target-title"/);
assert.match(artifacts.js, /data-whipify-role="target-subtitle"/);
assert.match(artifacts.js, /saveGlobalChrome/);
assert.match(artifacts.js, /savePageBlock/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel__meta/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel__structure/);
assert.match(artifacts.css, /\[data-whipify-editable="true"\]\[data-whipify-surface-kind="page-block"\]/);
assert.match(artifacts.css, /\[data-whipify-editable="true"\]\[data-whipify-surface-kind="global-chrome"\]/);

console.log('whipify frontend editor playground smoke passed (file-level pre-Playground harness)');
