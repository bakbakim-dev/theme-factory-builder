# Static Site Mode Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe `static-site` dashboard mode and a first-pass static export orchestrator without changing Platinum WordPress behavior.

**Architecture:** Extend the dashboard with a new conversion mode and an isolated "Local SEO & AI Signals" settings panel, then branch the existing conversion orchestration into a new `utils/static-output.ts` pipeline that emits a static-site file map instead of WordPress theme files. Keep the WordPress path untouched except for a mode guard and shared settings flow.

**Tech Stack:** React, TypeScript, JSZip, existing Dashboard conversion pipeline

---

### Task 1: Add the new mode and static settings state

**Files:**
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\components\Dashboard.tsx`

- [ ] **Step 1: Add the failing type/state references**

Add these definitions near the top-level Dashboard state so later code can compile against them:

```ts
type ConversionMode = 'gutenberg-native' | 'react-spa' | 'static-site';

const [conversionMode, setConversionMode] = useState<ConversionMode>('gutenberg-native');
const [showStaticSeoConfig, setShowStaticSeoConfig] = useState(false);
const [staticSiteSettings, setStaticSiteSettings] = useState({
  baseUrl: 'https://',
  formsProvider: 'web3forms',
  formsEndpoint: '',
  web3FormsAccessKey: '',
  latitude: '',
  longitude: '',
  serviceAreas: '',
  enableAiCrawlerAllowances: true,
  enableLlmsTxt: true,
  enableIndexNow: true,
});
```

- [ ] **Step 2: Run TypeScript build to verify it fails in expected places**

Run: `npm.cmd run build`

Expected: FAIL with missing references where the new mode/state is not yet integrated.

- [ ] **Step 3: Replace old conversion mode annotations with `ConversionMode`**

Update any existing mode unions in `Dashboard.tsx`:

```ts
const [conversionMode, setConversionMode] = useState<ConversionMode>('gutenberg-native');
```

and:

```ts
const [auditState, setAuditState] = useState<{
  platform: string;
  routes: RouteInfo[];
  mode: ConversionMode;
  logs: AuditLog[];
} | null>(null);
```

and:

```ts
const processConversion = async (
  zipContent: any,
  _rootPath: string,
  _platform: string,
  routes: RouteInfo[],
  mode: ConversionMode,
  auditBypassed = false,
  preExtractedFaqData?: { q: string; a: string }[]
) => {
```

- [ ] **Step 4: Run build again**

Run: `npm.cmd run build`

Expected: Either PASS or fail only on the not-yet-imported static orchestrator.

- [ ] **Step 5: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: add static mode state scaffolding"
```

### Task 2: Add the dashboard mode selector and Local SEO & AI Signals panel

**Files:**
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\components\Dashboard.tsx`

- [ ] **Step 1: Add a small output-mode selector component inline**

Insert a helper inside `Dashboard.tsx` before `return`:

```tsx
const outputModes: Array<{ id: ConversionMode; title: string; description: string }> = [
  {
    id: 'gutenberg-native',
    title: 'WordPress / Platinum',
    description: 'Editable WordPress theme export with the existing Platinum workflow.',
  },
  {
    id: 'static-site',
    title: 'Static Site',
    description: 'Pure static export for speed, local SEO, and AI discoverability.',
  },
  {
    id: 'react-spa',
    title: 'React SPA',
    description: 'Legacy SPA packaging path.',
  },
];
```

and render it:

```tsx
const renderOutputModeSelector = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {outputModes.map((modeOption) => {
      const active = conversionMode === modeOption.id;
      return (
        <button
          key={modeOption.id}
          type="button"
          onClick={() => setConversionMode(modeOption.id)}
          className={`text-left rounded-xl border p-4 transition-all ${
            active
              ? 'border-blue-500 bg-blue-600/10 text-white'
              : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="font-semibold">{modeOption.title}</div>
          <div className="text-xs mt-1 opacity-80">{modeOption.description}</div>
        </button>
      );
    })}
  </div>
);
```

- [ ] **Step 2: Render the selector in idle and source-detected views**

Place:

```tsx
{renderOutputModeSelector()}
```

above the upload area in `STEPS.IDLE` and above route selection/SEO config in `STEPS.SOURCE_DETECTED`.

- [ ] **Step 3: Add the dedicated Local SEO & AI Signals panel**

Render this panel only when `conversionMode === 'static-site'`:

```tsx
{conversionMode === 'static-site' && (
  <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 space-y-4">
    <button
      type="button"
      onClick={() => setShowStaticSeoConfig(!showStaticSeoConfig)}
      className="w-full flex items-center justify-between text-left group"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          Local SEO & AI Signals
          <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Static Mode</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1 ml-6">
          Base URL, static forms, geo coordinates, service areas, and AI crawler files.
        </p>
      </div>
    </button>
    {showStaticSeoConfig && (
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        {/* fields bound to staticSiteSettings */}
      </div>
    )}
  </div>
)}
```

Use inputs for:
- `baseUrl`
- `formsProvider`
- `web3FormsAccessKey`
- `formsEndpoint`
- `latitude`
- `longitude`
- `serviceAreas`
- `enableAiCrawlerAllowances`
- `enableLlmsTxt`
- `enableIndexNow`

- [ ] **Step 4: Run build to verify the UI compiles**

Run: `npm.cmd run build`

Expected: FAIL only if the static orchestrator import/call has not been added yet.

- [ ] **Step 5: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: add static mode selector and seo ai panel"
```

### Task 3: Write the failing static orchestrator test

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\scripts\static-output-regression.mjs`
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\package.json`

- [ ] **Step 1: Write a failing regression script**

Create `scripts/static-output-regression.mjs`:

```js
import assert from 'node:assert/strict';
import { createStaticSiteOutput } from '../utils/static-output.ts';

const routeHtmlByPath = {
  '/': '<!DOCTYPE html><html><head><title>Home</title></head><body><a href=\"/edmonton\">Edmonton</a><form><input name=\"name\" /></form></body></html>',
  '/edmonton/': '<!DOCTYPE html><html><head><title>Edmonton</title></head><body><h1>Edmonton</h1></body></html>',
};

const result = createStaticSiteOutput({
  siteSlug: 'duty-cleaners',
  routes: [
    { path: '/', slug: 'home', title: 'Home' },
    { path: '/edmonton/', slug: 'edmonton', title: 'Edmonton' },
  ],
  routeHtmlByPath,
  seoSettings: {
    companyName: 'Duty Cleaners',
    url: 'https://dutycleaners.example',
    description: 'Professional cleaning services in Edmonton.',
    telephone: '780-913-6565',
    addressLocality: 'Edmonton',
    addressRegion: 'AB',
    addressCountry: 'CA',
    priceRange: '$$',
    ogImage: 'https://dutycleaners.example/og.jpg',
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
    serviceAreas: 'Edmonton, St. Albert, Sherwood Park',
    enableAiCrawlerAllowances: true,
    enableLlmsTxt: true,
    enableIndexNow: true,
  },
});

assert.ok(result.files['index.html']);
assert.ok(result.files['edmonton/index.html']);
assert.ok(result.files['404.html']);
assert.ok(result.files['sitemap.xml']);
assert.ok(result.files['robots.txt']);
assert.ok(result.files['llms.txt']);
assert.ok(result.files['indexnow-key.txt']);
assert.match(result.files['index.html'], /<link rel=\"canonical\" href=\"https:\\/\\/dutycleaners\\.example\\/\"/);
assert.match(result.files['index.html'], /https:\\/\\/dutycleaners\\.example\\/edmonton\\//);
assert.match(result.files['llms.txt'], /Duty Cleaners/);
assert.match(result.files['robots.txt'], /OAI-SearchBot/);

console.log('Static output regression');
console.log('[PASS] Static output files and core SEO artifacts generated');
```

- [ ] **Step 2: Add the npm script**

In `package.json`:

```json
"test:static-output": "node scripts/static-output-regression.mjs"
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm.cmd run test:static-output`

Expected: FAIL because `utils/static-output.ts` does not exist yet.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/static-output-regression.mjs
git commit -m "test: add static output regression"
```

### Task 4: Implement `utils/static-output.ts`

**Files:**
- Create: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\utils\static-output.ts`

- [ ] **Step 1: Create the minimal orchestrator with explicit types**

Create:

```ts
import { RouteInfo } from '../types';

export interface StaticSiteSettings {
  baseUrl: string;
  formsProvider: 'web3forms' | 'formspree' | 'custom-endpoint';
  formsEndpoint: string;
  web3FormsAccessKey: string;
  latitude: string;
  longitude: string;
  serviceAreas: string;
  enableAiCrawlerAllowances: boolean;
  enableLlmsTxt: boolean;
  enableIndexNow: boolean;
}

export interface StaticSeoSettings {
  companyName: string;
  url: string;
  description: string;
  telephone: string;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
  priceRange: string;
  ogImage: string;
  primaryLocale: string;
  alternateLocales: string;
}

export interface StaticSiteOutputInput {
  siteSlug: string;
  routes: RouteInfo[];
  routeHtmlByPath: Record<string, string>;
  seoSettings: StaticSeoSettings;
  staticSiteSettings: StaticSiteSettings;
}

export interface StaticSiteOutputResult {
  files: Record<string, string>;
  report: {
    routeCount: number;
    generatedAt: string;
    baseUrl: string;
    formsProvider: string;
  };
}
```

- [ ] **Step 2: Add minimal trailing-slash helpers and route mapping**

Add:

```ts
const normalizeBaseUrl = (value: string) => (value || '').trim().replace(/\/+$/, '');
const ensureRoutePath = (value: string) => {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
};
const toFilePath = (routePath: string) => routePath === '/' ? 'index.html' : `${routePath.replace(/^\/|\/$/g, '')}/index.html`;
const toAbsoluteUrl = (baseUrl: string, routePath: string) => `${normalizeBaseUrl(baseUrl)}${ensureRoutePath(routePath)}`;
```

- [ ] **Step 3: Add minimal HTML transform and head injection**

Add:

```ts
const buildHeadTags = (baseUrl: string, route: RouteInfo, seoSettings: StaticSeoSettings) => {
  const canonical = toAbsoluteUrl(baseUrl, route.path);
  return [
    `<link rel=\"canonical\" href=\"${canonical}\" />`,
    `<meta property=\"og:url\" content=\"${canonical}\" />`,
    `<meta property=\"og:title\" content=\"${escapeHtml(route.title)}\" />`,
    `<meta property=\"og:description\" content=\"${escapeHtml(seoSettings.description)}\" />`,
    seoSettings.ogImage ? `<meta property=\"og:image\" content=\"${escapeHtml(toAbsoluteMediaUrl(baseUrl, seoSettings.ogImage))}\" />` : '',
    `<meta name=\"twitter:card\" content=\"summary_large_image\" />`,
  ].filter(Boolean).join('\\n');
};
```

and a transform function that:
- rewrites internal `href=\"/slug\"` to `href=\"/slug/\"`
- rewrites forms to Web3Forms if selected
- injects head tags before `</head>`

- [ ] **Step 4: Add global file generators**

Generate:

```ts
files['404.html'] = '<!DOCTYPE html><html><head><title>404</title></head><body><h1>Page not found</h1></body></html>';
files['robots.txt'] = buildRobotsTxt(...);
files['sitemap.xml'] = buildSitemapXml(...);
files['llms.txt'] = buildLlmsTxt(...);
files['indexnow-key.txt'] = enableIndexNow ? `${siteSlug}-indexnow` : '';
files['_headers'] = '/*\\n  Cache-Control: public, max-age=0, must-revalidate\\n/assets/*\\n  Cache-Control: public, max-age=31536000, immutable\\n';
files['_redirects'] = '/edmonton /edmonton/ 301\\n';
files['static-export-report.json'] = JSON.stringify(report, null, 2);
```

- [ ] **Step 5: Run the static regression and watch it pass**

Run: `npm.cmd run test:static-output`

Expected: PASS

- [ ] **Step 6: Run the app build**

Run: `npm.cmd run build`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add utils/static-output.ts package.json scripts/static-output-regression.mjs
git commit -m "feat: add static output orchestrator"
```

### Task 5: Wire Dashboard to call the static orchestrator

**Files:**
- Modify: `C:\Users\Marketplace\Documents\theme-factory-ai-golden\components\Dashboard.tsx`

- [ ] **Step 1: Import the orchestrator**

Add:

```ts
import { createStaticSiteOutput, StaticSiteSettings } from '../utils/static-output';
```

- [ ] **Step 2: Branch `processConversion` early for static mode**

Inside `processConversion`, before WordPress packaging begins, add:

```ts
if (mode === 'static-site') {
  const routeHtmlByPath: Record<string, string> = {};
  for (const route of routes) {
    const normalizedRoutePath = route.path === '/' ? '/' : `${route.path.replace(/\/+$/, '')}/`;
    const fileName = normalizedRoutePath === '/' ? 'home' : normalizedRoutePath.replace(/^\/|\/$/g, '');
    const candidateFiles = [
      `prerendered/${fileName}.html`,
      `${fileName}/index.html`,
      'index.html',
    ];
    for (const candidate of candidateFiles) {
      if (zipContent.files[candidate]) {
        routeHtmlByPath[normalizedRoutePath] = decode(await zipContent.files[candidate].async('uint8array'));
        break;
      }
    }
  }

  const staticOutput = createStaticSiteOutput({
    siteSlug: themeSlug || 'static-site',
    routes,
    routeHtmlByPath,
    seoSettings: {
      companyName: seoSettings.companyName,
      url: seoSettings.url,
      description: seoSettings.description,
      telephone: seoSettings.telephone,
      addressLocality: seoSettings.addressLocality,
      addressRegion: seoSettings.addressRegion,
      addressCountry: seoSettings.addressCountry,
      priceRange: seoSettings.priceRange,
      ogImage: seoSettings.ogImage,
      primaryLocale: seoSettings.primaryLocale,
      alternateLocales: seoSettings.alternateLocales,
    },
    staticSiteSettings,
  });

  Object.entries(staticOutput.files).forEach(([filePath, content]) => {
    folder.file(filePath, content);
  });

  setConversionStats({ php: 0, js: 0, css: 0, images: 0, routes: routes.length, patterns: 0 });
  addLog(`Static site export generated for ${routes.length} routes.`, 'success');
  await finishBuild(newZip);
  return;
}
```

- [ ] **Step 3: Run the regression and build**

Run:
- `npm.cmd run test:static-output`
- `npm.cmd run build`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: wire dashboard to static output mode"
```

## Spec Coverage Check

This phase intentionally covers only the foundation/orchestration slice of the spec:

- new `static-site` mode
- dedicated Local SEO & AI Signals panel
- top-level static output pipeline
- trailing-slash-aware static file layout
- baseline `404.html`
- baseline sitemap/robots/llms/indexnow output
- Web3Forms-capable orchestration surface

Deferred to later phases:

- full schema richness
- full absolute media normalization rules
- richer internal link rewriting
- richer deployment configs
- deeper tests and fixture coverage

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-static-site-mode-phase-1.md`.

The user explicitly asked to begin implementation immediately, so proceed inline with Phase 1 execution in this session.
