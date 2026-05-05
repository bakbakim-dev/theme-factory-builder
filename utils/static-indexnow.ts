export const buildIndexNowKey = (siteSlug: string, enabled: boolean): string => enabled ? `${siteSlug || 'static-site'}-indexnow` : '';
