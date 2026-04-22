export const extractRouteHintsFromBundleText = (bundleText: string): string[] => {
    const matches = bundleText.match(/\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\//gi) || [];
    return Array.from(new Set(matches));
};
