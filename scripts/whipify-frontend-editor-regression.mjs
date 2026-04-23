import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
const fallbackSupportMap = buildWhipifyFrontendEditorSupportMap();

const artifacts = buildWhipifyFrontendEditorArtifacts({
  defaults,
  supportMap,
  themeSlug: 'duty-cleaners-theme',
});
const dashboardSource = await fs.readFile(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8');

assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_block/);
assert.match(artifacts.php, /wp_ajax_tf_frontend_editor_save_chrome/);
assert.match(artifacts.php, /tf_frontend_editor_sanitize_block_field/);
assert.match(artifacts.php, /wp_create_nonce/);
assert.match(artifacts.php, /whipify_quick_editor_settings/);
assert.match(artifacts.php, /hash_equals/);
assert.match(artifacts.php, /tf_frontend_editor_revision_token_for_post/);
assert.match(artifacts.php, /data-whipify-post-id/);
assert.match(artifacts.php, /data-whipify-field/);
assert.match(artifacts.php, /data-whipify-revision/);
assert.match(artifacts.php, /data-whipify-source-hash/);
assert.match(artifacts.php, /tf_frontend_editor_render_chrome_text/);
assert.match(artifacts.php, /tf_frontend_editor_render_chrome_link_attributes/);
assert.match(artifacts.php, /data-whipify-block-path/);
assert.match(artifacts.php, /render_block_data/);
assert.match(artifacts.php, /render_block_core\/heading/);
assert.match(artifacts.php, /render_block_core\/paragraph/);
assert.match(artifacts.php, /render_block_core\/button/);
assert.match(artifacts.php, /render_block_core\/image/);
assert.doesNotMatch(artifacts.php, /add_filter\( 'render_block', 'tf_frontend_editor_render_block'/);
assert.match(artifacts.php, /current_user_can\( 'edit_pages' \)/);
assert.match(artifacts.php, /current_user_can\( 'edit_theme_options' \)/);
assert.match(artifacts.php, /current_user_can\( 'edit_post', \$post_id \)/);
assert.match(artifacts.php, /get_post_type\( \$post_id \)/);
assert.match(artifacts.php, /Only pages support frontend page-block editing\./);
assert.match(artifacts.php, /tf_frontend_editor_cookie_name/);
assert.match(artifacts.php, /whipify_frontend_editor_enabled/);
assert.match(artifacts.php, /tf_frontend_editor_handle_toggle_request/);
assert.match(artifacts.php, /setcookie/);
assert.match(artifacts.php, /whipify_frontend_editor_toggle/);
assert.match(artifacts.php, /wp_nonce_url/);
assert.match(artifacts.php, /wp_script_is\( 'wp-interactivity', 'registered' \)/);
assert.match(artifacts.php, /wp_enqueue_media\(\)/);
assert.match(artifacts.php, /quickEditorUrl/);
assert.match(artifacts.php, /core\/heading/);
assert.match(artifacts.php, /core\/paragraph/);
assert.match(artifacts.php, /core\/button/);
assert.match(artifacts.php, /core\/image/);
assert.match(artifacts.php, /content/);
assert.match(artifacts.php, /text/);
assert.match(artifacts.php, /url/);
assert.match(artifacts.php, /alt/);
assert.match(artifacts.php, /global-chrome/);
assert.match(artifacts.php, /page-block/);
assert.match(artifacts.js, /Whipify Edit Mode/);
assert.match(artifacts.js, /ajaxUrl/);
assert.match(artifacts.js, /wpInteractivity/);
assert.match(artifacts.js, /store\('whipifyFrontendEditor'/);
assert.match(artifacts.js, /syncInteractivityState/);
assert.match(artifacts.js, /data-wp-interactive/);
assert.match(artifacts.js, /globalChromeNonce/);
assert.match(artifacts.js, /pageBlockNonce/);
assert.match(artifacts.js, /isEnabled: false/);
assert.match(artifacts.js, /Edit in Gutenberg/);
assert.match(artifacts.js, /data-whipify-editable/);
assert.match(artifacts.js, /saveGlobalChrome/);
assert.match(artifacts.js, /savePageBlock/);
assert.match(artifacts.js, /state:\s*interactivityState/);
assert.match(artifacts.js, /data-whipify-action="choose-media"/);
assert.match(artifacts.js, /window\.wp && typeof window\.wp\.media === 'function'/);
assert.match(artifacts.js, /Media selected\. Save to apply\./);
assert.match(artifacts.js, /Open Quick Editor/);
assert.match(artifacts.js, /quickEditorUrl/);
assert.doesNotMatch(artifacts.js, /function bindAdminBarToggle/);
assert.match(artifacts.js, /setEnabled\(Boolean\(whipifyFrontendEditorConfig\.isEnabled\), panel\)/);
assert.match(artifacts.js, /data-whipify-post-id/);
assert.match(artifacts.js, /data-whipify-source-hash/);
assert.match(artifacts.js, /data-whipify-kind/);
assert.match(artifacts.js, /panel\.dataset\.kind/);
assert.match(artifacts.js, /getAttribute\('href'\)/);
assert.match(artifacts.js, /secondary-input/);
assert.match(artifacts.js, /sourceHash/);
assert.match(artifacts.js, /data-whipify-edit-scope'\) !== 'global-chrome'/);
assert.match(artifacts.js, /whipify-frontend-editor-input/);
assert.match(artifacts.js, /Saving…/);
assert.match(artifacts.js, /Page block revision token mismatch|Secondary save failed|Save failed/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel/);
assert.match(dashboardSource, /buildWhipifyFrontendEditorArtifacts/);
assert.match(dashboardSource, /buildWhipifyFrontendEditorSupportMap/);
assert.match(dashboardSource, /assets\/whipify-frontend-editor\.js/);
assert.match(dashboardSource, /assets\/whipify-frontend-editor\.css/);
assert.match(dashboardSource, /frontendEditorArtifacts\.php/);
assert.ok(fallbackSupportMap.globalChrome.header.includes('phone'));
assert.ok(fallbackSupportMap.globalChrome.footer.includes('business_name'));
assert.ok(fallbackSupportMap.globalChrome.social.includes('facebook'));

console.log('whipify frontend editor regression passed');
