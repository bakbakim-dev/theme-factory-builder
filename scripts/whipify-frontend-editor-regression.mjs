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
