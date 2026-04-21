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

assert.equal(normalizeCaptureUrl('mikaily129.sg-host.com/edmonton'), 'https://mikaily129.sg-host.com/edmonton/');
assert.deepEqual(
  normalizeRouteSeedList(' /pricing\n/contact\npricing '),
  ['/pricing/', '/contact/'],
);
assert.equal(toSyntheticArtifactPath('/edmonton/pricing/'), 'edmonton/pricing/index.html');

console.log('[PASS] URL capture defaults and normalization');
