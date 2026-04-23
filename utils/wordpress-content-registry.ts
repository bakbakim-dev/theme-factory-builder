import type { GeneratedFormManifestEntry } from './converter.ts';
import type { WhipifyQuickEditorSlotSupport } from './whipifyQuickEditor.ts';
import { buildWhipifyFrontendEditorSupportMap, type WhipifyFrontendEditorSupportMap } from './whipifyFrontendEditor.ts';
import type { RouteInfo } from '../types.ts';

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

export interface WordPressContentRegistryReport {
  routes: number;
  chromeVariants: number;
  forms: number;
  editors: number;
  warnings?: string[];
  emittedFiles?: string[];
}

export interface WordPressContentRegistryV1 {
  version: '1';
  routes: WordPressContentRegistryRoute[];
  chrome: WordPressContentRegistryChromeEntry[];
  forms: WordPressContentRegistryFormEntry[];
  editors: WordPressContentRegistryEditorEntry[];
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

export const createEmptyWordPressContentRegistry = (): WordPressContentRegistryV1 => ({
  version: '1',
  routes: [],
  chrome: [],
  forms: [],
  editors: [],
  report: {
    routes: 0,
    chromeVariants: 0,
    forms: 0,
    editors: 0,
  },
});

export const appendWordPressContentRegistryRoute = (
  registry: WordPressContentRegistryV1,
  route: WordPressContentRegistryRoute,
): WordPressContentRegistryV1 => {
  registry.routes.push({ ...route });
  return registry;
};

export const appendWordPressContentRegistryChrome = (
  registry: WordPressContentRegistryV1,
  chrome: WordPressContentRegistryChromeEntry,
): WordPressContentRegistryV1 => {
  registry.chrome.push({
    ...chrome,
    support: finalizeChromeSupport(chrome.support),
  });
  return registry;
};

export const appendWordPressContentRegistryForm = (
  registry: WordPressContentRegistryV1,
  form: WordPressContentRegistryFormEntry,
): WordPressContentRegistryV1 => {
  registry.forms.push({
    ...form,
    fields: [...form.fields],
  });
  return registry;
};

export const appendWordPressContentRegistryEditor = (
  registry: WordPressContentRegistryV1,
  editor: WordPressContentRegistryEditorEntry,
): WordPressContentRegistryV1 => {
  registry.editors.push({
    ...editor,
    supportMap: finalizeEditorSupportMap(editor.supportMap),
    assetFiles: editor.assetFiles ? uniqueSorted(editor.assetFiles) : undefined,
  });
  return registry;
};

export const appendWordPressContentRegistryReport = (
  registry: WordPressContentRegistryV1,
  report: Partial<WordPressContentRegistryReport>,
): WordPressContentRegistryV1 => {
  registry.report = {
    ...registry.report,
    ...report,
    warnings: report.warnings ? uniqueSorted(report.warnings) : registry.report.warnings,
    emittedFiles: report.emittedFiles ? uniqueSorted(report.emittedFiles) : registry.report.emittedFiles,
  };
  return registry;
};

export const finalizeWordPressContentRegistry = (
  registry: WordPressContentRegistryV1,
): WordPressContentRegistryV1 => ({
  version: '1',
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
  report: {
    ...registry.report,
    routes: registry.routes.length,
    chromeVariants: registry.chrome.length,
    forms: registry.forms.length,
    editors: registry.editors.length,
    warnings: registry.report.warnings ? uniqueSorted(registry.report.warnings) : undefined,
    emittedFiles: registry.report.emittedFiles ? uniqueSorted(registry.report.emittedFiles) : undefined,
  },
});

export const deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry = (
  registry: WordPressContentRegistryV1,
): WhipifyQuickEditorSlotSupport => {
  const fallbackGlobalChrome = registry.editors.find((entry) => entry.supportMap)?.supportMap?.globalChrome;

  return {
    header: uniqueSorted([
      ...registry.chrome.flatMap((entry) => entry.support?.header || []),
      ...(fallbackGlobalChrome?.header || []),
    ]),
    footer: uniqueSorted([
      ...registry.chrome.flatMap((entry) => entry.support?.footer || []),
      ...(fallbackGlobalChrome?.footer || []),
    ]),
    social: uniqueSorted([
      ...registry.chrome.flatMap((entry) => entry.support?.social || []),
      ...(fallbackGlobalChrome?.social || []),
    ]),
  };
};

export const buildWhipifyFrontendEditorSupportMapFromWordPressContentRegistry = (
  registry: WordPressContentRegistryV1,
): WhipifyFrontendEditorSupportMap => {
  const globalChrome = deriveWhipifyQuickEditorSlotSupportFromWordPressContentRegistry(registry);
  const preferredEditorSupportMap = registry.editors.find((entry) => entry.kind === 'frontend' && entry.supportMap)?.supportMap
    || registry.editors.find((entry) => entry.supportMap)?.supportMap;

  return {
    ...buildWhipifyFrontendEditorSupportMap({
      hasHeaderSlots: globalChrome.header,
      hasFooterSlots: globalChrome.footer,
      hasSocialSlots: globalChrome.social,
    }),
    ...(preferredEditorSupportMap
      ? {
        globalChrome: {
          header: uniqueSorted(preferredEditorSupportMap.globalChrome?.header || globalChrome.header),
          footer: uniqueSorted(preferredEditorSupportMap.globalChrome?.footer || globalChrome.footer),
          social: uniqueSorted(preferredEditorSupportMap.globalChrome?.social || globalChrome.social),
        },
        pageBlocks: Object.fromEntries(
          Object.entries(preferredEditorSupportMap.pageBlocks || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([blockName, fields]) => [blockName, uniqueSorted(fields)]),
        ),
      }
      : {}),
  };
};
