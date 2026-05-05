const PAGE_BLOCK_FIELD_SCHEMA: Record<string, Record<string, string>> = {
  'core/heading': {
    content: 'text',
  },
  'core/paragraph': {
    content: 'text',
  },
  'core/button': {
    text: 'text',
    url: 'url',
    linkTarget: 'text',
    rel: 'text',
  },
  'core/details': {
    summary: 'text',
  },
  'theme-factory/button': {
    text: 'text',
    href: 'url',
    target: 'text',
    rel: 'text',
  },
  'theme-factory/container': {
    text: 'text',
  },
  'core/image': {
    url: 'url',
    alt: 'text',
    id: 'mediaId',
    width: 'number',
    height: 'number',
  },
};

export interface WhipifyFrontendEditorParsedBlock {
  blockName?: string;
  attrs?: Record<string, unknown>;
  innerBlocks?: WhipifyFrontendEditorParsedBlock[];
  innerHTML?: string;
  innerContent?: Array<string | null>;
}

export interface WhipifyFrontendEditorPageBlockResolverTarget {
  version?: '2';
  entityKind?: 'page-block';
  entitySource?: string;
  stableId?: string;
  targetId?: string;
  identity?: {
    postId?: number;
    treePathKey?: string;
    stableId?: string;
  };
  blockName?: string;
  treePath?: Array<number | string>;
  field: string;
  fieldType?: string;
  revisionToken?: string;
  sourceHash?: string;
  mediaId?: string;
  mediaSourceHash?: string;
  action?: 'remove' | 'move-up' | 'move-down' | 'duplicate' | 'insert-paragraph';
}

export interface WhipifyFrontendEditorPageBlockSaveOperation {
  action?: 'update' | 'remove' | 'move-up' | 'move-down' | 'duplicate' | 'insert-paragraph';
  field: string;
  value: string;
  sourceHash?: string;
}

export interface WhipifyFrontendEditorPageBlockSaveAdapterResult {
  blocks: WhipifyFrontendEditorParsedBlock[];
  target: WhipifyFrontendEditorPageBlockResolverTarget;
  operations: Array<WhipifyFrontendEditorPageBlockResolverTarget>;
  action?: 'remove' | 'move-up' | 'move-down' | 'duplicate' | 'insert-paragraph';
}

const escapePhpSingleQuoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const phpString = (value: string): string => `'${escapePhpSingleQuoted(value)}'`;
const phpArray = (values: string[]): string => `array( ${values.map(phpString).join(', ')} )`;

const renderPhpAssoc = (entries: Array<[string, string]>): string => `array(
${entries
  .map(([key, value]) => `            ${phpString(key)} => ${phpString(value)}`)
  .join(',\n')}
        )`;

const renderPageBlockFieldSchema = (): string => `array(
${Object.entries(PAGE_BLOCK_FIELD_SCHEMA)
  .map(([blockName, fieldSchema]) => `            ${phpString(blockName)} => ${renderPhpAssoc(Object.entries(fieldSchema))}`)
  .join(',\n')}
        )`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeHtmlAttribute = (value: string): string => escapeHtml(value);

const cloneParsedBlocks = (blocks: WhipifyFrontendEditorParsedBlock[]): WhipifyFrontendEditorParsedBlock[] =>
  JSON.parse(JSON.stringify(blocks)) as WhipifyFrontendEditorParsedBlock[];

const getPrimaryTextFieldForBlockName = (blockName: string | undefined): string => {
  if (blockName === 'core/heading' || blockName === 'core/paragraph') {
    return 'content';
  }

  if (blockName === 'core/button' || blockName === 'theme-factory/button') {
    return 'text';
  }

  if (blockName === 'core/details') {
    return 'summary';
  }

  return '';
};

const replaceFirstTagText = (html: string, tagPattern: string, nextText: string): string =>
  html.replace(
    new RegExp(`<(${tagPattern})(\\s[^>]*)?>[\\s\\S]*?<\\/\\1>`, 'i'),
    (_match, tagName: string, attributes = '') => `<${tagName}${attributes}>${escapeHtml(nextText)}</${tagName}>`,
  );

const replaceFirstAnchorHref = (html: string, nextUrl: string): string =>
  html.replace(/<a(\s[^>]*)?>/i, (match, attributes = '') => {
    const nextHref = ` href="${escapeHtmlAttribute(nextUrl)}"`;
    if (/(\s)href=(['"]).*?\2/i.test(attributes)) {
      return `<a${attributes.replace(/(\s)href=(['"]).*?\2/i, nextHref)}>`;
    }

    return `<a${attributes}${nextHref}>`;
  });

const replaceFirstButtonHref = (html: string, nextUrl: string): string => replaceFirstAnchorHref(html, nextUrl);

const replaceFirstTagAttribute = (
  html: string,
  tagName: 'a' | 'img',
  attributeName: string,
  nextValue: string,
): string =>
  html.replace(new RegExp(`<${tagName}(\\s[^>]*)?>`, 'i'), (match, attributes = '') => {
    const attributePattern = new RegExp(`(\\s)${attributeName}=(['"]).*?\\2`, 'i');
    if (!nextValue) {
      return `<${tagName}${attributes.replace(attributePattern, '')}>`;
    }

    const replacement = ` ${attributeName}="${escapeHtmlAttribute(nextValue)}"`;

    if (attributePattern.test(attributes)) {
      return `<${tagName}${attributes.replace(attributePattern, replacement)}>`;
    }

    return `<${tagName}${attributes}${replacement}>`;
  });

const replaceFirstAnchorAttribute = (html: string, attributeName: 'target' | 'rel', nextValue: string): string =>
  replaceFirstTagAttribute(html, 'a', attributeName, nextValue);

const replaceFirstImageAttribute = (html: string, attributeName: 'src' | 'alt' | 'width' | 'height', nextValue: string): string =>
  replaceFirstTagAttribute(html, 'img', attributeName, nextValue);

const replaceInnerContentText = (
  innerContent: Array<string | null> | undefined,
  tagPattern: string,
  nextText: string,
): Array<string | null> | undefined => {
  if (!Array.isArray(innerContent)) {
    return innerContent;
  }

  let updated = false;
  return innerContent.map((part) => {
    if (updated || typeof part !== 'string') {
      return part;
    }

    const nextPart = replaceFirstTagText(part, tagPattern, nextText);
    updated = nextPart !== part;
    return nextPart;
  });
};

const updateBlockMarkup = (
  block: WhipifyFrontendEditorParsedBlock,
  field: string,
  value: string,
): WhipifyFrontendEditorParsedBlock => {
  const blockName = block.blockName || '';
  const innerHTML = typeof block.innerHTML === 'string' ? block.innerHTML : '';
  let nextInnerHTML = innerHTML;

  if (blockName === 'core/heading' && field === 'content') {
    nextInnerHTML = replaceFirstTagText(innerHTML, 'h[1-6]', value);
  } else if (blockName === 'core/paragraph' && field === 'content') {
    nextInnerHTML = replaceFirstTagText(innerHTML, 'p', value);
  } else if (blockName === 'core/button' && field === 'text') {
    nextInnerHTML = replaceFirstTagText(innerHTML, 'a', value);
  } else if (blockName === 'core/button' && field === 'url') {
    nextInnerHTML = replaceFirstAnchorHref(innerHTML, value);
  } else if (blockName === 'core/button' && field === 'linkTarget') {
    nextInnerHTML = replaceFirstAnchorAttribute(innerHTML, 'target', value);
  } else if (blockName === 'core/button' && field === 'rel') {
    nextInnerHTML = replaceFirstAnchorAttribute(innerHTML, 'rel', value);
  } else if (blockName === 'core/details' && field === 'summary') {
    nextInnerHTML = replaceFirstTagText(innerHTML, 'summary', value);
    return {
      ...block,
      innerHTML: nextInnerHTML,
      innerContent: replaceInnerContentText(block.innerContent, 'summary', value),
    };
  } else if (blockName === 'theme-factory/button' && field === 'text') {
    nextInnerHTML = replaceFirstTagText(innerHTML, 'a|button', value);
  } else if (blockName === 'theme-factory/button' && field === 'href') {
    nextInnerHTML = replaceFirstButtonHref(innerHTML, value);
  } else if (blockName === 'theme-factory/button' && field === 'target') {
    nextInnerHTML = replaceFirstAnchorAttribute(innerHTML, 'target', value);
  } else if (blockName === 'theme-factory/button' && field === 'rel') {
    nextInnerHTML = replaceFirstAnchorAttribute(innerHTML, 'rel', value);
  } else if (blockName === 'theme-factory/container' && field === 'text') {
    const updatedChildBlock = updateFirstTextChildBlock(block, value);
    nextInnerHTML = replaceFirstTagText(innerHTML, 'button', value);
    return {
      ...updatedChildBlock,
      innerHTML: nextInnerHTML,
    };
  } else if (blockName === 'core/image' && field === 'url') {
    nextInnerHTML = replaceFirstImageAttribute(innerHTML, 'src', value);
  } else if (blockName === 'core/image' && field === 'alt') {
    nextInnerHTML = replaceFirstImageAttribute(innerHTML, 'alt', value);
  } else if (blockName === 'core/image' && field === 'width') {
    nextInnerHTML = replaceFirstImageAttribute(innerHTML, 'width', value);
  } else if (blockName === 'core/image' && field === 'height') {
    nextInnerHTML = replaceFirstImageAttribute(innerHTML, 'height', value);
  }

  if (nextInnerHTML === innerHTML) {
    return block;
  }

  return {
    ...block,
    innerHTML: nextInnerHTML,
    innerContent: [nextInnerHTML],
  };
};

const updateFirstTextChildBlock = (
  block: WhipifyFrontendEditorParsedBlock,
  value: string,
): WhipifyFrontendEditorParsedBlock => {
  const innerBlocks = Array.isArray(block.innerBlocks) ? block.innerBlocks : [];
  if (innerBlocks.length === 0) {
    return block;
  }

  const nextInnerBlocks = [...innerBlocks];
  for (let index = 0; index < nextInnerBlocks.length; index += 1) {
    const child = nextInnerBlocks[index];
    const childField = getPrimaryTextFieldForBlockName(child.blockName);
    if (childField) {
      const nextChild: WhipifyFrontendEditorParsedBlock = {
        ...child,
        attrs: {
          ...(child.attrs || {}),
          [childField]: value,
        },
      };
      nextInnerBlocks[index] = updateBlockMarkup(nextChild, childField, value);
      return {
        ...block,
        innerBlocks: nextInnerBlocks,
      };
    }

    const nestedChild = updateFirstTextChildBlock(child, value);
    if (nestedChild !== child) {
      nextInnerBlocks[index] = nestedChild;
      return {
        ...block,
        innerBlocks: nextInnerBlocks,
      };
    }
  }

  return block;
};

const normalizeTreePath = (path: Array<number | string>): number[] | null => {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  const normalizedSegments = path.map((rawSegment) =>
    typeof rawSegment === 'number' ? rawSegment : Number.parseInt(String(rawSegment), 10),
  );

  return normalizedSegments.every((segment) => Number.isInteger(segment) && segment >= 0)
    ? normalizedSegments
    : null;
};

const getTreePathKey = (path: number[]): string => path.map(String).join('.');

const getBlockLocationAtPath = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  path: number[],
): { items: WhipifyFrontendEditorParsedBlock[]; index: number; block: WhipifyFrontendEditorParsedBlock } | null => {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  let items = blocks;
  for (let depth = 0; depth < path.length - 1; depth += 1) {
    const segment = path[depth];
    const nextBlock = items[segment];
    if (!nextBlock) {
      return null;
    }

    items = Array.isArray(nextBlock.innerBlocks) ? nextBlock.innerBlocks : [];
  }

  const index = path[path.length - 1];
  const block = items[index];
  if (!block) {
    return null;
  }

  return { items, index, block };
};

const moveBlockAtPath = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  path: number[],
  direction: -1 | 1,
): { blocks: WhipifyFrontendEditorParsedBlock[]; nextPath: number[]; block: WhipifyFrontendEditorParsedBlock } | null => {
  const clonedBlocks = cloneParsedBlocks(blocks);
  const location = getBlockLocationAtPath(clonedBlocks, path);
  if (!location) {
    return null;
  }

  const targetIndex = location.index;
  const siblingIndex = targetIndex + direction;
  if (siblingIndex < 0 || siblingIndex >= location.items.length) {
    return null;
  }

  const swappedBlock = location.items[siblingIndex];
  location.items[targetIndex] = swappedBlock;
  location.items[siblingIndex] = location.block;

  const nextPath = [...path];
  nextPath[nextPath.length - 1] = siblingIndex;

  return {
    blocks: clonedBlocks,
    nextPath,
    block: location.block,
  };
};

const duplicateBlockAtPath = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  path: number[],
): { blocks: WhipifyFrontendEditorParsedBlock[]; nextPath: number[]; block: WhipifyFrontendEditorParsedBlock } | null => {
  const clonedBlocks = cloneParsedBlocks(blocks);
  const location = getBlockLocationAtPath(clonedBlocks, path);
  if (!location) {
    return null;
  }

  const duplicatedBlock = cloneParsedBlocks([location.block])[0];
  location.items.splice(location.index + 1, 0, duplicatedBlock);
  const nextPath = [...path];
  nextPath[nextPath.length - 1] = location.index + 1;
  return {
    blocks: clonedBlocks,
    nextPath,
    block: duplicatedBlock,
  };
};

const insertParagraphAfterPath = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  path: number[],
  content: string,
): { blocks: WhipifyFrontendEditorParsedBlock[]; nextPath: number[]; block: WhipifyFrontendEditorParsedBlock } | null => {
  const clonedBlocks = cloneParsedBlocks(blocks);
  const location = getBlockLocationAtPath(clonedBlocks, path);
  if (!location) {
    return null;
  }

  const paragraphText = content || 'New paragraph';
  const innerHTML = `<p>${escapeHtml(paragraphText)}</p>`;
  const paragraphBlock: WhipifyFrontendEditorParsedBlock = {
    blockName: 'core/paragraph',
    attrs: {
      content: paragraphText,
    },
    innerBlocks: [],
    innerHTML,
    innerContent: [innerHTML],
  };
  location.items.splice(location.index + 1, 0, paragraphBlock);
  const nextPath = [...path];
  nextPath[nextPath.length - 1] = location.index + 1;
  return {
    blocks: clonedBlocks,
    nextPath,
    block: paragraphBlock,
  };
};

const getFieldType = (blockName: string | undefined, field: string): string | null => {
  const fieldSchema = blockName ? PAGE_BLOCK_FIELD_SCHEMA[blockName] : undefined;
  return fieldSchema?.[field] || null;
};

const getFirstTextChildValue = (block: WhipifyFrontendEditorParsedBlock): string => {
  const children = Array.isArray(block.innerBlocks) ? block.innerBlocks : [];
  for (const child of children) {
    const childField = getPrimaryTextFieldForBlockName(child.blockName);
    if (childField) {
      return getEffectiveFieldValue(child, childField);
    }

    const nestedValue = getFirstTextChildValue(child);
    if (nestedValue) {
      return nestedValue;
    }
  }

  return '';
};

const getEffectiveFieldValue = (
  block: WhipifyFrontendEditorParsedBlock,
  field: string,
): string => {
  const attrs = block.attrs || {};
  const blockName = block.blockName || '';
  const attrValue = attrs[field];
  if (typeof attrValue === 'string' || typeof attrValue === 'number') {
    return String(attrValue);
  }

  const innerHTML = typeof block.innerHTML === 'string' ? block.innerHTML : '';
  if ((blockName === 'core/heading' || blockName === 'core/paragraph') && field === 'content') {
    return innerHTML.replace(/<[^>]+>/g, '').trim();
  }

  if (blockName === 'core/button' && field === 'text') {
    return innerHTML.replace(/<[^>]+>/g, '').trim();
  }

  if (blockName === 'core/button' && field === 'url') {
    return innerHTML.match(/<a\s[^>]*href=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'core/button' && field === 'linkTarget') {
    return innerHTML.match(/<a\s[^>]*target=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'core/button' && field === 'rel') {
    return innerHTML.match(/<a\s[^>]*rel=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'core/details' && field === 'summary') {
    return innerHTML.match(/<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
  }

  if (blockName === 'theme-factory/button' && field === 'text') {
    return innerHTML.replace(/<[^>]+>/g, '').trim();
  }

  if (blockName === 'theme-factory/button' && field === 'href') {
    return innerHTML.match(/<a\s[^>]*href=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'theme-factory/button' && field === 'target') {
    return innerHTML.match(/<a\s[^>]*target=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'theme-factory/button' && field === 'rel') {
    return innerHTML.match(/<a\s[^>]*rel=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'theme-factory/container' && field === 'text') {
    return getFirstTextChildValue(block) || innerHTML.replace(/<[^>]+>/g, '').trim();
  }

  if (blockName === 'core/image' && field === 'url') {
    return innerHTML.match(/<img\s[^>]*src=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'core/image' && field === 'alt') {
    return innerHTML.match(/<img\s[^>]*alt=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'core/image' && field === 'width') {
    return innerHTML.match(/<img\s[^>]*width=(['"])(.*?)\1/i)?.[2] || '';
  }

  if (blockName === 'core/image' && field === 'height') {
    return innerHTML.match(/<img\s[^>]*height=(['"])(.*?)\1/i)?.[2] || '';
  }

  return '';
};

const getSourceHash = (
  block: WhipifyFrontendEditorParsedBlock,
  field: string,
): string => {
  const blockName = block.blockName || '';
  return JSON.stringify({
    blockName,
    field,
    fieldType: getFieldType(blockName, field),
    value: getEffectiveFieldValue(block, field),
  });
};

const buildResolvedTarget = (
  input: WhipifyFrontendEditorPageBlockResolverTarget,
  block: WhipifyFrontendEditorParsedBlock,
  normalizedPath: number[],
  field: string,
): WhipifyFrontendEditorPageBlockResolverTarget | null => {
  const blockName = block.blockName || '';
  const fieldType = getFieldType(blockName, field);
  const postId = input.identity?.postId;
  if (!fieldType || !postId) {
    return null;
  }

  const treePath = normalizedPath.map(String);
  const treePathKey = treePath.join('.');
  const stableId = `page-block:${postId}:${treePathKey}`;
  const mediaId = blockName === 'core/image' ? getEffectiveFieldValue(block, 'id') : '';
  const mediaSourceHash = blockName === 'core/image' ? getSourceHash(block, 'id') : '';

  return {
    version: '2',
    entityKind: 'page-block',
    entitySource: input.entitySource || 'wordpress-post',
    stableId,
    targetId: `${stableId}:${field}`,
    identity: {
      postId,
      treePathKey,
      stableId,
    },
    blockName,
    treePath,
    field,
    fieldType,
    ...(mediaId ? { mediaId } : {}),
    ...(mediaSourceHash ? { mediaSourceHash } : {}),
    ...(input.revisionToken ? { revisionToken: input.revisionToken } : {}),
    sourceHash: getSourceHash(block, field),
  };
};

const isEditableBlockName = (blockName: string | undefined): blockName is keyof typeof PAGE_BLOCK_FIELD_SCHEMA =>
  typeof blockName === 'string' && Object.prototype.hasOwnProperty.call(PAGE_BLOCK_FIELD_SCHEMA, blockName);

export const PAGE_BLOCK_WHITELIST: Record<string, string[]> = Object.fromEntries(
  Object.entries(PAGE_BLOCK_FIELD_SCHEMA).map(([blockName, fieldSchema]) => [blockName, Object.keys(fieldSchema)]),
);

export const findWhipifyEditablePageBlockAtLegacyPath = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  path: Array<number | string>,
): WhipifyFrontendEditorParsedBlock | null => {
  const normalizedPath = normalizeTreePath(path);
  if (!normalizedPath) {
    return null;
  }

  let currentItems = blocks;
  let currentBlock: WhipifyFrontendEditorParsedBlock | null = null;

  for (let depth = 0; depth < normalizedPath.length; depth += 1) {
    const targetIndex = normalizedPath[depth];
    const nextBlock = currentItems[targetIndex];
    if (!nextBlock) {
      return null;
    }

    currentBlock = nextBlock;
    currentItems = Array.isArray(nextBlock.innerBlocks) ? nextBlock.innerBlocks : [];
  }

  return currentBlock && isEditableBlockName(currentBlock.blockName) ? currentBlock : null;
};

export const resolveWhipifyFrontendEditorPageBlockTargetV2 = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  target: WhipifyFrontendEditorPageBlockResolverTarget,
): WhipifyFrontendEditorPageBlockResolverTarget | null => {
  const normalizedPath = normalizeTreePath(
    target.treePath || target.identity?.treePathKey?.split('.') || [],
  );
  if (!normalizedPath || !target.identity?.postId) {
    return null;
  }

  const block = findWhipifyEditablePageBlockAtLegacyPath(blocks, normalizedPath);
  if (!block) {
    return null;
  }

  return buildResolvedTarget(target, block, normalizedPath, target.field);
};

export const applyWhipifyFrontendEditorPageBlockUpdate = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  path: Array<number | string>,
  field: string,
  value: string,
): WhipifyFrontendEditorParsedBlock[] | null => {
  const normalizedPath = normalizeTreePath(path);
  if (!normalizedPath) {
    return null;
  }

  const clonedBlocks = cloneParsedBlocks(blocks);
  let updated = false;

  const visit = (items: WhipifyFrontendEditorParsedBlock[], depth: number): boolean => {
    const targetIndex = normalizedPath[depth];
    const item = items[targetIndex];
    if (!item) {
      return false;
    }

    if (depth < normalizedPath.length - 1) {
      if (!Array.isArray(item.innerBlocks) || item.innerBlocks.length === 0) {
        return false;
      }

      return visit(item.innerBlocks, depth + 1);
    }

    if (!isEditableBlockName(item.blockName)) {
      return false;
    }

    const fieldType = getFieldType(item.blockName, field);
    if (!fieldType) {
      return false;
    }

    const nextItem: WhipifyFrontendEditorParsedBlock = {
      ...item,
      attrs: {
        ...(item.attrs || {}),
        [field]: value,
      },
    };
    items[targetIndex] = updateBlockMarkup(nextItem, field, value);
    updated = true;
    return true;
  };

  return visit(clonedBlocks, 0) && updated ? clonedBlocks : null;
};

export const applyWhipifyFrontendEditorPageBlockSaveAdapter = (
  blocks: WhipifyFrontendEditorParsedBlock[],
  target: WhipifyFrontendEditorPageBlockResolverTarget,
  operations: WhipifyFrontendEditorPageBlockSaveOperation[],
): WhipifyFrontendEditorPageBlockSaveAdapterResult | null => {
  const normalizedPath = normalizeTreePath(
    target.treePath || target.identity?.treePathKey?.split('.') || [],
  );
  if (!normalizedPath) {
    return null;
  }

  const nextBlocks = cloneParsedBlocks(blocks);
  const structuralAction = operations.length === 1
    ? ((operations[0]?.action || 'update') as 'update' | 'remove' | 'move-up' | 'move-down' | 'duplicate' | 'insert-paragraph')
    : 'update';

  if (structuralAction !== 'update') {
    const currentTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(nextBlocks, target);
    if (!currentTarget) {
      return null;
    }

    const operationSourceHash = operations[0]?.sourceHash || '';
    if (operationSourceHash && currentTarget.sourceHash !== operationSourceHash) {
      return {
        conflict: true,
        field: target.field,
        target: currentTarget,
      } as never;
    }

    if (structuralAction === 'remove') {
      const location = getBlockLocationAtPath(nextBlocks, normalizedPath);
      if (!location) {
        return null;
      }
      location.items.splice(location.index, 1);
      return {
        blocks: nextBlocks,
        target: {
          ...currentTarget,
          revisionToken: target.revisionToken || currentTarget.revisionToken,
          sourceHash: currentTarget.sourceHash,
        },
        operations: [currentTarget],
        action: 'remove',
      };
    }

    if (structuralAction === 'duplicate') {
      const duplicated = duplicateBlockAtPath(nextBlocks, normalizedPath);
      if (!duplicated) {
        return null;
      }

      const duplicatedTarget = buildResolvedTarget(target, duplicated.block, duplicated.nextPath, target.field);
      if (!duplicatedTarget) {
        return null;
      }

      return {
        blocks: duplicated.blocks,
        target: duplicatedTarget,
        operations: [{ ...duplicatedTarget, action: 'duplicate' }],
        action: 'duplicate',
      };
    }

    if (structuralAction === 'insert-paragraph') {
      const inserted = insertParagraphAfterPath(nextBlocks, normalizedPath, operations[0]?.value || 'New paragraph');
      if (!inserted) {
        return null;
      }

      const insertedTarget = buildResolvedTarget(
        {
          ...target,
          field: 'content',
        },
        inserted.block,
        inserted.nextPath,
        'content',
      );
      if (!insertedTarget) {
        return null;
      }

      return {
        blocks: inserted.blocks,
        target: insertedTarget,
        operations: [{ ...insertedTarget, action: 'insert-paragraph' }],
        action: 'insert-paragraph',
      };
    }

    const moved = moveBlockAtPath(nextBlocks, normalizedPath, structuralAction === 'move-up' ? -1 : 1);
    if (!moved) {
      return null;
    }

    const movedTarget = buildResolvedTarget(target, moved.block, moved.nextPath, target.field);
    if (!movedTarget) {
      return null;
    }

    return {
      blocks: nextBlocks,
      target: movedTarget,
      operations: [movedTarget],
      action: structuralAction,
    };
  }

  let workingBlocks = nextBlocks;
  const resolvedOperations: Array<WhipifyFrontendEditorPageBlockResolverTarget> = [];

  for (const operation of operations) {
    const resolvedTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(workingBlocks, {
      ...target,
      field: operation.field,
    });
    if (!resolvedTarget) {
      return null;
    }

    if (operation.sourceHash && resolvedTarget.sourceHash !== operation.sourceHash) {
      return null;
    }

    const updatedBlocks = applyWhipifyFrontendEditorPageBlockUpdate(
      workingBlocks,
      normalizedPath,
      operation.field,
      operation.value,
    );
    if (!updatedBlocks) {
      return null;
    }

    workingBlocks = updatedBlocks;
    const nextResolvedTarget = resolveWhipifyFrontendEditorPageBlockTargetV2(workingBlocks, {
      ...target,
      field: operation.field,
    });
    if (!nextResolvedTarget) {
      return null;
    }
    resolvedOperations.push(nextResolvedTarget);
  }

  return {
    blocks: workingBlocks,
    target: resolvedOperations[0] || target,
    operations: resolvedOperations,
  };
};

export const renderWhipifyFrontendEditorPageBlockAdapterPhp = (): string => `
if ( ! function_exists( 'tf_frontend_editor_page_block_field_schema' ) ) {
    function tf_frontend_editor_page_block_field_schema() {
        return ${renderPageBlockFieldSchema()};
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_normalize_tree_path' ) ) {
    function tf_frontend_editor_page_block_normalize_tree_path( $path ) {
        if ( ! is_array( $path ) || empty( $path ) ) {
            return null;
        }

        $normalized_path = array();
        foreach ( $path as $segment ) {
            if ( '' === $segment || null === $segment ) {
                return null;
            }

            if ( is_string( $segment ) && ! preg_match( '/^\\d+$/', $segment ) ) {
                return null;
            }

            $normalized_segment = absint( $segment );
            if ( (string) $normalized_segment !== (string) $segment && ! is_int( $segment ) ) {
                return null;
            }

            $normalized_path[] = $normalized_segment;
        }

        return $normalized_path;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_target_from_payload' ) ) {
    function tf_frontend_editor_page_block_target_from_payload( $payload ) {
        $payload = is_array( $payload ) ? $payload : array();
        $payload_target = isset( $payload['target'] ) && is_array( $payload['target'] ) ? $payload['target'] : array();
        $post_id = isset( $payload['postId'] ) ? absint( $payload['postId'] ) : 0;
        if ( ! $post_id && isset( $payload_target['identity']['postId'] ) ) {
            $post_id = absint( $payload_target['identity']['postId'] );
        }
        $field = isset( $payload['field'] ) ? sanitize_key( wp_unslash( $payload['field'] ) ) : '';
        if ( ! $field && isset( $payload_target['field'] ) ) {
            $field = sanitize_key( wp_unslash( $payload_target['field'] ) );
        }
        $revision_token = isset( $payload['revisionToken'] ) ? sanitize_text_field( wp_unslash( $payload['revisionToken'] ) ) : '';
        if ( ! $revision_token && isset( $payload_target['revisionToken'] ) ) {
            $revision_token = sanitize_text_field( wp_unslash( $payload_target['revisionToken'] ) );
        }
        $source_hash = isset( $payload['sourceHash'] ) ? sanitize_text_field( wp_unslash( $payload['sourceHash'] ) ) : '';
        if ( ! $source_hash && isset( $payload_target['sourceHash'] ) ) {
            $source_hash = sanitize_text_field( wp_unslash( $payload_target['sourceHash'] ) );
        }
        $media_id = isset( $payload['mediaId'] ) ? sanitize_text_field( wp_unslash( $payload['mediaId'] ) ) : '';
        if ( ! $media_id && isset( $payload_target['mediaId'] ) ) {
            $media_id = sanitize_text_field( wp_unslash( $payload_target['mediaId'] ) );
        }
        $media_source_hash = isset( $payload['mediaSourceHash'] ) ? sanitize_text_field( wp_unslash( $payload['mediaSourceHash'] ) ) : '';
        if ( ! $media_source_hash && isset( $payload_target['mediaSourceHash'] ) ) {
            $media_source_hash = sanitize_text_field( wp_unslash( $payload_target['mediaSourceHash'] ) );
        }
        $raw_block_path = isset( $payload['blockPath'] ) ? sanitize_text_field( wp_unslash( $payload['blockPath'] ) ) : '';
        if ( '' === $raw_block_path && isset( $payload_target['identity']['treePathKey'] ) ) {
            $raw_block_path = sanitize_text_field( wp_unslash( $payload_target['identity']['treePathKey'] ) );
        }
        $tree_path = '' !== $raw_block_path
            ? array_values( array_filter( explode( '.', $raw_block_path ), 'strlen' ) )
            : array();
        $normalized_tree_path = tf_frontend_editor_page_block_normalize_tree_path( $tree_path );
        $block_path = is_array( $normalized_tree_path ) ? $normalized_tree_path : array();
        $tree_path = array_map( 'strval', $block_path );
        $tree_path_key = implode( '.', $tree_path );

        return array(
            'version' => '2',
            'entityKind' => 'page-block',
            'entitySource' => 'wordpress-post',
            'stableId' => 'page-block:' . $post_id . ':' . $tree_path_key,
            'targetId' => 'page-block:' . $post_id . ':' . $tree_path_key . ':' . $field,
            'identity' => array(
                'postId' => $post_id,
                'treePathKey' => $tree_path_key,
                'stableId' => 'page-block:' . $post_id . ':' . $tree_path_key,
            ),
            'treePath' => $tree_path,
            'field' => $field,
            'revisionToken' => $revision_token,
            'sourceHash' => $source_hash,
            'mediaId' => $media_id,
            'mediaSourceHash' => $media_source_hash,
            'legacy' => array(
                'blockPath' => $block_path,
            ),
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_target_from_request' ) ) {
    function tf_frontend_editor_page_block_target_from_request() {
        return tf_frontend_editor_page_block_target_from_payload( $_POST );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_is_editable' ) ) {
    function tf_frontend_editor_page_block_is_editable( $block_name ) {
        $whitelist = tf_frontend_editor_page_block_whitelist();
        return isset( $whitelist[ $block_name ] );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_effective_field_value' ) ) {
    function tf_frontend_editor_page_block_effective_field_value( $block, $field ) {
        $block = is_array( $block ) ? $block : array();
        $block_name = isset( $block['blockName'] ) ? $block['blockName'] : '';
        $attrs = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();
        $inner_html = isset( $block['innerHTML'] ) && is_string( $block['innerHTML'] ) ? $block['innerHTML'] : '';

        if ( isset( $attrs[ $field ] ) && is_scalar( $attrs[ $field ] ) ) {
            $value = (string) $attrs[ $field ];
            return 'url' === $field ? esc_url_raw( $value ) : sanitize_text_field( wp_strip_all_tags( $value ) );
        }

        if ( ( 'core/heading' === $block_name || 'core/paragraph' === $block_name ) && 'content' === $field ) {
            return sanitize_text_field( wp_strip_all_tags( $inner_html ) );
        }

        if ( 'core/button' === $block_name && 'text' === $field ) {
            return sanitize_text_field( wp_strip_all_tags( $inner_html ) );
        }

        if ( 'core/button' === $block_name && 'url' === $field ) {
            if ( preg_match( '/<a\\s[^>]*href=(["\\'])(.*?)\\1/i', $inner_html, $matches ) ) {
                return esc_url_raw( $matches[2] );
            }
        }

        if ( 'core/details' === $block_name && 'summary' === $field ) {
            if ( preg_match( '/<summary(?:\\s[^>]*)?>([\\s\\S]*?)<\\/summary>/i', $inner_html, $matches ) ) {
                return sanitize_text_field( wp_strip_all_tags( $matches[1] ) );
            }
        }

        if ( 'theme-factory/button' === $block_name && 'text' === $field ) {
            return sanitize_text_field( wp_strip_all_tags( $inner_html ) );
        }

        if ( 'theme-factory/button' === $block_name && 'href' === $field ) {
            if ( preg_match( '/<a\\s[^>]*href=(["\\'])(.*?)\\1/i', $inner_html, $matches ) ) {
                return esc_url_raw( $matches[2] );
            }
        }

        if ( 'theme-factory/button' === $block_name && 'target' === $field ) {
            if ( preg_match( '/<a\\s[^>]*target=(["\\'])(.*?)\\1/i', $inner_html, $matches ) ) {
                return sanitize_text_field( wp_strip_all_tags( $matches[2] ) );
            }
        }

        if ( 'theme-factory/button' === $block_name && 'rel' === $field ) {
            if ( preg_match( '/<a\\s[^>]*rel=(["\\'])(.*?)\\1/i', $inner_html, $matches ) ) {
                return sanitize_text_field( wp_strip_all_tags( $matches[2] ) );
            }
        }

        if ( 'theme-factory/container' === $block_name && 'text' === $field ) {
            $first_child_text = tf_frontend_editor_page_block_first_text_child_value( $block );
            return '' !== $first_child_text ? $first_child_text : sanitize_text_field( wp_strip_all_tags( $inner_html ) );
        }

        if ( 'core/image' === $block_name && 'url' === $field ) {
            if ( preg_match( '/<img\\s[^>]*src=(["\\'])(.*?)\\1/i', $inner_html, $matches ) ) {
                return esc_url_raw( $matches[2] );
            }
        }

        if ( 'core/image' === $block_name && 'alt' === $field ) {
            if ( preg_match( '/<img\\s[^>]*alt=(["\\'])(.*?)\\1/i', $inner_html, $matches ) ) {
                return sanitize_text_field( wp_strip_all_tags( $matches[2] ) );
            }
        }

        return '';
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_first_text_child_value' ) ) {
    function tf_frontend_editor_page_block_first_text_child_value( $block ) {
        $block = is_array( $block ) ? $block : array();
        $children = isset( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ? $block['innerBlocks'] : array();
        foreach ( $children as $child ) {
            if ( ! is_array( $child ) ) {
                continue;
            }

            $child_block_name = isset( $child['blockName'] ) ? $child['blockName'] : '';
            if ( 'core/heading' === $child_block_name || 'core/paragraph' === $child_block_name ) {
                return tf_frontend_editor_page_block_effective_field_value( $child, 'content' );
            }

            if ( 'core/button' === $child_block_name || 'theme-factory/button' === $child_block_name ) {
                return tf_frontend_editor_page_block_effective_field_value( $child, 'text' );
            }

            if ( 'core/details' === $child_block_name ) {
                return tf_frontend_editor_page_block_effective_field_value( $child, 'summary' );
            }

            $nested_value = tf_frontend_editor_page_block_first_text_child_value( $child );
            if ( '' !== $nested_value ) {
                return $nested_value;
            }
        }

        return '';
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_source_hash' ) ) {
    function tf_frontend_editor_page_block_source_hash( $block, $field ) {
        $block = is_array( $block ) ? $block : array();
        $field = is_string( $field ) ? $field : '';
        $block_name = isset( $block['blockName'] ) ? $block['blockName'] : '';
        $field_schema = tf_frontend_editor_page_block_field_schema();
        $field_type = isset( $field_schema[ $block_name ][ $field ] ) ? $field_schema[ $block_name ][ $field ] : '';
        $value = tf_frontend_editor_page_block_effective_field_value( $block, $field );

        return hash(
            'sha256',
            wp_json_encode(
                array(
                    'blockName' => $block_name,
                    'field' => $field,
                    'fieldType' => $field_type,
                    'value' => $value,
                )
            )
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_find_at_tree_path' ) ) {
    function tf_frontend_editor_page_block_find_at_tree_path( $blocks, $path ) {
        $path = tf_frontend_editor_page_block_normalize_tree_path( $path );
        if ( ! is_array( $path ) ) {
            return null;
        }

        $current_items = is_array( $blocks ) ? $blocks : array();
        $current_block = null;

        foreach ( $path as $depth => $segment ) {
            if ( ! isset( $current_items[ $segment ] ) || ! is_array( $current_items[ $segment ] ) ) {
                return null;
            }

            $current_block = $current_items[ $segment ];
            if ( $depth < count( $path ) - 1 ) {
                $current_items = isset( $current_block['innerBlocks'] ) && is_array( $current_block['innerBlocks'] )
                    ? $current_block['innerBlocks']
                    : array();
            }
        }

        return $current_block;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_tree_path_key' ) ) {
    function tf_frontend_editor_page_block_tree_path_key( $path ) {
        $path = is_array( $path ) ? array_map( 'strval', $path ) : array();
        return implode( '.', $path );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_remove_at_tree_path' ) ) {
    function tf_frontend_editor_page_block_remove_at_tree_path( &$items, $path, $depth = 0 ) {
        $path = tf_frontend_editor_page_block_normalize_tree_path( $path );
        if ( ! is_array( $path ) ) {
            return false;
        }

        $segment = isset( $path[ $depth ] ) ? absint( $path[ $depth ] ) : null;
        if ( null === $segment || ! isset( $items[ $segment ] ) || ! is_array( $items[ $segment ] ) ) {
            return false;
        }

        if ( $depth < count( $path ) - 1 ) {
            if ( ! isset( $items[ $segment ]['innerBlocks'] ) || ! is_array( $items[ $segment ]['innerBlocks'] ) ) {
                return false;
            }

            return tf_frontend_editor_page_block_remove_at_tree_path( $items[ $segment ]['innerBlocks'], $path, $depth + 1 );
        }

        array_splice( $items, $segment, 1 );
        return true;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_move_at_tree_path' ) ) {
    function tf_frontend_editor_page_block_move_at_tree_path( &$items, $path, $direction, $depth = 0 ) {
        $path = tf_frontend_editor_page_block_normalize_tree_path( $path );
        if ( ! is_array( $path ) ) {
            return false;
        }

        $segment = isset( $path[ $depth ] ) ? absint( $path[ $depth ] ) : null;
        if ( null === $segment || ! isset( $items[ $segment ] ) || ! is_array( $items[ $segment ] ) ) {
            return false;
        }

        if ( $depth < count( $path ) - 1 ) {
            if ( ! isset( $items[ $segment ]['innerBlocks'] ) || ! is_array( $items[ $segment ]['innerBlocks'] ) ) {
                return false;
            }

            return tf_frontend_editor_page_block_move_at_tree_path( $items[ $segment ]['innerBlocks'], $path, $direction, $depth + 1 );
        }

        $sibling_index = $segment + (int) $direction;
        if ( $sibling_index < 0 || ! isset( $items[ $sibling_index ] ) || ! is_array( $items[ $sibling_index ] ) ) {
            return false;
        }

        $swapped_block = $items[ $sibling_index ];
        $items[ $sibling_index ] = $items[ $segment ];
        $items[ $segment ] = $swapped_block;
        return true;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_duplicate_at_tree_path' ) ) {
    function tf_frontend_editor_page_block_duplicate_at_tree_path( &$items, $path, $depth = 0 ) {
        $path = tf_frontend_editor_page_block_normalize_tree_path( $path );
        if ( ! is_array( $path ) ) {
            return false;
        }

        $segment = isset( $path[ $depth ] ) ? absint( $path[ $depth ] ) : null;
        if ( null === $segment || ! isset( $items[ $segment ] ) || ! is_array( $items[ $segment ] ) ) {
            return false;
        }

        if ( $depth < count( $path ) - 1 ) {
            if ( ! isset( $items[ $segment ]['innerBlocks'] ) || ! is_array( $items[ $segment ]['innerBlocks'] ) ) {
                return false;
            }

            return tf_frontend_editor_page_block_duplicate_at_tree_path( $items[ $segment ]['innerBlocks'], $path, $depth + 1 );
        }

        $duplicate = $items[ $segment ];
        array_splice( $items, $segment + 1, 0, array( $duplicate ) );
        $next_path = $path;
        $next_path[ count( $next_path ) - 1 ] = $segment + 1;
        return $next_path;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_insert_paragraph_after_tree_path' ) ) {
    function tf_frontend_editor_page_block_insert_paragraph_after_tree_path( &$items, $path, $content, $depth = 0 ) {
        $path = tf_frontend_editor_page_block_normalize_tree_path( $path );
        if ( ! is_array( $path ) ) {
            return false;
        }

        $segment = isset( $path[ $depth ] ) ? absint( $path[ $depth ] ) : null;
        if ( null === $segment || ! isset( $items[ $segment ] ) || ! is_array( $items[ $segment ] ) ) {
            return false;
        }

        if ( $depth < count( $path ) - 1 ) {
            if ( ! isset( $items[ $segment ]['innerBlocks'] ) || ! is_array( $items[ $segment ]['innerBlocks'] ) ) {
                return false;
            }

            return tf_frontend_editor_page_block_insert_paragraph_after_tree_path( $items[ $segment ]['innerBlocks'], $path, $content, $depth + 1 );
        }

        $paragraph_text = '' !== (string) $content ? (string) $content : 'New paragraph';
        $inner_html = '<p>' . esc_html( $paragraph_text ) . '</p>';
        $paragraph = array(
            'blockName' => 'core/paragraph',
            'attrs' => array( 'content' => $paragraph_text ),
            'innerBlocks' => array(),
            'innerHTML' => $inner_html,
            'innerContent' => array( $inner_html ),
        );
        array_splice( $items, $segment + 1, 0, array( $paragraph ) );
        $next_path = $path;
        $next_path[ count( $next_path ) - 1 ] = $segment + 1;
        return $next_path;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_replace_first_tag_text' ) ) {
    function tf_frontend_editor_page_block_replace_first_tag_text( $html, $tag_pattern, $text ) {
        if ( ! is_string( $html ) || '' === $html ) {
            return $html;
        }

        return preg_replace_callback(
            '/<(' . $tag_pattern . ')(\\s[^>]*)?>[\\s\\S]*?<\\/\\1>/i',
            static function ( $matches ) use ( $text ) {
                $tag_name = isset( $matches[1] ) ? $matches[1] : '';
                $attributes = isset( $matches[2] ) ? $matches[2] : '';
                return '<' . $tag_name . $attributes . '>' . esc_html( $text ) . '</' . $tag_name . '>';
            },
            $html,
            1
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_replace_first_anchor_href' ) ) {
    function tf_frontend_editor_page_block_replace_first_anchor_href( $html, $url ) {
        if ( ! is_string( $html ) || '' === $html ) {
            return $html;
        }

        return preg_replace_callback(
            '/<a(\\s[^>]*)?>/i',
            static function ( $matches ) use ( $url ) {
                $attributes = isset( $matches[1] ) ? $matches[1] : '';
                $escaped_href = ' href="' . esc_attr( $url ) . '"';

                if ( preg_match( '/\\shref=(["\\']).*?\\1/i', $attributes ) ) {
                    $attributes = preg_replace( '/\\shref=(["\\']).*?\\1/i', $escaped_href, $attributes, 1 );
                } else {
                    $attributes .= $escaped_href;
                }

                return '<a' . $attributes . '>';
            },
            $html,
            1
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_replace_first_button_href' ) ) {
    function tf_frontend_editor_page_block_replace_first_button_href( $html, $url ) {
        return tf_frontend_editor_page_block_replace_first_anchor_href( $html, $url );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_replace_first_tag_attribute' ) ) {
    function tf_frontend_editor_page_block_replace_first_tag_attribute( $html, $tag_name, $attribute_name, $value ) {
        if ( ! is_string( $html ) || '' === $html ) {
            return $html;
        }

        return preg_replace_callback(
            '/<' . preg_quote( $tag_name, '/' ) . '(\\s[^>]*)?>/i',
            static function ( $matches ) use ( $tag_name, $attribute_name, $value ) {
                $attributes = isset( $matches[1] ) ? $matches[1] : '';
                $attribute_pattern = '/\\s' . preg_quote( $attribute_name, '/' ) . '=(["\\']).*?\\1/i';

                if ( '' === (string) $value ) {
                    return '<' . $tag_name . preg_replace( $attribute_pattern, '', $attributes, 1 ) . '>';
                }

                $escaped_value = ' ' . $attribute_name . '="' . esc_attr( $value ) . '"';
                if ( preg_match( $attribute_pattern, $attributes ) ) {
                    $attributes = preg_replace( $attribute_pattern, $escaped_value, $attributes, 1 );
                } else {
                    $attributes .= $escaped_value;
                }

                return '<' . $tag_name . $attributes . '>';
            },
            $html,
            1
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_replace_first_image_attribute' ) ) {
    function tf_frontend_editor_page_block_replace_first_image_attribute( $html, $attribute_name, $value ) {
        if ( ! is_string( $html ) || '' === $html ) {
            return $html;
        }

        return preg_replace_callback(
            '/<img(\\s[^>]*)?>/i',
            static function ( $matches ) use ( $attribute_name, $value ) {
                $attributes = isset( $matches[1] ) ? $matches[1] : '';
                $escaped_value = ' ' . $attribute_name . '="' . esc_attr( $value ) . '"';

                if ( preg_match( '/\\s' . preg_quote( $attribute_name, '/' ) . '=(["\\']).*?\\1/i', $attributes ) ) {
                    $attributes = preg_replace(
                        '/\\s' . preg_quote( $attribute_name, '/' ) . '=(["\\']).*?\\1/i',
                        $escaped_value,
                        $attributes,
                        1
                    );
                } else {
                    $attributes .= $escaped_value;
                }

                return '<img' . $attributes . '>';
            },
            $html,
            1
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_replace_inner_content_text' ) ) {
    function tf_frontend_editor_page_block_replace_inner_content_text( $inner_content, $tag_pattern, $value ) {
        if ( ! is_array( $inner_content ) ) {
            return $inner_content;
        }

        $updated = false;
        foreach ( $inner_content as $index => $part ) {
            if ( $updated || ! is_string( $part ) ) {
                continue;
            }

            $next_part = tf_frontend_editor_page_block_replace_first_tag_text( $part, $tag_pattern, $value );
            if ( $next_part !== $part ) {
                $inner_content[ $index ] = $next_part;
                $updated = true;
            }
        }

        return $inner_content;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_update_first_text_child' ) ) {
    function tf_frontend_editor_page_block_update_first_text_child( $item, $value ) {
        $children = isset( $item['innerBlocks'] ) && is_array( $item['innerBlocks'] ) ? $item['innerBlocks'] : array();
        if ( empty( $children ) ) {
            return $item;
        }

        foreach ( $children as $index => $child ) {
            if ( ! is_array( $child ) ) {
                continue;
            }

            $child_block_name = isset( $child['blockName'] ) ? $child['blockName'] : '';
            $child_field = '';
            if ( 'core/heading' === $child_block_name || 'core/paragraph' === $child_block_name ) {
                $child_field = 'content';
            } elseif ( 'core/button' === $child_block_name || 'theme-factory/button' === $child_block_name ) {
                $child_field = 'text';
            } elseif ( 'core/details' === $child_block_name ) {
                $child_field = 'summary';
            }

            if ( '' !== $child_field ) {
                if ( ! isset( $child['attrs'] ) || ! is_array( $child['attrs'] ) ) {
                    $child['attrs'] = array();
                }
                $child['attrs'][ $child_field ] = $value;
                $item['innerBlocks'][ $index ] = tf_frontend_editor_page_block_apply_markup_update( $child, $child_field, $value );
                return $item;
            }

            $updated_child = tf_frontend_editor_page_block_update_first_text_child( $child, $value );
            if ( $updated_child !== $child ) {
                $item['innerBlocks'][ $index ] = $updated_child;
                return $item;
            }
        }

        return $item;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_apply_markup_update' ) ) {
    function tf_frontend_editor_page_block_apply_markup_update( $item, $field, $value ) {
        $block_name = isset( $item['blockName'] ) ? $item['blockName'] : '';
        $inner_html = isset( $item['innerHTML'] ) && is_string( $item['innerHTML'] ) ? $item['innerHTML'] : '';
        $updated_inner_html = $inner_html;

        if ( 'core/heading' === $block_name && 'content' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_text( $inner_html, 'h[1-6]', $value );
        } elseif ( 'core/paragraph' === $block_name && 'content' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_text( $inner_html, 'p', $value );
        } elseif ( 'core/button' === $block_name && 'text' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_text( $inner_html, 'a', $value );
        } elseif ( 'core/button' === $block_name && 'url' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_anchor_href( $inner_html, $value );
        } elseif ( 'core/button' === $block_name && 'linkTarget' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_attribute( $inner_html, 'a', 'target', $value );
        } elseif ( 'core/button' === $block_name && 'rel' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_attribute( $inner_html, 'a', 'rel', $value );
        } elseif ( 'core/details' === $block_name && 'summary' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_text( $inner_html, 'summary', $value );
            if ( isset( $item['innerContent'] ) ) {
                $item['innerContent'] = tf_frontend_editor_page_block_replace_inner_content_text( $item['innerContent'], 'summary', $value );
            }
        } elseif ( 'theme-factory/button' === $block_name && 'text' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_text( $inner_html, 'a|button', $value );
        } elseif ( 'theme-factory/button' === $block_name && 'href' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_button_href( $inner_html, $value );
        } elseif ( 'theme-factory/button' === $block_name && 'target' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_attribute( $inner_html, 'a', 'target', $value );
        } elseif ( 'theme-factory/button' === $block_name && 'rel' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_attribute( $inner_html, 'a', 'rel', $value );
        } elseif ( 'theme-factory/container' === $block_name && 'text' === $field ) {
            $item = tf_frontend_editor_page_block_update_first_text_child( $item, $value );
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_tag_text( $inner_html, 'button', $value );
            $item['innerHTML'] = $updated_inner_html;
            return $item;
        } elseif ( 'core/image' === $block_name && 'url' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_image_attribute( $inner_html, 'src', $value );
        } elseif ( 'core/image' === $block_name && 'alt' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_image_attribute( $inner_html, 'alt', $value );
        } elseif ( 'core/image' === $block_name && 'width' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_image_attribute( $inner_html, 'width', $value );
        } elseif ( 'core/image' === $block_name && 'height' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_image_attribute( $inner_html, 'height', $value );
        }

        if ( $updated_inner_html === $inner_html ) {
            return $item;
        }

        $item['innerHTML'] = $updated_inner_html;
        if ( 'core/details' === $block_name && 'summary' === $field && isset( $item['innerContent'] ) && is_array( $item['innerContent'] ) ) {
            $item['innerContent'] = tf_frontend_editor_page_block_replace_inner_content_text( $item['innerContent'], 'summary', $value );
        } else {
            $item['innerContent'] = array( $updated_inner_html );
        }
        return $item;
    }
}

if ( ! function_exists( 'tf_frontend_editor_resolver_v2_resolve_page_block_target' ) ) {
    function tf_frontend_editor_resolver_v2_resolve_page_block_target( $blocks, $target ) {
        $tree_path = isset( $target['treePath'] ) && is_array( $target['treePath'] )
            ? tf_frontend_editor_page_block_normalize_tree_path( $target['treePath'] )
            : null;
        if ( ! is_array( $tree_path ) ) {
            $tree_path = isset( $target['legacy']['blockPath'] ) && is_array( $target['legacy']['blockPath'] )
                ? tf_frontend_editor_page_block_normalize_tree_path( $target['legacy']['blockPath'] )
                : null;
        }
        if ( ! is_array( $tree_path ) ) {
            return null;
        }

        $resolved_block = tf_frontend_editor_page_block_find_at_tree_path( $blocks, $tree_path );
        if ( null === $resolved_block ) {
            return null;
        }

        $block_name = isset( $resolved_block['blockName'] ) ? $resolved_block['blockName'] : '';
        $field = isset( $target['field'] ) ? $target['field'] : '';
        $field_schema = tf_frontend_editor_page_block_field_schema();
        if ( ! isset( $field_schema[ $block_name ] ) || ! isset( $field_schema[ $block_name ][ $field ] ) ) {
            return null;
        }

        $target['blockName'] = $block_name;
        $target['treePath'] = array_map( 'strval', $tree_path );
        $target['identity']['treePathKey'] = implode( '.', $target['treePath'] );
        $target['stableId'] = 'page-block:' . absint( $target['identity']['postId'] ) . ':' . $target['identity']['treePathKey'];
        $target['identity']['stableId'] = $target['stableId'];
        $target['targetId'] = $target['stableId'] . ':' . $field;
        $target['fieldType'] = $field_schema[ $block_name ][ $field ];
        $target['sourceHash'] = tf_frontend_editor_page_block_source_hash( $resolved_block, $field );
        $media_id = 'core/image' === $block_name ? tf_frontend_editor_page_block_effective_field_value( $resolved_block, 'id' ) : '';
        $media_source_hash = 'core/image' === $block_name ? tf_frontend_editor_page_block_source_hash( $resolved_block, 'id' ) : '';
        $target['mediaId'] = $media_id;
        $target['mediaSourceHash'] = $media_source_hash;
        $target['legacy']['blockPath'] = $tree_path;

        return $target;
    }
}

if ( ! function_exists( 'tf_frontend_editor_resolve_page_block_target' ) ) {
    function tf_frontend_editor_resolve_page_block_target( $blocks, $target ) {
        return tf_frontend_editor_resolver_v2_resolve_page_block_target( $blocks, $target );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_mutate_at_tree_path' ) ) {
    function tf_frontend_editor_page_block_mutate_at_tree_path( $blocks, $path, $field, $value ) {
        $path = tf_frontend_editor_page_block_normalize_tree_path( $path );
        if ( ! is_array( $path ) ) {
            return null;
        }

        $whitelist = tf_frontend_editor_page_block_whitelist();
        $update_block = static function ( &$items, $depth = 0 ) use ( &$update_block, $path, $field, $value, $whitelist ) {
            $segment = isset( $path[ $depth ] ) ? absint( $path[ $depth ] ) : null;
            if ( null === $segment || ! isset( $items[ $segment ] ) || ! is_array( $items[ $segment ] ) ) {
                return false;
            }

            if ( $depth < count( $path ) - 1 ) {
                if ( ! isset( $items[ $segment ]['innerBlocks'] ) || ! is_array( $items[ $segment ]['innerBlocks'] ) ) {
                    return false;
                }

                return $update_block( $items[ $segment ]['innerBlocks'], $depth + 1 );
            }

            $item = $items[ $segment ];
            $block_name = isset( $item['blockName'] ) ? $item['blockName'] : '';
            if ( ! isset( $whitelist[ $block_name ] ) || ! in_array( $field, $whitelist[ $block_name ], true ) ) {
                return false;
            }

            if ( ! isset( $item['attrs'] ) || ! is_array( $item['attrs'] ) ) {
                $item['attrs'] = array();
            }

            $sanitized_value = tf_frontend_editor_sanitize_block_field( $field, $value );
            $item['attrs'][ $field ] = $sanitized_value;
            $items[ $segment ] = tf_frontend_editor_page_block_apply_markup_update( $item, $field, $sanitized_value );
            return true;
        };

        if ( ! $update_block( $blocks, 0 ) ) {
            return null;
        }

        return $blocks;
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_tree_path_from_target' ) ) {
    function tf_frontend_editor_page_block_tree_path_from_target( $resolved_target ) {
        if ( isset( $resolved_target['treePath'] ) && is_array( $resolved_target['treePath'] ) ) {
            $tree_path = tf_frontend_editor_page_block_normalize_tree_path( $resolved_target['treePath'] );
            if ( is_array( $tree_path ) ) {
                return $tree_path;
            }
        }

        if ( isset( $resolved_target['legacy']['blockPath'] ) && is_array( $resolved_target['legacy']['blockPath'] ) ) {
            $legacy_path = tf_frontend_editor_page_block_normalize_tree_path( $resolved_target['legacy']['blockPath'] );
            if ( is_array( $legacy_path ) ) {
                return $legacy_path;
            }
        }

        return null;
    }
}

if ( ! function_exists( 'tf_frontend_editor_save_adapter_apply_page_block_operations' ) ) {
    function tf_frontend_editor_save_adapter_apply_page_block_operations( $blocks, $resolved_target, $operations ) {
        $tree_path = tf_frontend_editor_page_block_tree_path_from_target( $resolved_target );
        if ( ! is_array( $tree_path ) ) {
            return null;
        }

        $operations = is_array( $operations ) ? $operations : array();
        if ( empty( $operations ) ) {
            return null;
        }

        $updated_blocks = $blocks;
        $first_operation = isset( $operations[0] ) && is_array( $operations[0] ) ? $operations[0] : array();
        $operation_action = isset( $first_operation['action'] ) ? sanitize_key( wp_unslash( $first_operation['action'] ) ) : 'update';

        if ( in_array( $operation_action, array( 'remove', 'move-up', 'move-down', 'duplicate', 'insert-paragraph' ), true ) ) {
            $current_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $updated_blocks, $resolved_target );
            if ( null === $current_target ) {
                return null;
            }

            $operation_source_hash = isset( $first_operation['sourceHash'] ) ? sanitize_text_field( wp_unslash( $first_operation['sourceHash'] ) ) : '';
            $current_source_hash = isset( $current_target['sourceHash'] ) ? (string) $current_target['sourceHash'] : '';
            if ( $operation_source_hash && ( ! $current_source_hash || ! hash_equals( $current_source_hash, $operation_source_hash ) ) ) {
                return array(
                    'conflict' => true,
                    'field' => isset( $current_target['field'] ) ? $current_target['field'] : '',
                    'target' => $current_target,
                );
            }

            if ( 'remove' === $operation_action ) {
                $removed = tf_frontend_editor_page_block_remove_at_tree_path( $updated_blocks, $tree_path );
                if ( ! $removed ) {
                    return null;
                }

                $removed_target = $current_target;
                $removed_target['action'] = 'remove';

                return array(
                    'blocks' => $updated_blocks,
                    'target' => $removed_target,
                    'operations' => array( $removed_target ),
                    'action' => 'remove',
                );
            }

            if ( 'duplicate' === $operation_action ) {
                $duplicated_path = tf_frontend_editor_page_block_duplicate_at_tree_path( $updated_blocks, $tree_path );
                if ( ! is_array( $duplicated_path ) ) {
                    return null;
                }

                $duplicated_target = $resolved_target;
                $duplicated_target['treePath'] = array_map( 'strval', $duplicated_path );
                $duplicated_target['identity']['treePathKey'] = tf_frontend_editor_page_block_tree_path_key( $duplicated_target['treePath'] );
                $duplicated_target['stableId'] = 'page-block:' . absint( $duplicated_target['identity']['postId'] ) . ':' . $duplicated_target['identity']['treePathKey'];
                $duplicated_target['identity']['stableId'] = $duplicated_target['stableId'];
                $duplicated_target['targetId'] = $duplicated_target['stableId'] . ':' . ( isset( $duplicated_target['field'] ) ? $duplicated_target['field'] : '' );
                $duplicated_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $updated_blocks, $duplicated_target );
                if ( null === $duplicated_target ) {
                    return null;
                }
                $duplicated_target['action'] = 'duplicate';

                return array(
                    'blocks' => $updated_blocks,
                    'target' => $duplicated_target,
                    'operations' => array( $duplicated_target ),
                    'action' => 'duplicate',
                );
            }

            if ( 'insert-paragraph' === $operation_action ) {
                $inserted_value = isset( $first_operation['value'] ) ? sanitize_text_field( wp_unslash( $first_operation['value'] ) ) : 'New paragraph';
                $inserted_path = tf_frontend_editor_page_block_insert_paragraph_after_tree_path( $updated_blocks, $tree_path, $inserted_value );
                if ( ! is_array( $inserted_path ) ) {
                    return null;
                }

                $inserted_target = $resolved_target;
                $inserted_target['field'] = 'content';
                $inserted_target['treePath'] = array_map( 'strval', $inserted_path );
                $inserted_target['identity']['treePathKey'] = tf_frontend_editor_page_block_tree_path_key( $inserted_target['treePath'] );
                $inserted_target['stableId'] = 'page-block:' . absint( $inserted_target['identity']['postId'] ) . ':' . $inserted_target['identity']['treePathKey'];
                $inserted_target['identity']['stableId'] = $inserted_target['stableId'];
                $inserted_target['targetId'] = $inserted_target['stableId'] . ':content';
                $inserted_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $updated_blocks, $inserted_target );
                if ( null === $inserted_target ) {
                    return null;
                }
                $inserted_target['action'] = 'insert-paragraph';

                return array(
                    'blocks' => $updated_blocks,
                    'target' => $inserted_target,
                    'operations' => array( $inserted_target ),
                    'action' => 'insert-paragraph',
                );
            }

            $direction = 'move-up' === $operation_action ? -1 : 1;
            $moved = tf_frontend_editor_page_block_move_at_tree_path( $updated_blocks, $tree_path, $direction );
            if ( ! $moved ) {
                return null;
            }

            $moved_path = $tree_path;
            $last_index = count( $moved_path ) - 1;
            $moved_path[ $last_index ] = absint( $moved_path[ $last_index ] ) + $direction;

            $moved_target = $resolved_target;
            $moved_target['treePath'] = array_map( 'strval', $moved_path );
            $moved_target['identity']['treePathKey'] = tf_frontend_editor_page_block_tree_path_key( $moved_target['treePath'] );
            $moved_target['stableId'] = 'page-block:' . absint( $moved_target['identity']['postId'] ) . ':' . $moved_target['identity']['treePathKey'];
            $moved_target['identity']['stableId'] = $moved_target['stableId'];
            $moved_target['targetId'] = $moved_target['stableId'] . ':' . ( isset( $moved_target['field'] ) ? $moved_target['field'] : '' );
            $moved_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $updated_blocks, $moved_target );
            if ( null === $moved_target ) {
                return null;
            }

            $moved_target['action'] = $operation_action;

            return array(
                'blocks' => $updated_blocks,
                'target' => $moved_target,
                'operations' => array( $moved_target ),
                'action' => $operation_action,
            );
        }

        $applied_operations = array();
        foreach ( $operations as $operation ) {
            $field = isset( $operation['field'] ) ? sanitize_key( wp_unslash( $operation['field'] ) ) : '';
            $value = isset( $operation['value'] ) ? wp_unslash( $operation['value'] ) : '';
            $candidate_target = $resolved_target;
            $candidate_target['field'] = $field;
            $current_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $updated_blocks, $candidate_target );
            if ( null === $current_target ) {
                return null;
            }

            $operation_source_hash = isset( $operation['sourceHash'] ) ? sanitize_text_field( wp_unslash( $operation['sourceHash'] ) ) : '';
            $current_source_hash = isset( $current_target['sourceHash'] ) ? (string) $current_target['sourceHash'] : '';
            if ( $operation_source_hash && ( ! $current_source_hash || ! hash_equals( $current_source_hash, $operation_source_hash ) ) ) {
                return array(
                    'conflict' => true,
                    'field' => $field,
                    'target' => $current_target,
                );
            }

            $updated_blocks = tf_frontend_editor_page_block_mutate_at_tree_path( $updated_blocks, $tree_path, $field, $value );
            if ( null === $updated_blocks ) {
                return null;
            }

            $next_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $updated_blocks, $candidate_target );
            if ( null === $next_target ) {
                return null;
            }
            $applied_operations[] = $next_target;
        }

        return array(
            'blocks' => $updated_blocks,
            'target' => ! empty( $applied_operations ) ? $applied_operations[0] : $resolved_target,
            'operations' => $applied_operations,
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_adapter_result' ) ) {
    function tf_frontend_editor_page_block_adapter_result( $fresh_post, $adapter_result ) {
        $revision_token = tf_frontend_editor_revision_token_for_post( $fresh_post );
        $target = isset( $adapter_result['target'] ) && is_array( $adapter_result['target'] )
            ? $adapter_result['target']
            : array();
        $operations = isset( $adapter_result['operations'] ) && is_array( $adapter_result['operations'] )
            ? $adapter_result['operations']
            : array();
        if ( $fresh_post && function_exists( 'tf_frontend_editor_resolver_v2_resolve_page_block_target' ) ) {
            $fresh_blocks = parse_blocks( $fresh_post->post_content );
            $resolved_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $fresh_blocks, $target );
            if ( is_array( $resolved_target ) ) {
                $target = $resolved_target;
            }
            foreach ( $operations as $index => $operation_target ) {
                if ( ! is_array( $operation_target ) ) {
                    continue;
                }
                $refreshed_operation_target = tf_frontend_editor_resolver_v2_resolve_page_block_target( $fresh_blocks, $operation_target );
                if ( is_array( $refreshed_operation_target ) ) {
                    $operations[ $index ] = $refreshed_operation_target;
                }
            }
        }
        $target['revisionToken'] = $revision_token;

        return array(
            'postId' => isset( $adapter_result['postId'] ) ? $adapter_result['postId'] : ( $fresh_post ? $fresh_post->ID : 0 ),
            'revisionToken' => $revision_token,
            'postContent' => $fresh_post ? $fresh_post->post_content : '',
            'fieldType' => isset( $target['fieldType'] ) ? $target['fieldType'] : '',
            'targetId' => isset( $target['targetId'] ) ? $target['targetId'] : '',
            'target' => $target,
            'operations' => $operations,
            'action' => isset( $adapter_result['action'] ) ? $adapter_result['action'] : '',
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_apply_page_block_adapter_update' ) ) {
    function tf_frontend_editor_apply_page_block_adapter_update( $post, $blocks, $resolved_target, $value ) {
        $adapter_result = tf_frontend_editor_save_adapter_apply_page_block_operations(
            $blocks,
            $resolved_target,
            array(
                array(
                    'field' => isset( $resolved_target['field'] ) ? $resolved_target['field'] : '',
                    'value' => $value,
                    'sourceHash' => isset( $resolved_target['sourceHash'] ) ? $resolved_target['sourceHash'] : '',
                ),
            )
        );
        if ( null === $adapter_result || ( is_array( $adapter_result ) && ! empty( $adapter_result['conflict'] ) ) ) {
            return null;
        }

        $updated_content = serialize_blocks( $adapter_result['blocks'] );
        $update_result = wp_update_post( array(
            'ID' => $post->ID,
            'post_content' => $updated_content,
        ), true );
        if ( is_wp_error( $update_result ) ) {
            return $update_result;
        }

        return array(
            'postId' => $post->ID,
            'postContent' => $updated_content,
            'target' => isset( $adapter_result['target'] ) ? $adapter_result['target'] : $resolved_target,
            'operations' => isset( $adapter_result['operations'] ) ? $adapter_result['operations'] : array(),
            'action' => isset( $adapter_result['action'] ) ? $adapter_result['action'] : '',
        );
    }
}`;
