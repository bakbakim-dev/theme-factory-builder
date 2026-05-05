import assert from 'node:assert/strict';
import {
  buildFallbackManifestPagesForDoctor,
  buildDoctorSummary,
  classifyLiveAudit,
  flattenElementorElementsForDoctor,
  summarizeManifestPage,
} from './elementor-output-doctor.mjs';

const manifestPage = {
  slug: 'edmonton',
  path: '/edmonton',
  title: 'Edmonton',
  stats: {
    nativeWidgets: 12,
    customWidgets: 2,
    fallbackHtmlWidgets: 3,
    containers: 4,
  },
  warnings: [
    'Fell back to Elementor HTML widget for <span>.',
  ],
  elementorData: [
    {
      id: 'root',
      elType: 'container',
      settings: {
        _css_classes: 'entry-content grid md:grid-cols-2',
      },
      elements: [
        {
          id: 'inner',
          elType: 'container',
          settings: {
            css_classes: 'container mx-auto px-4',
          },
          elements: [
            {
              id: 'heading',
              elType: 'widget',
              widgetType: 'heading',
              settings: {
                _css_classes: 'text-4xl max-w-3xl mx-auto',
              },
              elements: [],
            },
            {
              id: 'html',
              elType: 'widget',
              widgetType: 'html',
              settings: {},
              elements: [],
            },
          ],
        },
      ],
    },
  ],
};

const flattened = flattenElementorElementsForDoctor(manifestPage.elementorData);
assert.equal(flattened.length, 4, 'Expected recursive flattening to include root, inner, and child widgets.');

const fallbackPages = buildFallbackManifestPagesForDoctor('https://example.test', '/edmonton/');
assert.equal(fallbackPages.length, 1);
assert.equal(fallbackPages[0].slug, 'edmonton');
assert.equal(fallbackPages[0].path, '/edmonton/');
assert.match(fallbackPages[0].warnings[0], /manifest was not reachable/i);

const manifestSummary = summarizeManifestPage(manifestPage);
assert.equal(manifestSummary.containerLegacyClassSettings, 1);
assert.equal(manifestSummary.containerRenderableClassSettings, 1);
assert.equal(manifestSummary.widgets, 2);
assert.equal(manifestSummary.htmlWidgets, 1);
assert.equal(manifestSummary.warningCount, 1);
assert.match(manifestSummary.uniqueWidgetTypes, /heading/);
assert.match(manifestSummary.uniqueWidgetTypes, /html/);

const liveClassification = classifyLiveAudit({
  route: '/edmonton/',
  widgets: 2,
  containers: 2,
  htmlWidgets: 1,
  customWidgets: 0,
  consoleErrors: 1,
  failedRequests: 1,
  layoutMismatches: [
    {
      kind: 'max-width',
      className: 'max-w-3xl mx-auto',
      computed: {
        maxWidth: '100%',
        marginLeft: '0px',
        marginRight: '0px',
      },
    },
  ],
});

assert.equal(liveClassification.severity, 'critical');
assert.ok(liveClassification.findings.some((finding) => /layout mismatch/i.test(finding)));
assert.ok(liveClassification.findings.some((finding) => /console error/i.test(finding)));
assert.ok(liveClassification.findings.some((finding) => /failed request/i.test(finding)));

const doctorSummary = buildDoctorSummary({
  siteUrl: 'https://example.test',
  generatedAt: '2026-04-27T00:00:00.000Z',
  manifestPages: [manifestSummary],
  livePages: [liveClassification],
});

assert.equal(doctorSummary.siteUrl, 'https://example.test');
assert.equal(doctorSummary.totals.pages, 1);
assert.equal(doctorSummary.totals.legacyContainerClassSettings, 1);
assert.equal(doctorSummary.totals.layoutMismatches, 1);
assert.equal(doctorSummary.overallSeverity, 'critical');

console.log('elementor output doctor regression passed');
