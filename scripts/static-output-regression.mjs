import assert from 'node:assert/strict';
import { createStaticSiteOutput } from '../utils/static-output.ts';

const routeHtmlByPath = {
  '/': '<!DOCTYPE html><html><head><title>Home</title></head><body><a href="/edmonton">Edmonton</a><form><input name="name" /></form></body></html>',
  '/edmonton/': '<!DOCTYPE html><html><head><title>Edmonton</title></head><body><h1>Edmonton</h1></body></html>',
  '/pricing/': '<!DOCTYPE html><html><head><title>Pricing</title></head><body><div role="tablist"><button type="button" role="tab" aria-selected="true" aria-controls="panel-standard" data-state="active">Standard</button><button type="button" role="tab" aria-selected="false" aria-controls="panel-deep" data-state="inactive">Deep</button></div><div id="panel-standard" role="tabpanel" data-state="active">Standard content</div><div id="panel-deep" role="tabpanel" data-state="inactive">Deep content</div></body></html>',
  '/faq-cards/': '<!DOCTYPE html><html><head><title>FAQ Cards</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Do you serve all areas of Edmonton?","acceptedAnswer":{"@type":"Answer","text":"Yes! We serve all Edmonton quadrants and nearby communities."}}]}</script></head><body><div class="max-w-3xl mx-auto space-y-4"><div class="bg-white rounded-xl border-2 border-border overflow-hidden hover:border-primary transition-colors"><button class="w-full p-6 flex items-center justify-between text-left"><span class="font-bold text-lg pr-4">Do you serve all areas of Edmonton?</span><svg></svg></button></div></div><details open><summary>Open by mistake</summary><p>Should start closed</p></details></body></html>',
};

const result = createStaticSiteOutput({
  siteSlug: 'duty-cleaners',
  routes: [
    { path: '/', slug: 'home', title: 'Home' },
    { path: '/edmonton/', slug: 'edmonton', title: 'Edmonton' },
    { path: '/pricing/', slug: 'pricing', title: 'Pricing' },
    { path: '/faq-cards/', slug: 'faq-cards', title: 'FAQ Cards' },
  ],
  routeHtmlByPath,
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional cleaning services in Edmonton.',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: 'CA',
    priceRange: '$$',
    ogImage: '/og.jpg',
    socialFacebook: 'https://facebook.com/dutycleaners',
    socialInstagram: 'https://instagram.com/dutycleaners',
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
    serviceAreas: 'Edmonton, St. Albert, Sherwood Park',
    enableAiCrawlerAllowances: true,
    enableLlmsTxt: true,
    enableIndexNow: true,
  },
});

const placeholderResult = createStaticSiteOutput({
  siteSlug: 'placeholder-site',
  routes: [{ path: '/', slug: 'home', title: 'Home' }],
  routeHtmlByPath: {
    '/': '<!DOCTYPE html><html><head><title>Placeholder</title></head><body><h1>Home</h1></body></html>',
  },
  seoSettings: {
    companyName: 'My Company',
    url: 'https://placeholder.example',
    description: 'Professional services in your area.',
    telephone: '(555) 123-4567',
    addressLocality: 'City Name',
    addressRegion: 'ST',
    addressCountry: '',
    priceRange: '$$',
    ogImage: '/og.jpg',
    primaryLocale: 'en-US',
    alternateLocales: '',
  },
  staticSiteSettings: {
    baseUrl: 'https://placeholder.example',
    formsProvider: 'web3forms',
    formsEndpoint: '',
    web3FormsAccessKey: 'test-key',
    latitude: '',
    longitude: '',
    serviceAreas: '',
    enableAiCrawlerAllowances: true,
    enableLlmsTxt: true,
    enableIndexNow: true,
  },
});

const inferredCountryResult = createStaticSiteOutput({
  siteSlug: 'inferred-country-site',
  routes: [{ path: '/contact/', slug: 'contact', title: 'Contact' }],
  routeHtmlByPath: {
    '/contact/': '<!DOCTYPE html><html><head><title>Contact</title></head><body><form><input name="name" /></form></body></html>',
  },
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional cleaning services in Edmonton.',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: '',
    priceRange: '$$',
    ogImage: '',
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

assert.ok(result.files['index.html']);
assert.ok(result.files['edmonton/index.html']);
assert.ok(result.files['404.html']);
assert.ok(result.files['sitemap.xml']);
assert.ok(result.files['robots.txt']);
assert.ok(result.files['llms.txt']);
assert.ok(result.files['indexnow-key.txt']);
assert.ok(result.files['assets/static-interactions.js']);
assert.match(result.files['index.html'], /<link rel="canonical" href="https:\/\/dutycleaners\.example\/"/);
assert.match(result.files['index.html'], /https:\/\/dutycleaners\.example\/edmonton\//);
assert.match(result.files['index.html'], /https:\/\/dutycleaners\.example\/og\.jpg/);
assert.match(result.files['index.html'], /<script defer src="\/assets\/static-interactions\.js"><\/script>/);
assert.match(result.files['index.html'], /\[role="tabpanel"\]\[data-state="inactive"\]\s*\{\s*display:\s*none\s*!important;/);
assert.match(result.files['index.html'], /\[role="region"\]\[data-state="closed"\]\s*\{\s*display:\s*none\s*!important;/);
assert.match(result.files['index.html'], /"@type": "WebSite"/);
assert.match(result.files['index.html'], /"@type": "BreadcrumbList"/);
assert.match(result.files['index.html'], /"@type": "GeoCoordinates"/);
assert.match(result.files['index.html'], /"areaServed"/);
assert.match(result.files['index.html'], /"sameAs"/);
assert.match(result.files['index.html'], /https:\/\/facebook\.com\/dutycleaners/);
assert.match(result.files['index.html'], /action="https:\/\/api\.web3forms\.com\/submit"/);
assert.match(result.files['index.html'], /name="access_key" value="test-key"/);
assert.doesNotMatch(inferredCountryResult.files['contact/index.html'], /"image": ""/);
assert.doesNotMatch(inferredCountryResult.files['contact/index.html'], /"logo": ""/);
assert.doesNotMatch(inferredCountryResult.files['contact/index.html'], /"sameAs": \[\]/);
assert.match(inferredCountryResult.files['contact/index.html'], /"addressCountry": "CA"/);
assert.match(result.files['llms.txt'], /Duty Cleaners/);
assert.match(result.files['llms.txt'], /Edmonton, St\. Albert, Sherwood Park/);
assert.match(result.files['robots.txt'], /OAI-SearchBot/);
assert.match(result.files['robots.txt'], /Google-Extended/);
assert.match(result.files['robots.txt'], /PerplexityBot/);
assert.match(result.files['pricing/index.html'], /id="panel-deep" role="tabpanel" data-state="inactive" hidden/);
assert.doesNotMatch(result.files['pricing/index.html'], /id="panel-standard" role="tabpanel" data-state="active" hidden/);
assert.match(result.files['faq-cards/index.html'], /data-static-faq-card="true"/);
assert.match(result.files['faq-cards/index.html'], /data-static-faq-answer="true" data-state="closed" hidden/);
assert.match(result.files['faq-cards/index.html'], /Yes! We serve all Edmonton quadrants and nearby communities\./);
assert.doesNotMatch(result.files['faq-cards/index.html'], /<details[^>]*\sopen/);
assert.doesNotMatch(placeholderResult.files['index.html'], /"@type": "LocalBusiness"/);
assert.equal(result.report.warnings.length, 0);
assert.equal(result.report.checks.formsReady, true);
assert.equal(result.report.checks.hasSufficientBusinessEntity, true);
assert.equal(result.report.checks.hasGeoCoordinates, true);
assert.equal(result.report.checks.hasServiceAreas, true);
assert.match(result.files['static-export-report.json'], /"warnings": \[\]/);
assert.match(placeholderResult.files['static-export-report.json'], /"code": "entity-placeholder"/);
assert.match(placeholderResult.files['static-export-report.json'], /"code": "geo-missing"/);
assert.match(placeholderResult.files['static-export-report.json'], /"code": "country-missing"/);
assert.equal(placeholderResult.report.checks.hasSufficientBusinessEntity, false);
assert.equal(placeholderResult.report.checks.hasGeoCoordinates, false);
assert.equal(placeholderResult.report.checks.hasServiceAreas, false);

console.log('Static output regression');
console.log('[PASS] Static output files and core SEO artifacts generated');
