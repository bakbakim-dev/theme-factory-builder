import assert from 'node:assert/strict';
import {
  createDefaultUrlCaptureSettings,
  normalizeCaptureUrl,
  normalizeRouteSeedList,
  toSyntheticArtifactPath,
} from '../utils/url-capture-common.ts';

const defaults = createDefaultUrlCaptureSettings();

assert.equal(defaults.inputMode, 'public-url-certified');
assert.equal(defaults.captureDepth, 'balanced');
assert.equal(defaults.interactionExploration, true);
assert.equal(defaults.bundleInspection, true);

assert.equal(normalizeCaptureUrl('example.com'), 'https://example.com/');
assert.equal(normalizeCaptureUrl('mikaily129.sg-host.com/edmonton'), 'https://mikaily129.sg-host.com/edmonton/');
assert.equal(normalizeCaptureUrl('https://'), '');
assert.equal(normalizeCaptureUrl('https://example.com/sitemap.xml'), 'https://example.com/sitemap.xml');
assert.equal(normalizeCaptureUrl('https://example.com/docs/file.json?download=1'), 'https://example.com/docs/file.json?download=1');
assert.equal(normalizeCaptureUrl('javascript:alert(1)'), '');
assert.equal(normalizeCaptureUrl('data:text/plain,hello'), '');
assert.equal(normalizeCaptureUrl('mailto:test@example.com'), '');
assert.equal(normalizeCaptureUrl('ftp://example.com/file.txt'), '');
assert.deepEqual(
  normalizeRouteSeedList(' /pricing\n/contact\npricing '),
  ['/pricing/', '/contact/'],
);
assert.deepEqual(
  normalizeRouteSeedList('https://example.com/pricing\nhttps://example.com/contact/?ref=nav'),
  ['/pricing/', '/contact/'],
);
assert.deepEqual(
  normalizeRouteSeedList('foo/bar?x=1\nfoo#hash'),
  ['/foo/bar/', '/foo/'],
);
assert.deepEqual(
  normalizeRouteSeedList('https://example.com/app.js'),
  ['/app.js'],
);
assert.deepEqual(
  normalizeRouteSeedList('mailto:test@example.com\njavascript:alert(1)'),
  [],
);
assert.equal(toSyntheticArtifactPath('/foo/bar?x=1'), 'foo/bar/index.html');
assert.equal(toSyntheticArtifactPath('/foo#hash'), 'foo/index.html');
assert.equal(toSyntheticArtifactPath('/app.js'), 'app.js');
assert.equal(toSyntheticArtifactPath('/edmonton/pricing/'), 'edmonton/pricing/index.html');

console.log('[PASS] URL capture defaults and normalization');
