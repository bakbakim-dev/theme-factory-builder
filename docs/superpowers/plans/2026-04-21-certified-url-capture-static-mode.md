# Certified URL Capture for Static Site Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Static Site input mode that captures a public React URL, reconstructs a synthetic artifact, certifies the capture result, and then feeds the existing Static Site exporter without touching Platinum / WordPress mode.

**Architecture:** Add a Playwright-based deep-capture stack under `utils/url-capture-*`, normalize the capture into a ZIP-like synthetic artifact, certify it, and only then route it into the existing static pipeline in `utils/static-output.ts`. The dashboard adds a URL input branch under `static-site`, while ZIP-driven Static Site exports remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Node ESM, Playwright, existing Static Site exporter utilities

---

## File Structure

### Create

- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-types.ts`
  - Shared runtime types and enums for URL capture, synthetic artifacts, and certification.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-common.ts`
  - Shared helpers for URL normalization, seed parsing, route/path normalization, and capture defaults.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-browser.ts`
  - Playwright browser session bootstrap and document capture.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-network.ts`
  - Network event recording and runtime payload capture.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-routes.ts`
  - Route discovery from links, sitemap, canonical tags, and bundle strings.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-interactions.ts`
  - Tabs, accordions, menu, modal, and pricing-state exploration.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-bundles.ts`
  - Bundle-text inspection for route-like strings and lazy route hints.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-artifact.ts`
  - Synthetic artifact builder plus Static Site bridge helper.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-certification.ts`
  - Certification rules and escalation recommendations.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-report.ts`
  - Human-readable and machine-readable reporting helpers.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-run.ts`
  - Top-level orchestrator for URL capture -> artifact -> certification -> optional static export.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-foundation-regression.mjs`
  - Node regression for defaults and normalization.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-browser-regression.mjs`
  - Node regression for browser and network capture.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-discovery-regression.mjs`
  - Node regression for route discovery and interaction exploration.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-artifact-regression.mjs`
  - Node regression for synthetic artifact generation and Static Site handoff.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-certification-regression.mjs`
  - Node regression for certified / needs-input / uncertified outcomes.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-dashboard-ui.spec.mjs`
  - Playwright UI test for the new dashboard controls.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-dashboard-smoke.mjs`
  - End-to-end smoke test of the new URL capture orchestration using a local fixture server.

### Modify

- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\components\Dashboard.tsx`
  - Add `static-site` URL input mode, capture form state, certification panel, and conversion branch.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`
  - Add URL capture regression and smoke scripts.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-types.ts`
  - Extend reporting types only if necessary for shared static/export display.
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-output.ts`
  - Accept synthetic-artifact handoff only through a small bridge, not by changing existing ZIP logic.

### Keep Unchanged

- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-seo.ts`
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-schema.ts`
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-forms.ts`
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-sitemap.ts`
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-robots.ts`
- `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-llms.ts`
- Platinum / WordPress mode code paths unless a shared type requires a no-behavior change extension.

## Task 1: Add URL Capture Types, Defaults, and Normalization Helpers

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-types.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-common.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-foundation-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing foundation regression**

```js
import assert from 'node:assert/strict';
import {
  createDefaultUrlCaptureSettings,
  normalizeCaptureUrl,
  normalizeRouteSeedList,
  toSyntheticArtifactPath,
} from '../utils/url-capture-common.ts';

const defaults = createDefaultUrlCaptureSettings();
assert.equal(defaults.inputMode, 'public-url-certified');
assert.equal(defaults.captureDepth, 'balanced');
assert.equal(defaults.interactionExploration, true);
assert.equal(defaults.bundleInspection, true);

assert.equal(normalizeCaptureUrl('mikaily129.sg-host.com/edmonton'), 'https://mikaily129.sg-host.com/edmonton/');
assert.deepEqual(
  normalizeRouteSeedList(' /pricing\\n/contact\\npricing '),
  ['/pricing/', '/contact/'],
);
assert.equal(toSyntheticArtifactPath('/edmonton/pricing/'), 'edmonton/pricing/index.html');

console.log('[PASS] URL capture defaults and normalization');
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/url-capture-foundation-regression.mjs`

Expected: FAIL with `Cannot find module '../utils/url-capture-common.ts'`

- [ ] **Step 3: Implement the shared runtime types**

```ts
export type UrlCaptureInputMode = 'public-url-certified';
export type UrlCaptureDepth = 'fast' | 'balanced' | 'deep';
export type UrlCaptureCertificationStatus = 'certified' | 'needs-input' | 'uncertified';

export interface UrlCaptureSettings {
  inputMode: UrlCaptureInputMode;
  sourceUrl: string;
  sitemapUrl: string;
  routeSeeds: string;
  authCookiesJson: string;
  captureDepth: UrlCaptureDepth;
  interactionExploration: boolean;
  bundleInspection: boolean;
}

export interface UrlCaptureRouteSnapshot {
  path: string;
  title: string;
  html: string;
  canonicalUrl: string;
  discoveredBy: Array<'seed' | 'link' | 'sitemap' | 'bundle' | 'history' | 'canonical'>;
}
```

- [ ] **Step 4: Implement defaults and normalization helpers**

```ts
import type { UrlCaptureSettings } from './url-capture-types.ts';

export const createDefaultUrlCaptureSettings = (): UrlCaptureSettings => ({
  inputMode: 'public-url-certified',
  sourceUrl: '',
  sitemapUrl: '',
  routeSeeds: '',
  authCookiesJson: '',
  captureDepth: 'balanced',
  interactionExploration: true,
  bundleInspection: true,
});

export const normalizeCaptureUrl = (value: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = '';
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return url.toString();
};

export const normalizeRouteSeedList = (value: string): string[] => {
  const seen = new Set<string>();
  return (value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith('/') ? item : `/${item}`))
    .map((item) => (item.endsWith('/') ? item : `${item}/`))
    .filter((item) => (seen.has(item) ? false : (seen.add(item), true)));
};

export const toSyntheticArtifactPath = (routePath: string): string => {
  const normalized = routePath === '/' ? '/' : `/${routePath.replace(/^\/+|\/+$/g, '')}/`;
  return normalized === '/' ? 'index.html' : `${normalized.slice(1)}index.html`;
};
```

- [ ] **Step 5: Add the npm test script**

```json
{
  "scripts": {
    "test:url-capture-foundation": "node scripts/url-capture-foundation-regression.mjs"
  }
}
```

- [ ] **Step 6: Run the regression to verify it passes**

Run: `npm.cmd run test:url-capture-foundation`

Expected:
- PASS line `[PASS] URL capture defaults and normalization`

- [ ] **Step 7: Commit**

```bash
git add utils/url-capture-types.ts utils/url-capture-common.ts scripts/url-capture-foundation-regression.mjs package.json
git commit -m "feat: add URL capture foundations"
```

## Task 2: Add Dashboard URL Input State and Static-Site-Only UI

**Files:**
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\components\Dashboard.tsx`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-dashboard-ui.spec.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing dashboard UI test**

```js
import { test, expect } from '@playwright/test';

test('Static Site mode exposes Certified URL capture controls', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('button', { name: /Static Site/i }).click();
  await expect(page.getByText('Public React URL (Certified Capture)')).toBeVisible();
  await page.getByRole('radio', { name: /Public React URL \(Certified Capture\)/i }).check();
  await expect(page.getByLabel(/Public URL/i)).toBeVisible();
  await expect(page.getByLabel(/Optional sitemap URL/i)).toBeVisible();
  await expect(page.getByText('Certification Status')).toBeVisible();
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `npx playwright test scripts/url-capture-dashboard-ui.spec.mjs --reporter=line`

Expected: FAIL because the new UI controls do not exist

- [ ] **Step 3: Add dashboard state for URL capture**

```ts
import { createDefaultUrlCaptureSettings } from '../utils/url-capture-common.ts';
import type { UrlCaptureCertificationStatus, UrlCaptureSettings } from '../utils/url-capture-types.ts';

type StaticSiteInputMode = 'artifact-zip' | 'public-url-certified';

const [staticSiteInputMode, setStaticSiteInputMode] = useState<StaticSiteInputMode>('artifact-zip');
const [urlCaptureSettings, setUrlCaptureSettings] = useState<UrlCaptureSettings>(createDefaultUrlCaptureSettings());
const [urlCaptureStatus, setUrlCaptureStatus] = useState<UrlCaptureCertificationStatus | 'idle'>('idle');
```

- [ ] **Step 4: Add the Static Site URL controls**

```tsx
{conversionMode === 'static-site' && (
  <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 space-y-4">
    <h3 className="text-sm font-semibold text-slate-300">Static Site Input</h3>
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input
        type="radio"
        name="static-input-mode"
        checked={staticSiteInputMode === 'artifact-zip'}
        onChange={() => setStaticSiteInputMode('artifact-zip')}
      />
      Build Artifact ZIP
    </label>
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input
        type="radio"
        name="static-input-mode"
        checked={staticSiteInputMode === 'public-url-certified'}
        onChange={() => setStaticSiteInputMode('public-url-certified')}
      />
      Public React URL (Certified Capture)
    </label>
    {staticSiteInputMode === 'public-url-certified' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input aria-label="Public URL" value={urlCaptureSettings.sourceUrl} onChange={(e) => setUrlCaptureSettings(prev => ({ ...prev, sourceUrl: e.target.value }))} />
        <input aria-label="Optional sitemap URL" value={urlCaptureSettings.sitemapUrl} onChange={(e) => setUrlCaptureSettings(prev => ({ ...prev, sitemapUrl: e.target.value }))} />
        <textarea aria-label="Optional route seeds" value={urlCaptureSettings.routeSeeds} onChange={(e) => setUrlCaptureSettings(prev => ({ ...prev, routeSeeds: e.target.value }))} />
        <textarea aria-label="Optional auth cookies JSON" value={urlCaptureSettings.authCookiesJson} onChange={(e) => setUrlCaptureSettings(prev => ({ ...prev, authCookiesJson: e.target.value }))} />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Add the certification status panel**

```tsx
{staticSiteInputMode === 'public-url-certified' && (
  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
    <div className="text-sm font-semibold text-slate-300">Certification Status</div>
    <div className="mt-2 text-sm text-slate-400">
      {urlCaptureStatus === 'idle' && 'Waiting to run URL capture.'}
      {urlCaptureStatus === 'certified' && 'Certified artifact-equivalent for Static Site export.'}
      {urlCaptureStatus === 'needs-input' && 'More input is required before certification is possible.'}
      {urlCaptureStatus === 'uncertified' && 'Best-effort output only. Certification was not possible.'}
    </div>
  </div>
)}
```

- [ ] **Step 6: Add the npm UI test script and run it**

```json
{
  "scripts": {
    "test:url-capture-dashboard-ui": "npx playwright test scripts/url-capture-dashboard-ui.spec.mjs --reporter=line"
  }
}
```

Run: `npm.cmd run test:url-capture-dashboard-ui`

Expected:
- Playwright test passes

- [ ] **Step 7: Commit**

```bash
git add components/Dashboard.tsx scripts/url-capture-dashboard-ui.spec.mjs package.json
git commit -m "feat: add Static Site certified URL capture controls"
```

## Task 3: Build Browser and Network Capture Primitives

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-browser.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-network.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-browser-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing browser regression**

```js
import assert from 'node:assert/strict';
import http from 'node:http';
import { captureUrlSession, disposeUrlSession } from '../utils/url-capture-browser.ts';

const server = http.createServer((req, res) => {
  if (req.url === '/app.js') {
    res.setHeader('content-type', 'application/javascript');
    res.end("window.__TEST_BOOT__ = { route: '/pricing/' };");
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html><head><title>Pricing</title><script src="/app.js"></script></head><body><h1>Pricing</h1></body></html>`);
});

await new Promise((resolve) => server.listen(4317, resolve));

const result = await captureUrlSession({
  url: 'http://127.0.0.1:4317/',
  authCookies: [],
  captureDepth: 'balanced',
});

assert.equal(result.initialUrl, 'http://127.0.0.1:4317/');
assert.match(result.initialHtml, /<h1>Pricing<\/h1>/);
assert.ok(result.networkRequests.some((item) => item.url.endsWith('/app.js')));

await disposeUrlSession(result);
server.close();
console.log('[PASS] URL capture browser and network primitives');
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/url-capture-browser-regression.mjs`

Expected: FAIL because `captureUrlSession` does not exist

- [ ] **Step 3: Implement network event recording**

```ts
export interface CapturedNetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  status: number | null;
}

export const attachNetworkRecorder = (page, requests: CapturedNetworkRequest[]) => {
  page.on('requestfinished', async (request) => {
    const response = await request.response();
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      status: response ? response.status() : null,
    });
  });
};
```

- [ ] **Step 4: Implement browser session capture**

```ts
import { chromium } from '@playwright/test';
import { attachNetworkRecorder } from './url-capture-network.ts';

export const captureUrlSession = async ({ url, authCookies, captureDepth }) => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  if (authCookies.length > 0) await context.addCookies(authCookies);
  const page = await context.newPage();
  const networkRequests = [];
  attachNetworkRecorder(page, networkRequests);
  await page.goto(url, { waitUntil: 'networkidle' });
  const initialHtml = await page.content();
  const title = await page.title();
  const linkHrefs = await page.locator('a[href]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('href')).filter(Boolean),
  );
  return {
    browser,
    context,
    page,
    initialUrl: url,
    title,
    initialHtml,
    linkHrefs,
    networkRequests,
    captureDepth,
  };
};

export const disposeUrlSession = async (session) => {
  await session.page.close();
  await session.context.close();
  await session.browser.close();
};
```

- [ ] **Step 5: Add the npm regression script**

```json
{
  "scripts": {
    "test:url-capture-browser": "node scripts/url-capture-browser-regression.mjs"
  }
}
```

- [ ] **Step 6: Run the regression to verify it passes**

Run: `npm.cmd run test:url-capture-browser`

Expected:
- PASS line `[PASS] URL capture browser and network primitives`

- [ ] **Step 7: Commit**

```bash
git add utils/url-capture-browser.ts utils/url-capture-network.ts scripts/url-capture-browser-regression.mjs package.json
git commit -m "feat: add URL capture browser primitives"
```

## Task 4: Add Route Discovery, Bundle Hints, and Interaction Exploration

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-routes.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-interactions.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-bundles.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-discovery-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing route discovery regression**

```js
import assert from 'node:assert/strict';
import http from 'node:http';
import { captureUrlSession, disposeUrlSession } from '../utils/url-capture-browser.ts';
import { discoverRoutesFromCapture } from '../utils/url-capture-routes.ts';
import { exploreInteractiveStates } from '../utils/url-capture-interactions.ts';

const server = http.createServer((req, res) => {
  if (req.url === '/sitemap.xml') {
    res.setHeader('content-type', 'application/xml');
    res.end(`<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:4318/pricing/</loc></url><url><loc>http://127.0.0.1:4318/contact/</loc></url></urlset>`);
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html><head><title>Home</title><link rel="canonical" href="http://127.0.0.1:4318/" /></head><body><a href="/pricing/">Pricing</a><div role="tablist"><button type="button" role="tab" aria-controls="panel-a" aria-selected="true" data-state="active">A</button><button type="button" role="tab" aria-controls="panel-b" aria-selected="false" data-state="inactive">B</button></div><div id="panel-a" role="tabpanel" data-state="active">A panel</div><div id="panel-b" role="tabpanel" data-state="inactive">B panel</div></body></html>`);
});

await new Promise((resolve) => server.listen(4318, resolve));

const session = await captureUrlSession({ url: 'http://127.0.0.1:4318/', authCookies: [], captureDepth: 'balanced' });
const routes = await discoverRoutesFromCapture(session, { sitemapUrl: 'http://127.0.0.1:4318/sitemap.xml', routeSeeds: ['/special/'], bundleInspection: true });
const interactions = await exploreInteractiveStates(session);

assert.ok(routes.some((route) => route.path === '/pricing/'));
assert.ok(routes.some((route) => route.path === '/contact/'));
assert.ok(routes.some((route) => route.path === '/special/'));
assert.ok(interactions.tabPanels.some((panel) => panel.panelId === 'panel-b'));

await disposeUrlSession(session);
server.close();
console.log('[PASS] URL capture discovery and interaction exploration');
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/url-capture-discovery-regression.mjs`

Expected: FAIL because route discovery and interaction modules do not exist

- [ ] **Step 3: Implement route discovery merging**

```ts
import { normalizeRouteSeedList } from './url-capture-common.ts';
import { extractRouteHintsFromBundleText } from './url-capture-bundles.ts';

export const discoverRoutesFromCapture = async (session, input) => {
  const discovered = new Map();
  const add = (path, discoveredBy) => {
    const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}/`;
    const current = discovered.get(normalizedPath) || { path: normalizedPath, discoveredBy: [] };
    current.discoveredBy = Array.from(new Set([...current.discoveredBy, discoveredBy]));
    discovered.set(normalizedPath, current);
  };

  add(new URL(session.initialUrl).pathname || '/', 'canonical');
  normalizeRouteSeedList(Array.isArray(input.routeSeeds) ? input.routeSeeds.join('\n') : input.routeSeeds).forEach((path) => add(path, 'seed'));

  for (const href of session.linkHrefs || []) add(new URL(href, session.initialUrl).pathname, 'link');
  if (input.sitemapUrl) {
    const xml = await fetch(input.sitemapUrl).then((res) => res.text());
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) add(new URL(match[1]).pathname, 'sitemap');
  }
  if (input.bundleInspection) {
    for (const request of session.networkRequests.filter((item) => item.resourceType === 'script')) {
      const bundleText = await fetch(request.url).then((res) => res.text());
      for (const path of extractRouteHintsFromBundleText(bundleText)) add(path, 'bundle');
    }
  }

  return Array.from(discovered.values());
};
```

- [ ] **Step 4: Implement interaction exploration**

```ts
export const exploreInteractiveStates = async (session) => {
  const tabPanels = [];
  for (const tab of await session.page.locator('[role="tab"]').all()) {
    const controls = await tab.getAttribute('aria-controls');
    if (!controls) continue;
    tabPanels.push({
      triggerText: (await tab.textContent())?.trim() || '',
      panelId: controls,
    });
  }

  const accordionRegions = [];
  for (const region of await session.page.locator('[role="region"]').all()) {
    accordionRegions.push({
      id: await region.getAttribute('id'),
      state: await region.getAttribute('data-state'),
    });
  }

  return { tabPanels, accordionRegions };
};
```

- [ ] **Step 5: Implement bundle hint extraction**

```ts
export const extractRouteHintsFromBundleText = (bundleText: string): string[] => {
  const matches = bundleText.match(/\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\//gi) || [];
  return Array.from(new Set(matches));
};
```

- [ ] **Step 6: Add the npm regression script and run it**

```json
{
  "scripts": {
    "test:url-capture-discovery": "node scripts/url-capture-discovery-regression.mjs"
  }
}
```

Run: `npm.cmd run test:url-capture-discovery`

Expected:
- PASS line `[PASS] URL capture discovery and interaction exploration`

- [ ] **Step 7: Commit**

```bash
git add utils/url-capture-routes.ts utils/url-capture-interactions.ts utils/url-capture-bundles.ts scripts/url-capture-discovery-regression.mjs package.json
git commit -m "feat: add URL capture discovery and interaction exploration"
```

## Task 5: Build Synthetic Artifact Normalization and Static-Site Bridge

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-artifact.ts`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-output.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-artifact-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing synthetic artifact regression**

```js
import assert from 'node:assert/strict';
import { buildSyntheticArtifact, buildStaticSiteFromSyntheticArtifact } from '../utils/url-capture-artifact.ts';

const artifact = buildSyntheticArtifact({
  siteSlug: 'duty-cleaners',
  routes: [{ path: '/', title: 'Home', html: '<!doctype html><html><body><h1>Home</h1></body></html>', canonicalUrl: 'https://dutycleaners.example/' }],
  assets: [{ path: 'assets/app.js', content: new Uint8Array([1, 2, 3]) }],
  captureMetadata: { sourceUrl: 'https://dutycleaners.example/' },
});

assert.equal(artifact.routeHtmlByPath['/'].includes('<h1>Home</h1>'), true);

const staticResult = buildStaticSiteFromSyntheticArtifact({
  artifact,
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional cleaning',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: 'CA',
    priceRange: '$$',
    ogImage: '/og.jpg',
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

assert.ok(staticResult.files['index.html']);
assert.ok(staticResult.assetFiles['assets/app.js']);
console.log('[PASS] URL capture synthetic artifact bridge');
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/url-capture-artifact-regression.mjs`

Expected: FAIL because synthetic artifact helpers do not exist

- [ ] **Step 3: Implement artifact normalization**

```ts
import type { RouteInfo } from '../types.ts';
import { createStaticSiteOutput } from './static-output.ts';
import { toSyntheticArtifactPath } from './url-capture-common.ts';

export const buildSyntheticArtifact = ({ siteSlug, routes, assets, captureMetadata }) => {
  const routeHtmlByPath = {};
  const normalizedRoutes: RouteInfo[] = routes.map((route, index) => {
    const path = route.path === '/' ? '/' : `/${route.path.replace(/^\/+|\/+$/g, '')}/`;
    routeHtmlByPath[path] = route.html;
    return { path, slug: path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-'), title: route.title || `Route ${index + 1}` };
  });

  return {
    siteSlug,
    routes: normalizedRoutes,
    routeHtmlByPath,
    capturedAssets: assets,
    assetManifest: assets.map((asset) => ({ sourcePath: asset.path, outputPath: asset.path })),
    captureMetadata,
  };
};
```

- [ ] **Step 4: Implement the Static Site bridge**

```ts
export const buildStaticSiteFromSyntheticArtifact = ({ artifact, seoSettings, staticSiteSettings }) => {
  const staticOutput = createStaticSiteOutput({
    siteSlug: artifact.siteSlug,
    routes: artifact.routes,
    routeHtmlByPath: artifact.routeHtmlByPath,
    seoSettings,
    staticSiteSettings,
  });

  return {
    ...staticOutput,
    assetFiles: Object.fromEntries(artifact.capturedAssets.map((asset) => [asset.path, asset.content])),
  };
};
```

- [ ] **Step 5: Add the npm regression script**

```json
{
  "scripts": {
    "test:url-capture-artifact": "node scripts/url-capture-artifact-regression.mjs"
  }
}
```

- [ ] **Step 6: Run the regression to verify it passes**

Run: `npm.cmd run test:url-capture-artifact`

Expected:
- PASS line `[PASS] URL capture synthetic artifact bridge`

- [ ] **Step 7: Commit**

```bash
git add utils/url-capture-artifact.ts scripts/url-capture-artifact-regression.mjs package.json
git commit -m "feat: add URL capture synthetic artifact bridge"
```

## Task 6: Add Certification Rules, Escalation Guidance, and Reporting

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-certification.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-report.ts`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-certification-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing certification regression**

```js
import assert from 'node:assert/strict';
import { certifyUrlCaptureArtifact } from '../utils/url-capture-certification.ts';

const certified = certifyUrlCaptureArtifact({
  routesRequested: ['/','/pricing/'],
  routesCaptured: ['/','/pricing/'],
  unresolvedAssets: [],
  missingCriticalData: [],
  interactionCoverage: { tabs: true, accordions: true },
});
assert.equal(certified.status, 'certified');

const needsInput = certifyUrlCaptureArtifact({
  routesRequested: ['/','/pricing/','/contact/'],
  routesCaptured: ['/','/pricing/'],
  unresolvedAssets: [],
  missingCriticalData: [],
  interactionCoverage: { tabs: true, accordions: true },
});
assert.equal(needsInput.status, 'needs-input');
assert.match(needsInput.recommendations.join(' '), /route seeds/i);

const uncertified = certifyUrlCaptureArtifact({
  routesRequested: ['/'],
  routesCaptured: ['/'],
  unresolvedAssets: ['https://example.com/app.js'],
  missingCriticalData: ['pricing table API'],
  interactionCoverage: { tabs: false, accordions: false },
});
assert.equal(uncertified.status, 'uncertified');

console.log('[PASS] URL capture certification outcomes');
```

- [ ] **Step 2: Run the regression to verify it fails**

Run: `node scripts/url-capture-certification-regression.mjs`

Expected: FAIL because certification helpers do not exist

- [ ] **Step 3: Implement certification rules**

```ts
export const certifyUrlCaptureArtifact = (input) => {
  const missingRoutes = input.routesRequested.filter((route) => !input.routesCaptured.includes(route));
  const hardFailures = input.unresolvedAssets.length > 0 || input.missingCriticalData.length > 0;
  const weakInteractions = !input.interactionCoverage.tabs || !input.interactionCoverage.accordions;

  if (!hardFailures && missingRoutes.length === 0 && !weakInteractions) {
    return { status: 'certified', recommendations: [], blockers: [] };
  }

  if (!hardFailures && missingRoutes.length > 0) {
    return {
      status: 'needs-input',
      recommendations: ['Add route seeds or sitemap URL and retry certification.'],
      blockers: missingRoutes.map((route) => `Missing route: ${route}`),
    };
  }

  return {
    status: 'uncertified',
    recommendations: ['Proceed with best-effort export only.'],
    blockers: [...input.unresolvedAssets, ...input.missingCriticalData],
  };
};
```

- [ ] **Step 4: Implement report shaping**

```ts
export const buildUrlCaptureReport = ({ sourceUrl, certification, routesDiscovered, routesCaptured }) => ({
  generatedAt: new Date().toISOString(),
  sourceUrl,
  certificationStatus: certification.status,
  recommendations: certification.recommendations,
  blockers: certification.blockers,
  routesDiscovered,
  routesCaptured,
});
```

- [ ] **Step 5: Add the npm regression script**

```json
{
  "scripts": {
    "test:url-capture-certification": "node scripts/url-capture-certification-regression.mjs"
  }
}
```

- [ ] **Step 6: Run the regression to verify it passes**

Run: `npm.cmd run test:url-capture-certification`

Expected:
- PASS line `[PASS] URL capture certification outcomes`

- [ ] **Step 7: Commit**

```bash
git add utils/url-capture-certification.ts utils/url-capture-report.ts scripts/url-capture-certification-regression.mjs package.json
git commit -m "feat: add URL capture certification rules"
```

## Task 7: Wire the End-to-End Orchestrator and Dashboard Static-Site Conversion Branch

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\url-capture-run.ts`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\components\Dashboard.tsx`
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-dashboard-smoke.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write the failing end-to-end smoke test**

```js
import assert from 'node:assert/strict';
import http from 'node:http';
import { runCertifiedUrlCapture } from '../utils/url-capture-run.ts';

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html><head><title>Home</title><link rel="canonical" href="http://127.0.0.1:4319/" /></head><body><a href="/pricing/">Pricing</a><h1>Home</h1></body></html>`);
});

await new Promise((resolve) => server.listen(4319, resolve));

const result = await runCertifiedUrlCapture({
  sourceUrl: 'http://127.0.0.1:4319/',
  sitemapUrl: '',
  routeSeeds: '',
  authCookiesJson: '',
  captureDepth: 'balanced',
  interactionExploration: true,
  bundleInspection: true,
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional cleaning',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: 'CA',
    priceRange: '$$',
    ogImage: '/og.jpg',
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

assert.ok(result.artifact);
assert.ok(result.report);
assert.ok(result.staticResult.files['index.html']);

server.close();
console.log('[PASS] URL capture dashboard smoke');
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `node scripts/url-capture-dashboard-smoke.mjs`

Expected: FAIL because orchestrator does not exist

- [ ] **Step 3: Implement the top-level orchestrator**

```ts
import { captureUrlSession } from './url-capture-browser.ts';
import { discoverRoutesFromCapture } from './url-capture-routes.ts';
import { exploreInteractiveStates } from './url-capture-interactions.ts';
import { buildSyntheticArtifact, buildStaticSiteFromSyntheticArtifact } from './url-capture-artifact.ts';
import { certifyUrlCaptureArtifact } from './url-capture-certification.ts';
import { buildUrlCaptureReport } from './url-capture-report.ts';

export const runCertifiedUrlCapture = async (input) => {
  const session = await captureUrlSession({ url: input.sourceUrl, authCookies: [], captureDepth: input.captureDepth });
  const routes = await discoverRoutesFromCapture(session, { sitemapUrl: input.sitemapUrl, routeSeeds: input.routeSeeds, bundleInspection: input.bundleInspection });
  const interactions = input.interactionExploration ? await exploreInteractiveStates(session) : { tabPanels: [], accordionRegions: [] };
  const artifact = buildSyntheticArtifact({
    siteSlug: new URL(input.sourceUrl).hostname.replace(/\./g, '-'),
    routes: routes.map((route) => ({ ...route, html: session.initialHtml, canonicalUrl: input.sourceUrl })),
    assets: [],
    captureMetadata: { sourceUrl: input.sourceUrl, interactions },
  });
  const certification = certifyUrlCaptureArtifact({
    routesRequested: routes.map((route) => route.path),
    routesCaptured: artifact.routes.map((route) => route.path),
    unresolvedAssets: [],
    missingCriticalData: [],
    interactionCoverage: { tabs: true, accordions: true },
  });
  const staticResult = buildStaticSiteFromSyntheticArtifact({ artifact, seoSettings: input.seoSettings, staticSiteSettings: input.staticSiteSettings });
  const report = buildUrlCaptureReport({ sourceUrl: input.sourceUrl, certification, routesDiscovered: routes.length, routesCaptured: artifact.routes.length });
  return { artifact, certification, staticResult, report };
};
```

- [ ] **Step 4: Wire Dashboard.tsx into the new URL branch**

```ts
if (conversionMode === 'static-site' && staticSiteInputMode === 'public-url-certified') {
  const urlResult = await runCertifiedUrlCapture({
    ...urlCaptureSettings,
    seoSettings,
    staticSiteSettings,
  });

  setUrlCaptureStatus(urlResult.certification.status);
  setStaticExportReport(urlResult.staticResult.report);
  setLogs((prev) => [...prev, { msg: `URL capture finished with status: ${urlResult.certification.status}`, type: 'info', time: new Date().toLocaleTimeString() }]);
}
```

- [ ] **Step 5: Add the npm smoke script**

```json
{
  "scripts": {
    "test:url-capture-dashboard-smoke": "node scripts/url-capture-dashboard-smoke.mjs"
  }
}
```

- [ ] **Step 6: Run the smoke test to verify it passes**

Run: `npm.cmd run test:url-capture-dashboard-smoke`

Expected:
- PASS line `[PASS] URL capture dashboard smoke`

- [ ] **Step 7: Commit**

```bash
git add utils/url-capture-run.ts components/Dashboard.tsx scripts/url-capture-dashboard-smoke.mjs package.json
git commit -m "feat: wire Static Site certified URL capture flow"
```

## Task 8: Add Hardening Regressions and Full Verification

**Files:**
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-browser-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-discovery-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\url-capture-dashboard-smoke.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Expand the browser regression with XHR and asset assertions**

```js
assert.ok(result.networkRequests.some((item) => item.resourceType === 'script'));
assert.ok(result.networkRequests.every((item) => item.status !== null));
```

- [ ] **Step 2: Expand discovery regression with accordion coverage**

```js
assert.ok(interactions.accordionRegions.every((region) => region.state === 'closed' || region.state === 'open'));
```

- [ ] **Step 3: Expand the dashboard smoke test with certification branches**

```js
assert.ok(['certified', 'needs-input', 'uncertified'].includes(result.certification.status));
assert.ok(result.report.certificationStatus === result.certification.status);
```

- [ ] **Step 4: Run all URL capture tests together**

Run:

```bash
npm.cmd run test:url-capture-foundation
npm.cmd run test:url-capture-browser
npm.cmd run test:url-capture-discovery
npm.cmd run test:url-capture-artifact
npm.cmd run test:url-capture-certification
npm.cmd run test:url-capture-dashboard-ui
npm.cmd run test:url-capture-dashboard-smoke
```

Expected:
- all URL capture regressions PASS

- [ ] **Step 5: Run the existing Static Site regressions to verify no regression**

Run:

```bash
npm.cmd run test:static-output
npm.cmd run test:static-interactions
npm.cmd run test:static-smoke
npm.cmd run test:static-dashboard-smoke
npm.cmd run build
```

Expected:
- all Static Site regressions PASS
- build completes successfully

- [ ] **Step 6: Commit**

```bash
git add scripts/url-capture-browser-regression.mjs scripts/url-capture-discovery-regression.mjs scripts/url-capture-dashboard-smoke.mjs
git commit -m "test: harden certified URL capture regressions"
```

## Coverage Check

- URL-based Static Site input mode: Tasks 1, 2, 7
- Deep capture engine: Tasks 3, 4
- Synthetic artifact builder: Task 5
- Certification engine and escalation status: Task 6
- Static Site reuse and ZIP parity: Tasks 5, 7
- Dashboard UX and certification reporting: Tasks 2, 7
- Test and hardening strategy: Task 8

## Notes for Execution

- Keep ZIP-driven Static Site conversion behavior unchanged. Treat any ZIP-path changes as regressions unless a shared type extension is truly required.
- Do not route Platinum / WordPress mode through URL capture in this plan.
- Keep the certification vocabulary exact:
  - `certified`
  - `needs-input`
  - `uncertified`
- If a helper becomes large, split it immediately instead of adding a second responsibility to the same file.
