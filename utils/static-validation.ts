import type { StaticExportWarning, StaticSeoSettings, StaticSiteSettings } from './static-types.ts';
import { resolveAddressCountry } from './static-common.ts';

const PLACEHOLDER_COMPANY = /^my company$/i;
const PLACEHOLDER_LOCALITY = /^city name$/i;
const PLACEHOLDER_TELEPHONE = /^\(?555\)?[\s-]*123[\s-]*4567$/i;
const PLACEHOLDER_DESCRIPTION = /^professional services in your area\.?$/i;

export const hasSufficientBusinessEntity = (seoSettings: StaticSeoSettings): boolean => {
    const companyName = (seoSettings.companyName || '').trim();
    const locality = (seoSettings.addressLocality || '').trim();
    const telephone = (seoSettings.telephone || '').trim();
    const description = (seoSettings.description || '').trim();

    const placeholderCompany = PLACEHOLDER_COMPANY.test(companyName);
    const placeholderLocality = PLACEHOLDER_LOCALITY.test(locality);
    const placeholderTelephone = PLACEHOLDER_TELEPHONE.test(telephone);
    const placeholderDescription = PLACEHOLDER_DESCRIPTION.test(description);

    return Boolean(companyName)
        && !placeholderCompany
        && !(placeholderLocality && placeholderTelephone && placeholderDescription);
};

export const hasGeoCoordinates = (staticSiteSettings: StaticSiteSettings): boolean =>
    Boolean((staticSiteSettings.latitude || '').trim() && (staticSiteSettings.longitude || '').trim());

export const hasServiceAreas = (staticSiteSettings: StaticSiteSettings): boolean =>
    Boolean((staticSiteSettings.serviceAreas || '').split(',').map(part => part.trim()).filter(Boolean).length);

export const hasAddressCountry = (seoSettings: StaticSeoSettings): boolean =>
    Boolean(resolveAddressCountry(seoSettings));

export const formsReady = (staticSiteSettings: StaticSiteSettings): boolean => {
    if (staticSiteSettings.formsProvider === 'web3forms') {
        return Boolean((staticSiteSettings.web3FormsAccessKey || '').trim());
    }
    return Boolean((staticSiteSettings.formsEndpoint || '').trim());
};

export const buildStaticWarnings = (seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings): StaticExportWarning[] => {
    const warnings: StaticExportWarning[] = [];

    if (!hasSufficientBusinessEntity(seoSettings)) {
        warnings.push({
            code: 'entity-placeholder',
            message: 'LocalBusiness and Service schema were suppressed because the business entity data still looks placeholder or incomplete.',
        });
    }

    const hasLat = Boolean((staticSiteSettings.latitude || '').trim());
    const hasLng = Boolean((staticSiteSettings.longitude || '').trim());
    if (!hasLat || !hasLng) {
        warnings.push({
            code: 'geo-missing',
            message: 'Latitude/longitude are missing or incomplete, so geo coordinates were omitted from local schema.',
        });
    }

    if (!hasServiceAreas(staticSiteSettings)) {
        warnings.push({
            code: 'service-areas-missing',
            message: 'No service areas were configured, so areaServed signals are limited.',
        });
    }

    if (!hasAddressCountry(seoSettings)) {
        warnings.push({
            code: 'country-missing',
            message: 'Address country is missing, so local entity signals may be weaker in structured data.',
        });
    }

    if (!formsReady(staticSiteSettings)) {
        warnings.push({
            code: 'forms-not-configured',
            message: 'Static forms are not fully configured for the selected provider, so exported forms may not submit successfully.',
        });
    }

    if (!staticSiteSettings.enableLlmsTxt) {
        warnings.push({
            code: 'llms-disabled',
            message: 'llms.txt generation is disabled, which may reduce AI entity discoverability.',
        });
    }

    return warnings;
};
