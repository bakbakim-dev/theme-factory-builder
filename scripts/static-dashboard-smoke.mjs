import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import JSZip from 'jszip';
import { buildStaticSiteFromArtifactZip } from '../utils/static-artifact.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const defaultArtifactRoot = path.join(repoRoot, 'logs', 'artifact-inspect');

const fixtureSlugs = [
  'home',
  'edmonton',
  'calgary',
  'contact',
  'pricing',
  'services',
  'deep-cleaning',
  'move-out-cleaning',
  'standard-cleaning',
  'post-construction-cleaning',
  'airbnb-cleaning',
  'st-albert',
  'sherwood-park',
  'spruce-grove',
  'leduc',
  'fort-saskatchewan',
  'beaumont',
  'stony-plain',
  'morinville',
  'devon',
  'faq',
];

const slugToTitle = (slug) => slug
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const addDirectoryToZip = async (zip, rootDir, currentDir = rootDir) => {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, rootDir, fullPath);
    } else {
      const content = await fs.readFile(fullPath);
      zip.file(relativePath, content);
    }
  }
};

const resolveArtifactRoot = async () => {
  try {
    await fs.access(path.join(defaultArtifactRoot, 'prerendered'));
    return defaultArtifactRoot;
  } catch {
    return '';
  }
};

const artifactRoot = await resolveArtifactRoot();
let routes = [];

const artifactZip = new JSZip();
if (artifactRoot) {
  const prerenderedRoot = path.join(artifactRoot, 'prerendered');
  const prerenderedEntries = await fs.readdir(prerenderedRoot, { withFileTypes: true });
  routes = prerenderedEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => {
      const slug = entry.name.replace(/\.html$/i, '');
      return {
        path: slug === 'home' ? '/' : `/${slug}/`,
        slug,
        title: slug === 'home' ? 'Home' : slugToTitle(slug),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  await addDirectoryToZip(artifactZip, artifactRoot);
} else {
  routes = fixtureSlugs.map((slug) => ({
    path: slug === 'home' ? '/' : `/${slug}/`,
    slug,
    title: slug === 'home' ? 'Home' : slugToTitle(slug),
  })).sort((a, b) => a.path.localeCompare(b.path));

  for (const route of routes) {
    const body = route.slug === 'contact'
      ? '<form><input name="name" /><input name="email" /></form>'
      : `<h1>${route.title}</h1><p>Professional house cleaning services in ${route.title}.</p>`;
    const html = `<!DOCTYPE html><html><head><title>${route.title}</title><link rel="stylesheet" href="/assets/index-R-8iGppv.css"></head><body>${body}<script src="/assets/index-IA58qcH_.js"></script></body></html>`;
    artifactZip.file(`prerendered/${route.slug}.html`, html);
    if (route.slug === 'home') {
      artifactZip.file('index.html', html);
    } else {
      artifactZip.file(`${route.slug}.html`, html);
    }
  }
  artifactZip.file('assets/index-IA58qcH_.js', 'console.log("fixture asset");');
  artifactZip.file('assets/index-R-8iGppv.css', 'body { font-family: sans-serif; }');
}
const zipBlob = await artifactZip.generateAsync({ type: 'nodebuffer' });
const loadedZip = await new JSZip().loadAsync(zipBlob);

const result = await buildStaticSiteFromArtifactZip({
  zipContent: loadedZip,
  routes,
  siteSlug: 'duty-cleaners-static',
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
    web3FormsAccessKey: 'dashboard-smoke-key',
    latitude: '53.5461',
    longitude: '-113.4938',
    serviceAreas: 'Edmonton, Calgary, St. Albert, Sherwood Park',
    enableAiCrawlerAllowances: true,
    enableLlmsTxt: true,
    enableIndexNow: true,
  },
});

assert.equal(result.report.routeCount, routes.length);
assert.ok(result.assetFiles['assets/index-IA58qcH_.js']);
assert.ok(result.assetFiles['assets/index-R-8iGppv.css']);
assert.ok(result.files['index.html']);
assert.ok(result.files['contact/index.html']);
assert.ok(result.files['edmonton/index.html']);
assert.match(result.files['contact/index.html'], /dashboard-smoke-key/);
assert.match(result.files['edmonton/index.html'], /https:\/\/dutycleaners\.example\/edmonton\//);
assert.equal(result.report.warnings.length, 0);

console.log('Static dashboard smoke');
console.log(`[PASS] Dashboard-path static export generated for ${routes.length} routes with copied assets (${artifactRoot ? 'artifact' : 'fixture'})`);
