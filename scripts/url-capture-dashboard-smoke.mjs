import assert from 'node:assert/strict';
import http from 'node:http';
import { runCertifiedUrlCapture } from '../utils/url-capture-run.ts';

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html><head><title>Home</title><link rel="canonical" href="http://127.0.0.1:4319/" /></head><body><a href="/pricing/">Pricing</a><h1>Home</h1></body></html>`);
});

await new Promise((resolve) => server.listen(4319, resolve));

try {
  const result = await runCertifiedUrlCapture({
    sourceUrl: 'http://127.0.0.1:4319/',
    sitemapUrl: '',
    routeSeeds: '/pricing/',
    authCookiesJson: '',
    captureDepth: 'balanced',
    interactionExploration: true,
    bundleInspection: true,
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

  assert.ok(result.artifact);
  assert.ok(result.report);
  assert.ok(result.staticResult.files['index.html']);
  assert.ok(result.staticResult.files['pricing/index.html']);
  assert.ok(['certified', 'needs-input', 'uncertified'].includes(result.certification.status));
  assert.equal(result.report.certificationStatus, result.certification.status);

  console.log('[PASS] URL capture dashboard smoke');
} finally {
  server.close();
}
