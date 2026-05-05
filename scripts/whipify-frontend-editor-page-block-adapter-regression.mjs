import assert from 'node:assert/strict';
import {
  buildWhipifyFrontendEditorArtifacts,
  buildWhipifyFrontendEditorSupportMap,
} from '../utils/whipifyFrontendEditor.ts';
import {
  applyWhipifyFrontendEditorPageBlockUpdate,
  applyWhipifyFrontendEditorPageBlockSaveAdapter,
  findWhipifyEditablePageBlockAtLegacyPath,
  resolveWhipifyFrontendEditorPageBlockTargetV2,
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
              linkTarget: '',
              rel: '',
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
  {
    blockName: 'theme-factory/button',
    attrs: {
      text: 'View Services',
      href: '',
      tagName: 'button',
      buttonType: 'button',
    },
    innerBlocks: [],
    innerHTML: '<button class="wp-block-theme-factory-button" type="button">View Services</button>',
    innerContent: ['<button class="wp-block-theme-factory-button" type="button">View Services</button>'],
  },
  {
    blockName: 'theme-factory/button',
    attrs: {
      text: 'Edmonton: 780-913-6565',
      href: 'tel:7809136565',
      target: '',
      rel: '',
      tagName: 'a',
    },
    innerBlocks: [],
    innerHTML: '<a class="wp-block-theme-factory-button" href="tel:7809136565">Edmonton: 780-913-6565</a>',
    innerContent: ['<a class="wp-block-theme-factory-button" href="tel:7809136565">Edmonton: 780-913-6565</a>'],
  },
  {
    blockName: 'core/details',
    attrs: {
      summary: 'Do I need to be home during the move out cleaning?',
    },
    innerBlocks: [
      {
        blockName: 'core/paragraph',
        attrs: {
          content: 'No, you do not need to be present.',
        },
        innerBlocks: [],
        innerHTML: '<p>No, you do not need to be present.</p>',
        innerContent: ['<p>No, you do not need to be present.</p>'],
      },
    ],
    innerHTML: '<details class="wp-block-details"><summary>Do I need to be home during the move out cleaning?</summary><p>No, you do not need to be present.</p></details>',
    innerContent: [
      '<details class="wp-block-details"><summary>Do I need to be home during the move out cleaning?</summary>',
      null,
      '</details>',
    ],
  },
  {
    blockName: 'theme-factory/container',
    attrs: {
      tagName: 'button',
      className: 'inline-flex bg-accent',
      htmlAttributes: {
        'data-state': 'active',
      },
    },
    innerBlocks: [
      {
        blockName: 'core/paragraph',
        attrs: {
          content: 'Book This Package',
        },
        innerBlocks: [],
        innerHTML: '<p>Book This Package</p>',
        innerContent: ['<p>Book This Package</p>'],
      },
    ],
    innerHTML: '<button class="inline-flex bg-accent" data-state="active"><p>Book This Package</p></button>',
    innerContent: [
      '<button class="inline-flex bg-accent" data-state="active">',
      null,
      '</button>',
    ],
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
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [3])?.blockName,
  'theme-factory/button',
  'custom rendered button blocks should be editable page-block targets',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [4])?.blockName,
  'theme-factory/button',
  'custom rendered anchor buttons should be editable page-block targets',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [5])?.blockName,
  'core/details',
  'details summary blocks should be editable page-block targets',
);
assert.equal(
  findWhipifyEditablePageBlockAtLegacyPath(sampleBlocks, [6])?.blockName,
  'theme-factory/container',
  'container-rendered button labels should be editable page-block targets',
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

const buttonTargetUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [0, 1, 0], 'linkTarget', '_blank');
assert.ok(buttonTargetUpdated, 'button target update should succeed');
assert.equal(buttonTargetUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.attrs?.linkTarget, '_blank');
assert.match(buttonTargetUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /target="_blank"/);

const buttonRelUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [0, 1, 0], 'rel', 'noopener nofollow');
assert.ok(buttonRelUpdated, 'button rel update should succeed');
assert.equal(buttonRelUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.attrs?.rel, 'noopener nofollow');
assert.match(buttonRelUpdated?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /rel="noopener nofollow"/);

const imageAltUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [2], 'alt', 'Updated lobby photo');
assert.ok(imageAltUpdated, 'image alt update should succeed');
assert.equal(imageAltUpdated?.[2]?.attrs?.alt, 'Updated lobby photo');
assert.match(imageAltUpdated?.[2]?.innerHTML || '', /alt="Updated lobby photo"/);

const imageUrlUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [2], 'url', '/images/updated.jpg');
assert.ok(imageUrlUpdated, 'image URL update should succeed');
assert.equal(imageUrlUpdated?.[2]?.attrs?.url, '/images/updated.jpg');
assert.match(imageUrlUpdated?.[2]?.innerHTML || '', /src="\/images\/updated.jpg"/);

const imageWidthUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [2], 'width', '640');
assert.ok(imageWidthUpdated, 'image width update should succeed');
assert.equal(imageWidthUpdated?.[2]?.attrs?.width, '640');
assert.match(imageWidthUpdated?.[2]?.innerHTML || '', /width="640"/);

const tfButtonTextUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [3], 'text', 'See Services');
assert.ok(tfButtonTextUpdated, 'custom button text update should succeed');
assert.equal(tfButtonTextUpdated?.[3]?.attrs?.text, 'See Services');
assert.equal(tfButtonTextUpdated?.[3]?.innerHTML, '<button class="wp-block-theme-factory-button" type="button">See Services</button>');

const tfButtonHrefUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [4], 'href', 'tel:17809136565');
assert.ok(tfButtonHrefUpdated, 'custom anchor button href update should succeed');
assert.equal(tfButtonHrefUpdated?.[4]?.attrs?.href, 'tel:17809136565');
assert.match(tfButtonHrefUpdated?.[4]?.innerHTML || '', /href="tel:17809136565"/);

const tfButtonTargetUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [4], 'target', '_blank');
assert.ok(tfButtonTargetUpdated, 'custom anchor button target update should succeed');
assert.equal(tfButtonTargetUpdated?.[4]?.attrs?.target, '_blank');
assert.match(tfButtonTargetUpdated?.[4]?.innerHTML || '', /target="_blank"/);

const detailsSummaryUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [5], 'summary', 'Can you clean while I am away?');
assert.ok(detailsSummaryUpdated, 'details summary update should succeed');
assert.equal(detailsSummaryUpdated?.[5]?.attrs?.summary, 'Can you clean while I am away?');
assert.match(detailsSummaryUpdated?.[5]?.innerHTML || '', /<summary>Can you clean while I am away\?<\/summary>/);

const containerButtonTextUpdated = applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [6], 'text', 'Reserve This Package');
assert.ok(containerButtonTextUpdated, 'container-rendered button text update should succeed');
assert.equal(containerButtonTextUpdated?.[6]?.innerBlocks?.[0]?.attrs?.content, 'Reserve This Package');
assert.match(containerButtonTextUpdated?.[6]?.innerHTML || '', /Reserve This Package/);

const resolvedButtonTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(sampleBlocks, {
  identity: { postId: 42, treePathKey: '0.1.0' },
  treePath: ['0', '1', '0'],
  field: 'text',
  revisionToken: 'rev-page-1',
});
assert.equal(resolvedButtonTarget?.stableId, 'page-block:42:0.1.0');
assert.equal(resolvedButtonTarget?.targetId, 'page-block:42:0.1.0:text');
assert.equal(resolvedButtonTarget?.fieldType, 'text');

const resolvedTfButtonTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(sampleBlocks, {
  identity: { postId: 42, treePathKey: '4' },
  treePath: ['4'],
  field: 'href',
  revisionToken: 'rev-page-1',
});
assert.equal(resolvedTfButtonTarget?.stableId, 'page-block:42:4');
assert.equal(resolvedTfButtonTarget?.targetId, 'page-block:42:4:href');
assert.equal(resolvedTfButtonTarget?.fieldType, 'url');

const resolvedDetailsTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(sampleBlocks, {
  identity: { postId: 42, treePathKey: '5' },
  treePath: ['5'],
  field: 'summary',
  revisionToken: 'rev-page-1',
});
assert.equal(resolvedDetailsTarget?.targetId, 'page-block:42:5:summary');
assert.equal(resolvedDetailsTarget?.fieldType, 'text');

const resolvedContainerButtonTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(sampleBlocks, {
  identity: { postId: 42, treePathKey: '6' },
  treePath: ['6'],
  field: 'text',
  revisionToken: 'rev-page-1',
});
assert.equal(resolvedContainerButtonTarget?.targetId, 'page-block:42:6:text');
assert.equal(resolvedContainerButtonTarget?.fieldType, 'text');

const saveAdapterUpdated = applyWhipifyFrontendEditorPageBlockSaveAdapter(sampleBlocks, {
  identity: { postId: 42, treePathKey: '0.1.0' },
  treePath: ['0', '1', '0'],
  field: 'text',
  revisionToken: 'rev-page-1',
}, [
  { field: 'text', value: 'Book today' },
  { field: 'url', value: '/book-today/' },
  { field: 'linkTarget', value: '_blank' },
  { field: 'rel', value: 'noopener noreferrer' },
]);
assert.ok(saveAdapterUpdated, 'multi-field save adapter update should succeed');
assert.equal(saveAdapterUpdated?.operations?.length, 4);
assert.equal(saveAdapterUpdated?.operations?.[0]?.targetId, 'page-block:42:0.1.0:text');
assert.equal(saveAdapterUpdated?.operations?.[1]?.targetId, 'page-block:42:0.1.0:url');
assert.equal(saveAdapterUpdated?.operations?.[2]?.targetId, 'page-block:42:0.1.0:linkTarget');
assert.equal(saveAdapterUpdated?.operations?.[3]?.targetId, 'page-block:42:0.1.0:rel');
assert.match(saveAdapterUpdated?.blocks?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /Book today/);
assert.match(saveAdapterUpdated?.blocks?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /href="\/book-today\/"/);
assert.match(saveAdapterUpdated?.blocks?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /target="_blank"/);
assert.match(saveAdapterUpdated?.blocks?.[0]?.innerBlocks?.[1]?.innerBlocks?.[0]?.innerHTML || '', /rel="noopener noreferrer"/);

const tfButtonSaveAdapterUpdated = applyWhipifyFrontendEditorPageBlockSaveAdapter(sampleBlocks, {
  identity: { postId: 42, treePathKey: '4' },
  treePath: ['4'],
  field: 'text',
  revisionToken: 'rev-page-1',
}, [
  { field: 'text', value: 'Call Edmonton' },
  { field: 'href', value: 'tel:17809136565' },
  { field: 'target', value: '_blank' },
  { field: 'rel', value: 'noopener nofollow' },
]);
assert.ok(tfButtonSaveAdapterUpdated, 'custom button multi-field save adapter update should succeed');
assert.equal(tfButtonSaveAdapterUpdated?.operations?.length, 4);
assert.equal(tfButtonSaveAdapterUpdated?.operations?.[1]?.targetId, 'page-block:42:4:href');
assert.match(tfButtonSaveAdapterUpdated?.blocks?.[4]?.innerHTML || '', /Call Edmonton/);
assert.match(tfButtonSaveAdapterUpdated?.blocks?.[4]?.innerHTML || '', /href="tel:17809136565"/);
assert.match(tfButtonSaveAdapterUpdated?.blocks?.[4]?.innerHTML || '', /target="_blank"/);
assert.match(tfButtonSaveAdapterUpdated?.blocks?.[4]?.innerHTML || '', /rel="noopener nofollow"/);

const detailsSaveAdapterUpdated = applyWhipifyFrontendEditorPageBlockSaveAdapter(sampleBlocks, {
  identity: { postId: 42, treePathKey: '5' },
  treePath: ['5'],
  field: 'summary',
  revisionToken: 'rev-page-1',
}, [
  { field: 'summary', value: 'Do I have to be there?' },
]);
assert.ok(detailsSaveAdapterUpdated, 'details summary save adapter update should succeed');
assert.match(detailsSaveAdapterUpdated?.blocks?.[5]?.innerHTML || '', /Do I have to be there\?/);

const containerButtonSaveAdapterUpdated = applyWhipifyFrontendEditorPageBlockSaveAdapter(sampleBlocks, {
  identity: { postId: 42, treePathKey: '6' },
  treePath: ['6'],
  field: 'text',
  revisionToken: 'rev-page-1',
}, [
  { field: 'text', value: 'Book Move-Out Package' },
]);
assert.ok(containerButtonSaveAdapterUpdated, 'container button save adapter update should succeed');
assert.equal(containerButtonSaveAdapterUpdated?.blocks?.[6]?.innerBlocks?.[0]?.attrs?.content, 'Book Move-Out Package');
assert.match(containerButtonSaveAdapterUpdated?.blocks?.[6]?.innerHTML || '', /Book Move-Out Package/);

const duplicatedBlock = applyWhipifyFrontendEditorPageBlockSaveAdapter(sampleBlocks, {
  identity: { postId: 42, treePathKey: '0.1.0' },
  treePath: ['0', '1', '0'],
  field: 'text',
  revisionToken: 'rev-page-1',
}, [
  { action: 'duplicate', field: 'text', value: '' },
]);
assert.ok(duplicatedBlock, 'duplicate block action should succeed');
assert.equal(duplicatedBlock?.action, 'duplicate');
assert.equal(duplicatedBlock?.blocks?.[0]?.innerBlocks?.[1]?.innerBlocks?.length, 2);

const insertedParagraph = applyWhipifyFrontendEditorPageBlockSaveAdapter(sampleBlocks, {
  identity: { postId: 42, treePathKey: '1' },
  treePath: ['1'],
  field: 'content',
  revisionToken: 'rev-page-1',
}, [
  { action: 'insert-paragraph', field: 'content', value: 'Inserted paragraph' },
]);
assert.ok(insertedParagraph, 'insert paragraph action should succeed');
assert.equal(insertedParagraph?.action, 'insert-paragraph');
assert.equal(insertedParagraph?.blocks?.[2]?.attrs?.content, 'Inserted paragraph');
assert.match(insertedParagraph?.blocks?.[2]?.innerHTML || '', /Inserted paragraph/);

assert.equal(
  applyWhipifyFrontendEditorPageBlockUpdate(sampleBlocks, [0, 1, 1], 'url', '/book-now/'),
  null,
  'adapter updates must reject invalid nested tree paths',
);

const bootstrapConfigStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_bootstrap_config' ) ) {");
const renderBlockStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_render_supported_block' ) ) {");
assert.notEqual(bootstrapConfigStart, -1, 'Expected tf_frontend_editor_bootstrap_config() in generated PHP');
assert.notEqual(renderBlockStart, -1, 'Expected tf_frontend_editor_render_supported_block() in generated PHP');
const renderBlockPhp = artifacts.php.slice(renderBlockStart, bootstrapConfigStart);
const tagBlockPhpStart = artifacts.php.indexOf("if ( ! function_exists( 'tf_frontend_editor_tag_block_content' ) ) {");
const tagBlockPhp = tagBlockPhpStart === -1
  ? artifacts.php
  : artifacts.php.slice(tagBlockPhpStart, renderBlockStart);

assert.match(artifacts.php, /tf_frontend_editor_page_block_target_from_request/);
assert.match(artifacts.php, /tf_frontend_editor_resolver_v2_resolve_page_block_target/);
assert.match(artifacts.php, /tf_frontend_editor_save_adapter_apply_page_block_operations/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_adapter_result/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_normalize_tree_path/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_find_at_tree_path/);
assert.match(artifacts.php, /innerHTML/);
assert.match(artifacts.php, /innerContent/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_tag_text/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_anchor_href/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_image_attribute/);
assert.match(artifacts.php, /theme-factory\/button/);
assert.match(artifacts.php, /theme-factory\/container/);
assert.match(artifacts.php, /core\/details/);
assert.match(artifacts.php, /render_block_theme-factory\/button/);
assert.match(artifacts.php, /render_block_theme-factory\/container/);
assert.match(artifacts.php, /render_block_core\/details/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_replace_first_button_href/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_update_first_text_child/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_source_hash/);
assert.match(artifacts.php, /__tf_frontend_editor_tree_path/);
assert.match(artifacts.php, /'sourceHash' =>/);
assert.match(artifacts.php, /'mediaId' => \$media_id/);
assert.match(artifacts.php, /'mediaSourceHash' => \$media_source_hash/);
assert.match(artifacts.php, /'stableId' =>/);
assert.match(artifacts.php, /'content' => 'text'/);
assert.match(artifacts.php, /'linkTarget' => 'text'/);
assert.match(artifacts.php, /'width' => 'number'/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_duplicate_at_tree_path/);
assert.match(artifacts.php, /tf_frontend_editor_page_block_insert_paragraph_after_tree_path/);
assert.doesNotMatch(artifacts.php, /rich-text/);
assert.doesNotMatch(artifacts.php, /tf_frontend_editor_save_block/);

assert.match(artifacts.php, /add_filter\( 'render_block_data', 'tf_frontend_editor_prepare_render_block_data'/);
assert.match(tagBlockPhp, /tf_frontend_editor_block_path_for_parsed_block\( \$parsed_block \)/);
assert.match(tagBlockPhp, /data-whipify-target/);
assert.match(tagBlockPhp, /data-whipify-target-id/);
assert.match(tagBlockPhp, /data-whipify-tree-path/);
assert.doesNotMatch(renderBlockPhp, /\$tf_frontend_editor_render_index\+\+/);

console.log('whipify frontend editor page-block adapter regression passed');
