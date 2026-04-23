import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  appendWordPressContentRegistryChrome,
  appendWordPressContentRegistryEditor,
  appendWordPressContentRegistryFrontendEditorTargets,
  appendWordPressContentRegistryForm,
  appendWordPressContentRegistryReport,
  appendWordPressContentRegistryRoute,
  appendWordPressContentRegistrySharedContentTargets,
  buildWhipifyFrontendEditorSupportMapFromWordPressContentRegistry,
  createEmptyWordPressContentRegistry,
  deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry,
  finalizeWordPressContentRegistry,
} from '../utils/wordpress-content-registry.ts';

const registry = createEmptyWordPressContentRegistry();
const orderIndependentRegistry = createEmptyWordPressContentRegistry();

assert.equal(registry.version, '2');
assert.deepEqual(registry.routes, []);
assert.deepEqual(registry.chrome, []);
assert.deepEqual(registry.forms, []);
assert.deepEqual(registry.editors, []);
assert.deepEqual(registry.targets, []);
assert.deepEqual(registry.report, {
  routes: 0,
  chromeVariants: 0,
  forms: 0,
  editors: 0,
  targets: 0,
  targetScopes: {
    'global-chrome': 0,
    'media': 0,
    'page-block': 0,
    'shared-content': 0,
  },
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

appendWordPressContentRegistryChrome(orderIndependentRegistry, {
  context: 'edmonton',
  sourceRoutePath: '/pricing/',
  headerFile: 'partials/header-edmonton.php',
  footerFile: 'partials/footer-edmonton.php',
  support: {
    header: ['phone'],
    footer: ['business_name'],
    social: [],
  },
});

appendWordPressContentRegistryRoute(orderIndependentRegistry, {
  path: '/pricing/',
  slug: 'pricing',
  title: 'Pricing',
  template: 'page-pricing.php',
  chromeContext: 'edmonton',
});

appendWordPressContentRegistrySharedContentTargets(registry, {
  sourcePath: 'functions.php',
});

appendWordPressContentRegistryFrontendEditorTargets(registry, {
  sourcePath: 'functions.php',
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

appendWordPressContentRegistryEditor(registry, {
  kind: 'quick',
  name: 'whipify-quick-editor',
  supportMap: {
    globalChrome: {
      header: ['primary_cta_text'],
      footer: [],
      social: [],
    },
    pageBlocks: {
      'core/quote': ['content'],
    },
  },
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
const finalizedOrderIndependent = finalizeWordPressContentRegistry(orderIndependentRegistry);
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

assert.equal(finalized.targets.length > 0, true);
assert.deepEqual(
  Array.from(new Set(finalized.targets.map((target) => target.scope))).sort(),
  ['global-chrome', 'media', 'page-block', 'shared-content'],
);

const sharedContentTarget = finalized.targets.find((target) => target.scope === 'shared-content' && target.field === 'phone');
assert.ok(sharedContentTarget);
assert.equal(sharedContentTarget.fieldType, 'tel');
assert.equal(sharedContentTarget.group, 'header');
assert.equal(sharedContentTarget.sourcePath, 'functions.php');
assert.match(sharedContentTarget.provenanceLabel, /quick editor/i);
assert.ok(sharedContentTarget.id);
assert.ok(sharedContentTarget.stableId);
assert.notEqual(sharedContentTarget.stableId, sharedContentTarget.sourceToken);

const chromeTarget = finalized.targets.find((target) => target.scope === 'global-chrome' && target.group === 'header' && target.field === 'phone');
assert.ok(chromeTarget);
assert.equal(chromeTarget.chromeContext, 'edmonton');
assert.equal(chromeTarget.sourcePath, 'partials/header-edmonton.php');
assert.equal(chromeTarget.sourceToken, 'chrome:edmonton:header:phone');
assert.notEqual(chromeTarget.stableId, chromeTarget.sourceToken);
assert.equal(chromeTarget.routeSlug, undefined);
assert.equal(chromeTarget.routeTitle, undefined);

const backfilledChromeTarget = finalizedOrderIndependent.targets.find((target) => target.scope === 'global-chrome' && target.field === 'phone');
assert.ok(backfilledChromeTarget);
assert.equal(backfilledChromeTarget.routeSlug, 'pricing');
assert.equal(backfilledChromeTarget.routeTitle, 'Pricing');

const pageBlockTarget = finalized.targets.find((target) => target.scope === 'page-block' && target.blockName === 'core/button' && target.field === 'text');
assert.ok(pageBlockTarget);
assert.equal(pageBlockTarget.fieldType, 'plainText');
assert.equal(pageBlockTarget.sourcePath, 'functions.php');

const mediaTarget = finalized.targets.find((target) => target.scope === 'media' && target.blockName === 'core/image' && target.field === 'alt');
assert.ok(mediaTarget);
assert.equal(mediaTarget.fieldType, 'imageAlt');
assert.equal(mediaTarget.sourcePath, 'functions.php');

assert.equal(finalized.forms.length, 1);
assert.equal(finalized.forms[0].templateFile, 'partials/forms/pricing-lead.php');
assert.equal(finalized.forms[0].blocksFile, 'assets/blocks/pricing-lead.json');

assert.equal(finalized.editors.length, 2);
const frontendEditorEntry = finalized.editors.find((editor) => editor.kind === 'frontend');
assert.ok(frontendEditorEntry);
assert.deepEqual(frontendEditorEntry.supportMap.globalChrome.header, ['phone', 'primary_cta_text']);
assert.deepEqual(frontendEditorEntry.supportMap.pageBlocks, {
  'core/button': ['text', 'url'],
  'core/heading': ['content'],
});
assert.deepEqual(frontendEditorEntry.assetFiles, ['assets/whipify-frontend-editor.css', 'assets/whipify-frontend-editor.js']);
assert.deepEqual(derivedQuickEditorSlotSupport, {
  header: [
    'announcement_text',
    'announcement_url',
    'phone',
    'primary_cta_text',
    'primary_cta_url',
    'secondary_cta_text',
    'secondary_cta_url',
  ],
  footer: ['address_line_1', 'address_line_2', 'business_name', 'contact_line'],
  social: ['facebook', 'facebook_url', 'instagram', 'linkedin', 'x'],
});
assert.deepEqual(derivedFrontendEditorSupportMap, {
  globalChrome: {
    header: [
      'announcement_text',
      'announcement_url',
      'phone',
      'primary_cta_text',
      'primary_cta_url',
      'secondary_cta_text',
      'secondary_cta_url',
    ],
    footer: ['address_line_1', 'address_line_2', 'business_name', 'contact_line'],
    social: ['facebook', 'facebook_url', 'instagram', 'linkedin', 'x'],
  },
  pageBlocks: {
    'core/heading': ['content'],
    'core/image': ['alt', 'url'],
    'core/paragraph': ['content'],
    'core/button': ['text', 'url'],
  },
});
assert.equal(Object.prototype.hasOwnProperty.call(derivedFrontendEditorSupportMap.pageBlocks, 'core/quote'), false);

assert.deepEqual(finalized.report, {
  routes: 2,
  chromeVariants: 1,
  forms: 1,
  editors: 2,
  targets: finalized.targets.length,
  targetScopes: {
    'global-chrome': finalized.targets.filter((target) => target.scope === 'global-chrome').length,
    'media': finalized.targets.filter((target) => target.scope === 'media').length,
    'page-block': finalized.targets.filter((target) => target.scope === 'page-block').length,
    'shared-content': finalized.targets.filter((target) => target.scope === 'shared-content').length,
  },
  warnings: ['Forms require plugin wiring'],
  emittedFiles: [
    'assets/data/content-registry.json',
    'assets/data/content-registry.report.json',
    'assets/data/forms.json',
    'functions.php',
  ],
});
assert.match(dashboardSource, /createEmptyWordPressContentRegistry\(\)/);
assert.match(dashboardSource, /appendWordPressContentRegistrySharedContentTargets\(/);
assert.match(dashboardSource, /appendWordPressContentRegistryFrontendEditorTargets\(/);
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
assert.match(dashboardSource, /const registryCompatibilitySource = mode === 'gutenberg-native' && wordpressContentRegistry/);

console.log('WordPress content registry regression');
console.log('[PASS] Registry contract and dashboard WordPress aggregation are stable');
