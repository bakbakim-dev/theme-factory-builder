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
  },
  'core/image': {
    url: 'url',
    alt: 'text',
  },
};

export interface WhipifyFrontendEditorParsedBlock {
  blockName?: string;
  attrs?: Record<string, unknown>;
  innerBlocks?: WhipifyFrontendEditorParsedBlock[];
  innerHTML?: string;
  innerContent?: Array<string | null>;
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

const replaceFirstImageAttribute = (html: string, attributeName: 'src' | 'alt', nextValue: string): string =>
  html.replace(/<img(\s[^>]*)?>/i, (match, attributes = '') => {
    const attributePattern = new RegExp(`(\\s)${attributeName}=(['"]).*?\\2`, 'i');
    const replacement = ` ${attributeName}="${escapeHtmlAttribute(nextValue)}"`;

    if (attributePattern.test(attributes)) {
      return `<img${attributes.replace(attributePattern, replacement)}>`;
    }

    return `<img${attributes}${replacement}>`;
  });

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
  } else if (blockName === 'core/image' && field === 'url') {
    nextInnerHTML = replaceFirstImageAttribute(innerHTML, 'src', value);
  } else if (blockName === 'core/image' && field === 'alt') {
    nextInnerHTML = replaceFirstImageAttribute(innerHTML, 'alt', value);
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

const getFieldType = (blockName: string | undefined, field: string): string | null => {
  const fieldSchema = blockName ? PAGE_BLOCK_FIELD_SCHEMA[blockName] : undefined;
  return fieldSchema?.[field] || null;
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

if ( ! function_exists( 'tf_frontend_editor_page_block_target_from_request' ) ) {
    function tf_frontend_editor_page_block_target_from_payload( $payload ) {
        $payload = is_array( $payload ) ? $payload : array();
        $post_id = isset( $payload['postId'] ) ? absint( $payload['postId'] ) : 0;
        $field = isset( $payload['field'] ) ? sanitize_key( wp_unslash( $payload['field'] ) ) : '';
        $revision_token = isset( $payload['revisionToken'] ) ? sanitize_text_field( wp_unslash( $payload['revisionToken'] ) ) : '';
        $source_hash = isset( $payload['sourceHash'] ) ? sanitize_text_field( wp_unslash( $payload['sourceHash'] ) ) : '';
        $raw_block_path = isset( $payload['blockPath'] ) ? sanitize_text_field( wp_unslash( $payload['blockPath'] ) ) : '';
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
            'targetId' => 'page-block:' . $post_id . ':' . $tree_path_key . ':' . $field,
            'identity' => array(
                'postId' => $post_id,
                'treePathKey' => $tree_path_key,
            ),
            'treePath' => $tree_path,
            'field' => $field,
            'revisionToken' => $revision_token,
            'sourceHash' => $source_hash,
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
        } elseif ( 'core/image' === $block_name && 'url' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_image_attribute( $inner_html, 'src', $value );
        } elseif ( 'core/image' === $block_name && 'alt' === $field ) {
            $updated_inner_html = tf_frontend_editor_page_block_replace_first_image_attribute( $inner_html, 'alt', $value );
        }

        if ( $updated_inner_html === $inner_html ) {
            return $item;
        }

        $item['innerHTML'] = $updated_inner_html;
        $item['innerContent'] = array( $updated_inner_html );
        return $item;
    }
}

if ( ! function_exists( 'tf_frontend_editor_resolve_page_block_target' ) ) {
    function tf_frontend_editor_resolve_page_block_target( $blocks, $target ) {
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
        $target['targetId'] = 'page-block:' . absint( $target['identity']['postId'] ) . ':' . $target['identity']['treePathKey'] . ':' . $field;
        $target['fieldType'] = $field_schema[ $block_name ][ $field ];
        $target['sourceHash'] = tf_frontend_editor_page_block_source_hash( $resolved_block, $field );
        $target['legacy']['blockPath'] = $tree_path;

        return $target;
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

if ( ! function_exists( 'tf_frontend_editor_apply_page_block_adapter_update' ) ) {
    function tf_frontend_editor_apply_page_block_adapter_update( $post, $blocks, $resolved_target, $value ) {
        $tree_path = tf_frontend_editor_page_block_tree_path_from_target( $resolved_target );
        $field = isset( $resolved_target['field'] ) ? $resolved_target['field'] : '';
        $updated_blocks = tf_frontend_editor_page_block_mutate_at_tree_path( $blocks, $tree_path, $field, $value );
        if ( null === $updated_blocks ) {
            return null;
        }

        $updated_content = serialize_blocks( $updated_blocks );
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
            'target' => $resolved_target,
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_adapter_result' ) ) {
    function tf_frontend_editor_page_block_adapter_result( $fresh_post, $adapter_result ) {
        $revision_token = tf_frontend_editor_revision_token_for_post( $fresh_post );
        $target = isset( $adapter_result['target'] ) && is_array( $adapter_result['target'] )
            ? $adapter_result['target']
            : array();
        if ( $fresh_post && function_exists( 'tf_frontend_editor_resolve_page_block_target' ) ) {
            $fresh_blocks = parse_blocks( $fresh_post->post_content );
            $resolved_target = tf_frontend_editor_resolve_page_block_target( $fresh_blocks, $target );
            if ( is_array( $resolved_target ) ) {
                $target = $resolved_target;
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
        );
    }
}`;
