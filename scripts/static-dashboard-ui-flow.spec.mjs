import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const downloadTarget = path.join(repoRoot, 'logs', 'static-dashboard-ui-download.zip');
const fixtureSlugs = [
  'home',
  'edmonton',
  'contact',
  'pricing',
  'services',
  'calgary',
];

const fillInputAfterLabel = async (page, labelText, value) => {
  const input = page.locator(`xpath=//label[contains(normalize-space(.), "${labelText}")]/following-sibling::input[1]`).first();
  await input.fill(value);
};

const buildStaticArtifactFixtureZip = async () => {
  const zip = new JSZip();
  for (const slug of fixtureSlugs) {
    const title = slug === 'home'
      ? 'Home'
      : slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    const body = slug === 'contact'
      ? '<h1>Contact Duty Cleaners</h1><form><input name="name" /><input name="email" /></form>'
      : `<h1>${title}</h1><p>Professional house cleaning services in ${title}.</p>`;
    const html = `<!DOCTYPE html><html><head><title>${title}</title><link rel="stylesheet" href="/assets/index-R-8iGppv.css"></head><body>${body}<script src="/assets/index-IA58qcH_.js"></script></body></html>`;
    zip.file(`prerendered/${slug}.html`, html);
    if (slug === 'home') {
      zip.file('index.html', html);
    } else {
      zip.file(`${slug}.html`, html);
    }
  }
  zip.file('assets/index-IA58qcH_.js', 'console.log("static dashboard fixture");');
  zip.file('assets/index-R-8iGppv.css', 'body { font-family: sans-serif; }');
  return zip.generateAsync({ type: 'nodebuffer' });
};

test.setTimeout(180000);

test('static-site mode exports a real artifact zip through the dashboard UI', async ({ page }) => {
  const artifactZipBuffer = await buildStaticArtifactFixtureZip();

  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Static Site' }).click();

  await page.getByRole('button', { name: /Local SEO & AI Signals/i }).click();
  await fillInputAfterLabel(page, 'Static Site Base URL', 'https://dutycleaners.ca');
  await fillInputAfterLabel(page, 'Web3Forms Access Key', 'demo-web3forms-key');
  await fillInputAfterLabel(page, 'Latitude', '53.5461');
  await fillInputAfterLabel(page, 'Longitude', '-113.4938');
  await fillInputAfterLabel(page, 'Service Areas', 'Edmonton, St. Albert, Sherwood Park');
  await fillInputAfterLabel(page, 'Website URL', 'https://dutycleaners.ca');
  await fillInputAfterLabel(page, 'Company Name', 'Duty Cleaners');
  await fillInputAfterLabel(page, 'Phone Number', '780-913-6565');
  await fillInputAfterLabel(page, 'City', 'Edmonton');
  await fillInputAfterLabel(page, 'State/Prov', 'AB');
  await fillInputAfterLabel(page, 'SEO Meta Description', 'Professional house cleaning services in Edmonton and surrounding service areas.');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'artifact-inspect.zip',
    mimeType: 'application/zip',
    buffer: artifactZipBuffer,
  });

  await page.getByText('Static Export Health').waitFor({ timeout: 120000 });
  await expect(page.getByText('Base URL:')).toContainText('https://dutycleaners.ca');
  await expect(page.getByText('Geo coordinates:')).toContainText('Configured');
  await expect(page.getByText('Service areas:')).toContainText('Configured');
  await expect(page.getByText('llms.txt:')).toContainText('Enabled');
  await expect(page.getByText('IndexNow key:')).toContainText('Enabled');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Download Static Site/i }).click(),
  ]);

  await fs.mkdir(path.dirname(downloadTarget), { recursive: true });
  await download.saveAs(downloadTarget);

  const zipBuffer = await fs.readFile(downloadTarget);
  const zip = await JSZip.loadAsync(zipBuffer);
  const fileNames = Object.keys(zip.files);

  expect(fileNames).toContain('artifact-inspect-static-site/404.html');
  expect(fileNames).toContain('artifact-inspect-static-site/robots.txt');
  expect(fileNames).toContain('artifact-inspect-static-site/sitemap.xml');
  expect(fileNames).toContain('artifact-inspect-static-site/llms.txt');
  expect(fileNames).toContain('artifact-inspect-static-site/indexnow-key.txt');
  expect(fileNames).toContain('artifact-inspect-static-site/contact/index.html');

  const robotsTxt = await zip.file('artifact-inspect-static-site/robots.txt').async('string');
  expect(robotsTxt).toContain('User-agent: OAI-SearchBot');
  expect(robotsTxt).toContain('User-agent: Google-Extended');
  expect(robotsTxt).toContain('User-agent: PerplexityBot');

  const llmsTxt = await zip.file('artifact-inspect-static-site/llms.txt').async('string');
  expect(llmsTxt).toContain('Duty Cleaners');
  expect(llmsTxt).toContain('Edmonton');

  const homeHtml = await zip.file('artifact-inspect-static-site/index.html').async('string');
  expect(homeHtml).toContain('<link rel="canonical" href="https://dutycleaners.ca/"');
  expect(homeHtml).toContain('"@type": "LocalBusiness"');
  expect(homeHtml).toContain('href="https://dutycleaners.ca/assets/index-R-8iGppv.css"');

  const contactHtml = await zip.file('artifact-inspect-static-site/contact/index.html').async('string');
  expect(contactHtml).toContain('https://dutycleaners.ca/contact/');
  expect(contactHtml).toContain('demo-web3forms-key');
});
