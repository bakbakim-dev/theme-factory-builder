import assert from 'node:assert/strict';
import {
  buildWhipifyFrontendEditorArtifacts,
  buildWhipifyFrontendEditorSupportMap,
} from '../utils/whipifyFrontendEditor.ts';
import {
  applyWhipifyFrontendEditorPageBlockUpdate,
  findWhipifyEditablePageBlockAtLegacyPath,
} from '../utils/whipifyFrontendEditorPageBlockAdapter.ts';
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

const sampleBlocks = [
  {
    blockName: 'core/group',
    attrs: {},
    innerBlocks: [
      {
        blockName: 'core/paragraph',
        attrs: {},
        innerBlocks: [],
        innerHTML: '<p><strong>Hello</strong> world</p>',
        innerContent: ['<p><strong>Hello</strong> world</p>'],
      },
      {
        blockName: 'core/group',
        attrs: {},
        innerBlocks: [
          {
            blockName: 'core/button',
            attrs: {
              text: 'Book now',
              url: '/old-book/',
            },
            innerBlocks: [],
            innerHTML: '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/old-book/">Book now</a></div>',
            innerContent: ['<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/old-book/">Book now</a></div>'],
          },
        ],
        innerHTML: '<div class="wp-block-group"><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/old-book/">Book now</a></div></div>',
        innerContent: ['<div class="wp-block-group"><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/old-book/">Book now</a></div></div>'],
      },
    ],
    innerHTML: '<div class="wp-block-group"><p><strong>Hello</strong> world</p><div class="wp-block-group"><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/old-book/">Book now</a></div></div></div>',
    innerContent: ['<div class="wp-block-group"><p><strong>Hello</strong> world</p><div class="wp-block-group"><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/old-book/">Book now</a></div></div></div>'],
  },
  {
    blockName: 'core/heading',
    attrs: {
      content: 'Main heading',
    },
    innerBlocks: [],
    innerHTML: '<h2>Main heading</h2>',
    innerContent: ['<h2>Main heading</h2>'],
  },
  {
    blockName: 'core/image',
    attrs: {
      url: '/images/original.jpg',
      alt: 'Original lobby photo',
    },
    innerBlocks: [],
    innerHTML: '<figure class="wp-block-image size-large"><img src="/images/original.jpg" alt="Original lobby photo" /></figure>',
    innerContent: ['<figure class="wp-block-image size-large"><img src="/images/original.jpg" alt="Original lobby photo" /></figure>'],
  },
];

assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [0, 0])?.blockName,
  'core/paragraph',
  'nested tree paths should resolve page paragraph blocks deterministically',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [0, 1, 0])?.blockName,
  'core/button',
  'deep nested tree paths should resolve page button blocks deterministically',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [1])?.blockName,
  'core/heading',
  'single-segment tree paths should still resolve root-level editable blocks',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [2])?.blockName,
  'core/image',
  'root-level image blocks should be available in the safe media lane',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [0, 9]),
  null,
  'invalid nested tree paths must fail closed',
);

const paragraphUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [0, 0], 'content', 'Updated paragraph');
assert.ok(paragraphUpdated, 'paragraph update should succeed');
assert.equal(paragraphUpdated?.[0]?.innerBlocks?.[0]?.attrs?.content, 'Updated paragraph');
assert.equal(paragraphUpdated?.[0]?.innerBlocks?.[0]?.innerHTML, '<p>Updated paragraph</p>');
assert.deepEqual(paragraphUpdated?.[0]?.innerBlocks?.[0]?.innerContent, ['<p>Updated paragraph</p>']);

const buttonUrlUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [0, 1, 0], 'url', '/book-now/');
assert.ok(buttonUrlUpdated, 'button URL update should succeed');
assert.equal(buttonUrlUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.attrs?.url, '/book-now/');
assert.match(buttonUrlUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /href="\/book-now\/"/);
assert.deepEqual(
  buttonUrlUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerContent,
  ['<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/book-now/">Book now</a></div>'],
);

const imageAltUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [2], 'alt', 'Updated lobby photo');
assert.ok(imageAltUpdated, 'image alt update should succeed');
assert.equal(imageAltUpdated?.[2]?.attrs?.alt, 'Updated lobby photo');
assert.match(imageAltUpdated?.[2]?.innerHTML || '', /alt="Updated lobby photo"/);

const imageUrlUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [2], 'url', '/images/updated.jpg');
assert.ok(imageUrlUpdated, 'image URL update should succeed');
assert.equal(imageUrlUpdated?.[2]?.attrs?.url, '/images/updated.jpg');
assert.match(imageUrlUpdated?.[2]?.innerHTML || '', /src="\/images\/updated.jpg"/);

assert.equal(
  applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [0, 1, 1], 'url', '/book-now/'),
  null,
  'adapter updates must reject invalid nested tree paths',
);

const saveBlockStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_save_block' ) ) {");
const bootstrapConfigStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_bootstrap_config' ) ) {");
const renderBlockStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_render_supported_block' ) ) {");
const jsonConflictStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_json_conflict' ) ) {");

assert.notEqual(saveBlockStart, -1, 'Expected tf_frontend_editor_save_block() in generated PHP');
assert.notEqual(bootstrapConfigStart, -1, 'Expected tf_frontend_editor_bootstrap_config() in generated PHP');
assert.notEqual(renderBlockStart, -1, 'Expected tf_frontend_editor_render_supported_block() in generated PHP');
assert.notEqual(jsonConflictStart, -1, 'Expected tf_frontend_editor_json_conflict() in generated PHP');

const saveBlockPhp = artifacts.php.slice(saveBlockStart, bootstrapConfigStart);
const renderBlockPhp = artifacts.php.slice(renderBlockStart, jsonConflictStart);
const tagBlockPhpStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_tag_block_content' ) ) {");
const tagBlockPhp = tagBlockPhpStart === -1
  ? artifacts.php
  : artifacts.php.slice(tagBlockPhpStart, renderBlockStart);

assert.match(artifacts.php, /tf_frontend_editor_page_block_target_from_request/);
assert.match(artifacts.php, /tf_frontend_editor_resolve_page_block_target/);
assert.match(artifacts.php, /tf_frontend_editor_apply_page_block_adapter_update/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_adapter_result/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_normalize_tree_path/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_find_at_tree_path/);
assert.match(artifacts.php, /innerHTML/);
assert.match(artifacts.php, /innerContent/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_tag_text/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_anchor_href/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_image_attribute/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_source_hash/);
assert.match(artifacts.php, /__tf_frontend_editor_tree_path/);
assert.match(artifacts.php, /'sourceHash' =>/);
assert.match(artifacts.php, /'content' => 'text'/);
assert.doesNotMatch(artifacts.php, /rich-text/);

assert.match(saveBlockPhp, /\$target = tf_frontend_editor_page_block_target_from_request\(\);/);
assert.match(saveBlockPhp, /\$resolved_target = tf_frontend_editor_resolve_page_block_target\( \$blocks, \$target \);/);
assert.match(saveBlockPhp, /\$current_source_hash = isset\( \$resolved_target\['sourceHash'\] \)/);
assert.match(saveBlockPhp, /Page block source hash mismatch/);
assert.match(saveBlockPhp, /\$adapter_result = tf_frontend_editor_apply_page_block_adapter_update\( \$post, \$blocks, \$resolved_target, \$value \);/);
assert.match(saveBlockPhp, /wp_send_json_success\( tf_frontend_editor_page_block_adapter_result\( \$fresh_post, \$adapter_result \) \);/);
assert.doesNotMatch(saveBlockPhp, /\$updated_blocks = tf_frontend_editor_update_block_at_path\( \$blocks, \$block_path, \$field, \$value \);/);

assert.match(artifacts.php, /add_filter\( 'render_block_data', 'tf_frontend_editor_prepare_render_block_data'/);
assert.match(tagBlockPhp, /tf_frontend_editor_block_path_for_parsed_block\( \$parsed_block \)/);
assert.doesNotMatch(renderBlockPhp, /\$tf_frontend_editor_render_index\+\+/);

console.log('whipify frontend editor page-block adapter regression passed');
