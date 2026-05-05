import assert from 'node:assert/strict';
import { certifyUrlCaptureArtifact } from '../utils/url-capture-certification.ts';

const certified = certifyUrlCaptureArtifact({
  routesRequested: ['/', '/pricing/'],
  routesCaptured: ['/', '/pricing/'],
  unresolvedAssets: [],
  missingCriticalData: [],
  interactionCoverage: { tabs: true, accordions: true },
});
assert.equal(certified.status, 'certified');

const needsInput = certifyUrlCaptureArtifact({
  routesRequested: ['/', '/pricing/', '/contact/'],
  routesCaptured: ['/', '/pricing/'],
  unresolvedAssets: [],
  missingCriticalData: [],
  interactionCoverage: { tabs: true, accordions: true },
});
assert.equal(needsInput.status, 'needs-input');
assert.match(needsInput.recommendations.join(' '), /route seeds/i);

const uncertified = certifyUrlCaptureArtifact({
  routesRequested: ['/'],
  routesCaptured: ['/'],
  unresolvedAssets: ['https://example.com/app.js'],
  missingCriticalData: ['pricing table API'],
  interactionCoverage: { tabs: false, accordions: false },
});
assert.equal(uncertified.status, 'uncertified');

console.log('[PASS] URL capture certification outcomes');
