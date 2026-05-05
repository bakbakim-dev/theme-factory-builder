import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const downloadTarget = path.join(repoRoot, 'logs', 'whipify-frontend-editor-theme.zip');
const dashboardUrl = process.env.DASHBOARD_URL || 'http://127.0.0.1:5174/';

const buildFrontendEditorFixtureZip = async () => {
  const homeHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Duty Cleaners Home</title>
  </head>
  <body>
    <header>
      <a class="primary" href="/contact/">Book Now</a>
      <a class="phone" href="tel:5551234567">(555) 123-4567</a>
    </header>
    <main>
      <h1>Edmonton House Cleaning</h1>
      <p>Duty Cleaners helps Edmonton homeowners with recurring cleaning, deep cleaning, and move-out cleaning.</p>
      <a href="/contact/">Contact Us</a>
    </main>
    <footer>
      <strong>My Company</strong>
      <div>City Name, ST</div>
      <div>(555) 123-4567</div>
    </footer>
  </body>
</html>`;

  const contactHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contact Duty Cleaners</title>
  </head>
  <body>
    <header>
      <a class="primary" href="/contact/">Book Now</a>
      <a class="phone" href="tel:5551234567">(555) 123-4567</a>
    </header>
    <main>
      <h1>Contact Duty Cleaners</h1>
      <p>Request your cleaning quote and tell us which service you need.</p>
    </main>
    <footer>
      <strong>My Company</strong>
      <div>City Name, ST</div>
      <div>(555) 123-4567</div>
    </footer>
  </body>
</html>`;

  const zip = new JSZip();
  zip.file('index.html', homeHtml);
  zip.file('contact.html', contactHtml);
  zip.file('prerendered/home.html', homeHtml);
  zip.file('prerendered/contact.html', contactHtml);
  return zip.generateAsync({ type: 'nodebuffer' });
};

test.setTimeout(240000);

test('wordpress export includes frontend editor helpers and assets', async ({ page }) => {
  const fixtureZipBuffer = await buildFrontendEditorFixtureZip();

  await page.goto(dashboardUrl, { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'whipify-frontend-editor-fixture.zip',
    mimeType: 'application/zip',
    buffer: fixtureZipBuffer,
  });

  await page.getByText('Conversion Complete').waitFor({ timeout: 180000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Download Theme/i }).click(),
  ]);

  await fs.mkdir(path.dirname(downloadTarget), { recursive: true });
  await download.saveAs(downloadTarget);

  const zipBuffer = await fs.readFile(downloadTarget);
  const zip = await JSZip.loadAsync(zipBuffer);
  const fileNames = Object.keys(zip.files);
  const root = fileNames[0].split('/')[0];

  const functionsPhpPath = `${root}/functions.php`;
  const runtimeJsPath = `${root}/assets/whipify-frontend-editor.js`;
  const runtimeCssPath = `${root}/assets/whipify-frontend-editor.css`;

  expect(fileNames).toContain(functionsPhpPath);
  expect(fileNames).toContain(runtimeJsPath);
  expect(fileNames).toContain(runtimeCssPath);

  const functionsPhp = await zip.file(functionsPhpPath).async('string');
  const runtimeJs = await zip.file(runtimeJsPath).async('string');
  const runtimeCss = await zip.file(runtimeCssPath).async('string');

  expect(functionsPhp).toContain('tf_frontend_editor_enqueue_assets');
  expect(functionsPhp).toContain('tf_frontend_editor_target_descriptor');
  expect(functionsPhp).toContain('tf_frontend_editor_render_chrome_text');
  expect(functionsPhp).toContain('tf_frontend_editor_render_chrome_link_attributes');
  expect(functionsPhp).toContain('render_block_core/heading');
  expect(functionsPhp).toContain('render_block_core/paragraph');
  expect(functionsPhp).toContain('render_block_core/button');
  expect(functionsPhp).toContain('render_block_core/image');
  expect(functionsPhp).toContain('wp_add_inline_script');
  expect(functionsPhp).toContain('data-whipify-provenance-label');
  expect(functionsPhp).toContain('data-whipify-target-label');
  expect(functionsPhp).toContain('data-whipify-open-target');

  expect(runtimeJs).toContain('Whipify Edit Mode');
  expect(runtimeJs).toContain('saveGlobalChrome');
  expect(runtimeJs).toContain('savePageBlock');
  expect(runtimeJs).toContain('Edit in Gutenberg');
  expect(runtimeJs).toContain('data-whipify-action="edit-source"');
  expect(runtimeJs).toContain('data-whipify-action="move-up"');
  expect(runtimeJs).toContain('data-whipify-action="move-down"');
  expect(runtimeJs).toContain('data-whipify-action="remove-block"');
  expect(runtimeJs).toContain('data-whipify-provenance-label');
  expect(runtimeJs).toContain('data-whipify-target-label');
  expect(runtimeJs).toContain('data-whipify-open-target');
  expect(runtimeJs).toContain('updatePanelSummary');

  expect(runtimeCss).toContain('.whipify-frontend-editor-panel');
  expect(runtimeCss).toContain('.whipify-frontend-editor-panel__meta');
  expect(runtimeCss).toContain('.whipify-frontend-editor-panel__structure');
  expect(runtimeCss).toContain('.whipify-frontend-editor-panel__badge');
  expect(runtimeCss).toContain('[data-whipify-editable="true"][data-whipify-surface-kind="page-block"]');
  expect(runtimeCss).toContain('[data-whipify-editable="true"][data-whipify-surface-kind="global-chrome"]');
});
