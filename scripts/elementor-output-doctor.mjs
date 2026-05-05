import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SEVERITY_WEIGHT = {
  ok: 0,
  warning: 1,
  critical: 2,
};

const normalizeSiteUrl = (value) => {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
};

const normalizeRoutePath = (value) => {
  const route = String(value || '').trim();
  if (!route || route === '/') return '/';
  return `/${route.replace(/^\/+|\/+$/g, '')}/`;
};

const routeForManifestPage = (page) => {
  if (page.path) return normalizeRoutePath(page.path);

  const slug = String(page.slug || '').replace(/^\/+|\/+$/g, '');
  if (!slug || slug === 'front-page' || slug === 'home') return '/';
  return `/${slug}/`;
};

const safeFileSlug = (value) => String(value || 'page')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'page';

export const flattenElementorElementsForDoctor = (elements = []) => elements.flatMap((element) => [
  element,
  ...flattenElementorElementsForDoctor(element.elements || []),
]);

export const summarizeManifestPage = (page) => {
  const elements = flattenElementorElementsForDoctor(page.elementorData || page.elements || page.content || []);
  const containers = elements.filter((element) => element.elType === 'container');
  const widgets = elements.filter((element) => element.elType === 'widget');
  const widgetTypes = widgets.map((widget) => widget.widgetType || 'unknown');

  return {
    slug: page.slug || '',
    path: page.path || routeForManifestPage(page),
    route: routeForManifestPage(page),
    title: page.title || page.slug || '',
    topLevelElements: (page.elementorData || page.elements || page.content || []).length,
    totalElements: elements.length,
    containers: containers.length,
    widgets: widgets.length,
    htmlWidgets: widgets.filter((widget) => widget.widgetType === 'html').length,
    customWidgets: widgets.filter((widget) => String(widget.widgetType || '').startsWith('whipify_')).length,
    containerLegacyClassSettings: containers.filter((container) => typeof container.settings?._css_classes === 'string').length,
    containerRenderableClassSettings: containers.filter((container) => typeof container.settings?.css_classes === 'string').length,
    widgetClassSettings: widgets.filter((widget) => typeof widget.settings?._css_classes === 'string').length,
    uniqueWidgetTypes: [...new Set(widgetTypes)].sort().join(', '),
    warningCount: Array.isArray(page.warnings) ? page.warnings.length : 0,
    warnings: Array.isArray(page.warnings) ? page.warnings : [],
    stats: page.stats || {},
  };
};

export const classifyLiveAudit = (livePage) => {
  const findings = [];
  const layoutMismatches = livePage.layoutMismatches || [];
  const consoleErrors = livePage.consoleErrors || 0;
  const failedRequests = livePage.failedRequests || 0;
  const htmlWidgets = livePage.htmlWidgets || 0;
  const widgets = livePage.widgets || 0;
  const htmlWidgetRatio = widgets > 0 ? htmlWidgets / widgets : 0;

  if (layoutMismatches.length > 0) {
    findings.push(`${layoutMismatches.length} layout mismatch(es) detected from computed CSS.`);
  }

  if (consoleErrors > 0) {
    findings.push(`${consoleErrors} browser console error(s) detected.`);
  }

  if (failedRequests > 0) {
    findings.push(`${failedRequests} failed request(s) detected.`);
  }

  if (htmlWidgetRatio > 0.25) {
    findings.push(`${Math.round(htmlWidgetRatio * 100)}% of widgets are HTML fallbacks.`);
  }

  let severity = 'ok';
  if (findings.length > 0) severity = 'warning';
  if (layoutMismatches.length > 0 || consoleErrors > 0 || failedRequests > 0) severity = 'critical';

  return {
    ...livePage,
    htmlWidgetRatio,
    findings,
    severity,
  };
};

export const buildDoctorSummary = ({
  siteUrl,
  generatedAt = new Date().toISOString(),
  manifestUrl = '',
  manifestGeneratedAt = '',
  manifestPages = [],
  livePages = [],
}) => {
  const totals = {
    pages: manifestPages.length,
    manifestWidgets: manifestPages.reduce((sum, page) => sum + page.widgets, 0),
    manifestContainers: manifestPages.reduce((sum, page) => sum + page.containers, 0),
    htmlWidgets: manifestPages.reduce((sum, page) => sum + page.htmlWidgets, 0),
    legacyContainerClassSettings: manifestPages.reduce((sum, page) => sum + page.containerLegacyClassSettings, 0),
    renderableContainerClassSettings: manifestPages.reduce((sum, page) => sum + page.containerRenderableClassSettings, 0),
    layoutMismatches: livePages.reduce((sum, page) => sum + (page.layoutMismatches || []).length, 0),
    consoleErrors: livePages.reduce((sum, page) => sum + (page.consoleErrors || 0), 0),
    failedRequests: livePages.reduce((sum, page) => sum + (page.failedRequests || 0), 0),
  };

  const severityPool = [
    ...livePages.map((page) => page.severity || 'ok'),
    totals.legacyContainerClassSettings > 0 ? 'critical' : 'ok',
  ];
  const overallSeverity = severityPool.sort((a, b) => SEVERITY_WEIGHT[b] - SEVERITY_WEIGHT[a])[0] || 'ok';

  return {
    siteUrl,
    generatedAt,
    manifestUrl,
    manifestGeneratedAt,
    overallSeverity,
    totals,
    manifestPages,
    livePages,
  };
};

const renderMarkdownReport = (summary) => {
  const lines = [
    '# Elementor Output Doctor',
    '',
    `Site: ${summary.siteUrl}`,
    `Generated: ${summary.generatedAt}`,
    `Manifest: ${summary.manifestUrl || 'not detected'}`,
    `Overall severity: ${summary.overallSeverity}`,
    '',
    '## Totals',
    '',
    `- Pages: ${summary.totals.pages}`,
    `- Manifest widgets: ${summary.totals.manifestWidgets}`,
    `- Manifest containers: ${summary.totals.manifestContainers}`,
    `- HTML fallback widgets: ${summary.totals.htmlWidgets}`,
    `- Legacy container class settings (_css_classes): ${summary.totals.legacyContainerClassSettings}`,
    `- Renderable container class settings (css_classes): ${summary.totals.renderableContainerClassSettings}`,
    `- Live layout mismatches: ${summary.totals.layoutMismatches}`,
    `- Console errors: ${summary.totals.consoleErrors}`,
    `- Failed requests: ${summary.totals.failedRequests}`,
    '',
    '## Pages',
    '',
  ];

  summary.livePages.forEach((page) => {
    const manifestPage = summary.manifestPages.find((item) => item.slug === page.slug) || {};
    lines.push(`### ${page.slug || page.route}`);
    lines.push('');
    lines.push(`- Route: ${page.route}`);
    lines.push(`- Severity: ${page.severity}`);
    lines.push(`- Live widgets: ${page.widgets}`);
    lines.push(`- Live containers: ${page.containers}`);
    lines.push(`- Live HTML widgets: ${page.htmlWidgets}`);
    lines.push(`- Manifest widget types: ${manifestPage.uniqueWidgetTypes || ''}`);
    lines.push(`- Manifest legacy container classes: ${manifestPage.containerLegacyClassSettings || 0}`);
    lines.push(`- Manifest renderable container classes: ${manifestPage.containerRenderableClassSettings || 0}`);
    if (page.findings?.length) {
      page.findings.forEach((finding) => lines.push(`- Finding: ${finding}`));
    }
    if (page.layoutMismatches?.length) {
      page.layoutMismatches.slice(0, 5).forEach((mismatch) => {
        lines.push(`- Mismatch: ${mismatch.kind} on \`${mismatch.className}\` computed ${JSON.stringify(mismatch.computed)}`);
      });
    }
    if (page.screenshot) {
      lines.push(`- Screenshot: ${page.screenshot}`);
    }
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
};

const findThemeManifestUrl = async (siteUrl) => {
  const html = await fetch(`${siteUrl}/`, {
    headers: { 'user-agent': 'Mozilla/5.0 Whipify Elementor Doctor' },
  }).then((response) => response.text());
  const themeMatch = html.match(/\/wp-content\/themes\/([^/"']+)\//i);
  if (!themeMatch) {
    throw new Error('Could not detect active theme slug from homepage assets.');
  }
  return `${siteUrl}/wp-content/themes/${themeMatch[1]}/assets/data/elementor-pages.json`;
};

export const buildFallbackManifestPagesForDoctor = (siteUrl, routePath = '/') => {
  const url = new URL(siteUrl);
  const slug = safeFileSlug(routePath === '/' ? url.pathname : routePath) || 'live-page';
  return [{
    slug,
    path: normalizeRoutePath(routePath),
    title: slug === 'live-page' ? 'Live Page' : slug,
    elementorData: [],
    warnings: ['Elementor manifest was not reachable; doctor ran live-page-only diagnostics.'],
  }];
};

const collectLayoutMismatches = () => {
  const read = (element, kind) => {
    const computed = getComputedStyle(element);
    return {
      kind,
      className: String(element.className || ''),
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      computed: {
        display: computed.display,
        maxWidth: computed.maxWidth,
        width: computed.width,
        marginLeft: computed.marginLeft,
        marginRight: computed.marginRight,
        gridTemplateColumns: computed.gridTemplateColumns,
      },
    };
  };

  const elements = Array.from(document.querySelectorAll('[class]'));
  const mismatches = [];

  elements.forEach((element) => {
    const className = String(element.className || '');
    const tokens = className.split(/\s+/).filter(Boolean);
    const computed = getComputedStyle(element);

    if (tokens.includes('grid') && computed.display !== 'grid') {
      mismatches.push(read(element, 'grid-display'));
    }

    const isResponsiveHidden = tokens.some((token) => /(^|:)hidden$/.test(token));
    if (tokens.includes('flex') && computed.display !== 'flex' && !(isResponsiveHidden && computed.display === 'none')) {
      mismatches.push(read(element, 'flex-display'));
    }

    if (tokens.includes('inline-flex') && !['inline-flex', 'flex'].includes(computed.display)) {
      mismatches.push(read(element, 'inline-flex-display'));
    }

    if (tokens.includes('mx-auto') && tokens.some((token) => /^max-w-/.test(token))) {
      const width = Number.parseFloat(computed.width);
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const left = Number.parseFloat(computed.marginLeft);
      const right = Number.parseFloat(computed.marginRight);
      const hasNoCenteringMargin = Number.isFinite(left) && Number.isFinite(right) && left === 0 && right === 0;
      const hasBalancedCenteringMargin = Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1 && left > 0;
      const isClearlyFullWidth = !hasBalancedCenteringMargin && (
        (computed.maxWidth === '100%' && Number.isFinite(width) && width >= viewportWidth * 0.9)
        || (hasNoCenteringMargin && Number.isFinite(width) && width >= viewportWidth * 0.9)
      );
      if (isClearlyFullWidth) {
        mismatches.push(read(element, 'max-width-centering'));
      }
    }
  });

  return mismatches.slice(0, 40);
};

const auditLivePage = async ({ browser, siteUrl, manifestPage, outDir }) => {
  const route = routeForManifestPage(manifestPage);
  const slug = manifestPage.slug || safeFileSlug(route);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  const consoleMessages = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || '',
    });
  });

  const url = `${siteUrl}${route}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const screenshot = path.join(outDir, `${safeFileSlug(slug)}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  const live = await page.evaluate(collectLayoutMismatchesString => {
    const layoutMismatches = (0, eval)(`(${collectLayoutMismatchesString})`)();
    const widgetTypes = Array.from(document.querySelectorAll('[data-widget_type]'))
      .map((element) => element.getAttribute('data-widget_type') || '')
      .filter(Boolean);
    const mainText = (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').trim();

    return {
      title: document.title,
      bodyClass: document.body.className,
      elementorRoots: document.querySelectorAll('[data-elementor-type]').length,
      widgets: document.querySelectorAll('.elementor-widget').length,
      containers: document.querySelectorAll('.e-con').length,
      htmlWidgets: document.querySelectorAll('.elementor-widget-html').length,
      customWidgets: widgetTypes.filter((type) => type.startsWith('whipify_')).length,
      uniqueWidgetTypes: [...new Set(widgetTypes)].sort().join(', '),
      mainTextLength: mainText.length,
      mainTextPrefix: mainText.slice(0, 240),
      layoutMismatches,
    };
  }, collectLayoutMismatches.toString());

  await page.close();

  return classifyLiveAudit({
    slug,
    route,
    url,
    screenshot,
    ...live,
    consoleMessages,
    consoleErrors: consoleMessages.filter((message) => message.type === 'error').length,
    consoleWarnings: consoleMessages.filter((message) => message.type === 'warning').length,
    failedRequests: failedRequests.length,
    failedRequestDetails: failedRequests.slice(0, 10),
  });
};

const runDoctorCli = async () => {
  const args = process.argv.slice(2);
  const rawSiteUrl = args.find((arg) => !arg.startsWith('--')) || process.env.WHIPIFY_ELEMENTOR_DOCTOR_URL;
  if (!rawSiteUrl) {
    throw new Error('Usage: npm run doctor:elementor -- https://example.com [--max-pages=5] [--fail-on-critical]');
  }

  const maxPagesArg = args.find((arg) => arg.startsWith('--max-pages='));
  const maxPages = maxPagesArg ? Number(maxPagesArg.split('=')[1]) : Number.POSITIVE_INFINITY;
  const failOnCritical = args.includes('--fail-on-critical');
  const requestedUrl = normalizeSiteUrl(rawSiteUrl);
  const requested = new URL(requestedUrl);
  const siteUrl = requested.origin;
  const focusedRoute = normalizeRoutePath(requested.pathname);
  const outDir = path.resolve('.tools', 'elementor-output-doctor');
  fs.mkdirSync(outDir, { recursive: true });

  let manifestUrl = '';
  let manifest = { pages: buildFallbackManifestPagesForDoctor(siteUrl, focusedRoute) };
  try {
    manifestUrl = await findThemeManifestUrl(siteUrl);
    manifest = await fetch(manifestUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 Whipify Elementor Doctor' },
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Could not fetch Elementor manifest: ${response.status} ${response.statusText}`);
      return response.json();
    });
  } catch (error) {
    console.warn(`Elementor manifest unavailable; running live-page-only diagnostics. ${error.message}`);
  }

  const rawManifestPages = manifest.pages || [];
  const scopedPages = focusedRoute === '/'
    ? rawManifestPages
    : rawManifestPages.filter((page) => routeForManifestPage(page) === focusedRoute);
  const pages = (scopedPages.length > 0 ? scopedPages : rawManifestPages)
    .slice(0, Number.isFinite(maxPages) ? maxPages : undefined);
  const manifestPages = pages.map(summarizeManifestPage);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const livePages = [];
  for (const manifestPage of pages) {
    livePages.push(await auditLivePage({ browser, siteUrl, manifestPage, outDir }));
  }
  await browser.close();

  const summary = buildDoctorSummary({
    siteUrl,
    manifestUrl,
    manifestGeneratedAt: manifest.generatedAt || '',
    manifestPages,
    livePages,
  });

  const jsonPath = path.join(outDir, 'elementor-output-doctor-report.json');
  const markdownPath = path.join(outDir, 'elementor-output-doctor-report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, renderMarkdownReport(summary), 'utf8');

  console.log(`Elementor doctor severity: ${summary.overallSeverity}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${markdownPath}`);

  if (failOnCritical && summary.overallSeverity === 'critical') {
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDoctorCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
