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
assert.equal(normalizeCaptureUrl('https://example.com/sitemap.xml'), 'https://example.com/sitemap.xml');
assert.equal(normalizeCaptureUrl('https://example.com/docs/file.json?download=1'), 'https://example.com/docs/file.json?download=1');
assert.deepEqual(
  normalizeRouteSeedList(' /pricing\n/contact\npricing '),
  ['/pricing/', '/contact/'],
);
assert.deepEqual(
  normalizeRouteSeedList('https://example.com/pricing\nhttps://example.com/contact/?ref=nav'),
  ['/pricing/', '/contact/'],
);
assert.equal(toSyntheticArtifactPath('/edmonton/pricing/'), 'edmonton/pricing/index.html');

console.log('[PASS] URL capture defaults and normalization');
