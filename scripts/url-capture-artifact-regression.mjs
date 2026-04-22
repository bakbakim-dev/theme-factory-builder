import assert from 'node:assert/strict';
import { buildSyntheticArtifact, buildStaticSiteFromSyntheticArtifact } from '../utils/url-capture-artifact.ts';

const artifact = buildSyntheticArtifact({
  siteSlug: 'duty-cleaners',
  routes: [{
    path: '/',
    title: 'Home',
    html: '<!doctype html><html><body><h1>Home</h1></body></html>',
    canonicalUrl: 'https://dutycleaners.example/',
  }],
  assets: [{ path: 'assets/app.js', content: new Uint8Array([1, 2, 3]) }],
  captureMetadata: { sourceUrl: 'https://dutycleaners.example/' },
});

assert.equal(artifact.routeHtmlByPath['/'].includes('<h1>Home</h1>'), true);

const staticResult = buildStaticSiteFromSyntheticArtifact({
  artifact,
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional cleaning',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: 'CA',
    priceRange: '$$',
    ogImage: '/og.jpg',
    primaryLocale: 'en-CA',
    alternateLocales: '',
  },
  staticSiteSettings: {
    baseUrl: 'https://dutycleaners.example',
    formsProvider: 'web3forms',
    formsEndpoint: '',
    web3FormsAccessKey: 'test-key',
    latitude: '53.5461',
    longitude: '-113.4938',
    serviceAreas: 'Edmonton',
    enableAiCrawlerAllowances: true,
    enableLlmsTxt: true,
    enableIndexNow: true,
  },
});

assert.ok(staticResult.files['index.html']);
assert.ok(staticResult.assetFiles['assets/app.js']);

console.log('[PASS] URL capture synthetic artifact bridge');
