import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createStaticSiteOutput } from '../utils/static-output.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const artifactRoot = path.join(repoRoot, 'logs', 'artifact-inspect');
const prerenderedRoot = path.join(artifactRoot, 'prerendered');

const slugToTitle = (slug) => slug
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const readArtifactInput = async () => {
  const entries = await fs.readdir(prerenderedRoot, { withFileTypes: true });
  const htmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();

  const routeHtmlByPath = {};
  const routes = [];

  for (const fileName of htmlFiles) {
    const slug = fileName.replace(/\.html$/i, '');
    const routePath = slug === 'home' ? '/' : `/${slug}/`;
    const fullPath = path.join(prerenderedRoot, fileName);
    routeHtmlByPath[routePath] = await fs.readFile(fullPath, 'utf8');
    routes.push({
      path: routePath,
      slug,
      title: slug === 'home' ? 'Home' : slugToTitle(slug),
    });
  }

  return { routes, routeHtmlByPath };
};

const { routes, routeHtmlByPath } = await readArtifactInput();

const result = createStaticSiteOutput({
  siteSlug: 'duty-cleaners-static',
  routes,
  routeHtmlByPath,
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional house cleaning services in Edmonton and Calgary.',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: 'CA',
    priceRange: '$$',
    ogImage: 'https://lovable.dev/opengraph-image-p98pqg.png',
    socialFacebook: 'https://www.facebook.com/dutycleaners/',
    socialInstagram: 'https://www.instagram.com/dutycleaners/',
    socialTwitter: 'https://x.com/Dutycleaners',
    socialLinkedIn: 'https://www.linkedin.com/company/duty-cleaners/',
    primaryLocale: 'en-CA',
    alternateLocales: '',
  },
  staticSiteSettings: {
    baseUrl: 'https://dutycleaners.example',
    formsProvider: 'web3forms',
    formsEndpoint: '',
    web3FormsAccessKey: 'smoke-key',
    latitude: '53.5461',
    longitude: '-113.4938',
    serviceAreas: 'Edmonton, Calgary, St. Albert, Sherwood Park',
    enableAiCrawlerAllowances: true,
    enableLlmsTxt: true,
    enableIndexNow: true,
  },
});

assert.equal(result.report.routeCount, routes.length);
assert.ok(routes.length >= 20);
assert.equal(result.report.warnings.length, 0);
assert.ok(result.files['index.html']);
assert.ok(result.files['edmonton/index.html']);
assert.ok(result.files['contact/index.html']);
assert.ok(result.files['sitemap.xml']);
assert.ok(result.files['robots.txt']);
assert.ok(result.files['llms.txt']);
assert.match(result.files['edmonton/index.html'], /<link rel="canonical" href="https:\/\/dutycleaners\.example\/edmonton\/"/);
assert.match(result.files['contact/index.html'], /action="https:\/\/api\.web3forms\.com\/submit"/);
assert.match(result.files['contact/index.html'], /name="access_key" value="smoke-key"/);
assert.match(result.files['edmonton/index.html'], /"@type": "LocalBusiness"/);
assert.match(result.files['edmonton/index.html'], /https:\/\/www\.facebook\.com\/dutycleaners\//);
assert.match(result.files['sitemap.xml'], /https:\/\/dutycleaners\.example\/edmonton\//);
assert.match(result.files['_redirects'], /\/edmonton \/edmonton\/ 301/);

console.log('Static output smoke');
console.log(`[PASS] Real artifact static export generated for ${routes.length} routes`);
