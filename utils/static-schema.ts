import type { RouteInfo } from '../types.ts';
import { buildPageDescription, buildRouteTitle, ensureRoutePath, escapeJsonForHtml, resolveAddressCountry, slugToLabel, splitCsv, toAbsoluteMediaUrl, toAbsoluteUrl } from './static-common.ts';
import type { StaticSeoSettings, StaticSiteSettings } from './static-types.ts';
import { hasSufficientBusinessEntity } from './static-validation.ts';

const pruneSchemaValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const next = value
            .map(item => pruneSchemaValue(item))
            .filter(item => item !== undefined);
        return next.length ? next : undefined;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .map(([key, entryValue]) => [key, pruneSchemaValue(entryValue)] as const)
            .filter(([, entryValue]) => entryValue !== undefined);
        return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return value;
};

const finalizeSchema = <T extends Record<string, unknown>>(schema: T): T | null => {
    const pruned = pruneSchemaValue(schema);
    return (pruned && typeof pruned === 'object') ? pruned as T : null;
};

const extractFaqPairs = (html: string): Array<{ question: string; answer: string }> => {
    const entries: Array<{ question: string; answer: string }> = [];
    const detailsRegex = /<details\b[^>]*>[\s\S]*?<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
    let match: RegExpExecArray | null;
    while ((match = detailsRegex.exec(html || ''))) {
        const question = (match[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const answer = (match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (question && answer) {
            entries.push({ question, answer });
        }
    }
    return entries;
};

const buildWebSiteSchema = (baseUrl: string, seoSettings: StaticSeoSettings) => finalizeSchema({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${toAbsoluteUrl(baseUrl, '/')}#website`,
    url: toAbsoluteUrl(baseUrl, '/'),
    name: seoSettings.companyName || 'Website',
    description: seoSettings.description || '',
});

const buildBreadcrumbSchema = (baseUrl: string, route: RouteInfo) => {
    const path = ensureRoutePath(route.path);
    const segments = path === '/' ? [] : path.replace(/^\/|\/$/g, '').split('/');
    const itemListElement: Array<Record<string, unknown>> = [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: toAbsoluteUrl(baseUrl, '/'),
        },
    ];

    if (!segments.length) {
        return finalizeSchema({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement,
        });
    }

    segments.forEach((segment, index) => {
        const crumbPath = `/${segments.slice(0, index + 1).join('/')}/`;
        const isLast = index === segments.length - 1;
        itemListElement.push({
            '@type': 'ListItem',
            position: index + 2,
            name: isLast ? (route.title || slugToLabel(route.slug || segment)) : slugToLabel(segment),
            item: toAbsoluteUrl(baseUrl, crumbPath),
        });
    });

    return finalizeSchema({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement,
    });
};

const buildWebPageSchema = (baseUrl: string, route: RouteInfo, seoSettings: StaticSeoSettings) => finalizeSchema({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${toAbsoluteUrl(baseUrl, route.path)}#webpage`,
    url: toAbsoluteUrl(baseUrl, route.path),
    name: buildRouteTitle(route, seoSettings),
    description: buildPageDescription(route, seoSettings),
    inLanguage: seoSettings.primaryLocale || 'en',
    isPartOf: { '@id': `${toAbsoluteUrl(baseUrl, '/')}#website` },
});

const buildLocalBusinessSchema = (baseUrl: string, route: RouteInfo, seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings) => {
    if (!hasSufficientBusinessEntity(seoSettings)) return null;
    const serviceAreas = splitCsv(staticSiteSettings.serviceAreas);
    const addressCountry = resolveAddressCountry(seoSettings);
    const sameAs = [
        seoSettings.socialFacebook,
        seoSettings.socialInstagram,
        seoSettings.socialTwitter,
        seoSettings.socialLinkedIn,
    ].filter(Boolean);
    const geo = staticSiteSettings.latitude && staticSiteSettings.longitude
        ? {
            '@type': 'GeoCoordinates',
            latitude: staticSiteSettings.latitude,
            longitude: staticSiteSettings.longitude,
        }
        : undefined;

    return finalizeSchema({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': `${toAbsoluteUrl(baseUrl, route.path)}#localbusiness`,
        name: seoSettings.companyName,
        url: toAbsoluteUrl(baseUrl, route.path),
        telephone: seoSettings.telephone,
        description: buildPageDescription(route, seoSettings),
        priceRange: seoSettings.priceRange,
        image: toAbsoluteMediaUrl(baseUrl, seoSettings.ogImage),
        logo: toAbsoluteMediaUrl(baseUrl, seoSettings.ogImage),
        sameAs,
        areaServed: serviceAreas.map(area => ({ '@type': 'AdministrativeArea', name: area })),
        address: {
            '@type': 'PostalAddress',
            addressLocality: seoSettings.addressLocality,
            addressRegion: seoSettings.addressRegion,
            addressCountry,
        },
        geo,
    });
};

const buildServiceSchema = (baseUrl: string, route: RouteInfo, seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings) => {
    if (!hasSufficientBusinessEntity(seoSettings)) return null;
    const serviceAreas = splitCsv(staticSiteSettings.serviceAreas);
    const addressCountry = resolveAddressCountry(seoSettings);
    const serviceName = route.path === '/' ? `${seoSettings.companyName} Services` : route.title || slugToLabel(route.slug || route.path);
    return finalizeSchema({
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${toAbsoluteUrl(baseUrl, route.path)}#service`,
        serviceType: serviceName,
        name: serviceName,
        description: buildPageDescription(route, seoSettings),
        url: toAbsoluteUrl(baseUrl, route.path),
        areaServed: serviceAreas.map(area => ({ '@type': 'AdministrativeArea', name: area })),
        provider: {
            '@type': 'LocalBusiness',
            name: seoSettings.companyName,
            telephone: seoSettings.telephone,
            address: {
                '@type': 'PostalAddress',
                addressLocality: seoSettings.addressLocality,
                addressRegion: seoSettings.addressRegion,
                addressCountry,
            },
        },
    });
};

const buildFaqSchema = (html: string) => {
    const items = extractFaqPairs(html);
    if (!items.length) return null;
    return finalizeSchema({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(item => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    });
};

export const buildSchemaScripts = (baseUrl: string, route: RouteInfo, html: string, seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings): string => {
    const schemas: any[] = [
        buildWebSiteSchema(baseUrl, seoSettings),
        buildBreadcrumbSchema(baseUrl, route),
        buildWebPageSchema(baseUrl, route, seoSettings),
        buildLocalBusinessSchema(baseUrl, route, seoSettings, staticSiteSettings),
        buildServiceSchema(baseUrl, route, seoSettings, staticSiteSettings),
    ];
    const faqSchema = buildFaqSchema(html);
    if (faqSchema) schemas.push(faqSchema);

    return schemas
        .filter(Boolean)
        .map(schema => `<script type="application/ld+json">\n${escapeJsonForHtml(schema)}\n</script>`)
        .join('\n');
};
