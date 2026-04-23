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
assert.match(artifacts.php, /tf_frontend_editor_save_block/);
assert.match(artifacts.php, /tf_frontend_editor_save_chrome/);
assert.match(artifacts.php, /tf_frontend_editor_revision_token_for_post/);
assert.match(artifacts.php, /tf_frontend_editor_handle_toggle_request/);
assert.match(artifacts.php, /whipify_frontend_editor_toggle/);
assert.match(artifacts.js, /Whipify Edit Mode/);
assert.match(artifacts.js, /isEnabled: false/);
assert.match(artifacts.js, /saveGlobalChrome/);
assert.match(artifacts.js, /savePageBlock/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel/);

console.log('whipify frontend editor playground smoke passed (file-level pre-Playground harness)');
