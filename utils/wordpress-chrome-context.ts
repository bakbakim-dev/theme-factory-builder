import type { RouteInfo } from '../types.ts';

export interface WordPressChromeContextPlan {
  contexts: string[];
  routeContextByPath: Record<string, string>;
  representativeRouteByContext: Record<string, RouteInfo>;
}

const GLOBAL_CONTEXT = 'global';

const normalizeRoutePath = (value: string): string => {
  if (!value || value === '/') return '/';
  const trimmed = value.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
};

const getPathSegments = (value: string): string[] =>
  normalizeRoutePath(value)
    .replace(/^\/|\/$/g, '')
    .split('/')
    .filter(Boolean);

const sanitizeContext = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getContextPathSuffix = (path: string, context: string): string => {
  const normalized = normalizeRoutePath(path);
  if (context === GLOBAL_CONTEXT) return normalized;
  const prefix = `/${context}/`;
  if (!normalized.startsWith(prefix)) return normalized;
  const remainder = normalized.slice(prefix.length - 1);
  return remainder === '/' ? '/' : normalizeRoutePath(remainder);
};

export const buildWordPressChromeContextPlan = (routes: RouteInfo[]): WordPressChromeContextPlan => {
  const normalizedRoutes = routes.map((route) => ({
    ...route,
    path: normalizeRoutePath(route.path),
  }));

  const nestedContextCandidates = new Set(
    normalizedRoutes
      .map((route) => getPathSegments(route.path))
      .filter((segments) => segments.length > 1)
      .map((segments) => sanitizeContext(segments[0] || ''))
      .filter(Boolean),
  );

  const routeContextByPath: Record<string, string> = {};
  for (const route of normalizedRoutes) {
    const segments = getPathSegments(route.path);
    const firstSegment = sanitizeContext(segments[0] || '');
    const context = firstSegment && nestedContextCandidates.has(firstSegment)
      ? firstSegment
      : GLOBAL_CONTEXT;
    routeContextByPath[route.path] = context;
  }

  const contexts = [
    GLOBAL_CONTEXT,
    ...Array.from(new Set(Object.values(routeContextByPath).filter((value) => value !== GLOBAL_CONTEXT))).sort(),
  ];

  const representativeRouteByContext: Record<string, RouteInfo> = {};
  for (const context of contexts) {
    const matchingRoutes = normalizedRoutes.filter((route) => routeContextByPath[route.path] === context);
    const exactContextRoot = context === GLOBAL_CONTEXT
      ? matchingRoutes.find((route) => route.path === '/')
      : matchingRoutes.find((route) => route.path === `/${context}/`);

    const fallbackRoute = [...matchingRoutes].sort((left, right) => {
      const leftSegments = getPathSegments(left.path).length;
      const rightSegments = getPathSegments(right.path).length;
      if (leftSegments !== rightSegments) return leftSegments - rightSegments;
      return left.path.localeCompare(right.path);
    })[0];

    const chosenRoute = exactContextRoot || fallbackRoute || normalizedRoutes[0];
    if (chosenRoute) {
      representativeRouteByContext[context] = chosenRoute;
    }
  }

  return {
    contexts,
    routeContextByPath,
    representativeRouteByContext,
  };
};

export const localizeWordPressChromePaths = (
  html: string,
  context: string,
  routes: RouteInfo[],
  routeContextByPath?: Record<string, string>,
): string => {
  const safeContext = sanitizeContext(context) || GLOBAL_CONTEXT;
  if (!html || safeContext === GLOBAL_CONTEXT) return html;

  const contextMap = routeContextByPath || buildWordPressChromeContextPlan(routes).routeContextByPath;
  const normalizedRoutes = routes.map((route) => ({
    ...route,
    path: normalizeRoutePath(route.path),
  }));

  const targetRoutesBySuffix = new Map<string, string>();
  normalizedRoutes.forEach((route) => {
    const routeContext = contextMap[route.path];
    if (routeContext !== safeContext) return;
    targetRoutesBySuffix.set(getContextPathSuffix(route.path, safeContext), route.path);
  });

  let rewritten = html;
  normalizedRoutes.forEach((route) => {
    const sourceContext = contextMap[route.path];
    if (!sourceContext || sourceContext === GLOBAL_CONTEXT || sourceContext === safeContext) return;
    const suffix = getContextPathSuffix(route.path, sourceContext);
    const localizedTarget = targetRoutesBySuffix.get(suffix);
    if (!localizedTarget || localizedTarget === route.path) return;
    const escapedPath = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rewritten = rewritten
      .replace(new RegExp(`href=["']${escapedPath}/?["']`, 'g'), `href="${localizedTarget}"`)
      .replace(new RegExp(`href=["']${escapedPath}#`, 'g'), `href="${localizedTarget}#`)
      .replace(new RegExp(`data-href=["']${escapedPath}/?["']`, 'g'), `data-href="${localizedTarget}"`);
  });

  return rewritten;
};

export const buildWordPressChromeSelectorPhp = (part: 'header' | 'footer'): string => {
  const safePart = part === 'footer' ? 'footer' : 'header';
  return `<?php
$tf_chrome_context = get_query_var( 'tf_chrome_context', '${GLOBAL_CONTEXT}' );
$tf_chrome_context = is_string( $tf_chrome_context ) ? sanitize_key( $tf_chrome_context ) : '${GLOBAL_CONTEXT}';
$tf_${safePart}_variant = get_template_directory() . '/partials/${safePart}-' . $tf_chrome_context . '.php';
if ( ! file_exists( $tf_${safePart}_variant ) ) {
    $tf_${safePart}_variant = get_template_directory() . '/partials/${safePart}-${GLOBAL_CONTEXT}.php';
}
if ( file_exists( $tf_${safePart}_variant ) ) {
    include $tf_${safePart}_variant;
}
?>`;
};

export const buildWordPressTemplateChromeBootstrap = (context: string): string => {
  const safeContext = sanitizeContext(context) || GLOBAL_CONTEXT;
  return `set_query_var( 'tf_chrome_context', '${safeContext}' );\n`;
};
