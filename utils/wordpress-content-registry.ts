import type { GeneratedFormManifestEntry } from './converter.ts';
import type { WhipifyQuickEditorSlotSupport } from './whipifyQuickEditor.ts';
import { listWhipifyQuickEditorSchemaFields } from './whipifyQuickEditor.ts';
import {
  buildWhipifyFrontendEditorSupportMap,
  listWhipifyFrontendEditorPageBlockSupport,
  type WhipifyFrontendEditorSupportMap,
} from './whipifyFrontendEditor.ts';
import type { RouteInfo } from '../types.ts';

export type WordPressContentTargetScope = 'page-block' | 'global-chrome' | 'shared-content' | 'media';
export type WordPressContentFieldType = 'plainText' | 'richText' | 'url' | 'tel' | 'mediaId' | 'imageAlt';
type WordPressChromeGroup = 'header' | 'footer' | 'social';

export interface WordPressContentRegistryRoute extends RouteInfo {
  template?: string;
  chromeContext?: string;
}

export interface WordPressContentRegistryChromeSupport {
  header: string[];
  footer: string[];
  social: string[];
}

export interface WordPressContentRegistryChromeEntry {
  context: string;
  sourceRoutePath?: string;
  headerFile?: string;
  footerFile?: string;
  support: WordPressContentRegistryChromeSupport;
}

export interface WordPressContentRegistryFormEntry extends GeneratedFormManifestEntry {
  templateFile?: string;
  blocksFile?: string;
}

export interface WordPressContentRegistryEditorEntry {
  kind: 'frontend' | 'quick';
  name: string;
  supportMap?: WhipifyFrontendEditorSupportMap;
  assetFiles?: string[];
  phpFile?: string;
}

export interface WordPressContentRegistryTarget {
  id: string;
  stableId: string;
  scope: WordPressContentTargetScope;
  field: string;
  fieldType: WordPressContentFieldType;
  provenanceLabel: string;
  sourcePath?: string;
  sourceToken?: string;
  group?: WordPressChromeGroup;
  chromeContext?: string;
  routePath?: string;
  routeSlug?: string;
  routeTitle?: string;
  blockName?: string;
  editor?: 'frontend' | 'quick';
}

export interface WordPressContentRegistryReport {
  routes: number;
  chromeVariants: number;
  forms: number;
  editors: number;
  targets: number;
  targetScopes: Record<WordPressContentTargetScope, number>;
  warnings?: string[];
  emittedFiles?: string[];
}

export interface WordPressContentRegistryV2 {
  version: '2';
  routes: WordPressContentRegistryRoute[];
  chrome: WordPressContentRegistryChromeEntry[];
  forms: WordPressContentRegistryFormEntry[];
  editors: WordPressContentRegistryEditorEntry[];
  targets: WordPressContentRegistryTarget[];
  report: WordPressContentRegistryReport;
}

const uniqueSorted = (values: string[] = []): string[] =>
  Array.from(new Set((values || []).filter(Boolean))).sort((left, right) => left.localeCompare(right));

const finalizeChromeSupport = (
  support: Partial<WordPressContentRegistryChromeSupport> | undefined,
): WordPressContentRegistryChromeSupport => ({
  header: uniqueSorted(support?.header),
  footer: uniqueSorted(support?.footer),
  social: uniqueSorted(support?.social),
});

const buildEmptyTargetScopeReport = (): Record<WordPressContentTargetScope, number> => ({
  'global-chrome': 0,
  media: 0,
  'page-block': 0,
  'shared-content': 0,
});

const finalizeEditorSupportMap = (
  supportMap: WhipifyFrontendEditorSupportMap | undefined,
): WhipifyFrontendEditorSupportMap | undefined => {
  if (!supportMap) return undefined;

  const pageBlocks = Object.fromEntries(
    Object.entries(supportMap.pageBlocks || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([blockName, fields]) => [blockName, uniqueSorted(fields)]),
  );

  return {
    globalChrome: finalizeChromeSupport(supportMap.globalChrome),
    pageBlocks,
  };
};

const normalizeQuickEditorFieldType = (
  field: string,
  kind: 'text' | 'url',
): WordPressContentFieldType => {
  if (field === 'phone') return 'tel';
  if (kind === 'url') return 'url';
  return 'plainText';
};

const normalizeFrontendFieldType = (fieldType: 'plainText' | 'richText' | 'url' | 'imageAlt'): WordPressContentFieldType =>
  fieldType === 'imageAlt' ? 'imageAlt' : fieldType;

const sortTargets = (targets: WordPressContentRegistryTarget[]): WordPressContentRegistryTarget[] =>
  [...targets]
    .map((target) => ({
      ...target,
      sourcePath: target.sourcePath || undefined,
      sourceToken: target.sourceToken || undefined,
    }))
    .sort((left, right) =>
      left.scope.localeCompare(right.scope)
      || left.stableId.localeCompare(right.stableId)
      || left.field.localeCompare(right.field));

const finalizeTargets = (targets: WordPressContentRegistryTarget[]): WordPressContentRegistryTarget[] => {
  const deduped = new Map<string, WordPressContentRegistryTarget>();

  for (const target of sortTargets(targets)) {
    const existing = deduped.get(target.stableId);
    if (!existing) {
      deduped.set(target.stableId, target);
      continue;
    }

    deduped.set(target.stableId, {
      ...existing,
      provenanceLabel: existing.provenanceLabel || target.provenanceLabel,
      sourcePath: existing.sourcePath || target.sourcePath,
      sourceToken: existing.sourceToken || target.sourceToken,
      routePath: existing.routePath || target.routePath,
      routeSlug: existing.routeSlug || target.routeSlug,
      routeTitle: existing.routeTitle || target.routeTitle,
      chromeContext: existing.chromeContext || target.chromeContext,
      editor: existing.editor || target.editor,
    });
  }

  return sortTargets(Array.from(deduped.values()));
};

const countTargetsByScope = (targets: WordPressContentRegistryTarget[]): Record<WordPressContentTargetScope, number> => {
  const counts = buildEmptyTargetScopeReport();
  for (const target of targets) {
    counts[target.scope] += 1;
  }
  return counts;
};

const createTarget = (
  target: Omit<WordPressContentRegistryTarget, 'id' | 'stableId'> & { stableId?: string },
): WordPressContentRegistryTarget => {
  const stableId = target.stableId || [
    target.scope,
    target.chromeContext,
    target.group,
    target.routePath,
    target.blockName,
    target.field,
    target.sourceToken,
  ].filter(Boolean).join(':');

  return {
    ...target,
    id: stableId,
    stableId,
  };
};

const appendTargets = (
  registry: WordPressContentRegistryV2,
  targets: WordPressContentRegistryTarget[],
): WordPressContentRegistryV2 => {
  registry.targets.push(...targets);
  return registry;
};

const buildRouteLookup = (
  registry: WordPressContentRegistryV2,
): Map<string, WordPressContentRegistryRoute> => new Map(registry.routes.map((route) => [route.path, route]));

export const createEmptyWordPressContentRegistry = (): WordPressContentRegistryV2 => ({
  version: '2',
  routes: [],
  chrome: [],
  forms: [],
  editors: [],
  targets: [],
  report: {
    routes: 0,
    chromeVariants: 0,
    forms: 0,
    editors: 0,
    targets: 0,
    targetScopes: buildEmptyTargetScopeReport(),
  },
});

export const appendWordPressContentRegistryRoute = (
  registry: WordPressContentRegistryV2,
  route: WordPressContentRegistryRoute,
): WordPressContentRegistryV2 => {
  registry.routes.push({ ...route });
  return registry;
};

export const appendWordPressContentRegistrySharedContentTargets = (
  registry: WordPressContentRegistryV2,
  input: {
    sourcePath: string;
    editor?: 'quick';
    provenanceLabel?: string;
  },
): WordPressContentRegistryV2 => appendTargets(
  registry,
  listWhipifyQuickEditorSchemaFields().map((field) => createTarget({
    scope: 'shared-content',
    field: String(field.key),
    fieldType: normalizeQuickEditorFieldType(String(field.key), field.kind),
    provenanceLabel: input.provenanceLabel || 'Quick Editor shared content schema',
    sourcePath: input.sourcePath,
    sourceToken: `quick-editor:${field.part}:${String(field.key)}`,
    group: field.part,
    editor: input.editor || 'quick',
  })),
);

export const appendWordPressContentRegistryFrontendEditorTargets = (
  registry: WordPressContentRegistryV2,
  input: {
    sourcePath: string;
    editor?: 'frontend';
    provenanceLabel?: string;
  },
): WordPressContentRegistryV2 => appendTargets(
  registry,
  listWhipifyFrontendEditorPageBlockSupport().map((field) => createTarget({
    scope: field.scope,
    field: field.field,
    fieldType: normalizeFrontendFieldType(field.fieldType),
    provenanceLabel: input.provenanceLabel || 'Frontend editor page block support',
    sourcePath: input.sourcePath,
    sourceToken: `frontend-editor:${field.blockName}:${field.field}`,
    blockName: field.blockName,
    editor: input.editor || 'frontend',
  })),
);

export const appendWordPressContentRegistryChrome = (
  registry: WordPressContentRegistryV2,
  chrome: WordPressContentRegistryChromeEntry,
): WordPressContentRegistryV2 => {
  const normalizedChrome = {
    ...chrome,
    support: finalizeChromeSupport(chrome.support),
  };
  registry.chrome.push(normalizedChrome);

  const routeLookup = buildRouteLookup(registry);
  const route = normalizedChrome.sourceRoutePath ? routeLookup.get(normalizedChrome.sourceRoutePath) : undefined;
  const targetGroups: Array<[WordPressChromeGroup, string | undefined, string[]]> = [
    ['header', normalizedChrome.headerFile, normalizedChrome.support.header],
    ['footer', normalizedChrome.footerFile, normalizedChrome.support.footer],
    ['social', normalizedChrome.footerFile || normalizedChrome.headerFile, normalizedChrome.support.social],
  ];

  return appendTargets(
    registry,
    targetGroups.flatMap(([group, sourcePath, fields]) =>
      uniqueSorted(fields).map((field) => createTarget({
        scope: 'global-chrome',
        field,
        fieldType: field === 'phone' ? 'tel' : field.includes('url') ? 'url' : 'plainText',
        provenanceLabel: `${normalizedChrome.context} ${group} chrome binding`,
        sourcePath,
        sourceToken: `chrome:${normalizedChrome.context}:${group}:${field}`,
        group,
        chromeContext: normalizedChrome.context,
        routePath: normalizedChrome.sourceRoutePath,
        routeSlug: route?.slug,
        routeTitle: route?.title,
      })),
    ),
  );
};

export const appendWordPressContentRegistryForm = (
  registry: WordPressContentRegistryV2,
  form: WordPressContentRegistryFormEntry,
): WordPressContentRegistryV2 => {
  registry.forms.push({
    ...form,
    fields: [...form.fields],
  });
  return registry;
};

export const appendWordPressContentRegistryEditor = (
  registry: WordPressContentRegistryV2,
  editor: WordPressContentRegistryEditorEntry,
): WordPressContentRegistryV2 => {
  registry.editors.push({
    ...editor,
    supportMap: finalizeEditorSupportMap(editor.supportMap),
    assetFiles: editor.assetFiles ? uniqueSorted(editor.assetFiles) : undefined,
  });
  return registry;
};

export const appendWordPressContentRegistryReport = (
  registry: WordPressContentRegistryV2,
  report: Partial<WordPressContentRegistryReport>,
): WordPressContentRegistryV2 => {
  registry.report = {
    ...registry.report,
    ...report,
    targetScopes: report.targetScopes || registry.report.targetScopes,
    warnings: report.warnings ? uniqueSorted(report.warnings) : registry.report.warnings,
    emittedFiles: report.emittedFiles ? uniqueSorted(report.emittedFiles) : registry.report.emittedFiles,
  };
  return registry;
};

export const finalizeWordPressContentRegistry = (
  registry: WordPressContentRegistryV2,
): WordPressContentRegistryV2 => {
  const finalizedTargets = finalizeTargets(registry.targets);
  return {
    version: '2',
    routes: [...registry.routes].sort((left, right) => left.path.localeCompare(right.path)),
    chrome: [...registry.chrome]
      .map((entry) => ({
        ...entry,
        support: finalizeChromeSupport(entry.support),
      }))
      .sort((left, right) => left.context.localeCompare(right.context)),
    forms: [...registry.forms].sort((left, right) => left.id.localeCompare(right.id)),
    editors: [...registry.editors]
      .map((entry) => ({
        ...entry,
        supportMap: finalizeEditorSupportMap(entry.supportMap),
        assetFiles: entry.assetFiles ? uniqueSorted(entry.assetFiles) : undefined,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    targets: finalizedTargets,
    report: {
      ...registry.report,
      routes: registry.routes.length,
      chromeVariants: registry.chrome.length,
      forms: registry.forms.length,
      editors: registry.editors.length,
      targets: finalizedTargets.length,
      targetScopes: countTargetsByScope(finalizedTargets),
      warnings: registry.report.warnings ? uniqueSorted(registry.report.warnings) : undefined,
      emittedFiles: registry.report.emittedFiles ? uniqueSorted(registry.report.emittedFiles) : undefined,
    },
  };
};

export const deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry = (
  registry: WordPressContentRegistryV2,
): WhipifyQuickEditorSlotSupport => {
  const byGroup = (group: WordPressChromeGroup): string[] => uniqueSorted(
    registry.targets
      .filter((target) =>
        (target.scope === 'global-chrome' || target.scope === 'shared-content')
        && target.group === group,
      )
      .map((target) => target.field),
  );

  return {
    header: byGroup('header'),
    footer: byGroup('footer'),
    social: byGroup('social'),
  };
};

export const buildWhipifyFrontendEditorSupportMapFromWordPressContentRegistry = (
  registry: WordPressContentRegistryV2,
): WhipifyFrontendEditorSupportMap => {
  const globalChrome = deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry(registry);
  const pageBlocks = Object.fromEntries(
    Array.from(
      registry.targets
        .filter((target) => (target.scope === 'page-block' || target.scope === 'media') && target.blockName)
        .reduce((map, target) => {
          const blockName = target.blockName as string;
          if (!map.has(blockName)) {
            map.set(blockName, new Set<string>());
          }
          map.get(blockName)?.add(target.field);
          return map;
        }, new Map<string, Set<string>>())
        .entries(),
    )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([blockName, fields]) => [blockName, uniqueSorted(Array.from(fields))]),
  );

  return {
    ...buildWhipifyFrontendEditorSupportMap({
      hasHeaderSlots: globalChrome.header,
      hasFooterSlots: globalChrome.footer,
      hasSocialSlots: globalChrome.social,
    }),
    globalChrome,
    pageBlocks,
  };
};
