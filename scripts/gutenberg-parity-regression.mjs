import assert from 'node:assert/strict';
import { PLUGIN_FILES } from '../utils/plugintemplates.ts';

const pluginSource = PLUGIN_FILES['build/blocks.js'] || '';
const pluginBootstrap = PLUGIN_FILES['theme-factory-blocks.php'] || '';
const importerSource = PLUGIN_FILES['inc/import.php'] || '';
const editorCurationSource = PLUGIN_FILES['inc/editor-curation.php'] || '';
const patternsSource = PLUGIN_FILES['inc/patterns.php'] || '';
const pageShellBlockJson = PLUGIN_FILES['blocks/page-shell/block.json'] || '';
const containerBlockJson = PLUGIN_FILES['blocks/container/block.json'] || '';
const buttonsBlockJson = PLUGIN_FILES['blocks/buttons/block.json'] || '';
const buttonBlockJson = PLUGIN_FILES['blocks/button/block.json'] || '';

assert.ok(pluginSource, 'Expected build/blocks.js in companion plugin templates.');
assert.ok(pluginBootstrap, 'Expected theme-factory-blocks.php in companion plugin templates.');
assert.ok(importerSource, 'Expected inc/import.php in companion plugin templates.');
assert.ok(editorCurationSource, 'Expected inc/editor-curation.php in companion plugin templates.');
assert.ok(patternsSource, 'Expected inc/patterns.php in companion plugin templates.');

assert.match(pluginBootstrap, /require_once TFB_PATH \. 'inc\/editor-curation\.php';/);
assert.match(pluginBootstrap, /require_once TFB_PATH \. 'inc\/patterns\.php';/);

assert.match(pluginSource, /registerBlockType\('theme-factory\/page-shell'/);
assert.match(pluginSource, /registerBlockType\('theme-factory\/container'/);
assert.match(pluginSource, /registerBlockType\('theme-factory\/buttons'/);
assert.match(pluginSource, /registerBlockType\('theme-factory\/button'/);
assert.match(pluginSource, /CONTENT_ONLY_TEMPLATE_LOCK\s*=\s*'contentOnly'/);
assert.match(pluginSource, /templateLock:\s*CONTENT_ONLY_TEMPLATE_LOCK/);
assert.match(pluginSource, /customStyle:\s*\{\s*type:\s*'object',\s*default:\s*\{\}\s*\}/);

assert.match(importerSource, /apply_curated_block_locks/);
assert.match(importerSource, /'theme-factory\/page-shell'/);
assert.match(importerSource, /'theme-factory\/container'/);
assert.match(importerSource, /'theme-factory\/buttons'/);
assert.match(importerSource, /'move'\s*=>\s*true/);
assert.match(importerSource, /'remove'\s*=>\s*true/);
assert.match(editorCurationSource, /allowed_block_types_all/);
assert.match(editorCurationSource, /block_editor_settings_all/);
assert.match(editorCurationSource, /canLockBlocks/);
assert.match(editorCurationSource, /theme-factory\/page-shell/);
assert.match(editorCurationSource, /theme-factory\/button/);
assert.match(editorCurationSource, /core\/image/);
assert.match(patternsSource, /class TFB_Patterns/);
assert.match(patternsSource, /register_block_pattern_category/);
assert.match(patternsSource, /register_block_pattern\(/);
assert.match(patternsSource, /theme-factory\/part-header/);
assert.match(patternsSource, /theme-factory\/part-footer/);
assert.match(patternsSource, /theme-factory\/hero/);
assert.match(patternsSource, /theme-factory\/cta-band/);
assert.match(patternsSource, /get_stylesheet_directory/);

const pageShellMetadata = JSON.parse(pageShellBlockJson);
const containerMetadata = JSON.parse(containerBlockJson);
const buttonsMetadata = JSON.parse(buttonsBlockJson);
const buttonMetadata = JSON.parse(buttonBlockJson);

assert.equal(buttonMetadata.attributes.text.role, 'content');
assert.equal(buttonMetadata.attributes.customStyle.type, 'object');
assert.equal(pageShellMetadata.supports.lock, false);
assert.equal(containerMetadata.supports.lock, false);
assert.equal(buttonsMetadata.supports.lock, false);

console.log('gutenberg parity regression passed');
