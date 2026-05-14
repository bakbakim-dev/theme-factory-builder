import type {
  SaasIntakeSource,
  SaasLaneSuitability,
  SaasOutputLane,
  SaasRouteInput,
  SaasSiteAnalysis,
} from './types.js';

const ALL_LANES: SaasOutputLane[] = ['gutenberg-native', 'wordpress-elementor', 'static-site'];

const normalizeHint = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '-');

const classifyRoute = (route: SaasRouteInput): string => {
  const path = route.path.toLowerCase();
  const title = route.title.toLowerCase();
  const hints = (route.widgetHints || []).map(normalizeHint);

  if (path === '/' || path === '/home/' || title === 'home') return 'home';
  if (path.includes('pricing') || title.includes('pricing') || hints.includes('pricing')) return 'pricing';
  if (path.includes('blog') || title.includes('blog') || hints.includes('post-list')) return 'blog';
  if (path.includes('contact') || title.includes('contact') || route.hasForms) return 'contact';
  if (path.includes('location') || title.includes('location')) return 'location';
  if (path.includes('service') || title.includes('service')) return 'service';
  return 'content';
};

const increment = (record: Record<string, number>, key: string): void => {
  record[key] = (record[key] || 0) + 1;
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort();

const buildRiskFlags = (intake: SaasIntakeSource, sectionSignals: string[]): string[] => {
  const risks: string[] = [];
  const scriptRoutes = intake.routes.filter((route) => route.hasScripts).length;
  const jsBytes = intake.assets
    .filter((asset) => asset.kind === 'js')
    .reduce((total, asset) => total + (asset.bytes || 0), 0);

  if (scriptRoutes > 0 || jsBytes > 150000) risks.push('client-side-scripts');
  if (sectionSignals.includes('testimonial-carousel') || sectionSignals.includes('carousel')) risks.push('interactive-carousel');
  if (sectionSignals.includes('tabs')) risks.push('tabbed-content');
  if (sectionSignals.includes('map') || sectionSignals.includes('embed')) risks.push('third-party-embed');
  if (intake.routes.some((route) => (route.sectionCount || 0) > 14)) risks.push('long-page-rhythm');
  return uniqueSorted(risks);
};

const suitability = (
  lane: SaasOutputLane,
  risks: string[],
  sectionSignals: string[],
  routeCount: number
): SaasLaneSuitability => {
  const reasons: string[] = [];
  let status: SaasLaneSuitability['status'] = 'ready';

  if (lane === 'wordpress-elementor') {
    if (risks.includes('client-side-scripts') || risks.includes('interactive-carousel') || sectionSignals.includes('tabs')) {
      status = 'review';
      reasons.push('Elementor output needs interaction hydration and editability scoring for scripted or carousel sections.');
    }
    if (sectionSignals.includes('canvas') || sectionSignals.includes('webgl')) {
      status = 'blocked';
      reasons.push('Canvas/WebGL sections require custom widget support before native Elementor export.');
    }
  }

  if (lane === 'gutenberg-native') {
    if (sectionSignals.includes('canvas') || sectionSignals.includes('webgl')) {
      status = 'review';
      reasons.push('Opaque interactive sections may need HTML fallback blocks.');
    }
  }

  if (lane === 'static-site') {
    if (routeCount === 0) {
      status = 'blocked';
      reasons.push('Static output requires at least one route.');
    }
  }

  if (reasons.length === 0) reasons.push('No blocking issues detected for this lane.');
  return { status, reasons };
};

export const analyzeSaasIntake = (intake: SaasIntakeSource): SaasSiteAnalysis => {
  const pageArchetypes: Record<string, number> = {};
  const sectionSignals = uniqueSorted(intake.routes.flatMap((route) => (route.widgetHints || []).map(normalizeHint)));
  const riskFlags = buildRiskFlags(intake, sectionSignals);
  const routeCount = intake.routes.length;
  const assetCount = intake.assets.length;

  for (const route of intake.routes) {
    increment(pageArchetypes, classifyRoute(route));
  }

  const laneSuitability = ALL_LANES.reduce((record, lane) => {
    record[lane] = suitability(lane, riskFlags, sectionSignals, routeCount);
    return record;
  }, {} as Record<SaasOutputLane, SaasLaneSuitability>);

  return {
    intakeId: intake.id,
    routeCount,
    assetCount,
    totalHtmlBytes: intake.routes.reduce((total, route) => total + (route.htmlBytes || 0), 0),
    totalAssetBytes: intake.assets.reduce((total, asset) => total + (asset.bytes || 0), 0),
    pageArchetypes,
    sectionSignals,
    riskFlags,
    laneSuitability,
  };
};
