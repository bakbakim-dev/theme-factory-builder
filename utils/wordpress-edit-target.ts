export type WordPressEditableEntityKind = 'page-block' | 'global-chrome';
export type WordPressEditableEntitySource =
  | 'wordpress-post'
  | 'wordpress-global'
  | 'wordpress-shared'
  | 'wordpress-media'
  | 'wordpress-theme';

export interface WordPressEditTargetIdentity {
  postId?: number;
  scope?: string;
  treePathKey?: string;
  stableId?: string;
}

export interface WordPressEditTargetV2 {
  version: '2';
  entityKind: WordPressEditableEntityKind;
  entitySource: WordPressEditableEntitySource;
  stableId: string;
  targetId: string;
  identity: WordPressEditTargetIdentity;
  blockName?: string;
  treePath?: string[];
  field: string;
  fieldType: string;
  mediaId?: string;
  mediaSourceHash?: string;
  revisionToken?: string;
  sourceHash?: string;
  context?: Record<string, string>;
}

export interface CreateWordPressPageBlockEditTargetInput {
  postId: number;
  blockName: string;
  treePath: Array<number | string>;
  field: string;
  fieldType: string;
  mediaId?: string;
  mediaSourceHash?: string;
  revisionToken?: string;
  sourceHash?: string;
  context?: Record<string, string>;
}

export interface CreateWordPressGlobalChromeEditTargetInput {
  scope: string;
  field: string;
  fieldType: string;
  revisionToken?: string;
  sourceHash?: string;
  context?: Record<string, string>;
}

export interface LegacyWordPressBlockLocatorInput {
  postId: number;
  blockName: string;
  blockPath: string;
  field: string;
  revision?: string;
  sourceHash?: string;
  fieldType?: string;
  context?: Record<string, string>;
}

const normalizeNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const normalizePostId = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('identity.postId must be a positive integer');
  }

  return value;
};

const normalizeTreePath = (treePath: Array<number | string> | undefined): string[] | undefined => {
  if (!treePath) return undefined;
  if (!Array.isArray(treePath) || treePath.length === 0) {
    throw new Error('treePath must be a non-empty array when provided');
  }

  return treePath.map((segment) => {
    if (typeof segment === 'number') {
      if (!Number.isInteger(segment) || segment < 0) {
        throw new Error('treePath segments must be non-negative integers or strings');
      }
      return String(segment);
    }

    return normalizeNonEmptyString(segment, 'treePath segment');
  });
};

const normalizeContext = (context: Record<string, string> | undefined): Record<string, string> | undefined => {
  if (!context) return undefined;

  const entries = Object.entries(context)
    .map(([key, value]) => [normalizeNonEmptyString(key, 'context key'), normalizeNonEmptyString(value, `context.${key}`)] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return entries.length ? Object.fromEntries(entries) : undefined;
};

const buildTargetId = (
  entityKind: WordPressEditableEntityKind,
  identity: WordPressEditTargetIdentity,
  field: string,
): string => {
  if (entityKind === 'page-block') {
    return `page-block:${identity.postId}:${identity.treePathKey}:${field}`;
  }

  return `global-chrome:${identity.scope}:${field}`;
};

const buildStableId = (
  entityKind: WordPressEditableEntityKind,
  identity: WordPressEditTargetIdentity,
): string => {
  if (entityKind === 'page-block') {
    return `page-block:${identity.postId}:${identity.treePathKey}`;
  }

  return `global-chrome:${identity.scope}`;
};

export const normalizeWordPressEditTarget = (
  input: Omit<WordPressEditTargetV2, 'version' | 'targetId'> & {
    version?: '2';
    targetId?: string;
  },
): WordPressEditTargetV2 => {
  const entityKind = input.entityKind === 'global-chrome' ? 'global-chrome' : 'page-block';
  const entitySource = normalizeNonEmptyString(input.entitySource, 'entitySource') as WordPressEditableEntitySource;
  const field = normalizeNonEmptyString(input.field, 'field');
  const fieldType = normalizeNonEmptyString(input.fieldType, 'fieldType');
  const revisionToken = normalizeOptionalString(input.revisionToken);
  const sourceHash = normalizeOptionalString(input.sourceHash);
  const mediaSourceHash = normalizeOptionalString(input.mediaSourceHash);

  if (!revisionToken && !sourceHash) {
    throw new Error('revisionToken or sourceHash is required');
  }

  const normalizedIdentity: WordPressEditTargetIdentity = {};
  let blockName: string | undefined;
  let treePath: string[] | undefined;

  if (entityKind === 'page-block') {
    normalizedIdentity.postId = normalizePostId(input.identity?.postId);
    blockName = normalizeNonEmptyString(input.blockName, 'blockName');
    treePath = normalizeTreePath(input.treePath || (input.identity?.treePathKey ? input.identity.treePathKey.split('.') : undefined));
    if (!treePath) {
      throw new Error('treePath is required for page-block targets');
    }
    normalizedIdentity.treePathKey = treePath.join('.');
  } else {
    normalizedIdentity.scope = normalizeNonEmptyString(input.identity?.scope, 'identity.scope');
  }

  const targetId = buildTargetId(entityKind, normalizedIdentity, field);
  const stableId = buildStableId(entityKind, normalizedIdentity);
  normalizedIdentity.stableId = stableId;
  const context = normalizeContext(input.context);

  return {
    version: '2',
    entityKind,
    entitySource,
    stableId,
    targetId,
    identity: normalizedIdentity,
    ...(blockName ? { blockName } : {}),
    ...(treePath ? { treePath } : {}),
    field,
    fieldType,
    ...(input.mediaId ? { mediaId: normalizeOptionalString(input.mediaId) } : {}),
    ...(mediaSourceHash ? { mediaSourceHash } : {}),
    ...(revisionToken ? { revisionToken } : {}),
    ...(sourceHash ? { sourceHash } : {}),
    ...(context ? { context } : {}),
  };
};

export const createWordPressPageBlockEditTarget = (
  input: CreateWordPressPageBlockEditTargetInput,
): WordPressEditTargetV2 =>
  normalizeWordPressEditTarget({
    entityKind: 'page-block',
    entitySource: 'wordpress-post',
    identity: {
      postId: input.postId,
    },
    blockName: input.blockName,
    treePath: input.treePath,
    field: input.field,
    fieldType: input.fieldType,
    mediaId: input.mediaId,
    mediaSourceHash: input.mediaSourceHash,
    revisionToken: input.revisionToken,
    sourceHash: input.sourceHash,
    context: input.context,
  });

export const createWordPressGlobalChromeEditTarget = (
  input: CreateWordPressGlobalChromeEditTargetInput,
): WordPressEditTargetV2 =>
  normalizeWordPressEditTarget({
    entityKind: 'global-chrome',
    entitySource: 'wordpress-global',
    identity: {
      scope: input.scope,
    },
    field: input.field,
    fieldType: input.fieldType,
    revisionToken: input.revisionToken,
    sourceHash: input.sourceHash,
    context: input.context,
  });

export const createWordPressEditTargetFromLegacyBlockLocator = (
  input: LegacyWordPressBlockLocatorInput,
): WordPressEditTargetV2 =>
  createWordPressPageBlockEditTarget({
    postId: input.postId,
    blockName: input.blockName,
    treePath: normalizeNonEmptyString(input.blockPath, 'blockPath').split('.'),
    field: input.field,
    fieldType: input.fieldType || 'text',
    revisionToken: input.revision,
    sourceHash: input.sourceHash,
    context: input.context,
  });

export const sortWordPressEditTargets = (targets: WordPressEditTargetV2[]): WordPressEditTargetV2[] =>
  [...targets].sort((left, right) => left.targetId.localeCompare(right.targetId));
