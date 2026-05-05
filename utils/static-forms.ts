import type { RouteInfo } from '../types.ts';
import { escapeHtml, toAbsoluteUrl } from './static-common.ts';
import type { StaticSiteSettings } from './static-types.ts';

export const rewriteStaticForms = (html: string, baseUrl: string, route: RouteInfo, staticSiteSettings: StaticSiteSettings): string => {
    const action = (() => {
        if (staticSiteSettings.formsProvider === 'custom-endpoint') return staticSiteSettings.formsEndpoint.trim();
        if (staticSiteSettings.formsProvider === 'formspree') return staticSiteSettings.formsEndpoint.trim();
        return 'https://api.web3forms.com/submit';
    })();

    return (html || '').replace(/<form\b([^>]*)>/gi, (_match, attributes) => {
        const method = 'post';
        const cleanAttributes = (attributes || '')
            .replace(/\saction=(["']).*?\1/gi, '')
            .replace(/\smethod=(["']).*?\1/gi, '');
        const hiddenFields = [
            staticSiteSettings.formsProvider === 'web3forms' && staticSiteSettings.web3FormsAccessKey
                ? `<input type="hidden" name="access_key" value="${escapeHtml(staticSiteSettings.web3FormsAccessKey)}" />`
                : '',
            `<input type="hidden" name="from_name" value="${escapeHtml(staticSiteSettings.baseUrl || baseUrl)}" />`,
            `<input type="hidden" name="subject" value="${escapeHtml(`${route.title || 'Website'} lead`)}" />`,
            `<input type="hidden" name="page_url" value="${escapeHtml(toAbsoluteUrl(baseUrl, route.path))}" />`,
        ].filter(Boolean).join('');
        return `<form${cleanAttributes} action="${escapeHtml(action)}" method="${method}" data-static-form-provider="${escapeHtml(staticSiteSettings.formsProvider)}">${hiddenFields}`;
    });
};
