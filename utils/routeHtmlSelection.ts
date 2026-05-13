export interface RouteHtmlCandidate {
  path: string;
  html: string;
}

export interface ScoredRouteHtmlCandidate extends RouteHtmlCandidate {
  score: number;
}

export interface RouteAliasInput {
  path: string;
  slug: string;
}

const ensureRoutePath = (value: string): string => {
  const cleaned = (value || '/').trim();
  if (!cleaned || cleaned === '/') return '/';
  return `/${cleaned.replace(/^\/+|\/+$/g, '')}/`;
};

const slugifyPath = (value: string): string => value
  .replace(/^\/+|\/+$/g, '')
  .replace(/\/+/g, '-')
  .replace(/[^a-z0-9-]/gi, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const nestedAliasFromFlatSlug = (value: string): string => {
  const slug = slugifyPath(value);
  const parts = slug.split('-').filter(Boolean);
  if (parts.length < 2) return '';

  return ensureRoutePath(`/${parts[0]}/${parts.slice(1).join('-')}/`);
};

const stripHtmlForText = (html: string): string => html
  .replace(/<\?(?:php|=)?[\s\S]*?\?>/gi, ' ')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

const countMatches = (html: string, pattern: RegExp): number => (html.match(pattern) || []).length;

const extractMainOrBodyHtml = (html: string): string => {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1] || '';

  const rootMatch = html.match(/<div\b[^>]*id=["']root["'][^>]*>([\s\S]*?)<\/div>\s*<\/body>/i);
  if (rootMatch) return rootMatch[1] || '';

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? (bodyMatch[1] || '') : html;
};

export const scoreRouteHtmlCandidateForContent = (html: string): number => {
  if (!html || !html.trim()) return 0;

  const contentHtml = extractMainOrBodyHtml(html);
  const text = stripHtmlForText(contentHtml);
  const words = text.split(/\s+/).filter(Boolean).length;
  const h1Count = countMatches(contentHtml, /<h1\b/gi);
  const h2Count = countMatches(contentHtml, /<h2\b/gi);
  const h3Count = countMatches(contentHtml, /<h3\b/gi);
  const sectionCount = countMatches(contentHtml, /<(section|article)\b/gi);
  const linkCount = countMatches(contentHtml, /<a\b[^>]*href=/gi);
  const imageCount = countMatches(contentHtml, /<img\b/gi);
  const formCount = countMatches(contentHtml, /<(form|input|textarea|select)\b/gi);

  let score = 0;
  score += Math.min(words, 2500);
  score += h1Count * 180;
  score += h2Count * 80;
  score += h3Count * 35;
  score += sectionCount * 45;
  score += Math.min(linkCount, 120) * 4;
  score += Math.min(imageCount, 80) * 5;
  score += formCount * 30;

  if (words < 80) score -= 300;
  if (words < 150 && h1Count === 0) score -= 250;
  if (/tf-elementor-breadcrumbs|breadcrumb/i.test(contentHtml) && words < 120) score -= 120;
  if (/trust-logo|bbb accredited|chamber of commerce|google reviews/i.test(text) && words < 160) score -= 160;

  return Math.max(0, Math.round(score));
};

export const selectBestRouteHtmlCandidate = (candidates: RouteHtmlCandidate[]): ScoredRouteHtmlCandidate => {
  const scored = candidates.map((candidate) => ({
    ...candidate,
    score: scoreRouteHtmlCandidateForContent(candidate.html),
  }));

  if (scored.length === 0) {
    return { path: '', html: '', score: 0 };
  }

  return scored.reduce<ScoredRouteHtmlCandidate>(
    (best, candidate) => (candidate.score > best.score ? candidate : best),
    scored[0],
  );
};

export const buildWordPressRouteAliasPaths = (route: RouteAliasInput): string[] => {
  const aliases = new Set<string>();
  const normalizedRoutePath = ensureRoutePath(route.path);
  const routeSlug = slugifyPath(route.slug || route.path);

  if (normalizedRoutePath !== '/') {
    aliases.add(normalizedRoutePath);
  }

  const flattenedFromPath = slugifyPath(normalizedRoutePath);
  if (flattenedFromPath) {
    aliases.add(ensureRoutePath(`/${flattenedFromPath}/`));
  }

  if (routeSlug && routeSlug !== 'home' && routeSlug !== 'front-page') {
    aliases.add(ensureRoutePath(`/${routeSlug}/`));
    aliases.add(nestedAliasFromFlatSlug(routeSlug));
  }

  return Array.from(aliases).filter(Boolean);
};
