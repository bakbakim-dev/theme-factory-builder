import assert from 'node:assert/strict';
import {
  createWordPressGlobalChromeEditTarget,
  createWordPressPageBlockEditTarget,
  createWordPressEditTargetFromLegacyBlockLocator,
  normalizeWordPressEditTarget,
  sortWordPressEditTargets,
} from '../utils/wordpress-edit-target.ts';

const pageBlockTarget = createWordPressPageBlockEditTarget({
  postId: 42,
  blockName: 'core/heading',
  treePath: ['2', '10', '1'],
  field: 'content',
  fieldType: 'rich-text',
  revisionToken: 'rev-page-1',
  sourceHash: 'hash-page-1',
  context: {
    routePath: '/pricing/',
    locale: 'en-ca',
  },
});

assert.deepEqual(pageBlockTarget, {
  version: '2',
  entityKind: 'page-block',
  entitySource: 'wordpress-post',
  stableId: 'page-block:42:2.10.1',
  targetId: 'page-block:42:2.10.1:content',
  identity: {
    postId: 42,
    treePathKey: '2.10.1',
    stableId: 'page-block:42:2.10.1',
  },
  blockName: 'core/heading',
  treePath: ['2', '10', '1'],
  field: 'content',
  fieldType: 'rich-text',
  revisionToken: 'rev-page-1',
  sourceHash: 'hash-page-1',
  context: {
    locale: 'en-ca',
    routePath: '/pricing/',
  },
});

const imageTarget = createWordPressPageBlockEditTarget({
  postId: 99,
  blockName: 'core/image',
  treePath: [0],
  field: 'id',
  fieldType: 'mediaId',
  mediaId: '248',
  mediaSourceHash: 'hash-image-media-1',
  revisionToken: 'rev-image-1',
  sourceHash: 'hash-image-1',
});

assert.equal(imageTarget.mediaId, '248');
assert.equal(imageTarget.mediaSourceHash, 'hash-image-media-1');
assert.equal(imageTarget.fieldType, 'mediaId');
assert.equal(imageTarget.targetId, 'page-block:99:0:id');

const globalChromeTarget = createWordPressGlobalChromeEditTarget({
  scope: 'header',
  field: 'phone',
  fieldType: 'text',
  revisionToken: 'rev-chrome-1',
  sourceHash: 'hash-chrome-1',
  context: {
    routePath: '/calgary/',
    variant: 'alberta',
  },
});

assert.deepEqual(globalChromeTarget, {
  version: '2',
  entityKind: 'global-chrome',
  entitySource: 'wordpress-global',
  stableId: 'global-chrome:header',
  targetId: 'global-chrome:header:phone',
  identity: {
    scope: 'header',
    stableId: 'global-chrome:header',
  },
  field: 'phone',
  fieldType: 'text',
  revisionToken: 'rev-chrome-1',
  sourceHash: 'hash-chrome-1',
  context: {
    routePath: '/calgary/',
    variant: 'alberta',
  },
});

const legacyTarget = createWordPressEditTargetFromLegacyBlockLocator({
  postId: 91,
  blockName: 'core/button',
  blockPath: '7.2',
  field: 'url',
  revision: 'legacy-rev-2',
});

assert.equal(legacyTarget.version, '2');
assert.equal(legacyTarget.entityKind, 'page-block');
assert.equal(legacyTarget.entitySource, 'wordpress-post');
assert.equal(legacyTarget.stableId, 'page-block:91:7.2');
assert.equal(legacyTarget.targetId, 'page-block:91:7.2:url');
assert.equal(legacyTarget.identity.postId, 91);
assert.equal(legacyTarget.identity.treePathKey, '7.2');
assert.equal(legacyTarget.identity.stableId, 'page-block:91:7.2');
assert.equal(legacyTarget.blockName, 'core/button');
assert.deepEqual(legacyTarget.treePath, ['7', '2']);
assert.equal(legacyTarget.field, 'url');
assert.equal(legacyTarget.fieldType, 'text');
assert.equal(legacyTarget.revisionToken, 'legacy-rev-2');

assert.throws(
  () => normalizeWordPressEditTarget({
    entityKind: 'page-block',
    entitySource: 'wordpress-post',
    identity: {
      postId: 5,
    },
    field: 'content',
    fieldType: 'text',
    revisionToken: '',
  }),
  /revisionToken or sourceHash is required/,
);

const sortedTargets = sortWordPressEditTargets([
  globalChromeTarget,
  pageBlockTarget,
  legacyTarget,
]);

assert.deepEqual(sortedTargets.map((target) => target.targetId), [
  'global-chrome:header:phone',
  'page-block:42:2.10.1:content',
  'page-block:91:7.2:url',
]);

console.log('WordPress edit target regression');
console.log('[PASS] Resolver-v2 target contract is stable');
