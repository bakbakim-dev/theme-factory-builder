import assert from 'node:assert/strict';
import { PLUGIN_FILES } from '../utils/plugintemplates.ts';

const pluginBootstrap = PLUGIN_FILES['theme-factory-blocks.php'] || '';
const blocksPhp = PLUGIN_FILES['inc/blocks.php'] || '';
const bindingsPhp = PLUGIN_FILES['inc/bindings.php'] || '';
const blocksJs = PLUGIN_FILES['build/blocks.js'] || '';

assert.match(pluginBootstrap, /require_once TFB_PATH \. 'inc\/bindings\.php';/);
assert.ok(bindingsPhp, 'Expected companion plugin to ship inc/bindings.php');

assert.match(bindingsPhp, /register_block_bindings_source/);
assert.match(bindingsPhp, /theme-factory\/site-content/);
assert.match(bindingsPhp, /block_bindings_supported_attributes_theme-factory\/button/);
assert.match(bindingsPhp, /primary_cta_text/);
assert.match(bindingsPhp, /primary_cta_url/);
assert.match(bindingsPhp, /phone/);
assert.match(bindingsPhp, /business_name/);
assert.match(bindingsPhp, /facebook/);
assert.match(bindingsPhp, /tfb_site_content_binding_fields_for_editor/);

assert.match(blocksPhp, /blockBindings/);
assert.match(blocksPhp, /tfb_site_content_binding_fields_for_editor/);
assert.match(blocksPhp, /tfb_site_content_binding_source_name/);

assert.match(blocksJs, /registerBlockBindingsSource/);
assert.match(blocksJs, /theme-factory\/site-content/);
assert.match(blocksJs, /getFieldsList/);
assert.match(blocksJs, /setValues/);
assert.match(blocksJs, /canUserEditValue/);
assert.match(blocksJs, /blockBindings/);

console.log('block bindings regression passed');
