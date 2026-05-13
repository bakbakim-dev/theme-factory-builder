import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const DEFAULT_VIEWPORTS = '1440x1200,768x1200,390x1000';
const DEFAULT_THRESHOLD = 0.035;

const parseArgs = (argv) => {
  const args = {
    base: '',
    reference: '',
    paths: '',
    viewports: DEFAULT_VIEWPORTS,
    threshold: String(DEFAULT_THRESHOLD),
    maxPages: '120',
    waitMs: '800',
    out: path.join('logs', 'elementor-visual-parity-' + Date.now()),
    live: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--live') {
      args.live = true;
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    args[key] = argv[i + 1] || '';
    i += 1;
  }

  return args;
};

const normalizeOrigin = (value) => value ? new URL(value).origin : '';
const normalizePathname = (value) => {
  if (!value) return '/';
  const parsed = value.startsWith('http') ? new URL(value) : new URL(value, 'https://example.test');
  const pathname = parsed.pathname || '/';
  return pathname.endsWith('/') ? pathname : pathname + '/';
};

const parseViewports = (value) => value.split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => {
    const match = item.match(/^(\d+)x(\d+)$/);
    if (!match) throw new Error(`Invalid viewport "${item}". Use WIDTHxHEIGHT.`);
    return { width: Number(match[1]), height: Number(match[2]), label: item };
  });

const discoverPaths = async (browser, origin, maxPages) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const queue = ['/'];
  const seen = new Set();
  const paths = [];

  while (queue.length && paths.length < maxPages) {
    const currentPath = queue.shift();
    if (!currentPath || seen.has(currentPath)) continue;
    seen.add(currentPath);

    try {
      const response = await page.goto(origin + currentPath, { waitUntil: 'networkidle', timeout: 45000 });
      const status = response ? response.status() : 0;
      if (status >= 400) continue;
      paths.push(normalizePathname(page.url()));

      const links = await page.evaluate((sameOrigin) => Array.from(document.querySelectorAll('a[href]'))
        .map((anchor) => anchor.href)
        .filter((href) => {
          try {
            const url = new URL(href);
            return url.origin === sameOrigin && !url.hash && !/\.(jpg|jpeg|png|webp|gif|svg|pdf|zip)$/i.test(url.pathname);
          } catch {
            return false;
          }
        })
        .map((href) => new URL(href).pathname)
        .map((pathname) => (pathname.endsWith('/') ? pathname : pathname + '/')), origin);

      for (const linkPath of links) {
        if (!seen.has(linkPath) && !queue.includes(linkPath) && paths.length + queue.length < maxPages * 2) {
          queue.push(linkPath);
        }
      }
    } catch {
      // Keep crawling; individual page failures are recorded during capture.
    }
  }

  await context.close();
  return Array.from(new Set(paths));
};

const readPng = (buffer) => PNG.sync.read(buffer);

const isEffectivelyBlankPng = (image) => {
  const totalPixels = image.width * image.height;
  if (!totalPixels) return true;

  let nonWhitePixels = 0;
  const stride = 4;
  for (let index = 0; index < image.data.length; index += stride) {
    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const alpha = image.data[index + 3];
    if (alpha > 16 && (red < 248 || green < 248 || blue < 248)) {
      nonWhitePixels += 1;
    }
  }

  return nonWhitePixels / totalPixels < 0.001;
};

const scrollPageForLazyAssets = async (page) => {
  await page.evaluate(async () => {
    const waitForImages = async () => {
      await Promise.all(Array.from(document.images).map((img) => {
        img.setAttribute('loading', 'eager');
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          window.setTimeout(done, 3000);
        });
      }));

      await Promise.all(Array.from(document.images).map((img) => {
        if (img.complete && img.naturalWidth > 0 && typeof img.decode === 'function') {
          return img.decode().catch(() => undefined);
        }
        return Promise.resolve();
      }));
    };

    await waitForImages();
    await new Promise((resolve) => {
      let y = 0;
      const step = Math.max(250, Math.floor(window.innerHeight * 0.75));
      const maxScroll = () => Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
      ) - window.innerHeight;

      const tick = () => {
        y += step;
        window.scrollTo(0, y);
        if (y < maxScroll()) {
          window.setTimeout(tick, 60);
          return;
        }
        window.scrollTo(0, 0);
        window.setTimeout(resolve, 300);
      };

      tick();
    });
    await waitForImages();
  });
};

const paddedPng = (source, width, height) => {
  const image = new PNG({ width, height });
  image.data.fill(255);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (source.width * y + x) << 2;
      const targetIndex = (width * y + x) << 2;
      image.data[targetIndex] = source.data[sourceIndex];
      image.data[targetIndex + 1] = source.data[sourceIndex + 1];
      image.data[targetIndex + 2] = source.data[sourceIndex + 2];
      image.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return image;
};

const safeName = (pathname, viewport) => {
  const slug = pathname === '/' ? 'home' : pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `${slug || 'home'}-${viewport.label}`;
};

const captureScreenshot = async (browser, url, viewport, waitMs) => {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  let status = 0;
  let finalUrl = url;
  let screenshot = null;
  let error = '';

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    status = response ? response.status() : 0;
    finalUrl = page.url();
    await page.waitForTimeout(waitMs);
    await scrollPageForLazyAssets(page);
    screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  await context.close();
  return { status, finalUrl, screenshot, error };
};

const comparePair = async ({ browser, baseOrigin, referenceOrigin, pathname, viewport, outDir, threshold, waitMs }) => {
  const base = await captureScreenshot(browser, baseOrigin + pathname, viewport, waitMs);
  const reference = await captureScreenshot(browser, referenceOrigin + pathname, viewport, waitMs);
  const name = safeName(pathname, viewport);

  if (!base.screenshot || !reference.screenshot) {
    return {
      pathname,
      viewport: viewport.label,
      status: 'capture-failed',
      baseStatus: base.status,
      referenceStatus: reference.status,
      baseFinalUrl: base.finalUrl,
      referenceFinalUrl: reference.finalUrl,
      error: base.error || reference.error,
      mismatchRatio: 1,
      pass: false,
    };
  }

  const baseImage = readPng(base.screenshot);
  const referenceImage = readPng(reference.screenshot);
  const baseBlank = isEffectivelyBlankPng(baseImage);
  const referenceBlank = isEffectivelyBlankPng(referenceImage);
  const width = Math.max(baseImage.width, referenceImage.width);
  const height = Math.max(baseImage.height, referenceImage.height);

  await fs.writeFile(path.join(outDir, `${name}-base.png`), base.screenshot);
  await fs.writeFile(path.join(outDir, `${name}-reference.png`), reference.screenshot);

  if (referenceBlank && !baseBlank) {
    return {
      pathname,
      viewport: viewport.label,
      status: 'reference-blank',
      baseStatus: base.status,
      referenceStatus: reference.status,
      baseFinalUrl: base.finalUrl,
      referenceFinalUrl: reference.finalUrl,
      dimensions: { width, height, base: { width: baseImage.width, height: baseImage.height }, reference: { width: referenceImage.width, height: referenceImage.height } },
      mismatchedPixels: 0,
      mismatchRatio: 0,
      pass: true,
    };
  }

  const basePadded = paddedPng(baseImage, width, height);
  const referencePadded = paddedPng(referenceImage, width, height);
  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(basePadded.data, referencePadded.data, diff.data, width, height, { threshold: 0.12 });
  const mismatchRatio = mismatchedPixels / (width * height);

  await fs.writeFile(path.join(outDir, `${name}-diff.png`), PNG.sync.write(diff));

  return {
    pathname,
    viewport: viewport.label,
    status: 'compared',
    baseStatus: base.status,
    referenceStatus: reference.status,
    baseFinalUrl: base.finalUrl,
    referenceFinalUrl: reference.finalUrl,
    dimensions: { width, height, base: { width: baseImage.width, height: baseImage.height }, reference: { width: referenceImage.width, height: referenceImage.height } },
    mismatchedPixels,
    mismatchRatio,
    pass: base.status < 400 && reference.status < 400 && mismatchRatio <= threshold,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseOrigin = normalizeOrigin(args.base);
  const referenceOrigin = normalizeOrigin(args.reference);

  if (!args.live && (!baseOrigin || !referenceOrigin)) {
    console.log('Elementor visual parity harness is installed. Run with --live --base <url> --reference <url>.');
    return;
  }

  assert.ok(baseOrigin, 'Missing --base URL.');
  assert.ok(referenceOrigin, 'Missing --reference URL.');

  const viewports = parseViewports(args.viewports);
  const threshold = Number(args.threshold);
  const maxPages = Number(args.maxPages);
  const waitMs = Number(args.waitMs);
  const outDir = path.resolve(args.out);
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const explicitPaths = args.paths
    ? args.paths.split(',').map((item) => normalizePathname(item.trim())).filter(Boolean)
    : [];
  const discovered = explicitPaths.length
    ? explicitPaths
    : Array.from(new Set([
      ...await discoverPaths(browser, referenceOrigin, maxPages),
      ...await discoverPaths(browser, baseOrigin, maxPages),
    ])).slice(0, maxPages);

  const results = [];
  for (const pathname of discovered) {
    for (const viewport of viewports) {
      results.push(await comparePair({ browser, baseOrigin, referenceOrigin, pathname, viewport, outDir, threshold, waitMs }));
    }
  }
  await browser.close();

  const failures = results.filter((result) => !result.pass);
  const blankReferenceCount = results.filter((result) => result.status === 'reference-blank').length;
  const summary = {
    baseOrigin,
    referenceOrigin,
    threshold,
    viewports: viewports.map((viewport) => viewport.label),
    pageCount: discovered.length,
    comparisonCount: results.length,
    failureCount: failures.length,
    blankReferenceCount,
    outputDirectory: outDir,
    failures,
    results,
  };

  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    pageCount: summary.pageCount,
    comparisonCount: summary.comparisonCount,
    failureCount: summary.failureCount,
    outputDirectory: summary.outputDirectory,
    topFailures: failures.slice(0, 10).map((failure) => ({
      pathname: failure.pathname,
      viewport: failure.viewport,
      mismatchRatio: Number(failure.mismatchRatio.toFixed(4)),
      baseStatus: failure.baseStatus,
      referenceStatus: failure.referenceStatus,
    })),
  }, null, 2));

  assert.equal(failures.length, 0, `Elementor visual parity failed for ${failures.length} comparison(s). See ${path.join(outDir, 'summary.json')}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
