import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';

const downloadTarget = 'C:/Users/Marketplace/Documents/theme-factory-ai-golden/logs/whipify-quick-editor-theme.zip';
const dashboardUrl = process.env.DASHBOARD_URL || 'http://127.0.0.1:5174/';

const buildQuickEditorFixtureZip = async () => {
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
      <p>Duty Cleaners helps Edmonton homeowners with recurring cleaning, deep cleaning, and move-out cleaning with clear pricing and reliable communication.</p>
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
      <p>Request your cleaning quote and tell us which home cleaning service you need.</p>
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

test('wordpress export includes Whipify Quick Editor helpers and bound chrome partials', async ({ page }) => {
  const fixtureZipBuffer = await buildQuickEditorFixtureZip();

  await page.goto(dashboardUrl, { waitUntil: 'networkidle' });

  await page.locator('input[type="file"]').setInputFiles({
    name: 'whipify-quick-editor-fixture.zip',
    mimeType: 'application/zip',
    buffer: fixtureZipBuffer,
  });

  await page.getByText('Conversion Complete').waitFor({ timeout: 180000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Download Theme/i }).click(),
  ]);

  await download.saveAs(downloadTarget);

  const zipBuffer = await fs.readFile(downloadTarget);
  const zip = await JSZip.loadAsync(zipBuffer);
  const fileNames = Object.keys(zip.files);
  const root = fileNames[0].split('/')[0];

  const functionsPhpPath = `${root}/functions.php`;
  const headerPartialPath = fileNames.find((name) => name === `${root}/partials/header-global.php`)
    || fileNames.find((name) => /\/partials\/header-[^/]+\.php$/.test(name));
  const footerPartialPath = fileNames.find((name) => name === `${root}/partials/footer-global.php`)
    || fileNames.find((name) => /\/partials\/footer-[^/]+\.php$/.test(name));

  expect(fileNames).toContain(functionsPhpPath);
  expect(headerPartialPath).toBeTruthy();
  expect(footerPartialPath).toBeTruthy();

  const functionsPhp = await zip.file(functionsPhpPath).async('string');
  const headerPartial = await zip.file(headerPartialPath).async('string');
  const footerPartial = await zip.file(footerPartialPath).async('string');

  expect(functionsPhp).toContain('Whipify Quick Editor');
  expect(functionsPhp).toContain('whipify_quick_editor_settings');
  expect(functionsPhp).toContain("add_theme_page( 'Whipify Quick Editor'");
  expect(functionsPhp).toContain('admin_post_tf_quick_editor_save');

  expect(headerPartial).toContain("tf_quick_editor_get( 'primary_cta_text'");
  expect(headerPartial).toContain("tf_quick_editor_get( 'phone'");
  expect(footerPartial).toContain("tf_quick_editor_get( 'business_name'");
});
