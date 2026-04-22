import type { Page } from '@playwright/test';

export interface CapturedNetworkRequest {
    url: string;
    method: string;
    resourceType: string;
    status: number | null;
}

export const attachNetworkRecorder = (page: Page, requests: CapturedNetworkRequest[]) => {
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
