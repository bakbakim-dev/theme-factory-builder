import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';

const themeDownloadTarget = 'C:/Users/Marketplace/Documents/theme-factory-ai-golden/logs/whipify-forms-theme-download.zip';
const pluginDownloadTarget = 'C:/Users/Marketplace/Documents/theme-factory-ai-golden/logs/whipify-forms-plugin-download.zip';

const fillInputAfterLabel = async (page, labelText, value) => {
  const input = page.locator(`xpath=//label[contains(normalize-space(.), "${labelText}")]/following-sibling::input[1]`).first();
  if (await input.count()) {
    await input.fill(value);
  }
};

const buildWordPressFixtureZip = async () => {
  const zip = new JSZip();
  zip.file('index.html', `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Duty Cleaners Home</title>
  </head>
  <body>
    <main>
      <h1>Edmonton House Cleaning</h1>
      <p>Duty Cleaners provides recurring and one-time home cleaning, deep cleaning, and move-out cleaning in Edmonton for busy households that want reliable help and clear communication.</p>
      <a href="/contact/">Contact Us</a>
    </main>
  </body>
</html>`);
  zip.file('contact.html', `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contact Duty Cleaners</title>
  </head>
  <body>
    <main>
      <h1>Book Your Cleaning</h1>
      <p>Tell us what kind of home cleaning service you need, when you want us to come, and any access details that will help our team prepare an accurate quote.</p>
      <form class="rounded-xl border p-4">
        <label>Name <input type="text" placeholder="Full Name" required /></label>
        <label>Email <input type="email" placeholder="Email Address" required /></label>
        <label>Service
          <select required>
            <option value="">Choose a service</option>
            <option value="standard">Standard Cleaning</option>
            <option value="deep">Deep Cleaning</option>
          </select>
        </label>
        <label>Details <textarea placeholder="Tell us about your home"></textarea></label>
        <button type="submit">Get My Quote</button>
      </form>
    </main>
  </body>
</html>`);
  zip.file('prerendered/home.html', `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Duty Cleaners Home</title>
  </head>
  <body>
    <main>
      <h1>Edmonton House Cleaning</h1>
      <p>Duty Cleaners provides recurring and one-time home cleaning, deep cleaning, and move-out cleaning in Edmonton for busy households that want reliable help and clear communication.</p>
      <a href="/contact/">Contact Us</a>
    </main>
  </body>
</html>`);
  zip.file('prerendered/contact.html', `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contact Duty Cleaners</title>
  </head>
  <body>
    <main>
      <h1>Book Your Cleaning</h1>
      <p>Tell us what kind of home cleaning service you need, when you want us to come, and any access details that will help our team prepare an accurate quote.</p>
      <form class="rounded-xl border p-4">
        <label>Name <input type="text" placeholder="Full Name" required /></label>
        <label>Email <input type="email" placeholder="Email Address" required /></label>
        <label>Service
          <select required>
            <option value="">Choose a service</option>
            <option value="standard">Standard Cleaning</option>
            <option value="deep">Deep Cleaning</option>
          </select>
        </label>
        <label>Details <textarea placeholder="Tell us about your home"></textarea></label>
        <button type="submit">Get My Quote</button>
      </form>
    </main>
  </body>
</html>`);

  return zip.generateAsync({ type: 'nodebuffer' });
};

test.setTimeout(240000);

test('wordpress mode exports a Whipify forms manifest and bundled plugin', async ({ page }) => {
  const fixtureZipBuffer = await buildWordPressFixtureZip();

  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });

  await fillInputAfterLabel(page, 'Website URL', 'https://dutycleaners.ca');
  await fillInputAfterLabel(page, 'Company Name', 'Duty Cleaners');
  await fillInputAfterLabel(page, 'Phone Number', '780-913-6565');
  await fillInputAfterLabel(page, 'City', 'Edmonton');
  await fillInputAfterLabel(page, 'State/Prov', 'AB');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'whipify-forms-fixture.zip',
    mimeType: 'application/zip',
    buffer: fixtureZipBuffer,
  });

  await page.getByText('Conversion Complete').waitFor({ timeout: 180000 });
  await expect(page.getByText('Whipify Forms Plugin')).toBeVisible();

  const [themeDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Download Theme/i }).click(),
  ]);

  await themeDownload.saveAs(themeDownloadTarget);

  const [pluginDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Whipify Forms Plugin/i }).click(),
  ]);

  await pluginDownload.saveAs(pluginDownloadTarget);

  const themeZipBuffer = await fs.readFile(themeDownloadTarget);
  const themeZip = await JSZip.loadAsync(themeZipBuffer);
  const themeFiles = Object.keys(themeZip.files);
  const themeRoot = themeFiles[0].split('/')[0];

  expect(themeFiles).toContain(`${themeRoot}/assets/data/forms.json`);
  expect(themeFiles).toContain(`${themeRoot}/plugins/README-forms.txt`);
  expect(themeFiles).toContain(`${themeRoot}/plugins/whipify-forms-plugin.zip`);

  const formsManifest = JSON.parse(await themeZip.file(`${themeRoot}/assets/data/forms.json`).async('string'));
  expect(Array.isArray(formsManifest)).toBeTruthy();
  expect(formsManifest.length).toBeGreaterThan(0);
  expect(formsManifest[0].id).toMatch(/^whipify-/);
  expect(formsManifest[0].needsWiring).toBe(true);

  const contactBlocks = await themeZip.file(`${themeRoot}/assets/content/contact.blocks.html`)?.async('string');
  if (contactBlocks) {
    expect(contactBlocks).toContain('data-whipify-form-id');
    expect(contactBlocks).toContain('data-wpconvert-form-id');
  }

  const pluginZipBuffer = await fs.readFile(pluginDownloadTarget);
  const pluginZip = await JSZip.loadAsync(pluginZipBuffer);
  const pluginFiles = Object.keys(pluginZip.files);
  const pluginRoot = pluginFiles[0].split('/')[0];
  expect(pluginFiles).toContain(`${pluginRoot}/whipify-forms-plugin.php`);
  const pluginPhp = await pluginZip.file(`${pluginRoot}/whipify-forms-plugin.php`).async('string');
  expect(pluginPhp).toContain('Plugin Name: Whipify Forms Plugin');
  expect(pluginPhp).toContain('Tools > Whipify Forms');
});
