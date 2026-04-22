import assert from 'node:assert/strict';
import {
  buildWhipifyFrontendEditorArtifacts,
  buildWhipifyFrontendEditorSupportMap,
} from '../utils/whipifyFrontendEditor.ts';
import { buildWhipifyQuickEditorDefaults } from '../utils/whipifyQuickEditor.ts';

const defaults = buildWhipifyQuickEditorDefaults({
  companyName: 'Duty Cleaners',
  telephone: '780-913-6565',
  primaryCtaText: 'Book Now',
  primaryCtaUrl: '/book/',
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

assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_block/);
assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_chrome/);
assert.match(artifacts.php, /tf_frontend_editor_sanitize_block_field/);
assert.match(artifacts.php, /wp_create_nonce/);
assert.match(artifacts.php, /whipify_quick_editor_settings/);
assert.match(artifacts.php, /hash_equals/);
assert.match(artifacts.php, /tf_frontend_editor_revision_token_for_post/);
assert.match(artifacts.php, /data-whipify-block-path/);
assert.match(artifacts.php, /core\/heading/);
assert.match(artifacts.php, /core\/paragraph/);
assert.match(artifacts.php, /core\/button/);
assert.match(artifacts.php, /content/);
assert.match(artifacts.php, /text/);
assert.match(artifacts.php, /url/);
assert.match(artifacts.php, /global-chrome/);
assert.match(artifacts.php, /page-block/);
assert.match(artifacts.js, /Whipify Edit Mode/);
assert.match(artifacts.js, /ajaxUrl/);
assert.match(artifacts.js, /globalChromeNonce/);
assert.match(artifacts.js, /pageBlockNonce/);
assert.match(artifacts.js, /wp-admin-bar-whipify-frontend-editor-toggle/);
assert.match(artifacts.js, /Edit in Gutenberg/);
assert.match(artifacts.js, /data-whipify-editable/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel/);

console.log('whipify frontend editor regression passed');
