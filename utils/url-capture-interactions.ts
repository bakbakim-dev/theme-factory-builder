import type { UrlCaptureSession } from './url-capture-browser.ts';

export interface CapturedTabPanelState {
    triggerText: string;
    panelId: string;
}

export interface CapturedAccordionRegionState {
    id: string | null;
    state: string | null;
}

export interface UrlCaptureInteractionState {
    tabPanels: CapturedTabPanelState[];
    accordionRegions: CapturedAccordionRegionState[];
}

export const exploreInteractiveStates = async (session: UrlCaptureSession): Promise<UrlCaptureInteractionState> => {
    const tabPanels: CapturedTabPanelState[] = [];
    const tabs = await session.page.locator('[role="tab"]').all();

    for (const tab of tabs) {
        const panelId = await tab.getAttribute('aria-controls');
        if (!panelId) continue;

        tabPanels.push({
            triggerText: (await tab.textContent())?.trim() || '',
            panelId,
        });
    }

    const accordionRegions: CapturedAccordionRegionState[] = [];
    const regions = await session.page.locator('[role="region"]').all();

    for (const region of regions) {
        accordionRegions.push({
            id: await region.getAttribute('id'),
            state: await region.getAttribute('data-state'),
        });
    }

    return { tabPanels, accordionRegions };
};
