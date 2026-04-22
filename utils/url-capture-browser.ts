import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { attachNetworkRecorder, type CapturedNetworkRequest } from './url-capture-network.ts';
import type { UrlCaptureDepth } from './url-capture-types.ts';

export interface UrlCaptureSession {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    initialUrl: string;
    title: string;
    initialHtml: string;
    linkHrefs: string[];
    networkRequests: CapturedNetworkRequest[];
    captureDepth: UrlCaptureDepth;
}

export interface CaptureUrlSessionInput {
    url: string;
    authCookies: Parameters<BrowserContext['addCookies']>[0];
    captureDepth: UrlCaptureDepth;
}

export const captureUrlSession = async ({ url, authCookies, captureDepth }: CaptureUrlSessionInput): Promise<UrlCaptureSession> => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    if (authCookies.length > 0) {
        await context.addCookies(authCookies);
    }

    const page = await context.newPage();
    const networkRequests: CapturedNetworkRequest[] = [];
    attachNetworkRecorder(page, networkRequests);

    await page.goto(url, { waitUntil: 'networkidle' });

    const initialHtml = await page.content();
    const title = await page.title();
    const linkHrefs = await page.locator('a[href]').evaluateAll((nodes) => (
        nodes
            .map((node) => node.getAttribute('href') || '')
            .filter(Boolean)
    ));

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

export const disposeUrlSession = async (session: UrlCaptureSession) => {
    await session.page.close();
    await session.context.close();
    await session.browser.close();
};
