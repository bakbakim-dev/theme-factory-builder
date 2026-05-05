import type { RouteInfo } from '../types.ts';
import { ensureRoutePath } from './static-common.ts';

export const buildHeadersFile = (): string => [
    '/*',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
].join('\n');

export const buildRedirectsFile = (routes: RouteInfo[]): string => {
    const redirects = routes
        .map(route => ensureRoutePath(route.path))
        .filter(path => path !== '/')
        .map(path => {
            const withoutSlash = path.replace(/\/$/, '');
            return `${withoutSlash} ${path} 301`;
        });
    return redirects.join('\n');
};
