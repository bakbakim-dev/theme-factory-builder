import type { SaasAssetInput, SaasIntakeKind, SaasIntakeSource, SaasRouteInput } from './types.js';

export interface SaasSiteFileInput {
  path: string;
  content?: string;
  bytes?: Uint8Array;
}

export interface CreateSaasIntakeFromSiteFilesInput {
  id: string;
  label: string;
  sourceSummary: string;
  kind?: SaasIntakeKind;
  files: SaasSiteFileInput[];
}

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/^\/+/, '');

const htmlFileToRoutePath = (filePath: string): string => {
  const raw = normalizePath(filePath);
  if (/^index\.html?$/i.test(raw) || raw === '') return '/';
  const normalized = raw.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '/');
  const routePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return routePath.endsWith('/') ? routePath : `${routePath}/`;
};

const extension = (filePath: string): string => {
  const match = normalizePath(filePath).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
};

const assetKind = (filePath: string): SaasAssetInput['kind'] => {
  const ext = extension(filePath);
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'mjs') return 'js';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(ext)) return 'image';
  if (['woff', 'woff2', 'ttf', 'otf'].includes(ext)) return 'font';
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
  return 'other';
};

const stripTags = (html: string): string => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const titleFromHtml = (html: string, routePath: string): string => {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = stripTags(h1 || title || '');
  if (text) return text;
  if (routePath === '/') return 'Home';
  return routePath.replace(/^\/+|\/+$/g, '').replace(/[-/]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const widgetHintsFromHtml = (html: string, routePath: string): string[] => {
  const combined = `${routePath} ${html}`.toLowerCase();
  const hints = new Set<string>();
  if (combined.includes('hero')) hints.add('hero');
  if (combined.includes('feature')) hints.add('feature-grid');
  if (combined.includes('pricing') || combined.includes('price')) hints.add('pricing');
  if (combined.includes('testimonial') || combined.includes('review')) hints.add('testimonial-carousel');
  if (combined.includes('faq') || combined.includes('accordion')) hints.add('faq');
  if (combined.includes('role="tab"') || combined.includes("role='tab'") || combined.includes('tabs')) hints.add('tabs');
  if (combined.includes('map') || combined.includes('iframe')) hints.add('map');
  if (combined.includes('blog') || combined.includes('post')) hints.add('post-list');
  return Array.from(hints).sort();
};

const bytesForFile = (file: SaasSiteFileInput): number => {
  if (file.bytes) return file.bytes.byteLength;
  return new TextEncoder().encode(file.content || '').byteLength;
};

export const createSaasIntakeFromSiteFiles = (input: CreateSaasIntakeFromSiteFilesInput): SaasIntakeSource => {
  const routes: SaasRouteInput[] = [];
  const assets: SaasAssetInput[] = [];

  for (const file of input.files) {
    const filePath = normalizePath(file.path);
    const ext = extension(filePath);

    if (ext === 'html' || ext === 'htm') {
      const html = file.content || '';
      const routePath = htmlFileToRoutePath(filePath);
      routes.push({
        path: routePath,
        title: titleFromHtml(html, routePath),
        htmlBytes: bytesForFile(file),
        sectionCount: (html.match(/<(section|article|main)\b/gi) || []).length,
        widgetHints: widgetHintsFromHtml(html, routePath),
        hasForms: /<(form|input|textarea|select)\b/i.test(html),
        hasScripts: /<script\b/i.test(html),
      });
      continue;
    }

    assets.push({
      path: filePath.startsWith('/') ? filePath : `/${filePath}`,
      kind: assetKind(filePath),
      bytes: bytesForFile(file),
    });
  }

  return {
    id: input.id,
    kind: input.kind || 'static-zip',
    label: input.label,
    sourceSummary: input.sourceSummary,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    assets: assets.sort((a, b) => a.path.localeCompare(b.path)),
  };
};
