import assert from 'node:assert/strict';
import http from 'node:http';
import { captureUrlSession, disposeUrlSession } from '../utils/url-capture-browser.ts';
import { discoverRoutesFromCapture } from '../utils/url-capture-routes.ts';
import { exploreInteractiveStates } from '../utils/url-capture-interactions.ts';

const server = http.createServer((req, res) => {
  if (req.url === '/sitemap.xml') {
    res.setHeader('content-type', 'application/xml');
    res.end('<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:4318/pricing/</loc></url><url><loc>http://127.0.0.1:4318/contact/</loc></url></urlset>');
    return;
  }

  if (req.url === '/bundle.js') {
    res.setHeader('content-type', 'application/javascript');
    res.end("const routes = ['/from-bundle/'];");
    return;
  }

  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html><head><title>Home</title><link rel="canonical" href="http://127.0.0.1:4318/" /><script src="/bundle.js"></script></head><body><a href="/pricing/">Pricing</a><div role="tablist"><button type="button" role="tab" aria-controls="panel-a" aria-selected="true" data-state="active">A</button><button type="button" role="tab" aria-controls="panel-b" aria-selected="false" data-state="inactive">B</button></div><div id="panel-a" role="tabpanel" data-state="active">A panel</div><div id="panel-b" role="tabpanel" data-state="inactive">B panel</div><div id="region-a" role="region" data-state="closed">Hidden FAQ</div></body></html>`);
});

await new Promise((resolve) => server.listen(4318, resolve));

const session = await captureUrlSession({
  url: 'http://127.0.0.1:4318/',
  authCookies: [],
  captureDepth: 'balanced',
});

const routes = await discoverRoutesFromCapture(session, {
  sitemapUrl: 'http://127.0.0.1:4318/sitemap.xml',
  routeSeeds: ['/special/'],
  bundleInspection: true,
});

const interactions = await exploreInteractiveStates(session);

assert.ok(routes.some((route) => route.path === '/pricing/'));
assert.ok(routes.some((route) => route.path === '/contact/'));
assert.ok(routes.some((route) => route.path === '/special/'));
assert.ok(routes.some((route) => route.path === '/from-bundle/'));
assert.ok(interactions.tabPanels.some((panel) => panel.panelId === 'panel-b'));
assert.ok(interactions.accordionRegions.some((region) => region.id === 'region-a'));

await disposeUrlSession(session);
server.close();

console.log('[PASS] URL capture discovery and interaction exploration');
