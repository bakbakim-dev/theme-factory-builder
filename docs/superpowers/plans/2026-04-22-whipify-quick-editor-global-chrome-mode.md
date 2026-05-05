# Whipify Quick Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generated, global-only WordPress Quick Editor that lets users update header/footer chrome values without creating a second source of truth alongside Gutenberg.

**Architecture:** Keep the Quick Editor theme-scoped and generator-driven. `Dashboard.tsx` will continue to build the theme ZIP, but Quick Editor-specific PHP and chrome rewrites will be moved into a focused utility so generated `functions.php`, `header.php`, `footer.php`, and localized chrome partials all share one settings model. The generated theme will store values in a single WordPress option and fall back to conversion-time defaults derived from `seoSettings` and detected header/footer slots.

**Tech Stack:** React + TypeScript + Vite dashboard, JSZip theme packaging, generated PHP WordPress theme files, Node regression scripts, Playwright dashboard export test.

---

## File Structure

### New files
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts`
  - Owns Quick Editor defaults, slot metadata, PHP helper generation, and header/footer binding rewrites.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-regression.mjs`
  - Regression checks for generated defaults, accessors, sanitization, and chrome binding output.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-dashboard-ui.spec.mjs`
  - End-to-end dashboard export verification that the theme ZIP includes Quick Editor code and bound partials.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/logs/.gitkeep`

### Modified files
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/components/Dashboard.tsx`
  - Call the new utility while generating `partials/header-*.php`, `partials/footer-*.php`, `header.php`, `footer.php`, and `functions.php`.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/package.json`
  - Add the new regression and Playwright scripts.

### Existing files to inspect while implementing
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/wordpress-chrome-context.ts`
  - Existing city-aware header/footer variant plumbing.
- `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-forms-dashboard-ui.spec.mjs`
  - Existing dashboard ZIP-export Playwright pattern to copy.

---

### Task 1: Build the Quick Editor utility and its regression coverage

**Files:**
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts`
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-regression.mjs`
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-regression.mjs`

- [ ] **Step 1: Write the failing regression script**

```js
import assert from 'node:assert/strict';
import {
  buildWhipifyQuickEditorDefaults,
  bindWhipifyQuickEditorChrome,
  buildWhipifyQuickEditorPhp,
} from '../utils/whipifyQuickEditor.ts';

const defaults = buildWhipifyQuickEditorDefaults({
  companyName: 'Duty Cleaners',
  telephone: '780-913-6565',
  ctaText1: 'Book Now',
  ctaLink1: '/book/',
  ctaText2: 'Call Today',
  ctaLink2: 'tel:7809136565',
  addressLocality: 'Edmonton',
  addressRegion: 'AB',
  url: 'https://dutycleaners.ca',
  facebookUrl: 'https://facebook.com/dutycleaners',
  instagramUrl: 'https://instagram.com/dutycleaners',
});

assert.equal(defaults.header.primary_cta_text, 'Book Now');
assert.equal(defaults.header.phone, '780-913-6565');
assert.equal(defaults.footer.business_name, 'Duty Cleaners');
assert.equal(defaults.social.facebook, 'https://facebook.com/dutycleaners');

const boundHeader = bindWhipifyQuickEditorChrome('header', `
<header>
  <a href="/book/">Book Now</a>
  <a href="tel:7809136565">780-913-6565</a>
</header>`, defaults);

assert.match(boundHeader.html, /tf_quick_editor_get\( 'header', 'primary_cta_text'/);
assert.match(boundHeader.html, /tf_quick_editor_get\( 'header', 'phone'/);
assert.equal(boundHeader.slots.header.primary_cta_text, true);
assert.equal(boundHeader.slots.header.phone, true);

const php = buildWhipifyQuickEditorPhp(defaults, boundHeader.slots);
assert.match(php, /function tf_quick_editor_defaults\(/);
assert.match(php, /add_theme_page\( 'Whipify Quick Editor'/);
assert.match(php, /current_user_can\( 'edit_theme_options' \)/);
assert.match(php, /sanitize_text_field/);
assert.match(php, /esc_url_raw/);

console.log('whipify quick editor regression passed');
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/whipify-quick-editor-regression.mjs`
Expected: FAIL with a module resolution error because `utils/whipifyQuickEditor.ts` does not exist yet.

- [ ] **Step 3: Write the minimal utility implementation**

```ts
export interface WhipifyQuickEditorDefaults {
  header: {
    primary_cta_text: string;
    primary_cta_url: string;
    secondary_cta_text: string;
    secondary_cta_url: string;
    phone: string;
    announcement_text: string;
    announcement_url: string;
  };
  footer: {
    business_name: string;
    address_line_1: string;
    address_line_2: string;
    contact_line: string;
  };
  social: {
    facebook: string;
    instagram: string;
    linkedin: string;
    x: string;
  };
}

export interface WhipifyQuickEditorSlotSupport {
  header: Record<string, boolean>;
  footer: Record<string, boolean>;
  social: Record<string, boolean>;
}

const phpString = (value: string): string => `'${(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export const buildWhipifyQuickEditorDefaults = (seoSettings: any): WhipifyQuickEditorDefaults => ({
  header: {
    primary_cta_text: seoSettings.ctaText1 || '',
    primary_cta_url: seoSettings.ctaLink1 || '',
    secondary_cta_text: seoSettings.ctaText2 || '',
    secondary_cta_url: seoSettings.ctaLink2 || '',
    phone: seoSettings.telephone || '',
    announcement_text: '',
    announcement_url: '',
  },
  footer: {
    business_name: seoSettings.companyName || '',
    address_line_1: [seoSettings.addressLocality, seoSettings.addressRegion].filter(Boolean).join(', '),
    address_line_2: seoSettings.addressCountry || '',
    contact_line: seoSettings.telephone || '',
  },
  social: {
    facebook: seoSettings.facebookUrl || '',
    instagram: seoSettings.instagramUrl || '',
    linkedin: seoSettings.linkedinUrl || '',
    x: seoSettings.xUrl || '',
  },
});

export const bindWhipifyQuickEditorChrome = (part: 'header' | 'footer', html: string, defaults: WhipifyQuickEditorDefaults) => {
  let rewritten = html || '';
  const slots: WhipifyQuickEditorSlotSupport = {
    header: {},
    footer: {},
    social: {},
  };

  if (part === 'header' && defaults.header.primary_cta_text) {
    rewritten = rewritten.replace(
      defaults.header.primary_cta_text,
      `<?php echo esc_html( tf_quick_editor_get( 'header', 'primary_cta_text', ${phpString(defaults.header.primary_cta_text)} ) ); ?>`,
    );
    slots.header.primary_cta_text = rewritten.includes("tf_quick_editor_get( 'header', 'primary_cta_text'");
  }

  if (part === 'header' && defaults.header.phone) {
    rewritten = rewritten.replace(
      defaults.header.phone,
      `<?php echo esc_html( tf_quick_editor_get( 'header', 'phone', ${phpString(defaults.header.phone)} ) ); ?>`,
    );
    slots.header.phone = rewritten.includes("tf_quick_editor_get( 'header', 'phone'");
  }

  return { html: rewritten, slots };
};

export const buildWhipifyQuickEditorPhp = (defaults: WhipifyQuickEditorDefaults, slots: WhipifyQuickEditorSlotSupport): string => `
function tf_quick_editor_defaults() {
    return ${JSON.stringify(defaults, null, 2)
      .replace(/"([^"]+)":/g, "'$1' =>")
      .replace(/"/g, "'")};
}

function tf_quick_editor_settings() {
    $defaults = tf_quick_editor_defaults();
    $saved = get_option( 'whipify_quick_editor_settings', array() );
    return array_replace_recursive( $defaults, is_array( $saved ) ? $saved : array() );
}

function tf_quick_editor_get( $section, $field, $fallback = '' ) {
    $settings = tf_quick_editor_settings();
    return $settings[$section][$field] ?? $fallback;
}

function tf_register_quick_editor_page() {
    add_theme_page( 'Whipify Quick Editor', 'Whipify Quick Editor', 'edit_theme_options', 'whipify-quick-editor', 'tf_render_quick_editor_page' );
}
add_action( 'admin_menu', 'tf_register_quick_editor_page' );

function tf_render_quick_editor_page() {
    if ( ! current_user_can( 'edit_theme_options' ) ) {
        return;
    }
}
`;
```

- [ ] **Step 4: Expand the utility to cover the full spec before re-running**

```ts
// Extend bindWhipifyQuickEditorChrome() to patch these additional slots when present:
// - header.primary_cta_url
// - header.secondary_cta_text
// - header.secondary_cta_url
// - footer.business_name
// - footer.address_line_1
// - footer.address_line_2
// - footer.contact_line
// - social.facebook / instagram / linkedin / x
// - header.announcement_text / announcement_url only when matching nodes exist
//
// Extend buildWhipifyQuickEditorPhp() to include:
// - nonce-protected save handler
// - sanitize_text_field for text values
// - esc_url_raw for URL values
// - a reset-to-defaults branch that deletes the option
// - a standard admin notice via redirect query arg
// - helper accessors that return defaults when saved values are absent
```

- [ ] **Step 5: Run the regression to verify it passes**

Run: `node scripts/whipify-quick-editor-regression.mjs`
Expected: PASS with `whipify quick editor regression passed`

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  utils/whipifyQuickEditor.ts \
  scripts/whipify-quick-editor-regression.mjs
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: add quick editor utility and regression"
```

### Task 2: Integrate Quick Editor generation into the WordPress theme export

**Files:**
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/components/Dashboard.tsx`
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts`
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-regression.mjs`

- [ ] **Step 1: Write the failing integration assertion in the regression script**

```js
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const dashboardSource = await fs.readFile(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8');
assert.match(dashboardSource, /buildWhipifyQuickEditorDefaults/);
assert.match(dashboardSource, /bindWhipifyQuickEditorChrome\( 'header'/);
assert.match(dashboardSource, /bindWhipifyQuickEditorChrome\( 'footer'/);
assert.match(dashboardSource, /whipify_quick_editor_settings/);
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/whipify-quick-editor-regression.mjs`
Expected: FAIL because `Dashboard.tsx` has not been wired to the utility yet.

- [ ] **Step 3: Import and apply the utility in the theme generator**

```ts
import {
  bindWhipifyQuickEditorChrome,
  buildWhipifyQuickEditorDefaults,
  buildWhipifyQuickEditorPhp,
  mergeWhipifyQuickEditorSlotSupport,
} from '../utils/whipifyQuickEditor';

const quickEditorDefaults = buildWhipifyQuickEditorDefaults(seoSettings);
let quickEditorSlotSupport = {
  header: {},
  footer: {},
  social: {},
};

Object.entries(chromeVariants).forEach(([context, variant]) => {
  if (variant.headerHtml) {
    const boundHeader = bindWhipifyQuickEditorChrome('header', rewriteWordPressRouteLinks(
      replaceAssetPaths(variant.headerHtml, '<?php echo esc_url(get_template_directory_uri()); ?>/'),
      context,
    ), quickEditorDefaults);
    quickEditorSlotSupport = mergeWhipifyQuickEditorSlotSupport(quickEditorSlotSupport, boundHeader.slots);
    folder.file(`partials/header-${context}.php`, boundHeader.html);
  }

  if (variant.footerHtml) {
    const boundFooter = bindWhipifyQuickEditorChrome('footer', rewriteWordPressRouteLinks(
      replaceAssetPaths(variant.footerHtml, '<?php echo esc_url(get_template_directory_uri()); ?>/'),
      context,
    ), quickEditorDefaults);
    quickEditorSlotSupport = mergeWhipifyQuickEditorSlotSupport(quickEditorSlotSupport, boundFooter.slots);
    folder.file(`partials/footer-${context}.php`, boundFooter.html);
  }
});
```

- [ ] **Step 4: Inject the generated PHP helpers into `functions.php` only for WordPress mode**

```ts
if (mode === 'gutenberg-native') {
  const quickEditorPhp = buildWhipifyQuickEditorPhp(quickEditorDefaults, quickEditorSlotSupport);
  functionsPhpContent += `\n${quickEditorPhp}\n`;
}
```

- [ ] **Step 5: Ensure the generated helper respects the spec's render boundaries**

```php
// Inside buildWhipifyQuickEditorPhp()
function tf_quick_editor_save() {
    if ( ! current_user_can( 'edit_theme_options' ) ) {
        wp_die( 'Unauthorized' );
    }

    check_admin_referer( 'tf_quick_editor_save', 'tf_quick_editor_nonce' );

    if ( isset( $_POST['tf_quick_editor_reset'] ) ) {
        delete_option( 'whipify_quick_editor_settings' );
        wp_safe_redirect( add_query_arg( 'tf_quick_editor_updated', 'reset', menu_page_url( 'whipify-quick-editor', false ) ) );
        exit;
    }

    $payload = array(
        'header' => array(
            'primary_cta_text' => sanitize_text_field( wp_unslash( $_POST['header']['primary_cta_text'] ?? '' ) ),
            'primary_cta_url' => esc_url_raw( wp_unslash( $_POST['header']['primary_cta_url'] ?? '' ) ),
            'secondary_cta_text' => sanitize_text_field( wp_unslash( $_POST['header']['secondary_cta_text'] ?? '' ) ),
            'secondary_cta_url' => esc_url_raw( wp_unslash( $_POST['header']['secondary_cta_url'] ?? '' ) ),
            'phone' => sanitize_text_field( wp_unslash( $_POST['header']['phone'] ?? '' ) ),
            'announcement_text' => sanitize_text_field( wp_unslash( $_POST['header']['announcement_text'] ?? '' ) ),
            'announcement_url' => esc_url_raw( wp_unslash( $_POST['header']['announcement_url'] ?? '' ) ),
        ),
        'footer' => array(
            'business_name' => sanitize_text_field( wp_unslash( $_POST['footer']['business_name'] ?? '' ) ),
            'address_line_1' => sanitize_text_field( wp_unslash( $_POST['footer']['address_line_1'] ?? '' ) ),
            'address_line_2' => sanitize_text_field( wp_unslash( $_POST['footer']['address_line_2'] ?? '' ) ),
            'contact_line' => sanitize_text_field( wp_unslash( $_POST['footer']['contact_line'] ?? '' ) ),
        ),
        'social' => array(
            'facebook' => esc_url_raw( wp_unslash( $_POST['social']['facebook'] ?? '' ) ),
            'instagram' => esc_url_raw( wp_unslash( $_POST['social']['instagram'] ?? '' ) ),
            'linkedin' => esc_url_raw( wp_unslash( $_POST['social']['linkedin'] ?? '' ) ),
            'x' => esc_url_raw( wp_unslash( $_POST['social']['x'] ?? '' ) ),
        ),
    );

    update_option( 'whipify_quick_editor_settings', $payload, false );
    wp_safe_redirect( add_query_arg( 'tf_quick_editor_updated', 'saved', menu_page_url( 'whipify-quick-editor', false ) ) );
    exit;
}
add_action( 'admin_post_tf_quick_editor_save', 'tf_quick_editor_save' );
```

- [ ] **Step 6: Run the regression and build after integration**

Run: `node scripts/whipify-quick-editor-regression.mjs`
Expected: PASS

Run: `npm.cmd run build`
Expected: PASS with a normal Vite production build summary

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  components/Dashboard.tsx \
  utils/whipifyQuickEditor.ts
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: generate quick editor into wordpress themes"
```

### Task 3: Add dashboard ZIP-export verification for the generated Quick Editor

**Files:**
- Create: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-dashboard-ui.spec.mjs`
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/package.json`
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-dashboard-ui.spec.mjs`

- [ ] **Step 1: Write the failing Playwright export test**

```js
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';

const downloadTarget = 'C:/Users/Marketplace/Documents/theme-factory-ai-golden/logs/whipify-quick-editor-theme.zip';

const buildFixtureZip = async () => {
  const zip = new JSZip();
  zip.file('index.html', `<!DOCTYPE html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Duty Cleaners</title></head>
  <body>
    <div id="root">
      <header>
        <a href="/book/">Book Now</a>
        <a href="tel:7809136565">780-913-6565</a>
      </header>
      <main><h1>Edmonton Cleaning</h1></main>
      <footer>
        <strong>Duty Cleaners</strong>
        <a href="https://facebook.com/dutycleaners">Facebook</a>
      </footer>
    </div>
  </body>
</html>`);
  zip.file('prerendered/home.html', await zip.file('index.html').async('string'));
  return zip.generateAsync({ type: 'nodebuffer' });
};

test('wordpress export includes Whipify Quick Editor helpers and bound chrome partials', async ({ page }) => {
  const fixtureZipBuffer = await buildFixtureZip();
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'quick-editor-fixture.zip',
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
  const files = Object.keys(zip.files);
  const root = files[0].split('/')[0];

  const functionsPhp = await zip.file(`${root}/functions.php`).async('string');
  const headerPartial = await zip.file(`${root}/partials/header-global.php`).async('string');
  const footerPartial = await zip.file(`${root}/partials/footer-global.php`).async('string');

  expect(functionsPhp).toContain('Whipify Quick Editor');
  expect(functionsPhp).toContain("whipify_quick_editor_settings");
  expect(functionsPhp).toContain("add_theme_page( 'Whipify Quick Editor'");
  expect(functionsPhp).toContain("admin_post_tf_quick_editor_save");
  expect(headerPartial).toContain("tf_quick_editor_get( 'header', 'primary_cta_text'");
  expect(headerPartial).toContain("tf_quick_editor_get( 'header', 'phone'");
  expect(footerPartial).toContain("tf_quick_editor_get( 'footer', 'business_name'");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test scripts/whipify-quick-editor-dashboard-ui.spec.mjs --reporter=line`
Expected: FAIL because the new script and package command have not been added yet, or the exported theme does not yet contain the expected Quick Editor bindings.

- [ ] **Step 3: Add the package script and align the fixture with current dashboard expectations**

```json
{
  "scripts": {
    "test:whipify-quick-editor": "node scripts/whipify-quick-editor-regression.mjs",
    "test:whipify-quick-editor-dashboard-ui": "npx playwright test scripts/whipify-quick-editor-dashboard-ui.spec.mjs --reporter=line"
  }
}
```

```js
await page.getByLabel('Website URL').fill('https://dutycleaners.ca');
await page.getByLabel('Company Name').fill('Duty Cleaners');
await page.getByLabel('Phone Number').fill('780-913-6565');
await page.getByLabel('City').fill('Edmonton');
await page.getByLabel('State/Prov').fill('AB');

await page.getByText('Conversion Complete').waitFor({ timeout: 180000 });

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('link', { name: /Download Theme/i }).click(),
]);
await download.saveAs(downloadTarget);
```

- [ ] **Step 4: Run the UI test and full build verification**

Run: `npm.cmd run test:whipify-quick-editor-dashboard-ui`
Expected: PASS

Run: `npm.cmd run test:whipify-quick-editor`
Expected: PASS

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  package.json \
  scripts/whipify-quick-editor-dashboard-ui.spec.mjs \
  scripts/whipify-quick-editor-regression.mjs
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "test: cover quick editor theme export"
```

### Task 4: Final verification and WordPress-safe behavior check

**Files:**
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/utils/whipifyQuickEditor.ts` (only if verification exposes gaps)
- Modify: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/components/Dashboard.tsx` (only if verification exposes gaps)
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-regression.mjs`
- Test: `C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/scripts/whipify-quick-editor-dashboard-ui.spec.mjs`

- [ ] **Step 1: Run the complete local verification set**

Run: `npm.cmd run test:whipify-quick-editor`
Expected: PASS

Run: `npm.cmd run test:whipify-quick-editor-dashboard-ui`
Expected: PASS

Run: `npm.cmd run test:wordpress-chrome-context`
Expected: PASS

Run: `npm.cmd run test:whipify-forms-dashboard-ui`
Expected: PASS

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 2: Perform a generated-theme spot check before any WordPress deploy**

```powershell
$zipPath = 'C:/Users/Marketplace/Documents/theme-factory-ai-golden/logs/whipify-quick-editor-theme.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$extractPath = 'C:/Users/Marketplace/Documents/theme-factory-ai-golden/logs/whipify-quick-editor-theme'
if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractPath)
Get-Content "$extractPath\*\functions.php" | Select-String 'Whipify Quick Editor|whipify_quick_editor_settings|admin_post_tf_quick_editor_save'
Get-Content "$extractPath\*\partials\header-global.php" | Select-String "tf_quick_editor_get\( 'header'"
Get-Content "$extractPath\*\partials\footer-global.php" | Select-String "tf_quick_editor_get\( 'footer'"
```

Expected: the extracted theme shows Quick Editor helpers in `functions.php` and accessor calls inside the generated header/footer partials.

- [ ] **Step 3: Manual WordPress sanity check on a disposable install**

```text
1. Upload the generated theme ZIP.
2. Activate the theme.
3. Open Appearance -> Whipify Quick Editor.
4. Change header CTA text, phone number, and footer business name.
5. Save and verify the values update on the frontend.
6. Open a Gutenberg-edited page and save a body-content change.
7. Verify the body-content change still appears unchanged by Quick Editor logic.
```

Expected: Quick Editor updates only global chrome, and Gutenberg remains the source of truth for page content.

- [ ] **Step 4: Commit the final verified implementation**

```bash
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" add \
  components/Dashboard.tsx \
  package.json \
  scripts/whipify-quick-editor-regression.mjs \
  scripts/whipify-quick-editor-dashboard-ui.spec.mjs \
  utils/whipifyQuickEditor.ts
git -C "C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode" commit -m "feat: add whipify quick editor"
```

## Self-Review

### Spec coverage
- Global-only scope: covered by utility defaults, slot binding, and generated helper API in Task 1.
- Admin-screen first: covered by generated `add_theme_page()` and save/reset handler in Tasks 1-2.
- WordPress options/theme settings storage: covered by `whipify_quick_editor_settings` in Tasks 1-2.
- Header/footer integration only: covered by chrome binding in Task 2 and ZIP verification in Task 3.
- Gutenberg safety boundaries: covered by explicit non-`post_content` helper design in Task 2 and manual sanity check in Task 4.
- Export verification: covered by Task 3 and Task 4.

### Placeholder scan
- No `TBD`, `TODO`, or `implement later` placeholders remain.
- Each test and implementation step includes concrete commands or code.

### Type consistency
- Utility names stay consistent across all tasks: `buildWhipifyQuickEditorDefaults`, `bindWhipifyQuickEditorChrome`, `buildWhipifyQuickEditorPhp`, `mergeWhipifyQuickEditorSlotSupport`.
- Persisted option name stays consistent: `whipify_quick_editor_settings`.
- Admin page slug and post action stay consistent: `whipify-quick-editor`, `tf_quick_editor_save`.
