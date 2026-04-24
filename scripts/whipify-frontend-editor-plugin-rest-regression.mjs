import assert from 'node:assert/strict';
import { PLUGIN_FILES } from '../utils/plugintemplates.ts';
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

const pluginBootstrap = PLUGIN_FILES['theme-factory-blocks.php'] || '';
const frontendEditorPluginPhp = PLUGIN_FILES['inc/frontend-editor.php'] || '';

assert.match(pluginBootstrap, /require_once TFB_PATH \. 'inc\/frontend-editor\.php';/);
assert.ok(frontendEditorPluginPhp, 'Expected companion plugin to ship inc/frontend-editor.php');

assert.match(frontendEditorPluginPhp, /class TFB_Frontend_Editor/);
assert.match(frontendEditorPluginPhp, /register_rest_route/);
assert.match(frontendEditorPluginPhp, /REST_BASE\s*=\s*'\/frontend-editor'/);
assert.match(frontendEditorPluginPhp, /['"]\/chrome['"]/);
assert.match(frontendEditorPluginPhp, /['"]\/page-block['"]/);
assert.match(frontendEditorPluginPhp, /['"]\/lock['"]/);
assert.match(frontendEditorPluginPhp, /permission_callback/);
assert.match(frontendEditorPluginPhp, /wp_check_post_lock/);
assert.match(frontendEditorPluginPhp, /wp_set_post_lock/);
assert.match(frontendEditorPluginPhp, /require_once ABSPATH \. 'wp-admin\/includes\/post\.php';/);
assert.match(frontendEditorPluginPhp, /tf_frontend_editor_page_block_target_from_payload/);
assert.match(frontendEditorPluginPhp, /tf_frontend_editor_resolver_v2_resolve_page_block_target/);
assert.match(frontendEditorPluginPhp, /tf_frontend_editor_save_adapter_apply_page_block_operations/);
assert.match(frontendEditorPluginPhp, /operations/);
assert.match(frontendEditorPluginPhp, /sourceHash/);
assert.match(frontendEditorPluginPhp, /Only pages support frontend page-block editing\./);
assert.match(frontendEditorPluginPhp, /get_post_type\( \$post \)/);
assert.match(frontendEditorPluginPhp, /tfb_frontend_editor_rest_base_url/);
assert.match(frontendEditorPluginPhp, /tfb_frontend_editor_lock_url/);

assert.match(artifacts.php, /transport' => function_exists\( 'tfb_frontend_editor_rest_base_url' \) \? 'rest' : 'unavailable'/);
assert.match(artifacts.php, /restBaseUrl/);
assert.match(artifacts.php, /restNonce/);
assert.match(artifacts.php, /lockUrl/);
assert.match(artifacts.js, /saveGlobalChromeViaRest/);
assert.match(artifacts.js, /savePageBlockViaRest/);
assert.match(artifacts.js, /JSON\.parse\(rawTarget\)/);
assert.match(artifacts.js, /operations/);
assert.match(artifacts.js, /sourceHash/);
assert.doesNotMatch(artifacts.js, /saveGlobalChromeViaAjax/);
assert.doesNotMatch(artifacts.js, /savePageBlockViaAjax/);
assert.match(artifacts.js, /lockCurrentPagePost/);
assert.match(artifacts.js, /throw new Error\('REST transport is unavailable\.'/);

console.log('whipify frontend editor plugin rest regression passed');
