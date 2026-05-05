import {
  buildWhipifyQuickEditorSchemaSlotSupport,
  type WhipifyQuickEditorDefaults,
} from './whipifyQuickEditor.ts';
import {
  PAGE_BLOCK_WHITELIST,
  renderWhipifyFrontendEditorPageBlockAdapterPhp,
} from './whipifyFrontendEditorPageBlockAdapter.ts';

export interface WhipifyFrontendEditorArtifacts {
  php: string;
  js: string;
  css: string;
}

export interface WhipifyFrontendEditorSupportMap {
  globalChrome: {
    header: string[];
    footer: string[];
    social: string[];
  };
  pageBlocks: Record<string, string[]>;
}

export interface WhipifyFrontendEditorPageBlockFieldSupport {
  blockName: string;
  field: string;
  fieldType: 'plainText' | 'richText' | 'url' | 'imageAlt' | 'mediaId' | 'number';
  scope: 'page-block' | 'media';
}

interface BuildWhipifyFrontendEditorSupportMapInput {
  hasHeaderSlots?: string[];
  hasFooterSlots?: string[];
  hasSocialSlots?: string[];
}

interface BuildWhipifyFrontendEditorArtifactsInput {
  defaults: WhipifyQuickEditorDefaults;
  supportMap: WhipifyFrontendEditorSupportMap;
  themeSlug: string;
}

const escapePhpSingleQuoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const phpString = (value: string): string => `'${escapePhpSingleQuoted(value)}'`;
const phpArray = (values: string[]): string => `array( ${values.map(phpString).join(', ')} )`;
const uniqueValues = (values: string[] = []): string[] => Array.from(new Set(values.filter(Boolean)));

const renderPhpAssoc = (entries: Array<[string, string | string[]]>): string => `array(
${entries
  .map(([key, value]) => `        ${phpString(key)} => ${Array.isArray(value) ? phpArray(value) : phpString(value)}`)
  .join(',\n')}
    )`;

const renderDefaults = (defaults: WhipifyQuickEditorDefaults): string => renderPhpAssoc(Object.entries(defaults) as Array<[string, string]>);

const renderChromeFields = (supportMap: WhipifyFrontendEditorSupportMap): string => `array(
        'header' => ${phpArray(supportMap.globalChrome.header)},
        'footer' => ${phpArray(supportMap.globalChrome.footer)},
        'social' => ${phpArray(supportMap.globalChrome.social)},
    )`;

const renderPageBlockWhitelist = (): string => `array(
${Object.entries(PAGE_BLOCK_WHITELIST)
  .map(([blockName, allowedFields]) => `        ${phpString(blockName)} => ${phpArray(allowedFields)}`)
  .join(',\n')}
    )`;

const renderPageBlocks = (supportMap: WhipifyFrontendEditorSupportMap): string => `array(
${Object.entries(supportMap.pageBlocks)
  .map(([blockName, allowedFields]) => `        ${phpString(blockName)} => ${phpArray(allowedFields)}`)
  .join(',\n')}
    )`;

const renderPhp = (defaults: WhipifyQuickEditorDefaults, supportMap: WhipifyFrontendEditorSupportMap, themeSlug: string): string => `<?php
if ( ! function_exists( 'tf_frontend_editor_humanize_label' ) ) {
    function tf_frontend_editor_humanize_label( $value ) {
        $value = is_string( $value ) ? $value : '';
        $value = preg_replace( '/[_-]+/', ' ', $value );
        $value = trim( preg_replace( '/\s+/', ' ', $value ) );

        return '' === $value ? '' : ucwords( $value );
    }
}

if ( ! function_exists( 'tf_frontend_editor_chrome_field_label' ) ) {
    function tf_frontend_editor_chrome_field_label( $scope, $field ) {
        $labels = array(
            'header' => array(
                'primary_cta_text' => 'Primary CTA Text',
                'primary_cta_url' => 'Primary CTA URL',
                'secondary_cta_text' => 'Secondary CTA Text',
                'secondary_cta_url' => 'Secondary CTA URL',
                'phone' => 'Phone Number',
                'announcement_text' => 'Announcement Text',
                'announcement_url' => 'Announcement URL',
            ),
            'footer' => array(
                'business_name' => 'Business Name',
                'address_line_1' => 'Address Line 1',
                'address_line_2' => 'Address Line 2',
                'contact_line' => 'Contact Line',
            ),
            'social' => array(
                'facebook' => 'Facebook URL',
                'instagram' => 'Instagram URL',
                'linkedin' => 'LinkedIn URL',
                'x' => 'X URL',
            ),
        );

        if ( isset( $labels[ $scope ][ $field ] ) ) {
            return $labels[ $scope ][ $field ];
        }

        return tf_frontend_editor_humanize_label( $field );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_field_label' ) ) {
    function tf_frontend_editor_page_block_field_label( $block_name, $field ) {
        $labels = array(
            'core/heading' => array(
                'content' => 'Heading',
            ),
            'core/paragraph' => array(
                'content' => 'Paragraph',
            ),
            'core/button' => array(
                'text' => 'Button Text',
                'url' => 'Button URL',
                'linkTarget' => 'Button Target',
                'rel' => 'Button Rel',
            ),
            'core/details' => array(
                'summary' => 'Summary',
            ),
            'theme-factory/button' => array(
                'text' => 'Button Text',
                'href' => 'Button URL',
                'target' => 'Button Target',
                'rel' => 'Button Rel',
            ),
            'theme-factory/container' => array(
                'text' => 'Button Text',
            ),
            'core/image' => array(
                'url' => 'Image Source',
                'alt' => 'Image Alt',
                'id' => 'Attachment ID',
            ),
        );

        if ( isset( $labels[ $block_name ][ $field ] ) ) {
            return $labels[ $block_name ][ $field ];
        }

        return tf_frontend_editor_humanize_label( $field );
    }
}

if ( ! function_exists( 'tf_frontend_editor_target_descriptor' ) ) {
    function tf_frontend_editor_target_descriptor( $surface_kind, $provenance_label, $target_label, $open_target, $source_scope, $source_key = '', $secondary_source_key = '' ) {
        return array(
            'surfaceKind' => $surface_kind,
            'provenanceLabel' => $provenance_label,
            'targetLabel' => $target_label,
            'openTarget' => $open_target,
            'sourceScope' => $source_scope,
            'sourceKey' => $source_key,
            'secondarySourceKey' => $secondary_source_key,
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_defaults' ) ) {
    function tf_frontend_editor_defaults() {
        return ${renderDefaults(defaults)};
    }
}

if ( ! function_exists( 'tf_frontend_editor_support_map' ) ) {
    function tf_frontend_editor_support_map() {
        return array(
            'globalChrome' => ${renderChromeFields(supportMap)},
            'pageBlocks' => ${renderPageBlocks(supportMap)},
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_user_can_edit' ) ) {
    function tf_frontend_editor_current_user_can_edit() {
        return is_user_logged_in() && ( current_user_can( 'edit_pages' ) || current_user_can( 'edit_theme_options' ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_user_can_edit_post' ) ) {
    function tf_frontend_editor_current_user_can_edit_post( $post_id ) {
        return tf_frontend_editor_current_user_can_edit()
            && 'page' === get_post_type( $post_id )
            && current_user_can( 'edit_post', $post_id );
    }
}

if ( ! function_exists( 'tf_frontend_editor_cookie_name' ) ) {
    function tf_frontend_editor_cookie_name() {
        return 'whipify_frontend_editor_enabled';
    }
}

if ( ! function_exists( 'tf_frontend_editor_set_enabled_cookie' ) ) {
    function tf_frontend_editor_set_enabled_cookie( $enabled ) {
        $cookie_name = tf_frontend_editor_cookie_name();
        $secure = is_ssl();
        $httponly = true;
        $path = defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/';
        $domain = defined( 'COOKIE_DOMAIN' ) ? COOKIE_DOMAIN : '';
        $expires = $enabled ? time() + DAY_IN_SECONDS : time() - HOUR_IN_SECONDS;
        $value = $enabled ? '1' : '0';

        setcookie( $cookie_name, $value, $expires, $path, $domain, $secure, $httponly );
        $_COOKIE[ $cookie_name ] = $value;
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_url' ) ) {
    function tf_frontend_editor_current_url() {
        $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
        return home_url( $request_uri );
    }
}

if ( ! function_exists( 'tf_frontend_editor_handle_toggle_request' ) ) {
    function tf_frontend_editor_handle_toggle_request() {
        if ( ! isset( $_GET['whipify_frontend_editor_toggle'] ) ) {
            return;
        }

        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            return;
        }

        check_admin_referer( 'tf_frontend_editor_toggle' );

        $enabled = '1' === sanitize_text_field( wp_unslash( $_GET['whipify_frontend_editor_toggle'] ) );
        tf_frontend_editor_set_enabled_cookie( $enabled );

        $redirect_url = remove_query_arg(
            array( 'whipify_frontend_editor_toggle', '_wpnonce' ),
            wp_get_referer() ? wp_get_referer() : tf_frontend_editor_current_url()
        );

        wp_safe_redirect( $redirect_url ? $redirect_url : home_url( '/' ) );
        exit;
    }
}

if ( ! function_exists( 'tf_frontend_editor_is_enabled' ) ) {
    function tf_frontend_editor_is_enabled() {
        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            return false;
        }

        return isset( $_COOKIE[ tf_frontend_editor_cookie_name() ] ) && '1' === $_COOKIE[ tf_frontend_editor_cookie_name() ];
    }
}

if ( ! function_exists( 'tf_frontend_editor_allowed_chrome_fields' ) ) {
    function tf_frontend_editor_allowed_chrome_fields() {
        return array(
            'header' => ${phpArray(supportMap.globalChrome.header)},
            'footer' => ${phpArray(supportMap.globalChrome.footer)},
            'social' => ${phpArray(supportMap.globalChrome.social)},
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_whitelist' ) ) {
    function tf_frontend_editor_page_block_whitelist() {
        return ${renderPageBlockWhitelist()};
    }
}

if ( ! function_exists( 'tf_frontend_editor_sanitize_block_field' ) ) {
    function tf_frontend_editor_sanitize_block_field( $field, $value ) {
        if ( 'url' === $field || 'href' === $field ) {
            return esc_url_raw( $value );
        }

        if ( 'id' === $field || 'mediaId' === $field ) {
            return (string) absint( $value );
        }

        if ( 'width' === $field || 'height' === $field ) {
            return '' === (string) $value ? '' : (string) absint( $value );
        }

        return sanitize_text_field( $value );
    }
}

if ( ! function_exists( 'tf_frontend_editor_revision_token_for_post' ) ) {
    function tf_frontend_editor_revision_token_for_post( $post ) {
        if ( ! $post || ! isset( $post->ID ) ) {
            return '';
        }

        return hash( 'sha256', $post->ID . '|' . $post->post_modified_gmt . '|' . $post->post_content );
    }
}

if ( ! function_exists( 'tf_frontend_editor_global_chrome_revision_token' ) ) {
    function tf_frontend_editor_global_chrome_revision_token( $settings ) {
        return hash( 'sha256', wp_json_encode( $settings ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_global_chrome_source_hash' ) ) {
    function tf_frontend_editor_global_chrome_source_hash( $scope, $field, $value ) {
        return hash(
            'sha256',
            wp_json_encode(
                array(
                    'scope' => $scope,
                    'field' => $field,
                    'value' => is_scalar( $value ) ? (string) $value : '',
                )
            )
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_render_chrome_text' ) ) {
    function tf_frontend_editor_render_chrome_text( $scope, $field, $fallback = '' ) {
        $value = function_exists( 'tf_quick_editor_get' )
            ? tf_quick_editor_get( $field, $fallback )
            : $fallback;

        if ( ! tf_frontend_editor_is_enabled() ) {
            return esc_html( $value );
        }

        $settings = function_exists( 'tf_quick_editor_settings' )
            ? tf_quick_editor_settings()
            : array();
        $revision = tf_frontend_editor_global_chrome_revision_token( $settings );

        $source_hash = tf_frontend_editor_global_chrome_source_hash( $scope, $field, $value );
        $descriptor = tf_frontend_editor_target_descriptor(
            'global-chrome',
            'Global chrome',
            tf_frontend_editor_chrome_field_label( $scope, $field ),
            'quick-editor',
            $scope,
            $field
        );
        $target = array_merge(
            array(
                'version' => '2',
                'entityKind' => 'global-chrome',
                'entitySource' => 'wordpress-global',
                'stableId' => 'global-chrome:' . $scope,
                'targetId' => 'global-chrome:' . $scope . ':' . $field,
                'identity' => array(
                    'scope' => $scope,
                    'stableId' => 'global-chrome:' . $scope,
                ),
                'field' => $field,
                'fieldType' => 'text',
                'revisionToken' => $revision,
                'sourceHash' => $source_hash,
            ),
            $descriptor
        );

        return sprintf(
            '<span data-whipify-editable="true" data-whipify-edit-scope="global-chrome" data-whipify-surface-kind="global-chrome" data-whipify-provenance-label="%1$s" data-whipify-target-label="%2$s" data-whipify-open-target="%3$s" data-whipify-source-scope="%4$s" data-whipify-source-key="%5$s" data-whipify-scope="%4$s" data-whipify-field="%5$s" data-whipify-kind="text" data-whipify-entity-kind="global-chrome" data-whipify-entity-source="wordpress-global" data-whipify-target-id="%6$s" data-whipify-field-type="text" data-whipify-revision="%7$s" data-whipify-source-hash="%8$s" data-whipify-target="%9$s">%10$s</span>',
            esc_attr( $descriptor['provenanceLabel'] ),
            esc_attr( $descriptor['targetLabel'] ),
            esc_attr( $descriptor['openTarget'] ),
            esc_attr( $descriptor['sourceScope'] ),
            esc_attr( $descriptor['sourceKey'] ),
            esc_attr( $target['targetId'] ),
            esc_attr( $revision ),
            esc_attr( $source_hash ),
            esc_attr( wp_json_encode( $target ) ),
            esc_html( $value )
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_render_chrome_link_attributes' ) ) {
    function tf_frontend_editor_render_chrome_link_attributes( $scope, $field, $fallback = '' ) {
        $value = function_exists( 'tf_quick_editor_get' )
            ? tf_quick_editor_get( $field, $fallback )
            : $fallback;

        if ( ! tf_frontend_editor_is_enabled() ) {
            return sprintf(
                'href="%1$s"',
                esc_url( $value )
            );
        }

        $settings = function_exists( 'tf_quick_editor_settings' )
            ? tf_quick_editor_settings()
            : array();
        $revision = tf_frontend_editor_global_chrome_revision_token( $settings );

        $source_hash = tf_frontend_editor_global_chrome_source_hash( $scope, $field, $value );
        $descriptor = tf_frontend_editor_target_descriptor(
            'global-chrome',
            'Global chrome',
            tf_frontend_editor_chrome_field_label( $scope, $field ),
            'quick-editor',
            $scope,
            $field
        );
        $target = array_merge(
            array(
                'version' => '2',
                'entityKind' => 'global-chrome',
                'entitySource' => 'wordpress-global',
                'stableId' => 'global-chrome:' . $scope,
                'targetId' => 'global-chrome:' . $scope . ':' . $field,
                'identity' => array(
                    'scope' => $scope,
                    'stableId' => 'global-chrome:' . $scope,
                ),
                'field' => $field,
                'fieldType' => 'url',
                'revisionToken' => $revision,
                'sourceHash' => $source_hash,
            ),
            $descriptor
        );

        return sprintf(
            'href="%1$s" data-whipify-editable="true" data-whipify-edit-scope="global-chrome" data-whipify-surface-kind="global-chrome" data-whipify-provenance-label="%2$s" data-whipify-target-label="%3$s" data-whipify-open-target="%4$s" data-whipify-source-scope="%5$s" data-whipify-source-key="%6$s" data-whipify-scope="%5$s" data-whipify-field="%6$s" data-whipify-kind="url" data-whipify-entity-kind="global-chrome" data-whipify-entity-source="wordpress-global" data-whipify-target-id="%7$s" data-whipify-field-type="url" data-whipify-revision="%8$s" data-whipify-source-hash="%9$s" data-whipify-target="%10$s"',
            esc_url( $value ),
            esc_attr( $descriptor['provenanceLabel'] ),
            esc_attr( $descriptor['targetLabel'] ),
            esc_attr( $descriptor['openTarget'] ),
            esc_attr( $descriptor['sourceScope'] ),
            esc_attr( $descriptor['sourceKey'] ),
            esc_attr( $target['targetId'] ),
            esc_attr( $revision ),
            esc_attr( $source_hash ),
            esc_attr( wp_json_encode( $target ) )
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_string' ) ) {
    function tf_frontend_editor_block_path_string( $path ) {
        $path = array_map( 'absint', is_array( $path ) ? $path : array() );
        return implode( '.', $path );
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_for_parsed_block' ) ) {
    function tf_frontend_editor_block_path_for_parsed_block( $parsed_block ) {
        $attrs = isset( $parsed_block['attrs'] ) && is_array( $parsed_block['attrs'] ) ? $parsed_block['attrs'] : array();
        $tree_path = isset( $attrs['__tf_frontend_editor_tree_path'] ) ? $attrs['__tf_frontend_editor_tree_path'] : '';
        if ( ! is_string( $tree_path ) || '' === $tree_path ) {
            return array();
        }

        return array_map( 'absint', array_filter( explode( '.', $tree_path ), 'strlen' ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_is_container_button_block' ) ) {
    function tf_frontend_editor_is_container_button_block( $parsed_block ) {
        $attrs = isset( $parsed_block['attrs'] ) && is_array( $parsed_block['attrs'] ) ? $parsed_block['attrs'] : array();
        return isset( $attrs['tagName'] ) && 'button' === strtolower( (string) $attrs['tagName'] );
    }
}

if ( ! function_exists( 'tf_frontend_editor_prepare_render_block_data' ) ) {
    function tf_frontend_editor_prepare_render_block_data( $parsed_block, $source_block, $parent_block ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $parsed_block;
        }

        $post_id = get_the_ID();
        if ( ! $post_id || ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            return $parsed_block;
        }

        static $tf_frontend_editor_tree_path_counters = array();
        static $tf_frontend_editor_tree_path_post_id = 0;

        if ( $tf_frontend_editor_tree_path_post_id !== (int) $post_id ) {
            $tf_frontend_editor_tree_path_counters = array();
            $tf_frontend_editor_tree_path_post_id = (int) $post_id;
        }

        $parent_tree_path = '';
        if ( $parent_block instanceof WP_Block && isset( $parent_block->parsed_block['attrs']['__tf_frontend_editor_tree_path'] ) ) {
            $parent_tree_path = (string) $parent_block->parsed_block['attrs']['__tf_frontend_editor_tree_path'];
        }

        $counter_key = '' === $parent_tree_path ? 'root' : $parent_tree_path;
        $next_index = isset( $tf_frontend_editor_tree_path_counters[ $counter_key ] )
            ? (int) $tf_frontend_editor_tree_path_counters[ $counter_key ] + 1
            : 0;
        $tf_frontend_editor_tree_path_counters[ $counter_key ] = $next_index;

        $tree_path = '' === $parent_tree_path
            ? array( (string) $next_index )
            : array_merge( explode( '.', $parent_tree_path ), array( (string) $next_index ) );

        if ( ! isset( $parsed_block['attrs'] ) || ! is_array( $parsed_block['attrs'] ) ) {
            $parsed_block['attrs'] = array();
        }
        $parsed_block['attrs']['__tf_frontend_editor_tree_path'] = implode( '.', $tree_path );

        return $parsed_block;
    }
}

${renderWhipifyFrontendEditorPageBlockAdapterPhp()}

if ( ! function_exists( 'tf_frontend_editor_tag_block_content' ) ) {
    function tf_frontend_editor_tag_block_content( $block_content, $parsed_block ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $block_content;
        }

        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : '';
        $whitelist = tf_frontend_editor_page_block_whitelist();
        if ( ! isset( $whitelist[ $block_name ] ) || ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
            return $block_content;
        }

        if ( 'theme-factory/container' === $block_name && ! tf_frontend_editor_is_container_button_block( $parsed_block ) ) {
            return $block_content;
        }

        $post_id = get_the_ID();
        if ( ! $post_id || ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            return $block_content;
        }

        if ( 'core/button' === $block_name || 'theme-factory/button' === $block_name ) {
            $field = 'text';
        } elseif ( 'core/details' === $block_name ) {
            $field = 'summary';
        } elseif ( 'theme-factory/container' === $block_name ) {
            $field = 'text';
        } elseif ( 'core/image' === $block_name ) {
            $field = 'url';
        } else {
            $field = 'content';
        }
        $revision = tf_frontend_editor_revision_token_for_post( get_post( $post_id ) );
        $source_hash = function_exists( 'tf_frontend_editor_page_block_source_hash' )
            ? tf_frontend_editor_page_block_source_hash( $parsed_block, $field )
            : '';
        $tree_path = tf_frontend_editor_block_path_for_parsed_block( $parsed_block );
        $tree_path_key = tf_frontend_editor_block_path_string( $tree_path );
        $descriptor = tf_frontend_editor_target_descriptor(
            'page-block',
            'Page block',
            tf_frontend_editor_page_block_field_label( $block_name, $field ),
            'gutenberg',
            'page-block',
            $field
        );
        $target = array_merge(
            array(
                'version' => '2',
                'entityKind' => 'page-block',
                'entitySource' => 'wordpress-post',
                'stableId' => 'page-block:' . $post_id . ':' . $tree_path_key,
                'targetId' => 'page-block:' . $post_id . ':' . $tree_path_key . ':' . $field,
                'identity' => array(
                    'postId' => (int) $post_id,
                    'treePathKey' => $tree_path_key,
                    'stableId' => 'page-block:' . $post_id . ':' . $tree_path_key,
                ),
                'blockName' => $block_name,
                'treePath' => array_map( 'strval', $tree_path ),
                'field' => $field,
                'fieldType' => isset( tf_frontend_editor_page_block_field_schema()[ $block_name ][ $field ] )
                    ? tf_frontend_editor_page_block_field_schema()[ $block_name ][ $field ]
                    : 'text',
                'revisionToken' => $revision,
                'sourceHash' => $source_hash,
            ),
            $descriptor
        );

        $processor = new WP_HTML_Tag_Processor( $block_content );
        if ( 'core/image' === $block_name ) {
            $did_locate_tag = $processor->next_tag( array( 'tag_name' => 'img' ) );
        } elseif ( 'core/details' === $block_name ) {
            $did_locate_tag = $processor->next_tag( array( 'tag_name' => 'summary' ) );
        } elseif ( 'theme-factory/container' === $block_name ) {
            $did_locate_tag = $processor->next_tag( array( 'tag_name' => 'button' ) );
        } else {
            $did_locate_tag = $processor->next_tag();
        }
        if ( ! $did_locate_tag ) {
            return $block_content;
        }

        $processor->set_attribute( 'data-whipify-editable', 'true' );
        $processor->set_attribute( 'data-whipify-edit-scope', 'page-block' );
        $processor->set_attribute( 'data-whipify-surface-kind', 'page-block' );
        $processor->set_attribute( 'data-whipify-provenance-label', $descriptor['provenanceLabel'] );
        $processor->set_attribute( 'data-whipify-target-label', $descriptor['targetLabel'] );
        $processor->set_attribute( 'data-whipify-open-target', $descriptor['openTarget'] );
        $processor->set_attribute( 'data-whipify-source-scope', $descriptor['sourceScope'] );
        $processor->set_attribute( 'data-whipify-source-key', $descriptor['sourceKey'] );
        $processor->set_attribute( 'data-whipify-entity-kind', 'page-block' );
        $processor->set_attribute( 'data-whipify-entity-source', 'wordpress-post' );
        $processor->set_attribute( 'data-whipify-post-id', (string) $post_id );
        $processor->set_attribute( 'data-whipify-block-name', $block_name );
        $processor->set_attribute( 'data-whipify-block-path', $tree_path_key );
        $processor->set_attribute( 'data-whipify-tree-path', $tree_path_key );
        $processor->set_attribute( 'data-whipify-field', $field );
        $processor->set_attribute( 'data-whipify-field-type', isset( $target['fieldType'] ) ? (string) $target['fieldType'] : 'text' );
        $processor->set_attribute( 'data-whipify-target-id', $target['targetId'] );
        $processor->set_attribute( 'data-whipify-revision', $revision );
        $processor->set_attribute( 'data-whipify-source-hash', $source_hash );
        $processor->set_attribute( 'data-whipify-target', wp_json_encode( $target ) );
        if ( 'core/button' === $block_name || 'theme-factory/button' === $block_name ) {
            $secondary_field = 'core/button' === $block_name ? 'url' : 'href';
            $processor->set_attribute( 'data-whipify-secondary-field', $secondary_field );
            $processor->set_attribute( 'data-whipify-secondary-target-label', tf_frontend_editor_page_block_field_label( $block_name, $secondary_field ) );
            $processor->set_attribute( 'data-whipify-secondary-source-key', $secondary_field );
            if ( function_exists( 'tf_frontend_editor_page_block_source_hash' ) ) {
                $processor->set_attribute( 'data-whipify-secondary-source-hash', tf_frontend_editor_page_block_source_hash( $parsed_block, $secondary_field ) );
            }
        } elseif ( 'core/image' === $block_name ) {
            $processor->set_attribute( 'data-whipify-secondary-field', 'alt' );
            $processor->set_attribute( 'data-whipify-secondary-target-label', tf_frontend_editor_page_block_field_label( $block_name, 'alt' ) );
            $processor->set_attribute( 'data-whipify-secondary-source-key', 'alt' );
            if ( function_exists( 'tf_frontend_editor_page_block_source_hash' ) ) {
                $processor->set_attribute( 'data-whipify-secondary-source-hash', tf_frontend_editor_page_block_source_hash( $parsed_block, 'alt' ) );
            }
            if ( isset( $parsed_block['attrs']['id'] ) && is_scalar( $parsed_block['attrs']['id'] ) && '' !== (string) $parsed_block['attrs']['id'] ) {
                $processor->set_attribute( 'data-whipify-media-id', (string) $parsed_block['attrs']['id'] );
                if ( function_exists( 'tf_frontend_editor_page_block_source_hash' ) ) {
                    $processor->set_attribute( 'data-whipify-media-source-hash', tf_frontend_editor_page_block_source_hash( $parsed_block, 'id' ) );
                }
            }
        }
        return $processor->get_updated_html();
    }
}

if ( ! function_exists( 'tf_frontend_editor_render_supported_block' ) ) {
    function tf_frontend_editor_render_supported_block( $block_content, $parsed_block ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $block_content;
        }

        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : '';
        $whitelist = tf_frontend_editor_page_block_whitelist();
        $post_id = get_the_ID();
        if ( ! isset( $whitelist[ $block_name ] ) || ! $post_id || ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            return $block_content;
        }

        return tf_frontend_editor_tag_block_content( $block_content, $parsed_block );
    }
}

if ( ! function_exists( 'tf_frontend_editor_bootstrap_config' ) ) {
    function tf_frontend_editor_bootstrap_config() {
        return array(
            'themeSlug' => ${phpString(themeSlug)},
            'transport' => function_exists( 'tfb_frontend_editor_rest_base_url' ) ? 'rest' : 'unavailable',
            'restBaseUrl' => function_exists( 'tfb_frontend_editor_rest_base_url' ) ? tfb_frontend_editor_rest_base_url() : '',
            'restNonce' => wp_create_nonce( 'wp_rest' ),
            'lockUrl' => function_exists( 'tfb_frontend_editor_lock_url' ) ? tfb_frontend_editor_lock_url() : '',
            'lockRefreshInterval' => function_exists( 'tfb_frontend_editor_lock_interval' ) ? (int) tfb_frontend_editor_lock_interval() : 20,
            'quickEditorUrl' => admin_url( 'themes.php?page=whipify-quick-editor' ),
            'isEnabled' => tf_frontend_editor_is_enabled(),
            'editScopes' => array( 'global-chrome', 'page-block', 'shared-content' ),
            'supportMap' => tf_frontend_editor_support_map(),
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_admin_bar_menu' ) ) {
    function tf_frontend_editor_admin_bar_menu( $wp_admin_bar ) {
        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            return;
        }

        $is_enabled = tf_frontend_editor_is_enabled();
        $toggle_url = wp_nonce_url(
            add_query_arg(
                'whipify_frontend_editor_toggle',
                $is_enabled ? '0' : '1',
                tf_frontend_editor_current_url()
            ),
            'tf_frontend_editor_toggle'
        );

        $wp_admin_bar->add_node( array(
            'id' => 'whipify-frontend-editor-toggle',
            'title' => 'Whipify Edit Mode',
            'href' => $toggle_url,
        ) );
    }
}

add_action( 'init', 'tf_frontend_editor_handle_toggle_request', 20 );
add_action( 'admin_bar_menu', 'tf_frontend_editor_admin_bar_menu', 100 );
if ( ! function_exists( 'tf_frontend_editor_enqueue_assets' ) ) {
    function tf_frontend_editor_enqueue_assets() {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return;
        }

        $script_handle = ${phpString(`${themeSlug}-frontend-editor`)};
        $style_handle = ${phpString(`${themeSlug}-frontend-editor-style`)};
        $script_rel = 'assets/whipify-frontend-editor.js';
        $style_rel = 'assets/whipify-frontend-editor.css';
        $script_path = get_theme_file_path( $script_rel );
        $style_path = get_theme_file_path( $style_rel );
        $script_uri = get_theme_file_uri( $script_rel );
        $style_uri = get_theme_file_uri( $style_rel );
        $script_ver = file_exists( $script_path ) ? (string) filemtime( $script_path ) : '1.0.0';
        $style_ver = file_exists( $style_path ) ? (string) filemtime( $style_path ) : '1.0.0';
        $script_deps = wp_script_is( 'wp-interactivity', 'registered' ) ? array( 'wp-interactivity' ) : array();

        wp_enqueue_style( $style_handle, $style_uri, array(), $style_ver );
        wp_enqueue_media();
        wp_enqueue_script( $script_handle, $script_uri, $script_deps, $script_ver, true );
        wp_add_inline_script(
            $script_handle,
            'window.whipifyFrontendEditorConfig = ' . wp_json_encode( tf_frontend_editor_bootstrap_config() ) . ';',
            'before'
        );
    }
}

add_action( 'wp_enqueue_scripts', 'tf_frontend_editor_enqueue_assets', 100 );
add_filter( 'render_block_data', 'tf_frontend_editor_prepare_render_block_data', 10, 3 );
add_filter( 'render_block_core/heading', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/paragraph', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/button', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/image', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/details', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_theme-factory/button', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_theme-factory/container', 'tf_frontend_editor_render_supported_block', 10, 2 );`;

const renderJs = (defaults: WhipifyQuickEditorDefaults, supportMap: WhipifyFrontendEditorSupportMap, themeSlug: string): string => `const whipifyFrontendEditorConfig = {
  themeSlug: ${JSON.stringify(themeSlug)},
  transport: 'rest',
  restBaseUrl: '',
  restNonce: '',
  lockUrl: '',
  lockRefreshInterval: 20,
  quickEditorUrl: '/wp-admin/themes.php?page=whipify-quick-editor',
  isEnabled: false,
  editScopes: ['global-chrome', 'page-block', 'shared-content'],
  defaults: ${JSON.stringify(defaults)},
  supportMap: ${JSON.stringify(supportMap)},
  ...(window.whipifyFrontendEditorConfig || {}),
};

const panelClassName = 'whipify-frontend-editor-panel';
const activeClassName = 'is-whipify-frontend-editor-enabled';
const selectedClassName = 'is-whipify-selected';
const activePageLock = {
  postId: '',
  timer: null,
};
const pendingDrafts = new Map();
const undoStack = [];
const redoStack = [];
let inlineEditingTarget = null;
const wpInteractivity = window.wp && window.wp.interactivity ? window.wp.interactivity : null;
const frontendEditorState = {
  enabled: Boolean(whipifyFrontendEditorConfig.isEnabled),
  selectedScope: '',
  selectedField: '',
  selectedTargetId: '',
  selectedPostId: '',
  saving: false,
  locked: false,
  notice: '',
};
let interactivityState = frontendEditorState;

if (wpInteractivity && typeof wpInteractivity.store === 'function') {
  const interactivityStore = wpInteractivity.store('whipifyFrontendEditor', {
    state: frontendEditorState,
  });
  if (interactivityStore && interactivityStore.state) {
    interactivityState = interactivityStore.state;
  }
}

function syncInteractivityState(partial) {
  Object.assign(frontendEditorState, partial);
  if (interactivityState !== frontendEditorState) {
    Object.assign(interactivityState, partial);
  }
}

function transportIsRest() {
  return whipifyFrontendEditorConfig.transport === 'rest' && Boolean(whipifyFrontendEditorConfig.restBaseUrl);
}

function buildRestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (whipifyFrontendEditorConfig.restNonce) {
    headers['X-WP-Nonce'] = whipifyFrontendEditorConfig.restNonce;
  }
  return headers;
}

async function readJsonPayload(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {
      success: false,
      data: {
        message: 'Invalid server response.',
      },
    };
  }
}

function getPayloadMessage(payload, fallback) {
  const message = payload?.message || payload?.data?.message || fallback;
  return String(message || fallback || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEditableTarget(target) {
  const rawTarget = target.getAttribute('data-whipify-target') || '';
  if (!rawTarget) {
    return null;
  }

  try {
    return JSON.parse(rawTarget);
  } catch (_error) {
    return null;
  }
}

function humanizeWhipifyLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getEditableTargetAttribute(target, name, fallback = '') {
  if (!(target instanceof HTMLElement)) {
    return fallback;
  }

  const value = target.getAttribute(name);
  return value ? value : fallback;
}

function normalizeEditableTargetString(value, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || typeof value === 'undefined') {
    return fallback;
  }
  return String(value);
}

function getEditableTargetSurfaceKind(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-surface-kind')
    || parsedTarget?.surfaceKind
    || getEditableTargetAttribute(target, 'data-whipify-edit-scope')
    || parsedTarget?.entityKind
    || 'page-block';
}

function getEditableTargetEditScope(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-edit-scope')
    || getEditableTargetSurfaceKind(target, parsedTarget);
}

function getEditableTargetProvenanceLabel(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-provenance-label')
    || parsedTarget?.provenanceLabel
    || humanizeWhipifyLabel(getEditableTargetSurfaceKind(target, parsedTarget));
}

function getEditableTargetTargetLabel(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-target-label')
    || parsedTarget?.targetLabel
    || humanizeWhipifyLabel(getEditableTargetAttribute(target, 'data-whipify-field') || parsedTarget?.field || 'target');
}

function getEditableTargetOpenTarget(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-open-target')
    || parsedTarget?.openTarget
    || (getEditableTargetSurfaceKind(target, parsedTarget) === 'page-block' ? 'gutenberg' : 'quick-editor');
}

function getEditableTargetSourceScope(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-source-scope')
    || normalizeEditableTargetString(parsedTarget?.sourceScope)
    || getEditableTargetSurfaceKind(target, parsedTarget);
}

function getEditableTargetSourceKey(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-source-key')
    || normalizeEditableTargetString(parsedTarget?.sourceKey)
    || getEditableTargetAttribute(target, 'data-whipify-field')
    || normalizeEditableTargetString(parsedTarget?.field)
    || '';
}

function getEditableTargetSecondarySourceKey(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-secondary-source-key')
    || normalizeEditableTargetString(parsedTarget?.secondarySourceKey)
    || getEditableTargetAttribute(target, 'data-whipify-secondary-field')
    || '';
}

function getEditableTargetField(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-field')
    || normalizeEditableTargetString(parsedTarget?.field)
    || getEditableTargetSourceKey(target, parsedTarget);
}

function getEditableTargetSecondaryField(target, parsedTarget) {
  return getEditableTargetAttribute(target, 'data-whipify-secondary-field')
    || normalizeEditableTargetString(parsedTarget?.secondaryField)
    || '';
}

function getEditableTargetKind(target, parsedTarget) {
  const explicitKind = getEditableTargetAttribute(target, 'data-whipify-kind');
  if (explicitKind) {
    return explicitKind;
  }

  const fieldType = getEditableTargetAttribute(target, 'data-whipify-field-type')
    || normalizeEditableTargetString(parsedTarget?.fieldType);
  return fieldType === 'url' ? 'url' : 'text';
}

function getConfiguredDefaultValue(key) {
  const value = whipifyFrontendEditorConfig.defaults?.[key];
  return typeof value === 'string' ? value : '';
}

function mergeEditableTargetState(targetNode, nextTarget) {
  const currentTarget = targetNode instanceof HTMLElement ? parseEditableTarget(targetNode) : null;
  if (!currentTarget) {
    return nextTarget;
  }

  return {
    ...currentTarget,
    ...nextTarget,
    identity: {
      ...(currentTarget.identity || {}),
      ...(nextTarget.identity || {}),
    },
  };
}

function writeEditableTarget(targetNode, target) {
  if (!target) {
    return;
  }

  const mergedTarget = mergeEditableTargetState(targetNode, target);
  targetNode.setAttribute('data-whipify-target', JSON.stringify(mergedTarget));
  if (mergedTarget.surfaceKind) {
    targetNode.setAttribute('data-whipify-edit-scope', mergedTarget.surfaceKind);
    targetNode.setAttribute('data-whipify-surface-kind', mergedTarget.surfaceKind);
  }
  if (mergedTarget.provenanceLabel) {
    targetNode.setAttribute('data-whipify-provenance-label', mergedTarget.provenanceLabel);
  }
  if (mergedTarget.targetLabel) {
    targetNode.setAttribute('data-whipify-target-label', mergedTarget.targetLabel);
  }
  if (mergedTarget.openTarget) {
    targetNode.setAttribute('data-whipify-open-target', mergedTarget.openTarget);
  }
  if (mergedTarget.sourceScope) {
    targetNode.setAttribute('data-whipify-source-scope', mergedTarget.sourceScope);
  }
  if (mergedTarget.sourceKey) {
    targetNode.setAttribute('data-whipify-source-key', mergedTarget.sourceKey);
  }
  if (mergedTarget.secondarySourceKey) {
    targetNode.setAttribute('data-whipify-secondary-source-key', mergedTarget.secondarySourceKey);
  }
  if (target.targetId) {
    targetNode.setAttribute('data-whipify-target-id', target.targetId);
  }
  if (target.entityKind) {
    targetNode.setAttribute('data-whipify-entity-kind', target.entityKind);
  }
  if (target.entitySource) {
    targetNode.setAttribute('data-whipify-entity-source', target.entitySource);
  }
  if (target.field) {
    targetNode.setAttribute('data-whipify-field', target.field);
  }
  if (target.secondaryField) {
    targetNode.setAttribute('data-whipify-secondary-field', target.secondaryField);
  }
  if (target.fieldType) {
    targetNode.setAttribute('data-whipify-field-type', target.fieldType);
  }
  if (target.secondaryFieldType) {
    targetNode.setAttribute('data-whipify-secondary-field-type', target.secondaryFieldType);
  }
  if (target.revisionToken) {
    targetNode.setAttribute('data-whipify-revision', target.revisionToken);
  }
  if (target.sourceHash) {
    targetNode.setAttribute('data-whipify-source-hash', target.sourceHash);
  }
  if (target.mediaId) {
    targetNode.setAttribute('data-whipify-media-id', target.mediaId);
  }
  if (target.mediaSourceHash) {
    targetNode.setAttribute('data-whipify-media-source-hash', target.mediaSourceHash);
  }
  const targetSummary = [mergedTarget.provenanceLabel, mergedTarget.targetLabel].filter(Boolean).join(' · ');
  if (targetSummary) {
    targetNode.setAttribute('title', targetSummary);
  }
}

function syncConflictState(panel, selected, payload) {
  const nextRevision = payload?.data?.revisionToken || '';
  const nextSourceHash = payload?.data?.sourceHash || payload?.data?.target?.sourceHash || '';
  if (nextRevision) {
    panel.dataset.revision = nextRevision;
    if (selected instanceof HTMLElement) {
      selected.setAttribute('data-whipify-revision', nextRevision);
    }
  }
  if (nextSourceHash) {
    panel.dataset.sourceHash = nextSourceHash;
    if (selected instanceof HTMLElement) {
      selected.setAttribute('data-whipify-source-hash', nextSourceHash);
    }
  }
  if (payload?.data?.lockOwner) {
    panel.dataset.locked = '1';
    syncInteractivityState({ locked: true });
  }
}

function updatePanelSummary(panel, targetNode, parsedTarget) {
  const provenanceBadge = panel.querySelector('[data-whipify-role="provenance-badge"]');
  const targetTitle = panel.querySelector('[data-whipify-role="target-title"]');
  const targetSubtitle = panel.querySelector('[data-whipify-role="target-subtitle"]');
  const sourceNote = panel.querySelector('[data-whipify-role="source-note"]');
  const breadcrumb = panel.querySelector('[data-whipify-role="breadcrumb"]');
  const structureActions = panel.querySelector('[data-whipify-role="structure-actions"]');
  if (!(provenanceBadge instanceof HTMLElement) || !(targetTitle instanceof HTMLElement) || !(targetSubtitle instanceof HTMLElement) || !(sourceNote instanceof HTMLElement)) {
    return;
  }

  if (!(targetNode instanceof HTMLElement)) {
    panel.dataset.surfaceKind = '';
    panel.dataset.provenanceLabel = '';
    panel.dataset.targetLabel = '';
    panel.dataset.openTarget = '';
    panel.dataset.sourceScope = '';
    panel.dataset.sourceKey = '';
    provenanceBadge.textContent = 'Select a target';
    targetTitle.textContent = 'Whipify Edit Mode';
    targetSubtitle.textContent = 'Page content, global chrome, and shared content all show their source here.';
    sourceNote.textContent = 'Select an editable field to begin.';
    if (breadcrumb instanceof HTMLElement) {
      breadcrumb.textContent = 'No target selected';
    }
    if (structureActions instanceof HTMLElement) {
      structureActions.hidden = true;
    }
    return;
  }

  const surfaceKind = getEditableTargetSurfaceKind(targetNode, parsedTarget);
  const provenanceLabel = getEditableTargetProvenanceLabel(targetNode, parsedTarget);
  const targetLabel = getEditableTargetTargetLabel(targetNode, parsedTarget);
  const openTarget = getEditableTargetOpenTarget(targetNode, parsedTarget);
  const sourceScope = getEditableTargetSourceScope(targetNode, parsedTarget);
  const sourceKey = getEditableTargetSourceKey(targetNode, parsedTarget);
  const secondarySourceKey = getEditableTargetSecondarySourceKey(targetNode, parsedTarget);
  const destinationLabel = openTarget === 'quick-editor'
    ? 'Quick Editor'
    : openTarget === 'gutenberg'
      ? 'Gutenberg'
      : humanizeWhipifyLabel(openTarget || 'source');
  const surfaceLabel = surfaceKind === 'global-chrome'
    ? 'Global chrome'
    : surfaceKind === 'page-block'
      ? 'Page block'
      : humanizeWhipifyLabel(surfaceKind || 'target');

  panel.dataset.surfaceKind = surfaceKind || '';
  panel.dataset.provenanceLabel = provenanceLabel || '';
  panel.dataset.targetLabel = targetLabel || '';
  panel.dataset.openTarget = openTarget || '';
  panel.dataset.sourceScope = sourceScope || '';
  panel.dataset.sourceKey = sourceKey || '';
  panel.dataset.secondarySourceKey = secondarySourceKey || '';

  provenanceBadge.textContent = provenanceLabel || surfaceLabel;
  targetTitle.textContent = targetLabel || 'Whipify Edit Mode';
  targetSubtitle.textContent = surfaceLabel + ' · saves in ' + destinationLabel;
  sourceNote.textContent = [sourceScope, sourceKey, secondarySourceKey].filter(Boolean).join(' · ') || 'Select an editable field to begin.';
  if (breadcrumb instanceof HTMLElement) {
    breadcrumb.textContent = [surfaceLabel, provenanceLabel, targetLabel, sourceKey].filter(Boolean).join(' > ');
  }
  if (structureActions instanceof HTMLElement) {
    structureActions.hidden = surfaceKind !== 'page-block';
  }
}

function createPanel() {
  const panel = document.createElement('aside');
  panel.className = panelClassName;
  panel.hidden = true;
  panel.dataset.locked = '0';
  panel.setAttribute('data-wp-interactive', 'whipifyFrontendEditor');
  panel.setAttribute('data-whipify-runtime', 'interactivity-store');
  panel.innerHTML = \`
    <header class="whipify-frontend-editor-panel__header">
      <div class="whipify-frontend-editor-panel__meta">
        <span class="whipify-frontend-editor-panel__badge" data-whipify-role="provenance-badge">Select a target</span>
        <strong class="whipify-frontend-editor-panel__title" data-whipify-role="target-title">Whipify Edit Mode</strong>
        <span class="whipify-frontend-editor-panel__subtitle" data-whipify-role="target-subtitle">Page content, global chrome, and shared content all show their source here.</span>
      </div>
      <button type="button" data-whipify-action="edit-source">Edit in Gutenberg</button>
    </header>
    <section class="whipify-frontend-editor-panel__body">
      <nav class="whipify-frontend-editor-panel__breadcrumb" data-whipify-role="breadcrumb">No target selected</nav>
      <div class="whipify-frontend-editor-panel__viewport" data-whipify-role="viewport-frame">
        <button type="button" data-whipify-action="viewport-desktop">Desktop</button>
        <button type="button" data-whipify-action="viewport-tablet">Tablet</button>
        <button type="button" data-whipify-action="viewport-mobile">Mobile</button>
      </div>
      <p class="whipify-frontend-editor-panel__source" data-whipify-role="source-note">Select an editable field to begin.</p>
      <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-input">Value</label>
      <input id="whipify-frontend-editor-input" class="whipify-frontend-editor-panel__input" type="text" />
      <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-secondary-input" data-whipify-role="secondary-label" hidden>URL</label>
      <input id="whipify-frontend-editor-secondary-input" class="whipify-frontend-editor-panel__input" type="text" data-whipify-role="secondary-input" hidden />
      <div class="whipify-frontend-editor-panel__inspector" data-whipify-role="link-inspector" hidden>
        <p class="whipify-frontend-editor-panel__hint">Link inspector</p>
        <label class="whipify-frontend-editor-panel__checkbox"><input type="checkbox" data-whipify-role="link-target-blank" /> Open in new tab</label>
        <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-link-rel">Rel attributes</label>
        <input id="whipify-frontend-editor-link-rel" class="whipify-frontend-editor-panel__input" type="text" data-whipify-role="link-rel" placeholder="noopener noreferrer" />
        <label class="whipify-frontend-editor-panel__checkbox"><input type="checkbox" data-whipify-role="link-nofollow" /> Add nofollow</label>
      </div>
      <div class="whipify-frontend-editor-panel__inspector" data-whipify-role="media-size" hidden>
        <p class="whipify-frontend-editor-panel__hint">Image size</p>
        <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-image-width">Width</label>
        <input id="whipify-frontend-editor-image-width" class="whipify-frontend-editor-panel__input" type="number" min="0" data-whipify-role="image-width" />
        <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-image-height">Height</label>
        <input id="whipify-frontend-editor-image-height" class="whipify-frontend-editor-panel__input" type="number" min="0" data-whipify-role="image-height" />
      </div>
      <button type="button" class="whipify-frontend-editor-panel__media-button" data-whipify-action="choose-media" hidden>Choose Media</button>
      <p class="whipify-frontend-editor-panel__hint" data-whipify-role="hint">Select an editable field to begin.</p>
      <div class="whipify-frontend-editor-panel__drafts">
        <button type="button" data-whipify-action="inline-edit">Edit Inline</button>
        <button type="button" data-whipify-action="save-draft">Save Draft</button>
        <button type="button" data-whipify-action="undo">Undo</button>
        <button type="button" data-whipify-action="redo">Redo</button>
        <button type="button" data-whipify-action="save-all">Save All</button>
        <button type="button" data-whipify-action="discard-all">Discard All</button>
      </div>
      <div class="whipify-frontend-editor-panel__structure" data-whipify-role="structure-actions" hidden>
        <p class="whipify-frontend-editor-panel__hint">Block actions</p>
        <div class="whipify-frontend-editor-panel__structure-actions">
          <button type="button" data-whipify-action="move-up">Move Up</button>
          <button type="button" data-whipify-action="move-down">Move Down</button>
          <button type="button" data-whipify-action="duplicate-block">Duplicate</button>
          <button type="button" data-whipify-action="insert-paragraph">Insert Paragraph</button>
          <button type="button" data-whipify-action="remove-block">Remove Block</button>
        </div>
      </div>
      <div class="whipify-frontend-editor-panel__actions">
        <button type="button" data-whipify-action="save">Save</button>
        <button type="button" data-whipify-action="cancel">Cancel</button>
      </div>
    </section>
  \`;
  return panel;
}

function setEnabled(enabled, panel) {
  document.body.classList.toggle(activeClassName, enabled);
  panel.hidden = !enabled;
  syncInteractivityState({ enabled: Boolean(enabled) });
}

function clearPagePostLock() {
  if (activePageLock.timer) {
    window.clearInterval(activePageLock.timer);
  }
  activePageLock.postId = '';
  activePageLock.timer = null;
  syncInteractivityState({ locked: false, selectedPostId: '' });
}

async function refreshPagePostLock(postId) {
  if (!transportIsRest() || !whipifyFrontendEditorConfig.lockUrl || !postId) {
    return {
      response: { ok: true },
      payload: { success: true, data: {} },
    };
  }

  const response = await fetch(whipifyFrontendEditorConfig.lockUrl, {
    method: 'POST',
    headers: buildRestHeaders(),
    body: JSON.stringify({ postId: String(postId) }),
  });
  const payload = await readJsonPayload(response);
  return { response, payload };
}

async function lockCurrentPagePost(postId, panel, hint) {
  if (!transportIsRest() || !whipifyFrontendEditorConfig.lockUrl || !postId) {
    panel.dataset.locked = '0';
    syncInteractivityState({ locked: false, selectedPostId: String(postId || '') });
    return true;
  }

  const { response, payload } = await refreshPagePostLock(postId);
  if (!response.ok || !payload?.success) {
    panel.dataset.locked = '1';
    hint.textContent = getPayloadMessage(payload, 'Page lock check failed.');
    syncInteractivityState({
      locked: true,
      notice: hint.textContent,
      selectedPostId: String(postId || ''),
    });
    clearPagePostLock();
    return false;
  }

  panel.dataset.locked = '0';
  syncInteractivityState({ locked: false, selectedPostId: String(postId || '') });
  if (activePageLock.postId === postId && activePageLock.timer) {
    return true;
  }

  clearPagePostLock();
  activePageLock.postId = postId;
  activePageLock.timer = window.setInterval(async () => {
    const lockResult = await refreshPagePostLock(postId);
    if (!lockResult.response.ok || !lockResult.payload?.success) {
      panel.dataset.locked = '1';
      hint.textContent = getPayloadMessage(lockResult.payload, 'Page lock check failed.');
      syncInteractivityState({
        locked: true,
        notice: hint.textContent,
        selectedPostId: String(postId || ''),
      });
      clearPagePostLock();
    }
  }, Math.max(5, Number(whipifyFrontendEditorConfig.lockRefreshInterval) || 20) * 1000);

  return true;
}

function normalizeRelTokens(value, addNofollow) {
  const tokens = String(value || '')
    .split(/\\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (addNofollow && !tokens.includes('nofollow')) {
    tokens.push('nofollow');
  }
  return Array.from(new Set(tokens)).join(' ');
}

function getButtonTargetField(blockName) {
  if (blockName === 'core/button') {
    return 'linkTarget';
  }

  if (blockName === 'theme-factory/button') {
    return 'target';
  }

  return '';
}

function setViewportMode(mode) {
  document.body.classList.remove('is-whipify-viewport-desktop', 'is-whipify-viewport-tablet', 'is-whipify-viewport-mobile');
  document.body.classList.add('is-whipify-viewport-' + mode);
  syncInteractivityState({ viewport: mode });
}

function updateInspectorVisibility(panel, target) {
  const linkInspector = panel.querySelector('[data-whipify-role="link-inspector"]');
  const linkTargetBlank = panel.querySelector('[data-whipify-role="link-target-blank"]');
  const linkRel = panel.querySelector('[data-whipify-role="link-rel"]');
  const linkNofollow = panel.querySelector('[data-whipify-role="link-nofollow"]');
  const mediaSize = panel.querySelector('[data-whipify-role="media-size"]');
  const imageWidth = panel.querySelector('[data-whipify-role="image-width"]');
  const imageHeight = panel.querySelector('[data-whipify-role="image-height"]');

  if (linkInspector instanceof HTMLElement) {
    linkInspector.hidden = !(target instanceof HTMLAnchorElement);
  }
  if (linkTargetBlank instanceof HTMLInputElement) {
    linkTargetBlank.checked = target instanceof HTMLAnchorElement && target.getAttribute('target') === '_blank';
  }
  if (linkRel instanceof HTMLInputElement) {
    linkRel.value = target instanceof HTMLAnchorElement ? (target.getAttribute('rel') || '') : '';
  }
  if (linkNofollow instanceof HTMLInputElement) {
    linkNofollow.checked = target instanceof HTMLAnchorElement && /(^|\\s)nofollow(\\s|$)/.test(target.getAttribute('rel') || '');
  }
  if (mediaSize instanceof HTMLElement) {
    mediaSize.hidden = !(target instanceof HTMLImageElement);
  }
  if (imageWidth instanceof HTMLInputElement) {
    imageWidth.value = target instanceof HTMLImageElement ? (target.getAttribute('width') || '') : '';
  }
  if (imageHeight instanceof HTMLInputElement) {
    imageHeight.value = target instanceof HTMLImageElement ? (target.getAttribute('height') || '') : '';
  }
}

function getSelectedDraftId(panel) {
  return panel.dataset.targetId || [panel.dataset.editScope, panel.dataset.scope, panel.dataset.field].filter(Boolean).join(':');
}

function capturePanelDraft(panel) {
  const selected = document.querySelector('.' + selectedClassName);
  const input = panel.querySelector('#whipify-frontend-editor-input');
  const secondaryInput = panel.querySelector('[data-whipify-role="secondary-input"]');
  const linkTargetBlank = panel.querySelector('[data-whipify-role="link-target-blank"]');
  const linkRel = panel.querySelector('[data-whipify-role="link-rel"]');
  const linkNofollow = panel.querySelector('[data-whipify-role="link-nofollow"]');
  const imageWidth = panel.querySelector('[data-whipify-role="image-width"]');
  const imageHeight = panel.querySelector('[data-whipify-role="image-height"]');
  if (!(selected instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
    return null;
  }

  return {
    id: getSelectedDraftId(panel),
    editScope: panel.dataset.editScope || '',
    scope: panel.dataset.scope || '',
    field: panel.dataset.field || '',
    sourceKey: panel.dataset.sourceKey || panel.dataset.field || '',
    secondaryField: panel.dataset.secondaryField || '',
    secondarySourceKey: panel.dataset.secondarySourceKey || '',
    kind: panel.dataset.kind || 'text',
    revisionToken: panel.dataset.revision || '',
    sourceHash: panel.dataset.sourceHash || '',
    secondarySourceHash: panel.dataset.secondarySourceHash || '',
    target: panel.dataset.target ? JSON.parse(panel.dataset.target) : null,
    value: input.value,
    secondaryValue: secondaryInput instanceof HTMLInputElement ? secondaryInput.value : '',
    linkTarget: linkTargetBlank instanceof HTMLInputElement && linkTargetBlank.checked ? '_blank' : '',
    rel: normalizeRelTokens(linkRel instanceof HTMLInputElement ? linkRel.value : '', linkNofollow instanceof HTMLInputElement && linkNofollow.checked),
    width: imageWidth instanceof HTMLInputElement ? imageWidth.value : '',
    height: imageHeight instanceof HTMLInputElement ? imageHeight.value : '',
  };
}

function previewDraftOnSelected(draft) {
  const selected = document.querySelector('.' + selectedClassName);
  if (!(selected instanceof HTMLElement) || !draft) {
    return;
  }
  if (selected instanceof HTMLImageElement) {
    if (draft.value) selected.setAttribute('src', draft.value);
    selected.setAttribute('alt', draft.secondaryValue || '');
    if (draft.width) selected.setAttribute('width', draft.width);
    if (draft.height) selected.setAttribute('height', draft.height);
    return;
  }
  if (selected instanceof HTMLAnchorElement) {
    if (draft.editScope === 'shared-content' && draft.secondaryValue) {
      selected.textContent = draft.value;
      selected.setAttribute('href', draft.secondaryValue);
    } else if (draft.kind === 'url') {
      selected.setAttribute('href', draft.value);
    } else {
      selected.textContent = draft.value;
      if (draft.secondaryValue) selected.setAttribute('href', draft.secondaryValue);
    }
    if (draft.linkTarget) selected.setAttribute('target', draft.linkTarget); else selected.removeAttribute('target');
    if (draft.rel) selected.setAttribute('rel', draft.rel); else selected.removeAttribute('rel');
    return;
  }
  selected.textContent = draft.value;
}

function saveDraft(panel, hint) {
  const previous = pendingDrafts.get(getSelectedDraftId(panel));
  const draft = capturePanelDraft(panel);
  if (!draft) {
    return;
  }
  pendingDrafts.set(draft.id, draft);
  undoStack.push({ previous, next: draft });
  redoStack.length = 0;
  previewDraftOnSelected(draft);
  hint.textContent = pendingDrafts.size + ' draft change(s) ready to save.';
  syncInteractivityState({ dirtyFields: pendingDrafts.size, notice: hint.textContent });
}

function shouldAutoStartInlineEditing(target, panel) {
  if (!(target instanceof HTMLElement) || target instanceof HTMLImageElement) {
    return false;
  }

  if (panel.dataset.kind === 'media') {
    return false;
  }

  if (panel.dataset.editScope === 'global-chrome' && panel.dataset.kind === 'url') {
    return false;
  }

  return Boolean((target.textContent || '').trim());
}

function toggleDetailsSummaryTarget(target) {
  if (!(target instanceof HTMLElement) || target.tagName.toLowerCase() !== 'summary' || target.isContentEditable) {
    return;
  }

  const details = target.parentElement;
  if (details instanceof HTMLDetailsElement) {
    details.open = !details.open;
  }
}

function setInlineEditing(panel, enabled) {
  const selected = document.querySelector('.' + selectedClassName);
  const input = panel.querySelector('#whipify-frontend-editor-input');
  if (inlineEditingTarget && inlineEditingTarget !== selected) {
    inlineEditingTarget.removeAttribute('contenteditable');
    inlineEditingTarget.classList.remove('is-whipify-inline-editing');
  }

  if (!(selected instanceof HTMLElement) || selected instanceof HTMLImageElement || !(input instanceof HTMLInputElement)) {
    if (!enabled && inlineEditingTarget instanceof HTMLElement) {
      inlineEditingTarget.removeAttribute('contenteditable');
      inlineEditingTarget.classList.remove('is-whipify-inline-editing');
      inlineEditingTarget = null;
    }
    return;
  }

  inlineEditingTarget = enabled ? selected : null;
  selected.classList.toggle('is-whipify-inline-editing', enabled);
  if (enabled) {
    selected.setAttribute('contenteditable', 'true');
    selected.focus();
    if (selected.dataset.whipifyInlineInputBound !== '1') {
      selected.dataset.whipifyInlineInputBound = '1';
      selected.addEventListener('input', () => {
        input.value = selected.textContent || '';
      }, { once: false });
    }
  } else {
    selected.removeAttribute('contenteditable');
  }
}

async function applyPendingDrafts(panel, hint) {
  if (!pendingDrafts.size) {
    hint.textContent = 'No draft changes to save.';
    return;
  }

  for (const draft of pendingDrafts.values()) {
    if (draft.editScope === 'global-chrome' || draft.editScope === 'shared-content') {
      const response = await saveGlobalChrome(draft.scope, draft.sourceKey, draft.value, draft.revisionToken);
      const payload = await readJsonPayload(response);
      if (!response.ok || !payload?.success) {
        hint.textContent = payload?.data?.message || 'Save all failed.';
        syncInteractivityState({ saving: false, notice: hint.textContent });
        return;
      }
      if (draft.editScope === 'shared-content' && draft.secondarySourceKey) {
        await saveGlobalChrome(draft.scope, draft.secondarySourceKey, draft.secondaryValue, payload?.data?.revisionToken || draft.revisionToken);
      }
      continue;
    }

    if (draft.editScope === 'page-block' && draft.target?.identity?.postId) {
      const operations = [{ field: draft.field, value: draft.value, sourceHash: draft.sourceHash }];
      const buttonTargetField = getButtonTargetField(draft.target?.blockName || '');
      if (draft.secondaryField && (draft.secondaryValue || buttonTargetField)) {
        operations.push({ field: draft.secondaryField, value: draft.secondaryValue, sourceHash: draft.secondarySourceHash });
      }
      if (buttonTargetField) {
        operations.push({ field: buttonTargetField, value: draft.linkTarget, sourceHash: '' });
        operations.push({ field: 'rel', value: draft.rel, sourceHash: '' });
      }
      if (draft.target?.blockName === 'core/image') {
        operations.push({ field: 'width', value: draft.width, sourceHash: '' });
        operations.push({ field: 'height', value: draft.height, sourceHash: '' });
      }
      const response = await savePageBlock({ ...draft.target, revisionToken: draft.revisionToken }, operations);
      const payload = await readJsonPayload(response);
      if (!response.ok || !payload?.success) {
        hint.textContent = payload?.data?.message || 'Save all failed.';
        syncInteractivityState({ saving: false, notice: hint.textContent });
        return;
      }
    }
  }

  pendingDrafts.clear();
  hint.textContent = 'All draft changes saved.';
  syncInteractivityState({ dirtyFields: 0, saving: false, notice: hint.textContent });
}

function getEditableTargets() {
  return Array.from(document.querySelectorAll('[data-whipify-editable="true"]'));
}

function bindEditableTarget(target) {
  const parsedTarget = parseEditableTarget(target) || {};
  const provenanceLabel = getEditableTargetProvenanceLabel(target, parsedTarget);
  const targetLabel = getEditableTargetTargetLabel(target, parsedTarget);
  const targetSummary = [provenanceLabel, targetLabel].filter(Boolean).join(' - ');
  if (targetSummary) {
    target.setAttribute('title', targetSummary);
    target.setAttribute('aria-label', targetSummary);
  }
  target.addEventListener('mouseenter', () => target.classList.add('is-whipify-hovered'));
  target.addEventListener('mouseleave', () => target.classList.remove('is-whipify-hovered'));
}

function updateOpenEditorLabel(panel, button) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if ((panel.dataset.openTarget || '') === 'quick-editor' || panel.dataset.editScope === 'global-chrome' || panel.dataset.editScope === 'shared-content') {
    button.textContent = 'Open Quick Editor';
    return;
  }

  button.textContent = 'Edit in Gutenberg';
}

async function openTargetEditor(target, panel) {
  const input = panel.querySelector('#whipify-frontend-editor-input');
  const secondaryLabel = panel.querySelector('[data-whipify-role="secondary-label"]');
  const secondaryInput = panel.querySelector('[data-whipify-role="secondary-input"]');
  const chooseMediaButton = panel.querySelector('[data-whipify-action="choose-media"]');
  const openEditorButton = panel.querySelector('[data-whipify-action="edit-source"]');
  const hint = panel.querySelector('[data-whipify-role="hint"]');
  if (!(input instanceof HTMLInputElement) || !(hint instanceof HTMLElement) || !(secondaryLabel instanceof HTMLElement) || !(secondaryInput instanceof HTMLInputElement)) return;

  document.querySelectorAll('.' + selectedClassName).forEach((node) => node.classList.remove(selectedClassName));
  target.classList.add(selectedClassName);
  const editableTarget = parseEditableTarget(target) || {};
  const editScope = getEditableTargetEditScope(target, editableTarget);
  const sourceScope = target.getAttribute('data-whipify-scope') || getEditableTargetSourceScope(target, editableTarget);
  const sourceKey = getEditableTargetSourceKey(target, editableTarget);
  const secondarySourceKey = getEditableTargetSecondarySourceKey(target, editableTarget);
  panel.dataset.editScope = editScope || '';
  panel.dataset.scope = sourceScope || '';
  panel.dataset.field = getEditableTargetField(target, editableTarget);
  panel.dataset.kind = getEditableTargetKind(target, editableTarget);
  panel.dataset.secondaryField = getEditableTargetSecondaryField(target, editableTarget);
  panel.dataset.revision = target.getAttribute('data-whipify-revision') || editableTarget.revisionToken || '';
  panel.dataset.sourceHash = target.getAttribute('data-whipify-source-hash') || editableTarget.sourceHash || '';
  panel.dataset.secondarySourceHash = target.getAttribute('data-whipify-secondary-source-hash') || editableTarget.secondarySourceHash || '';
  panel.dataset.target = JSON.stringify(editableTarget);
  panel.dataset.targetId = target.getAttribute('data-whipify-target-id') || editableTarget.targetId || '';
  panel.dataset.postId = target.getAttribute('data-whipify-post-id') || editableTarget?.identity?.postId || '';
  panel.dataset.treePath = target.getAttribute('data-whipify-tree-path') || editableTarget?.identity?.treePathKey || '';
  panel.dataset.blockName = target.getAttribute('data-whipify-block-name') || editableTarget.blockName || '';
  panel.dataset.mediaId = target.getAttribute('data-whipify-media-id') || editableTarget?.mediaId || '';
  panel.dataset.mediaSourceHash = target.getAttribute('data-whipify-media-source-hash') || editableTarget?.mediaSourceHash || '';
  panel.dataset.sourceKey = sourceKey || '';
  panel.dataset.secondarySourceKey = secondarySourceKey || '';
  updatePanelSummary(panel, target, editableTarget);
  updateInspectorVisibility(panel, target);
  if (panel.dataset.editScope === 'page-block' && panel.dataset.blockName === 'core/image' && target instanceof HTMLImageElement) {
    panel.dataset.kind = 'media';
    input.value = target.getAttribute('src') || '';
    secondaryLabel.hidden = false;
    secondaryInput.hidden = false;
    secondaryLabel.textContent = 'Alt Text';
    secondaryInput.value = target.getAttribute('alt') || '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = !(window.wp && typeof window.wp.media === 'function');
    }
  } else if (panel.dataset.editScope === 'page-block' && panel.dataset.secondaryField && target instanceof HTMLAnchorElement) {
    input.value = target.textContent || '';
    secondaryLabel.hidden = false;
    secondaryInput.hidden = false;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = target.getAttribute('href') || '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  } else if (panel.dataset.editScope === 'global-chrome' && panel.dataset.kind === 'url' && target instanceof HTMLAnchorElement) {
    input.value = target.getAttribute('href') || '';
    secondaryLabel.hidden = true;
    secondaryInput.hidden = true;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = '';
    updateInspectorVisibility(panel, null);
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  } else if (panel.dataset.editScope === 'shared-content' && panel.dataset.secondaryField && target instanceof HTMLAnchorElement) {
    input.value = target.textContent || getConfiguredDefaultValue(panel.dataset.sourceKey || '');
    secondaryLabel.hidden = false;
    secondaryInput.hidden = false;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = target.getAttribute('href') || getConfiguredDefaultValue(panel.dataset.secondarySourceKey || '');
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  } else {
    input.value = target.textContent || '';
    secondaryLabel.hidden = true;
    secondaryInput.hidden = true;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  }
  hint.textContent = 'Editing ' + (panel.dataset.field || 'field');
  syncInteractivityState({
    selectedScope: panel.dataset.editScope || panel.dataset.scope || '',
    selectedField: panel.dataset.field || '',
    selectedTargetId: panel.dataset.targetId || '',
    selectedPostId: panel.dataset.postId || '',
    locked: false,
    notice: hint.textContent,
  });
  updateOpenEditorLabel(panel, openEditorButton);
  setEnabled(true, panel);

  let canEditInline = true;
  if (panel.dataset.editScope === 'page-block' && panel.dataset.postId) {
    canEditInline = await lockCurrentPagePost(panel.dataset.postId, panel, hint);
  } else {
    panel.dataset.locked = '0';
    clearPagePostLock();
  }
  setInlineEditing(panel, canEditInline && shouldAutoStartInlineEditing(target, panel));
}

function bindPanelActions(panel) {
  const input = panel.querySelector('#whipify-frontend-editor-input');
  const secondaryLabel = panel.querySelector('[data-whipify-role="secondary-label"]');
  const secondaryInput = panel.querySelector('[data-whipify-role="secondary-input"]');
  const hint = panel.querySelector('[data-whipify-role="hint"]');
  const saveButton = panel.querySelector('[data-whipify-action="save"]');
  const cancelButton = panel.querySelector('[data-whipify-action="cancel"]');
  const gutenbergButton = panel.querySelector('[data-whipify-action="edit-source"]');
  const chooseMediaButton = panel.querySelector('[data-whipify-action="choose-media"]');
  const moveUpButton = panel.querySelector('[data-whipify-action="move-up"]');
  const moveDownButton = panel.querySelector('[data-whipify-action="move-down"]');
  const removeBlockButton = panel.querySelector('[data-whipify-action="remove-block"]');
  const duplicateBlockButton = panel.querySelector('[data-whipify-action="duplicate-block"]');
  const insertParagraphButton = panel.querySelector('[data-whipify-action="insert-paragraph"]');
  const inlineEditButton = panel.querySelector('[data-whipify-action="inline-edit"]');
  const saveDraftButton = panel.querySelector('[data-whipify-action="save-draft"]');
  const saveAllButton = panel.querySelector('[data-whipify-action="save-all"]');
  const discardAllButton = panel.querySelector('[data-whipify-action="discard-all"]');
  const undoButton = panel.querySelector('[data-whipify-action="undo"]');
  const redoButton = panel.querySelector('[data-whipify-action="redo"]');
  const viewportDesktopButton = panel.querySelector('[data-whipify-action="viewport-desktop"]');
  const viewportTabletButton = panel.querySelector('[data-whipify-action="viewport-tablet"]');
  const viewportMobileButton = panel.querySelector('[data-whipify-action="viewport-mobile"]');
  const linkTargetBlank = panel.querySelector('[data-whipify-role="link-target-blank"]');
  const linkRel = panel.querySelector('[data-whipify-role="link-rel"]');
  const linkNofollow = panel.querySelector('[data-whipify-role="link-nofollow"]');
  const imageWidth = panel.querySelector('[data-whipify-role="image-width"]');
  const imageHeight = panel.querySelector('[data-whipify-role="image-height"]');
  if (!(input instanceof HTMLInputElement) || !(hint instanceof HTMLElement) || !(saveButton instanceof HTMLButtonElement) || !(cancelButton instanceof HTMLButtonElement) || !(gutenbergButton instanceof HTMLButtonElement) || !(secondaryLabel instanceof HTMLElement) || !(secondaryInput instanceof HTMLInputElement)) {
    return;
  }

  const submitStructuralAction = async (action) => {
    const targetPayload = panel.dataset.target ? JSON.parse(panel.dataset.target) : null;
    if (panel.dataset.surfaceKind !== 'page-block' || !targetPayload?.identity?.postId || !targetPayload?.treePath) {
      hint.textContent = 'This block action is not available here.';
      syncInteractivityState({ saving: false, notice: hint.textContent });
      return;
    }

    const response = await savePageBlock(targetPayload, [
      {
        action,
        field: panel.dataset.field || targetPayload.field || '',
        value: action === 'insert-paragraph' ? (panel.dataset.insertParagraphText || 'New paragraph') : '',
        sourceHash: panel.dataset.sourceHash || targetPayload.sourceHash || '',
      },
    ]);
    const payload = await readJsonPayload(response);
    if (!response.ok || !payload?.success) {
      syncConflictState(panel, null, payload);
      hint.textContent = payload?.data?.message || 'Block action failed.';
      syncInteractivityState({ saving: false, notice: hint.textContent });
      return;
    }

    const actionLabel = action === 'remove' ? 'Block removed.' : 'Block moved.';
    hint.textContent = actionLabel + ' Refreshing...';
    syncInteractivityState({ saving: false, notice: hint.textContent });
    window.location.reload();
  };

  const clearSelection = () => {
    document.querySelectorAll('.' + selectedClassName).forEach((node) => node.classList.remove(selectedClassName));
    panel.dataset.editScope = '';
    panel.dataset.scope = '';
    panel.dataset.field = '';
    panel.dataset.kind = '';
    panel.dataset.secondaryField = '';
    panel.dataset.revision = '';
    panel.dataset.sourceHash = '';
    panel.dataset.secondarySourceHash = '';
    panel.dataset.target = '';
    panel.dataset.targetId = '';
    panel.dataset.postId = '';
    panel.dataset.treePath = '';
    panel.dataset.blockName = '';
    panel.dataset.surfaceKind = '';
    panel.dataset.provenanceLabel = '';
    panel.dataset.targetLabel = '';
    panel.dataset.openTarget = '';
    panel.dataset.sourceScope = '';
    panel.dataset.sourceKey = '';
    panel.dataset.secondarySourceKey = '';
    panel.dataset.locked = '0';
    input.value = '';
    secondaryLabel.hidden = true;
    secondaryInput.hidden = true;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
    hint.textContent = 'Select an editable field to begin.';
    updateOpenEditorLabel(panel, gutenbergButton);
    updatePanelSummary(panel, null, null);
    syncInteractivityState({
      selectedScope: '',
      selectedField: '',
      selectedTargetId: '',
      selectedPostId: '',
      saving: false,
      locked: false,
      notice: hint.textContent,
    });
    clearPagePostLock();
  };

  cancelButton.addEventListener('click', () => clearSelection());
  if (inlineEditButton instanceof HTMLButtonElement) {
    inlineEditButton.addEventListener('click', () => {
      const selected = document.querySelector('.' + selectedClassName);
      setInlineEditing(panel, !(selected instanceof HTMLElement && selected.isContentEditable));
    });
  }
  if (saveDraftButton instanceof HTMLButtonElement) {
    saveDraftButton.addEventListener('click', () => saveDraft(panel, hint));
  }
  if (saveAllButton instanceof HTMLButtonElement) {
    saveAllButton.addEventListener('click', () => {
      hint.textContent = 'Saving draft changes...';
      syncInteractivityState({ saving: true, notice: hint.textContent });
      void applyPendingDrafts(panel, hint);
    });
  }
  if (discardAllButton instanceof HTMLButtonElement) {
    discardAllButton.addEventListener('click', () => {
      pendingDrafts.clear();
      hint.textContent = 'Draft changes discarded.';
      syncInteractivityState({ dirtyFields: 0, notice: hint.textContent });
    });
  }
  if (undoButton instanceof HTMLButtonElement) {
    undoButton.addEventListener('click', () => {
      const entry = undoStack.pop();
      if (!entry) return;
      if (entry.previous) {
        pendingDrafts.set(entry.previous.id, entry.previous);
        previewDraftOnSelected(entry.previous);
      } else if (entry.next?.id) {
        pendingDrafts.delete(entry.next.id);
      }
      redoStack.push(entry);
      hint.textContent = 'Undo applied.';
    });
  }
  if (redoButton instanceof HTMLButtonElement) {
    redoButton.addEventListener('click', () => {
      const entry = redoStack.pop();
      if (!entry?.next) return;
      pendingDrafts.set(entry.next.id, entry.next);
      previewDraftOnSelected(entry.next);
      undoStack.push(entry);
      hint.textContent = 'Redo applied.';
    });
  }
  if (viewportDesktopButton instanceof HTMLButtonElement) {
    viewportDesktopButton.addEventListener('click', () => setViewportMode('desktop'));
  }
  if (viewportTabletButton instanceof HTMLButtonElement) {
    viewportTabletButton.addEventListener('click', () => setViewportMode('tablet'));
  }
  if (viewportMobileButton instanceof HTMLButtonElement) {
    viewportMobileButton.addEventListener('click', () => setViewportMode('mobile'));
  }
  if (linkNofollow instanceof HTMLInputElement && linkRel instanceof HTMLInputElement) {
    linkNofollow.addEventListener('change', () => {
      linkRel.value = normalizeRelTokens(linkRel.value, linkNofollow.checked);
    });
  }
  gutenbergButton.addEventListener('click', () => {
    if ((panel.dataset.openTarget || '') === 'quick-editor' && whipifyFrontendEditorConfig.quickEditorUrl) {
      window.location.href = whipifyFrontendEditorConfig.quickEditorUrl;
      return;
    }

    const editLink = document.querySelector('#wp-admin-bar-edit a');
    if (editLink instanceof HTMLAnchorElement) {
      window.location.href = editLink.href;
    }
  });
  if (chooseMediaButton instanceof HTMLButtonElement) {
    chooseMediaButton.addEventListener('click', () => {
      if (panel.dataset.blockName !== 'core/image' || !(window.wp && typeof window.wp.media === 'function')) {
        return;
      }

      const mediaFrame = window.wp.media({
        title: 'Choose Image',
        multiple: false,
        library: { type: 'image' },
      });

      mediaFrame.on('select', () => {
        const selection = mediaFrame.state().get('selection');
        const attachment = selection && selection.first && selection.first() ? selection.first().toJSON() : null;
        if (!attachment) {
          return;
        }

        input.value = attachment.url || input.value || '';
        secondaryLabel.hidden = false;
        secondaryInput.hidden = false;
        secondaryLabel.textContent = 'Alt Text';
        secondaryInput.value = attachment.alt || secondaryInput.value || '';
        panel.dataset.mediaId = attachment.id ? String(attachment.id) : panel.dataset.mediaId || '';
        hint.textContent = 'Media selected. Save to apply.';
        syncInteractivityState({ notice: hint.textContent });
      });

      mediaFrame.open();
    });
  }
  if (moveUpButton instanceof HTMLButtonElement) {
    moveUpButton.addEventListener('click', () => {
      void submitStructuralAction('move-up');
    });
  }
  if (moveDownButton instanceof HTMLButtonElement) {
    moveDownButton.addEventListener('click', () => {
      void submitStructuralAction('move-down');
    });
  }
  if (duplicateBlockButton instanceof HTMLButtonElement) {
    duplicateBlockButton.addEventListener('click', () => {
      void submitStructuralAction('duplicate');
    });
  }
  if (insertParagraphButton instanceof HTMLButtonElement) {
    insertParagraphButton.addEventListener('click', () => {
      const paragraphText = window.prompt('Paragraph text', 'New paragraph') || 'New paragraph';
      panel.dataset.insertParagraphText = paragraphText;
      void submitStructuralAction('insert-paragraph');
    });
  }
  if (removeBlockButton instanceof HTMLButtonElement) {
    removeBlockButton.addEventListener('click', () => {
      void submitStructuralAction('remove');
    });
  }

  saveButton.addEventListener('click', async () => {
    const selected = document.querySelector('.' + selectedClassName);
    if (!(selected instanceof HTMLElement)) {
      hint.textContent = 'Select an editable field to save.';
      syncInteractivityState({ notice: hint.textContent });
      return;
    }

    const scope = panel.dataset.scope || '';
    const field = panel.dataset.field || '';
    const kind = panel.dataset.kind || 'text';
    const revisionToken = panel.dataset.revision || '';
    const editScope = panel.dataset.editScope || selected.getAttribute('data-whipify-edit-scope') || '';
    const sourceKey = panel.dataset.sourceKey || field;
    const secondarySourceKey = panel.dataset.secondarySourceKey || '';
    if ((editScope !== 'global-chrome' && editScope !== 'shared-content') || !scope || !sourceKey) {
      const targetPayload = panel.dataset.target ? JSON.parse(panel.dataset.target) : null;
      const secondaryField = panel.dataset.secondaryField || '';
      const sourceHash = panel.dataset.sourceHash || '';
      if (editScope !== 'page-block' || !targetPayload?.identity?.postId || !field) {
        hint.textContent = 'This field is not ready for frontend saving yet.';
        syncInteractivityState({ notice: hint.textContent });
        return;
      }

      if (panel.dataset.locked === '1') {
        hint.textContent = 'Page is locked by another editor.';
        syncInteractivityState({ locked: true, notice: hint.textContent });
        return;
      }

      hint.textContent = 'Saving…';
      syncInteractivityState({ saving: true, notice: hint.textContent, locked: false });
      const buttonTargetField = getButtonTargetField(panel.dataset.blockName || '');
      const operations = [
        {
          field,
          value: input.value,
          sourceHash,
        },
      ];
      if (secondaryField && !secondaryInput.hidden && (selected instanceof HTMLAnchorElement || selected instanceof HTMLImageElement)) {
        operations.push({
          field: secondaryField,
          value: secondaryInput.value,
          sourceHash: panel.dataset.secondarySourceHash || '',
        });
      }
      if (selected instanceof HTMLAnchorElement && buttonTargetField) {
        const nextRel = normalizeRelTokens(linkRel instanceof HTMLInputElement ? linkRel.value : '', linkNofollow instanceof HTMLInputElement && linkNofollow.checked);
        operations.push({
          field: buttonTargetField,
          value: linkTargetBlank instanceof HTMLInputElement && linkTargetBlank.checked ? '_blank' : '',
          sourceHash: '',
        });
        operations.push({
          field: 'rel',
          value: nextRel,
          sourceHash: '',
        });
      }
      if (panel.dataset.blockName === 'core/image' && panel.dataset.mediaId) {
        operations.push({
          field: 'id',
          value: panel.dataset.mediaId,
          sourceHash: panel.dataset.mediaSourceHash || '',
        });
      }
      if (selected instanceof HTMLImageElement && panel.dataset.blockName === 'core/image') {
        operations.push({
          field: 'width',
          value: imageWidth instanceof HTMLInputElement ? imageWidth.value : '',
          sourceHash: '',
        });
        operations.push({
          field: 'height',
          value: imageHeight instanceof HTMLInputElement ? imageHeight.value : '',
          sourceHash: '',
        });
      }
      const response = await savePageBlock({
        ...targetPayload,
        revisionToken,
        sourceHash,
      }, operations);
      const payload = await readJsonPayload(response);

      if (!response.ok || !payload?.success) {
        syncConflictState(panel, selected, payload);
        hint.textContent = payload?.data?.message || 'Save failed.';
        syncInteractivityState({ saving: false, notice: hint.textContent });
        return;
      }

      const nextRevision = payload?.data?.revisionToken || revisionToken;
      const operationResults = Array.isArray(payload?.data?.operations) ? payload.data.operations : [];
      const primaryTarget = operationResults.find((operation) => operation?.field === field) || payload?.data?.target;
      const secondaryTarget = operationResults.find((operation) => operation?.field === secondaryField);
      if (primaryTarget) {
        primaryTarget.revisionToken = nextRevision;
        writeEditableTarget(selected, primaryTarget);
        panel.dataset.target = JSON.stringify(primaryTarget);
      }
      panel.dataset.revision = nextRevision;
      panel.dataset.sourceHash = primaryTarget?.sourceHash || sourceHash;
      if (selected instanceof HTMLImageElement) {
        const nextMediaId = primaryTarget?.mediaId || panel.dataset.mediaId || '';
        const nextMediaSourceHash = primaryTarget?.mediaSourceHash || panel.dataset.mediaSourceHash || '';
        if (nextMediaId) {
          selected.setAttribute('data-whipify-media-id', nextMediaId);
          panel.dataset.mediaId = nextMediaId;
        }
        if (nextMediaSourceHash) {
          selected.setAttribute('data-whipify-media-source-hash', nextMediaSourceHash);
          panel.dataset.mediaSourceHash = nextMediaSourceHash;
        }
      }
      if (selected instanceof HTMLImageElement && field === 'url') {
        selected.setAttribute('src', input.value);
      } else {
        selected.textContent = input.value;
      }

      if (secondaryField && !secondaryInput.hidden && (selected instanceof HTMLAnchorElement || selected instanceof HTMLImageElement) && secondaryTarget) {
        if (selected instanceof HTMLAnchorElement) {
          selected.setAttribute('href', secondaryInput.value);
        } else if (selected instanceof HTMLImageElement) {
          selected.setAttribute('alt', secondaryInput.value);
        }
        selected.setAttribute('data-whipify-revision', nextRevision);
        selected.setAttribute('data-whipify-secondary-source-hash', secondaryTarget?.sourceHash || '');
        panel.dataset.secondarySourceHash = secondaryTarget?.sourceHash || '';
      }
      if (selected instanceof HTMLAnchorElement && buttonTargetField) {
        const nextRel = normalizeRelTokens(linkRel instanceof HTMLInputElement ? linkRel.value : '', linkNofollow instanceof HTMLInputElement && linkNofollow.checked);
        if (linkTargetBlank instanceof HTMLInputElement && linkTargetBlank.checked) {
          selected.setAttribute('target', '_blank');
        } else {
          selected.removeAttribute('target');
        }
        if (nextRel) {
          selected.setAttribute('rel', nextRel);
        } else {
          selected.removeAttribute('rel');
        }
      }
      if (selected instanceof HTMLImageElement && panel.dataset.blockName === 'core/image') {
        if (imageWidth instanceof HTMLInputElement && imageWidth.value) {
          selected.setAttribute('width', imageWidth.value);
        }
        if (imageHeight instanceof HTMLInputElement && imageHeight.value) {
          selected.setAttribute('height', imageHeight.value);
        }
      }

      hint.textContent = 'Saved.';
      syncInteractivityState({ saving: false, notice: hint.textContent });
      return;
    }

    hint.textContent = 'Saving…';
    syncInteractivityState({ saving: true, notice: hint.textContent });
    const response = await saveGlobalChrome(scope, sourceKey, input.value, revisionToken);
    const payload = await readJsonPayload(response);
    if (!response.ok || !payload?.success) {
      hint.textContent = payload?.data?.message || 'Save failed.';
      syncInteractivityState({ saving: false, notice: hint.textContent });
      return;
    }

    let nextRevision = payload?.data?.revisionToken || revisionToken;
    let secondaryPayload = null;
    if (editScope === 'shared-content' && secondarySourceKey && !secondaryInput.hidden) {
      const secondaryResponse = await saveGlobalChrome(scope, secondarySourceKey, secondaryInput.value, nextRevision);
      secondaryPayload = await readJsonPayload(secondaryResponse);
      if (!secondaryResponse.ok || !secondaryPayload?.success) {
        hint.textContent = secondaryPayload?.data?.message || 'Secondary save failed.';
        syncInteractivityState({ saving: false, notice: hint.textContent });
        return;
      }
      nextRevision = secondaryPayload?.data?.revisionToken || nextRevision;
    }

    if (editScope === 'shared-content' && selected instanceof HTMLAnchorElement && secondarySourceKey && !secondaryInput.hidden) {
      selected.textContent = input.value;
      selected.setAttribute('href', secondaryInput.value);
    } else if (kind === 'url' && selected instanceof HTMLAnchorElement) {
      selected.setAttribute('href', input.value);
    } else {
      selected.textContent = input.value;
    }
    const nextTarget = parseEditableTarget(selected);
    if (nextTarget) {
      nextTarget.revisionToken = nextRevision;
      nextTarget.sourceHash = payload?.data?.sourceHash || nextTarget.sourceHash;
      if (secondaryPayload?.data?.sourceHash) {
        nextTarget.secondarySourceHash = secondaryPayload.data.sourceHash;
      }
      writeEditableTarget(selected, nextTarget);
      panel.dataset.target = JSON.stringify(nextTarget);
      panel.dataset.sourceHash = nextTarget.sourceHash || '';
      panel.dataset.secondarySourceHash = nextTarget.secondarySourceHash || panel.dataset.secondarySourceHash || '';
    }
    selected.setAttribute('data-whipify-revision', nextRevision);
    panel.dataset.revision = nextRevision;
    hint.textContent = 'Saved.';
    syncInteractivityState({ saving: false, notice: hint.textContent });
  });
}

function saveGlobalChromeViaRest(scope, field, value, revisionToken) {
  return fetch(whipifyFrontendEditorConfig.restBaseUrl + '/chrome', {
    method: 'POST',
    headers: buildRestHeaders(),
    body: JSON.stringify({
      scope,
      field,
      value,
      revisionToken,
    }),
  });
}

function savePageBlockViaRest(target, operations) {
  return fetch(whipifyFrontendEditorConfig.restBaseUrl + '/page-block', {
    method: 'POST',
    headers: buildRestHeaders(),
    body: JSON.stringify({
      target,
      operations,
    }),
  });
}

function saveGlobalChrome(scope, field, value, revisionToken) {
  if (!transportIsRest()) {
    throw new Error('REST transport is unavailable.');
  }

  return saveGlobalChromeViaRest(scope, field, value, revisionToken);
}

function savePageBlock(target, operations) {
  if (!transportIsRest()) {
    throw new Error('REST transport is unavailable.');
  }

  return savePageBlockViaRest(target, operations);
}

function boot() {
  const panel = createPanel();
  document.body.appendChild(panel);
  setEnabled(Boolean(whipifyFrontendEditorConfig.isEnabled), panel);
  bindPanelActions(panel);
  getEditableTargets().forEach((target) => {
    bindEditableTarget(target);
    target.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleDetailsSummaryTarget(target);
      void openTargetEditor(target, panel);
    });
  });

  window.addEventListener('beforeunload', clearPagePostLock);
}

window.addEventListener('DOMContentLoaded', boot);

window.WhipifyFrontendEditor = {
  config: whipifyFrontendEditorConfig,
  state: interactivityState,
  lockCurrentPagePost,
  saveGlobalChrome,
  saveGlobalChromeViaRest,
  savePageBlock,
  savePageBlockViaRest,
  setEnabled,
};`;

const renderCss = (): string => `.whipify-frontend-editor-panel {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  width: min(24rem, calc(100vw - 2rem));
  background: rgba(11, 15, 25, 0.96);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
  z-index: 99999;
}

.whipify-frontend-editor-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.whipify-frontend-editor-panel__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.whipify-frontend-editor-panel__badge {
  display: inline-flex;
  width: fit-content;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.whipify-frontend-editor-panel__title {
  display: block;
  font-size: 0.98rem;
  line-height: 1.2;
}

.whipify-frontend-editor-panel__subtitle,
.whipify-frontend-editor-panel__source {
  display: block;
  font-size: 0.8rem;
  line-height: 1.35;
  color: rgba(226, 232, 240, 0.72);
}

.whipify-frontend-editor-panel__breadcrumb {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.75rem;
  background: rgba(148, 163, 184, 0.1);
  color: #dbeafe;
  font-size: 0.78rem;
}

.whipify-frontend-editor-panel__viewport,
.whipify-frontend-editor-panel__drafts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

.whipify-frontend-editor-panel__structure {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.875rem;
  background: rgba(15, 23, 42, 0.64);
}

.whipify-frontend-editor-panel__structure-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.whipify-frontend-editor-panel__body {
  padding: 1rem;
}

.whipify-frontend-editor-panel__label,
.whipify-frontend-editor-panel__hint {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.86);
}

.whipify-frontend-editor-panel__input {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
}

.whipify-frontend-editor-panel__inspector {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.875rem;
  background: rgba(15, 23, 42, 0.52);
}

.whipify-frontend-editor-panel__checkbox {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  margin-bottom: 0.6rem;
  color: rgba(226, 232, 240, 0.86);
  font-size: 0.85rem;
}

.whipify-frontend-editor-panel__media-button {
  margin-bottom: 0.75rem;
  border: 0;
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  background: rgba(16, 185, 129, 0.18);
  color: #d1fae5;
  cursor: pointer;
}

.whipify-frontend-editor-panel__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.whipify-frontend-editor-panel__actions button,
.whipify-frontend-editor-panel__header button,
.whipify-frontend-editor-panel__drafts button,
.whipify-frontend-editor-panel__viewport button {
  border: 0;
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  background: rgba(59, 130, 246, 0.2);
  color: #f8fafc;
  cursor: pointer;
}

.is-whipify-inline-editing {
  cursor: text;
  outline-color: #22c55e !important;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.22) !important;
}

body.is-whipify-viewport-tablet main,
body.is-whipify-viewport-tablet .site-main {
  max-width: 820px;
  margin-inline: auto;
}

body.is-whipify-viewport-mobile main,
body.is-whipify-viewport-mobile .site-main {
  max-width: 430px;
  margin-inline: auto;
}

.whipify-frontend-editor-panel__structure button[data-whipify-action="remove-block"] {
  background: rgba(220, 38, 38, 0.18);
  color: #fecaca;
}

[data-whipify-editable="true"] {
  outline: 2px dashed transparent;
  outline-offset: 2px;
  border-radius: 0.375rem;
  transition: outline-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

[data-whipify-editable="true"][data-whipify-surface-kind="page-block"] {
  background: rgba(245, 158, 11, 0.04);
}

[data-whipify-editable="true"][data-whipify-surface-kind="global-chrome"] {
  background: rgba(59, 130, 246, 0.05);
}

[data-whipify-editable="true"][data-whipify-surface-kind="shared-content"] {
  background: rgba(16, 185, 129, 0.05);
}

[data-whipify-editable="true"][data-whipify-surface-kind="media"] {
  background: rgba(168, 85, 247, 0.05);
}

[data-whipify-editable="true"].is-whipify-hovered,
[data-whipify-editable="true"].is-whipify-selected {
  outline-color: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
}

[data-whipify-editable="true"][data-whipify-surface-kind="global-chrome"].is-whipify-hovered,
[data-whipify-editable="true"][data-whipify-surface-kind="global-chrome"].is-whipify-selected {
  outline-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18);
}

[data-whipify-editable="true"][data-whipify-surface-kind="shared-content"].is-whipify-hovered,
[data-whipify-editable="true"][data-whipify-surface-kind="shared-content"].is-whipify-selected {
  outline-color: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.18);
}

[data-whipify-editable="true"][data-whipify-surface-kind="media"].is-whipify-hovered,
[data-whipify-editable="true"][data-whipify-surface-kind="media"].is-whipify-selected {
  outline-color: #a855f7;
  box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.18);
}

.whipify-frontend-editor-admin-only {
  display: none;
}

body.is-whipify-frontend-editor-enabled .whipify-frontend-editor-admin-only {
  display: block;
}`;

const inferPageBlockFieldType = (
  blockName: string,
  field: string,
): WhipifyFrontendEditorPageBlockFieldSupport['fieldType'] => {
  if (blockName === 'core/image' && field === 'id') {
    return 'mediaId';
  }

  if (blockName === 'core/image' && (field === 'width' || field === 'height')) {
    return 'number';
  }

  if (blockName === 'core/image' && field === 'alt') {
    return 'imageAlt';
  }

  if (field === 'url' || field === 'href') {
    return 'url';
  }

  if (field === 'content') {
    return 'richText';
  }

  return 'plainText';
};

const inferPageBlockScope = (
  blockName: string,
): WhipifyFrontendEditorPageBlockFieldSupport['scope'] => (blockName === 'core/image' ? 'media' : 'page-block');

export const listWhipifyFrontendEditorPageBlockSupport = (): WhipifyFrontendEditorPageBlockFieldSupport[] =>
  Object.entries(PAGE_BLOCK_WHITELIST)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([blockName, fields]) =>
      [...fields]
        .sort((left, right) => left.localeCompare(right))
        .map((field) => ({
          blockName,
          field,
          fieldType: inferPageBlockFieldType(blockName, field),
          scope: inferPageBlockScope(blockName),
        })),
    );

export const buildWhipifyFrontendEditorSupportMap = (
  input: BuildWhipifyFrontendEditorSupportMapInput = {},
): WhipifyFrontendEditorSupportMap => {
  const schemaSupport = buildWhipifyQuickEditorSchemaSlotSupport();
  return {
    globalChrome: {
      header: uniqueValues([...(schemaSupport.header || []), ...(input.hasHeaderSlots || [])]),
      footer: uniqueValues([...(schemaSupport.footer || []), ...(input.hasFooterSlots || [])]),
      social: uniqueValues([...(schemaSupport.social || []), ...(input.hasSocialSlots || [])]),
    },
    pageBlocks: { ...PAGE_BLOCK_WHITELIST },
  };
};

export const buildWhipifyFrontendEditorArtifacts = (
  input: BuildWhipifyFrontendEditorArtifactsInput,
): WhipifyFrontendEditorArtifacts => ({
  php: renderPhp(input.defaults, input.supportMap, input.themeSlug),
  js: renderJs(input.defaults, input.supportMap, input.themeSlug),
  css: renderCss(),
});
