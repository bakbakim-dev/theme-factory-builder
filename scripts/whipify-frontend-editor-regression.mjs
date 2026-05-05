import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  buildWhipifyFrontendEditorArtifacts,
  buildWhipifyFrontendEditorSupportMap,
  listWhipifyFrontendEditorPageBlockSupport,
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
const converterSource = await fs.readFile(new URL('../utils/converter.ts', import.meta.url), 'utf8');
const pluginTemplatesSource = await fs.readFile(new URL('../utils/plugintemplates.ts', import.meta.url), 'utf8');

assert.doesNotMatch(artifacts.php, /wp_ajax_tf_frontend_editor_save_block/);
assert.doesNotMatch(artifacts.php, /wp_ajax_tf_frontend_editor_save_chrome/);
assert.match(artifacts.php, /tf_frontend_editor_sanitize_block_field/);
assert.match(artifacts.php, /wp_create_nonce/);
assert.match(artifacts.php, /tf_quick_editor_settings/);
assert.match(artifacts.php, /hash_equals/);
assert.match(artifacts.php, /tf_frontend_editor_revision_token_for_post/);
assert.match(artifacts.php, /data-whipify-post-id/);
assert.match(artifacts.php, /data-whipify-field/);
assert.match(artifacts.php, /data-whipify-revision/);
assert.match(artifacts.php, /data-whipify-source-hash/);
assert.match(artifacts.php, /data-whipify-target-id/);
assert.match(artifacts.php, /data-whipify-target/);
assert.match(artifacts.php, /data-whipify-tree-path/);
assert.match(artifacts.php, /tf_frontend_editor_render_chrome_text/);
assert.match(artifacts.php, /tf_frontend_editor_render_chrome_link_attributes/);
assert.match(artifacts.php, /tf_frontend_editor_humanize_label/);
assert.match(artifacts.php, /tf_frontend_editor_chrome_field_label/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_field_label/);
assert.match(artifacts.php, /tf_frontend_editor_target_descriptor/);
assert.match(artifacts.php, /data-whipify-provenance-label/);
assert.match(artifacts.php, /data-whipify-target-label/);
assert.match(artifacts.php, /data-whipify-open-target/);
assert.match(artifacts.php, /data-whipify-surface-kind/);
assert.match(artifacts.php, /data-whipify-block-path/);
assert.match(artifacts.php, /render_block_data/);
assert.match(artifacts.php, /render_block_core\/heading/);
assert.match(artifacts.php, /render_block_core\/paragraph/);
assert.match(artifacts.php, /render_block_core\/button/);
assert.match(artifacts.php, /render_block_core\/image/);
assert.match(artifacts.php, /render_block_core\/details/);
assert.match(artifacts.php, /render_block_theme-factory\/button/);
assert.match(artifacts.php, /render_block_theme-factory\/container/);
assert.doesNotMatch(artifacts.php, /add_filter\( 'render_block', 'tf_frontend_editor_render_block'/);
assert.match(artifacts.php, /current_user_can\( 'edit_pages' \)/);
assert.match(artifacts.php, /current_user_can\( 'edit_theme_options' \)/);
assert.match(artifacts.php, /current_user_can\( 'edit_post', \$post_id \)/);
assert.match(artifacts.php, /get_post_type\( \$post_id \)/);
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
assert.match(artifacts.php, /core\/details/);
assert.match(artifacts.php, /theme-factory\/button/);
assert.match(artifacts.php, /theme-factory\/container/);
assert.match(artifacts.php, /content/);
assert.match(artifacts.php, /summary/);
assert.match(artifacts.php, /text/);
assert.match(artifacts.php, /url/);
assert.match(artifacts.php, /href/);
assert.match(artifacts.php, /alt/);
assert.match(artifacts.php, /global-chrome/);
assert.match(artifacts.php, /page-block/);
assert.match(artifacts.php, /'editScopes' => array\( 'global-chrome', 'page-block', 'shared-content' \)/);
assert.match(artifacts.js, /Whipify Edit Mode/);
assert.doesNotMatch(artifacts.js, /ajaxUrl/);
assert.match(artifacts.js, /wpInteractivity/);
assert.match(artifacts.js, /store\('whipifyFrontendEditor'/);
assert.match(artifacts.js, /syncInteractivityState/);
assert.match(artifacts.js, /data-wp-interactive/);
assert.doesNotMatch(artifacts.js, /globalChromeNonce/);
assert.doesNotMatch(artifacts.js, /pageBlockNonce/);
assert.match(artifacts.js, /isEnabled: false/);
assert.match(artifacts.js, /Edit in Gutenberg/);
assert.match(artifacts.js, /data-whipify-action="edit-source"/);
assert.match(artifacts.js, /data-whipify-action="move-up"/);
assert.match(artifacts.js, /data-whipify-action="move-down"/);
assert.match(artifacts.js, /data-whipify-action="remove-block"/);
assert.match(artifacts.js, /updatePanelSummary/);
assert.match(artifacts.js, /data-whipify-role="provenance-badge"/);
assert.match(artifacts.js, /data-whipify-role="target-title"/);
assert.match(artifacts.js, /data-whipify-role="target-subtitle"/);
assert.match(artifacts.js, /data-whipify-role="source-note"/);
assert.match(artifacts.js, /data-whipify-editable/);
assert.match(artifacts.js, /saveGlobalChrome/);
assert.match(artifacts.js, /savePageBlock/);
assert.match(artifacts.js, /parseEditableTarget/);
assert.match(artifacts.js, /writeEditableTarget/);
assert.match(artifacts.js, /syncConflictState/);
assert.match(artifacts.js, /state:\s*interactivityState/);
assert.match(artifacts.js, /data-whipify-action="choose-media"/);
assert.match(artifacts.js, /data-whipify-role="breadcrumb"/);
assert.match(artifacts.js, /data-whipify-role="link-inspector"/);
assert.match(artifacts.js, /data-whipify-role="link-target-blank"/);
assert.match(artifacts.js, /data-whipify-role="link-rel"/);
assert.match(artifacts.js, /data-whipify-role="link-nofollow"/);
assert.match(artifacts.js, /data-whipify-role="media-size"/);
assert.match(artifacts.js, /data-whipify-role="image-width"/);
assert.match(artifacts.js, /data-whipify-role="image-height"/);
assert.match(artifacts.js, /data-whipify-role="viewport-frame"/);
assert.match(artifacts.js, /data-whipify-action="inline-edit"/);
assert.match(artifacts.js, /data-whipify-action="save-draft"/);
assert.match(artifacts.js, /data-whipify-action="save-all"/);
assert.match(artifacts.js, /data-whipify-action="discard-all"/);
assert.match(artifacts.js, /data-whipify-action="undo"/);
assert.match(artifacts.js, /data-whipify-action="redo"/);
assert.match(artifacts.js, /data-whipify-action="duplicate-block"/);
assert.match(artifacts.js, /data-whipify-action="insert-paragraph"/);
assert.match(artifacts.js, /data-whipify-action="viewport-mobile"/);
assert.match(artifacts.js, /window\.wp && typeof window\.wp\.media === 'function'/);
assert.match(artifacts.js, /Media selected\. Save to apply\./);
assert.match(artifacts.js, /Open Quick Editor/);
assert.match(artifacts.js, /quickEditorUrl/);
assert.doesNotMatch(artifacts.js, /function bindAdminBarToggle/);
assert.match(artifacts.js, /editScopes: \['global-chrome', 'page-block', 'shared-content'\]/);
assert.match(artifacts.js, /panel\.dataset\.editScope/);
assert.match(artifacts.js, /panel\.dataset\.editScope === 'global-chrome' && panel\.dataset\.kind === 'url'/);
assert.match(artifacts.js, /panel\.dataset\.editScope === 'page-block'/);
assert.match(artifacts.js, /panel\.dataset\.editScope === 'shared-content'/);
assert.match(artifacts.js, /capturePanelDraft/);
assert.match(artifacts.js, /applyPendingDrafts/);
assert.match(artifacts.js, /setViewportMode/);
assert.match(artifacts.js, /setInlineEditing/);
assert.match(artifacts.js, /shouldAutoStartInlineEditing/);
assert.match(artifacts.js, /setInlineEditing\(panel, canEditInline && shouldAutoStartInlineEditing\(target, panel\)\)/);
assert.match(artifacts.js, /toggleDetailsSummaryTarget/);
assert.match(artifacts.js, /target\.tagName\.toLowerCase\(\) !== 'summary'/);
assert.match(artifacts.js, /setEnabled\(Boolean\(whipifyFrontendEditorConfig\.isEnabled\), panel\)/);
assert.match(artifacts.js, /data-whipify-post-id/);
assert.match(artifacts.js, /data-whipify-source-hash/);
assert.match(artifacts.js, /data-whipify-kind/);
assert.match(artifacts.js, /panel\.dataset\.kind/);
assert.match(artifacts.js, /getAttribute\('href'\)/);
assert.match(artifacts.js, /secondary-input/);
assert.match(artifacts.js, /sourceHash/);
assert.match(artifacts.js, /editScope !== 'global-chrome' && editScope !== 'shared-content'/);
assert.match(artifacts.js, /whipify-frontend-editor-input/);
assert.match(artifacts.js, /Saving…/);
assert.match(artifacts.js, /Page block revision token mismatch|Secondary save failed|Save failed/);
assert.match(artifacts.js, /payload\?\.message \|\| payload\?\.data\?\.message/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel__meta/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel__structure/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel__badge/);
assert.match(artifacts.css, /\.whipify-frontend-editor-panel__subtitle/);
assert.match(artifacts.css, /\[data-whipify-editable="true"\]\[data-whipify-surface-kind="page-block"\]/);
assert.match(artifacts.css, /\[data-whipify-editable="true"\]\[data-whipify-surface-kind="global-chrome"\]/);
assert.match(dashboardSource, /buildWhipifyFrontendEditorArtifacts/);
assert.match(dashboardSource, /buildWhipifyFrontendEditorSupportMap/);
assert.match(dashboardSource, /assets\/whipify-frontend-editor\.js/);
assert.match(dashboardSource, /assets\/whipify-frontend-editor\.css/);
assert.match(dashboardSource, /frontendEditorArtifacts\.php/);
assert.match(converterSource, /DYNAMIC_CONTAINER_SAFE_TAGS = new Set\(\[[^\]]*'button'[^\]]*\]\)/);
assert.match(converterSource, /name === 'type'/);
assert.match(pluginTemplatesSource, /\$allowed = array\([^\)]*'button'[^\)]*\)/);
assert.match(pluginTemplatesSource, /'target', 'rel', 'type'/);
assert.match(pluginTemplatesSource, /safeTags = \[[^\]]*'button'[^\]]*\]/);
assert.ok(fallbackSupportMap.globalChrome.header.includes('phone'));
assert.ok(fallbackSupportMap.globalChrome.footer.includes('business_name'));
assert.ok(fallbackSupportMap.globalChrome.social.includes('facebook'));
const imageWidthSupport = listWhipifyFrontendEditorPageBlockSupport().find(
  (support) => support.blockName === 'core/image' && support.field === 'width',
);
const imageHeightSupport = listWhipifyFrontendEditorPageBlockSupport().find(
  (support) => support.blockName === 'core/image' && support.field === 'height',
);
const customButtonTextSupport = listWhipifyFrontendEditorPageBlockSupport().find(
  (support) => support.blockName === 'theme-factory/button' && support.field === 'text',
);
const customButtonHrefSupport = listWhipifyFrontendEditorPageBlockSupport().find(
  (support) => support.blockName === 'theme-factory/button' && support.field === 'href',
);
const detailsSummarySupport = listWhipifyFrontendEditorPageBlockSupport().find(
  (support) => support.blockName === 'core/details' && support.field === 'summary',
);
const containerButtonTextSupport = listWhipifyFrontendEditorPageBlockSupport().find(
  (support) => support.blockName === 'theme-factory/container' && support.field === 'text',
);
assert.equal(imageWidthSupport?.fieldType, 'number');
assert.equal(imageHeightSupport?.fieldType, 'number');
assert.equal(customButtonTextSupport?.fieldType, 'plainText');
assert.equal(customButtonHrefSupport?.fieldType, 'url');
assert.equal(detailsSummarySupport?.fieldType, 'plainText');
assert.equal(containerButtonTextSupport?.fieldType, 'plainText');

console.log('whipify frontend editor regression passed');
