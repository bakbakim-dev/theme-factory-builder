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
  targetId: 'page-block:42:2.10.1:content',
  identity: {
    postId: 42,
    treePathKey: '2.10.1',
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
  entitySource: 'wordpress-theme',
  targetId: 'global-chrome:header:phone',
  identity: {
    scope: 'header',
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
assert.equal(legacyTarget.targetId, 'page-block:91:7.2:url');
assert.equal(legacyTarget.identity.postId, 91);
assert.equal(legacyTarget.identity.treePathKey, '7.2');
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
