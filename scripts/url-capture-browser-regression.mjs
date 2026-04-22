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
