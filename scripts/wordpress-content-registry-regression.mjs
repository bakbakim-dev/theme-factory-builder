import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  appendWordPressContentRegistryChrome,
  appendWordPressContentRegistryEditor,
  appendWordPressContentRegistryForm,
  appendWordPressContentRegistryReport,
  appendWordPressContentRegistryRoute,
  buildWhipifyFrontendEditorSupportMapFromWordPressContentRegistry,
  createEmptyWordPressContentRegistry,
  deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry,
  finalizeWordPressContentRegistry,
} from '../utils/wordpress-content-registry.ts';

const registry = createEmptyWordPressContentRegistry();

assert.equal(registry.version, '1');
assert.deepEqual(registry.routes, []);
assert.deepEqual(registry.chrome, []);
assert.deepEqual(registry.forms, []);
assert.deepEqual(registry.editors, []);
assert.deepEqual(registry.report, {
  routes: 0,
  chromeVariants: 0,
  forms: 0,
  editors: 0,
});

appendWordPressContentRegistryRoute(registry, {
  path: '/pricing/',
  slug: 'pricing',
  title: 'Pricing',
  template: 'page-pricing.php',
  chromeContext: 'edmonton',
});

appendWordPressContentRegistryRoute(registry, {
  path: '/',
  slug: 'home',
  title: 'Home',
  template: 'front-page.php',
  chromeContext: 'global',
});

appendWordPressContentRegistryChrome(registry, {
  context: 'edmonton',
  sourceRoutePath: '/edmonton/',
  headerFile: 'partials/header-edmonton.php',
  footerFile: 'partials/footer-edmonton.php',
  support: {
    header: ['primary_cta_text', 'phone', 'phone'],
    footer: ['business_name'],
    social: ['facebook_url', 'facebook_url'],
  },
});

appendWordPressContentRegistryForm(registry, {
  id: 'whipify-pricing-form-1',
  page: '/pricing/',
  routeSlug: 'pricing',
  routeTitle: 'Pricing',
  needsWiring: true,
  templateFile: 'partials/forms/pricing-lead.php',
  blocksFile: 'assets/blocks/pricing-lead.json',
  fields: [
    {
      type: 'text',
      name: 'full_name',
      label: 'Full Name',
      required: true,
    },
  ],
});

appendWordPressContentRegistryEditor(registry, {
  kind: 'frontend',
  name: 'whipify-frontend-editor',
  supportMap: {
    globalChrome: {
      header: ['phone', 'primary_cta_text', 'phone'],
      footer: ['business_name'],
      social: ['facebook_url', 'facebook_url'],
    },
    pageBlocks: {
      'core/button': ['url', 'text'],
      'core/heading': ['content'],
    },
  },
  assetFiles: ['assets/whipify-frontend-editor.css', 'assets/whipify-frontend-editor.js'],
});

appendWordPressContentRegistryReport(registry, {
  warnings: ['Forms require plugin wiring'],
  emittedFiles: [
    'functions.php',
    'assets/data/forms.json',
    'assets/data/content-registry.json',
    'assets/data/content-registry.report.json',
  ],
});

const finalized = finalizeWordPressContentRegistry(registry);
const derivedQuickEditorSlotSupport = deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry(finalized);
const derivedFrontendEditorSupportMap = buildWhipifyFrontendEditorSupportMapFromWordPressContentRegistry(finalized);
const dashboardSource = await fs.readFile(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8');

assert.deepEqual(finalized.routes.map((route) => route.path), ['/', '/pricing/']);
assert.equal(finalized.routes[0].template, 'front-page.php');
assert.equal(finalized.routes[1].chromeContext, 'edmonton');

assert.equal(finalized.chrome.length, 1);
assert.deepEqual(finalized.chrome[0].support, {
  header: ['phone', 'primary_cta_text'],
  footer: ['business_name'],
  social: ['facebook_url'],
});

assert.equal(finalized.forms.length, 1);
assert.equal(finalized.forms[0].templateFile, 'partials/forms/pricing-lead.php');
assert.equal(finalized.forms[0].blocksFile, 'assets/blocks/pricing-lead.json');

assert.equal(finalized.editors.length, 1);
assert.deepEqual(finalized.editors[0].supportMap.globalChrome.header, ['phone', 'primary_cta_text']);
assert.deepEqual(finalized.editors[0].supportMap.pageBlocks, {
  'core/button': ['text', 'url'],
  'core/heading': ['content'],
});
assert.deepEqual(finalized.editors[0].assetFiles, ['assets/whipify-frontend-editor.css', 'assets/whipify-frontend-editor.js']);
assert.deepEqual(derivedQuickEditorSlotSupport, {
  header: ['phone', 'primary_cta_text'],
  footer: ['business_name'],
  social: ['facebook_url'],
});
assert.deepEqual(derivedFrontendEditorSupportMap, {
  globalChrome: {
    header: ['phone', 'primary_cta_text'],
    footer: ['business_name'],
    social: ['facebook_url'],
  },
  pageBlocks: {
    'core/button': ['text', 'url'],
    'core/heading': ['content'],
  },
});

assert.deepEqual(finalized.report, {
  routes: 2,
  chromeVariants: 1,
  forms: 1,
  editors: 1,
  warnings: ['Forms require plugin wiring'],
  emittedFiles: [
    'assets/data/content-registry.json',
    'assets/data/content-registry.report.json',
    'assets/data/forms.json',
    'functions.php',
  ],
});
assert.match(dashboardSource, /createEmptyWordPressContentRegistry\(\)/);
assert.match(dashboardSource, /appendWordPressContentRegistryChrome\(/);
assert.match(dashboardSource, /appendWordPressContentRegistryRoute\(/);
assert.match(dashboardSource, /appendWordPressContentRegistryForm\(/);
assert.match(dashboardSource, /appendWordPressContentRegistryEditor\(/);
assert.match(dashboardSource, /finalizeWordPressContentRegistry\(/);
assert.match(dashboardSource, /deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry\(/);
assert.match(dashboardSource, /buildWhipifyFrontendEditorSupportMapFromWordPressContentRegistry\(/);
assert.match(dashboardSource, /folder\.file\("assets\/data\/content-registry\.json",\s*JSON\.stringify\(finalizedWordPressContentRegistry,\s*null,\s*2\)\)/);
assert.match(dashboardSource, /folder\.file\("assets\/data\/content-registry\.report\.json",\s*JSON\.stringify\(finalizedWordPressContentRegistry\.report,\s*null,\s*2\)\)/);
assert.match(dashboardSource, /emittedFiles:\s*\[[\s\S]*'assets\/data\/content-registry\.json'[\s\S]*'assets\/data\/content-registry\.report\.json'/);

console.log('WordPress content registry regression');
console.log('[PASS] Registry contract and dashboard WordPress aggregation are stable');
