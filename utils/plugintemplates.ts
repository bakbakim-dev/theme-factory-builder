/**
 * Theme Factory Blocks - Plugin Templates
 * Version: 2.6.1
 * 
 * This file contains the PHP code for the companion plugin.
 * IMPORTANT: All PHP code must use straight quotes (', ") not curly quotes.
 */

export const PLUGIN_FILES: Record<string, string> = {
  'theme-factory-blocks.php': `<?php
/**
 * Plu` + `gin Name: Theme Factory Blocks
 * Description: Custom Gutenberg blocks and editor parity for Theme Factory themes.
 * Version: 2.6.1
 * Author: Theme Factory AI
 * Text Domain: theme-factory-blocks
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('TFB_VERSION', '2.6.1');
define('TFB_PATH', plugin_dir_path(__FILE__));
define('TFB_URL', plugin_dir_url(__FILE__));

require_once TFB_PATH . 'inc/sanitize.php';
require_once TFB_PATH . 'inc/blocks.php';
require_once TFB_PATH . 'inc/import.php';
require_once TFB_PATH . 'inc/editor-assets.php';
require_once TFB_PATH . 'inc/editor-curation.php';
require_once TFB_PATH . 'inc/patterns.php';
require_once TFB_PATH . 'inc/frontend-editor.php';
require_once TFB_PATH . 'inc/bindings.php';

register_activation_hook(__FILE__, function() {
    if (class_exists('TFB_Import')) {
        TFB_Import::on_activate();
    }
    if (class_exists('TFB_Editor_Assets')) {
        TFB_Editor_Assets::on_activate();
    }
    if (class_exists('TFB_Frontend_Editor')) {
        TFB_Frontend_Editor::on_activate();
    }
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});

add_filter('plugin_action_links_' . plugin_basename(__FILE__), function($links) {
    $import_link = '<a href="' . admin_url('tools.php?page=tf-import') . '">' . __('Import', 'theme-factory-blocks') . '</a>';
    array_unshift($links, $import_link);
    return $links;
});`,

  'inc/blocks.php': `<?php
/**
 * Block registration and rendering for Theme Factory Blocks
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! class_exists( 'TFB_Blocks' ) ) :

final class TFB_Blocks {

    private static $block_slugs = array(
        'page-shell',
        'container',
        'buttons',
        'link-group',
        'table',
        'svg',
        'nav-toggle',
        'button',
        'select',
        'input',
        'textarea'
    );

    public static function init() {
        add_action( 'init', array( __CLASS__, 'register_blocks' ) );
        add_action( 'init', array( __CLASS__, 'register_block_category' ) );
        add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_editor_assets' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_assets' ) );
    }

    public static function register_block_category() {
        if ( ! function_exists( 'register_block_type' ) ) {
            return;
        }

        add_filter( 'block_categories_all', function( $categories ) {
            return array_merge(
                array(
                    array(
                        'slug'  => 'theme-factory',
                        'title' => __( 'Theme Factory', 'theme-factory-blocks' ),
                        'icon'  => 'layout',
                    ),
                ),
                $categories
            );
        }, 10, 1 );
    }

    public static function register_blocks() {
        if ( ! function_exists( 'register_block_type' ) ) {
            return;
        }

        $script_path = TFB_PATH . 'build/blocks.js';
        $script_url  = TFB_URL . 'build/blocks.js';
        $asset_file  = TFB_PATH . 'build/blocks.asset.php';
        $script_deps = array(
            'wp-blocks',
            'wp-element',
            'wp-i18n',
            'wp-components',
            'wp-block-editor',
            'wp-data',
            'wp-compose',
        );

        $version = TFB_VERSION;

        if ( file_exists( $asset_file ) ) {
            $asset = require $asset_file;
            if ( isset( $asset['dependencies'] ) ) {
                $script_deps = $asset['dependencies'];
            }
            if ( isset( $asset['version'] ) ) {
                $version = $asset['version'];
            }
        }

        if ( file_exists( $script_path ) ) {
            wp_register_script(
                'tfb-blocks',
                $script_url,
                $script_deps,
                $version,
                true
            );
        }

        $editor_style_path = TFB_PATH . 'build/editor.css';
        if ( file_exists( $editor_style_path ) ) {
            wp_register_style(
                'tfb-editor',
                TFB_URL . 'build/editor.css',
                array(),
                $version
            );
        }

        $frontend_style_path = TFB_PATH . 'build/style.css';
        if ( file_exists( $frontend_style_path ) ) {
            wp_register_style(
                'tfb-frontend',
                TFB_URL . 'build/style.css',
                array(),
                $version
            );
        }

        foreach ( self::$block_slugs as $slug ) {
            $block_dir  = TFB_PATH . 'blocks/' . $slug;
            $block_json = $block_dir . '/block.json';

            $args = array(
                'editor_script' => 'tfb-blocks',
                'editor_style'  => 'tfb-editor',
                'style'         => 'tfb-frontend',
            );

            $callback_name = 'render_' . str_replace( '-', '_', $slug );
            if ( method_exists( __CLASS__, $callback_name ) ) {
                $args['render_callback'] = array( __CLASS__, $callback_name );
            }

            if ( function_exists( 'register_block_type_from_metadata' ) && file_exists( $block_json ) ) {
                register_block_type_from_metadata( $block_dir, $args );
            } else {
                register_block_type( 'theme-factory/' . $slug, $args );
            }
        }
    }

    public static function enqueue_editor_assets() {
        $site_content_values = function_exists( 'tfb_site_content_binding_settings_for_editor' )
            ? tfb_site_content_binding_settings_for_editor()
            : array();
        wp_localize_script( 'tfb-blocks', 'tfbData', array(
            'siteUrl'  => home_url( '/' ),
            'siteName' => get_bloginfo( 'name' ),
            'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'tfb_nonce' ),
            'blockBindings' => array(
                'sourceName' => function_exists( 'tfb_site_content_binding_source_name' ) ? tfb_site_content_binding_source_name() : '',
                'fields' => function_exists( 'tfb_site_content_binding_fields_for_editor' ) ? tfb_site_content_binding_fields_for_editor() : array(),
                'values' => $site_content_values,
                'revisionToken' => function_exists( 'tfb_site_content_binding_revision_token' ) ? tfb_site_content_binding_revision_token( $site_content_values ) : '',
                'updateUrl' => function_exists( 'tfb_site_content_binding_update_url' ) ? tfb_site_content_binding_update_url() : '',
                'restNonce' => wp_create_nonce( 'wp_rest' ),
            ),
        ) );
    }

    public static function enqueue_frontend_assets() {
        $style_path = TFB_PATH . 'build/style.css';
        if ( file_exists( $style_path ) ) {
            wp_enqueue_style( 'tfb-frontend' );
        }

        $interactivity_path = TFB_PATH . 'build/interactivity.js';
        if ( file_exists( $interactivity_path ) ) {
            wp_enqueue_script(
                'tfb-interactivity',
                TFB_URL . 'build/interactivity.js',
                array(),
                TFB_VERSION,
                true
            );
        }
    }

    private static function sanitize_tag( $tag, $fallback = 'div' ) {
        $allowed = array( 'div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav', 'span', 'form', 'button' );
        $tag     = is_string( $tag ) ? strtolower( $tag ) : $fallback;
        return in_array( $tag, $allowed, true ) ? $tag : $fallback;
    }

    private static function decode_loose_unicode_escapes( $value ) {
        if ( ! is_string( $value ) || '' === $value ) {
            return '';
        }
        $value = preg_replace_callback(
            '/u([0-9a-fA-F]{4})/',
            function( $matches ) {
                return html_entity_decode( '&#x' . $matches[1] . ';', ENT_QUOTES | ENT_HTML5, 'UTF-8' );
            },
            $value
        );
        return html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
    }

    private static function sanitize_html_id( $value ) {
        if ( ! is_string( $value ) ) {
            return '';
        }
        $value = trim( self::decode_loose_unicode_escapes( $value ) );
        if ( '' === $value ) {
            return '';
        }
        $value = preg_replace( '/[^A-Za-z0-9_-]+/', '-', $value );
        return trim( $value, '-' );
    }

    private static function normalize_id_reference_value( $value, $allow_multiple = true ) {
        if ( ! is_scalar( $value ) ) {
            return '';
        }

        $decoded = trim( self::decode_loose_unicode_escapes( (string) $value ) );
        if ( '' === $decoded ) {
            return '';
        }

        if ( ! $allow_multiple ) {
            $prefix = '';
            if ( '#' === substr( $decoded, 0, 1 ) ) {
                $prefix  = '#';
                $decoded = substr( $decoded, 1 );
            }
            $normalized = self::sanitize_html_id( $decoded );
            return '' !== $normalized ? $prefix . $normalized : '';
        }

        $tokens = preg_split( '/\s+/', $decoded );
        $clean  = array();

        foreach ( $tokens as $token ) {
            if ( '' === $token ) {
                continue;
            }

            $prefix = '';
            if ( '#' === substr( $token, 0, 1 ) ) {
                $prefix = '#';
                $token  = substr( $token, 1 );
            }

            $normalized = self::sanitize_html_id( $token );
            if ( '' !== $normalized ) {
                $clean[] = $prefix . $normalized;
            }
        }

        return implode( ' ', $clean );
    }

    private static function parse_legacy_json( $value ) {
        if ( ! is_string( $value ) || '' === trim( $value ) ) {
            return array();
        }

        $decoded = json_decode( $value, true );
        return is_array( $decoded ) ? $decoded : array();
    }

    private static function parse_legacy_style_string( $value ) {
        $styles = array();

        if ( ! is_string( $value ) || '' === trim( $value ) ) {
            return $styles;
        }

        foreach ( explode( ';', $value ) as $rule ) {
            if ( false === strpos( $rule, ':' ) ) {
                continue;
            }

            list( $property, $property_value ) = array_map( 'trim', explode( ':', $rule, 2 ) );
            if ( '' === $property || '' === $property_value ) {
                continue;
            }

            $styles[ $property ] = $property_value;
        }

        return $styles;
    }

    private static function sanitize_style_property( $property ) {
        if ( ! is_string( $property ) ) {
            return '';
        }

        $property = trim( strtolower( $property ) );
        if ( preg_match( '/^--[a-z0-9-]+$/', $property ) ) {
            return $property;
        }

        return preg_match( '/^[a-z][a-z0-9-]*$/', $property ) ? $property : '';
    }

    private static function sanitize_style_value( $value ) {
        if ( ! is_scalar( $value ) ) {
            return '';
        }

        $value = trim( wp_strip_all_tags( (string) $value ) );
        $value = preg_replace( '/[{};]/', '', $value );
        $value = preg_replace( '/expression\s*\(/i', '', $value );
        $value = preg_replace( '/javascript\s*:/i', '', $value );

        return trim( $value );
    }

    private static function normalize_style_object( $attributes ) {
        $styles = array();

        if ( isset( $attributes['customStyle'] ) && is_array( $attributes['customStyle'] ) ) {
            $styles = $attributes['customStyle'];
        } elseif ( isset( $attributes['style'] ) && is_string( $attributes['style'] ) ) {
            $styles = self::parse_legacy_style_string( $attributes['style'] );
        }

        if ( ! empty( $attributes['bgImage'] ) && is_string( $attributes['bgImage'] ) ) {
            $styles['background-image'] = "url('" . esc_url_raw( $attributes['bgImage'] ) . "')";
            if ( empty( $styles['background-size'] ) ) {
                $styles['background-size'] = 'cover';
            }
            if ( empty( $styles['background-position'] ) ) {
                $styles['background-position'] = 'center';
            }
        }

        return $styles;
    }

    private static function style_object_to_css( $style_object ) {
        if ( ! is_array( $style_object ) ) {
            return '';
        }

        $declarations = array();

        foreach ( $style_object as $property => $value ) {
            $property = self::sanitize_style_property( $property );
            $value    = self::sanitize_style_value( $value );

            if ( '' === $property || '' === $value ) {
                continue;
            }

            $declarations[] = $property . ': ' . $value;
        }

        return implode( '; ', $declarations );
    }

    private static function sanitize_extra_attributes( $attributes ) {
        $clean = array();

        if ( ! is_array( $attributes ) ) {
            return $clean;
        }

        foreach ( $attributes as $name => $value ) {
            if ( ! is_string( $name ) ) {
                continue;
            }

            $is_data    = 0 === strpos( $name, 'data-' );
            $is_aria    = 0 === strpos( $name, 'aria-' );
            $is_allowed = $is_data || $is_aria || in_array( $name, array( 'role', 'hidden', 'tabindex', 'target', 'rel', 'type' ), true );

            if ( ! $is_allowed ) {
                continue;
            }

            if ( 'hidden' === $name ) {
                $clean[ $name ] = filter_var( $value, FILTER_VALIDATE_BOOLEAN ) || '' === $value || 'hidden' === $value;
                continue;
            }

            if ( in_array( $name, array( 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-details', 'aria-flowto', 'aria-activedescendant' ), true ) ) {
                $normalized = self::normalize_id_reference_value( $value, ! in_array( $name, array( 'aria-controls', 'aria-activedescendant' ), true ) );
                if ( '' !== $normalized ) {
                    $clean[ $name ] = $normalized;
                }
                continue;
            }

            if ( is_bool( $value ) ) {
                $clean[ $name ] = $value ? 'true' : 'false';
                continue;
            }

            if ( ! is_scalar( $value ) ) {
                continue;
            }

            $clean[ $name ] = sanitize_text_field( (string) $value );
        }

        return $clean;
    }

    private static function normalize_html_attributes( $attributes ) {
        $html_attributes = array();

        if ( isset( $attributes['htmlAttributes'] ) && is_array( $attributes['htmlAttributes'] ) ) {
            $html_attributes = $attributes['htmlAttributes'];
        } elseif ( isset( $attributes['extraAttributes'] ) && is_string( $attributes['extraAttributes'] ) ) {
            $html_attributes = self::parse_legacy_json( $attributes['extraAttributes'] );
        }

        return self::sanitize_extra_attributes( $html_attributes );
    }

    private static function build_attr_string( $attributes ) {
        if ( ! is_array( $attributes ) || empty( $attributes ) ) {
            return '';
        }

        $parts = array();

        foreach ( $attributes as $name => $value ) {
            if ( '' === $value || null === $value || false === $value ) {
                continue;
            }

            if ( true === $value ) {
                $parts[] = $name;
                continue;
            }

            $parts[] = $name . '="' . esc_attr( $value ) . '"';
        }

        return empty( $parts ) ? '' : ' ' . implode( ' ', $parts );
    }

    private static function join_attributes( $wrapper_attributes, $extra_attributes = array() ) {
        $combined = trim( $wrapper_attributes . self::build_attr_string( $extra_attributes ) );
        return '' === $combined ? '' : ' ' . $combined;
    }

    private static function get_wrapper_context( $attributes, $default_tag = 'div', $extra_wrapper = array() ) {
        $tag     = self::sanitize_tag( isset( $attributes['tagName'] ) ? $attributes['tagName'] : $default_tag, $default_tag );
        $wrapper = array();

        foreach ( array( 'class', 'style', 'id', 'aria-label' ) as $key ) {
            if ( isset( $extra_wrapper[ $key ] ) && '' !== $extra_wrapper[ $key ] ) {
                $wrapper[ $key ] = $extra_wrapper[ $key ];
            }
        }

        $id = self::sanitize_html_id( isset( $attributes['id'] ) ? $attributes['id'] : '' );
        if ( $id && empty( $wrapper['id'] ) ) {
            $wrapper['id'] = $id;
        }

        $custom_style = self::style_object_to_css( self::normalize_style_object( $attributes ) );
        if ( '' !== $custom_style ) {
            $wrapper['style'] = empty( $wrapper['style'] ) ? $custom_style : trim( $wrapper['style'] . '; ' . $custom_style, '; ' );
        }

        return array(
            'tag'     => $tag,
            'wrapper' => get_block_wrapper_attributes( $wrapper ),
            'html'    => self::normalize_html_attributes( $attributes ),
        );
    }

    private static function render_wrapped_content( $tag, $wrapper_attributes, $extra_attributes, $content ) {
        return '<' . $tag . self::join_attributes( $wrapper_attributes, $extra_attributes ) . '>' . $content . '</' . $tag . '>';
    }

    public static function render_page_shell( $attributes, $content ) {
        $context = self::get_wrapper_context(
            $attributes,
            'div',
            array( 'class' => 'wp-block-theme-factory-page-shell' )
        );

        return self::render_wrapped_content( $context['tag'], $context['wrapper'], $context['html'], $content );
    }

    public static function render_container( $attributes, $content ) {
        $context = self::get_wrapper_context(
            $attributes,
            'div',
            array( 'class' => 'wp-block-theme-factory-container' )
        );

        return self::render_wrapped_content( $context['tag'], $context['wrapper'], $context['html'], $content );
    }

    public static function render_buttons( $attributes, $content ) {
        $context = self::get_wrapper_context(
            $attributes,
            'div',
            array( 'class' => 'wp-block-theme-factory-buttons wp-block-buttons' )
        );

        return self::render_wrapped_content( $context['tag'], $context['wrapper'], $context['html'], $content );
    }

    public static function render_link_group( $attributes, $content ) {
        $context = self::get_wrapper_context(
            $attributes,
            'div',
            array( 'class' => 'wp-block-theme-factory-link-group' )
        );

        $href = '';
        if ( ! empty( $attributes['href'] ) && is_string( $attributes['href'] ) ) {
            $href = esc_url( $attributes['href'] );
        } elseif ( ! empty( $attributes['url'] ) && is_string( $attributes['url'] ) ) {
            $href = esc_url( $attributes['url'] );
        }

        $html_attributes = $context['html'];
        if ( $href ) {
            $html_attributes['data-href'] = $href;
        }

        if ( ! empty( $attributes['target'] ) ) {
            $html_attributes['data-target'] = sanitize_text_field( $attributes['target'] );
        }

        if ( ! empty( $attributes['rel'] ) ) {
            $html_attributes['data-rel'] = sanitize_text_field( $attributes['rel'] );
        }

        if ( empty( $html_attributes['role'] ) ) {
            $html_attributes['role'] = 'link';
        }

        if ( empty( $html_attributes['tabindex'] ) ) {
            $html_attributes['tabindex'] = '0';
        }

        return self::render_wrapped_content( $context['tag'], $context['wrapper'], $html_attributes, $content );
    }

    public static function render_table( $attributes, $content ) {
        $encoded = isset( $attributes['content'] ) ? $attributes['content'] : '';
        if ( empty( $encoded ) ) {
            return $content;
        }

        $decoded = base64_decode( $encoded );
        if ( false === $decoded || '' === trim( $decoded ) ) {
            return $content;
        }

        $allowed_html = array(
            'table'   => array( 'class' => true, 'style' => true ),
            'thead'   => array( 'class' => true, 'style' => true ),
            'tbody'   => array( 'class' => true, 'style' => true ),
            'tfoot'   => array( 'class' => true, 'style' => true ),
            'tr'      => array( 'class' => true, 'style' => true ),
            'th'      => array( 'class' => true, 'style' => true, 'scope' => true, 'colspan' => true, 'rowspan' => true ),
            'td'      => array( 'class' => true, 'style' => true, 'colspan' => true, 'rowspan' => true ),
            'caption' => array( 'class' => true, 'style' => true ),
            'colgroup'=> array(),
            'col'     => array( 'span' => true, 'style' => true ),
            'div'     => array( 'class' => true, 'style' => true ),
            'span'    => array( 'class' => true, 'style' => true ),
            'p'       => array( 'class' => true, 'style' => true ),
            'strong'  => array( 'class' => true, 'style' => true ),
            'em'      => array( 'class' => true, 'style' => true ),
            'br'      => array(),
            'a'       => array( 'class' => true, 'style' => true, 'href' => true, 'target' => true, 'rel' => true, 'aria-label' => true ),
            'button'  => array( 'class' => true, 'style' => true, 'type' => true, 'aria-label' => true ),
            'img'     => array( 'class' => true, 'style' => true, 'src' => true, 'alt' => true, 'width' => true, 'height' => true, 'loading' => true ),
            'svg'     => array( 'xmlns' => true, 'width' => true, 'height' => true, 'viewBox' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true, 'class' => true, 'style' => true, 'aria-hidden' => true, 'role' => true ),
            'path'    => array( 'd' => true, 'fill' => true, 'stroke' => true ),
        );

        $wrapper = get_block_wrapper_attributes( array( 'class' => 'wp-block-theme-factory-table' ) );
        return '<div ' . $wrapper . '>' . wp_kses( $decoded, $allowed_html ) . '</div>';
    }

    public static function render_svg( $attributes, $content ) {
        $encoded = isset( $attributes['content'] ) ? $attributes['content'] : '';
        if ( empty( $encoded ) ) {
            return $content;
        }

        $decoded = base64_decode( $encoded );
        if ( false === $decoded ) {
            return $content;
        }

        $allowed_html = array(
            'svg'      => array( 'xmlns' => true, 'width' => true, 'height' => true, 'viewBox' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true, 'class' => true, 'style' => true, 'aria-hidden' => true, 'role' => true ),
            'path'     => array( 'd' => true, 'fill' => true, 'stroke' => true ),
            'circle'   => array( 'cx' => true, 'cy' => true, 'r' => true, 'fill' => true, 'stroke' => true ),
            'rect'     => array( 'x' => true, 'y' => true, 'width' => true, 'height' => true, 'fill' => true, 'stroke' => true, 'rx' => true, 'ry' => true ),
            'line'     => array( 'x1' => true, 'y1' => true, 'x2' => true, 'y2' => true, 'stroke' => true ),
            'polyline' => array( 'points' => true, 'fill' => true, 'stroke' => true ),
            'polygon'  => array( 'points' => true, 'fill' => true, 'stroke' => true ),
            'g'        => array( 'fill' => true, 'stroke' => true, 'transform' => true ),
            'defs'     => array(),
            'text'     => array( 'x' => true, 'y' => true, 'fill' => true, 'font-size' => true ),
        );

        return '<div class="wp-block-theme-factory-svg">' . wp_kses( $decoded, $allowed_html ) . '</div>';
    }

    public static function render_nav_toggle( $attributes, $content ) {
        if ( '' !== trim( $content ) ) {
            return $content;
        }

        $class_name = '';
        if ( ! empty( $attributes['className'] ) ) {
            $class_name = ' ' . TFB_Sanitize::classes( $attributes['className'] );
        }

        return '<button class="wp-block-theme-factory-nav-toggle' . $class_name . '" type="button" aria-expanded="false"></button>';
    }

  public static function render_button( $attributes, $content ) {
      if ( '' === trim( (string) ( $attributes['text'] ?? '' ) ) && '' !== trim( $content ) ) {
          return $content;
      }

      $href       = ! empty( $attributes['href'] ) ? esc_url( $attributes['href'] ) : '';
      $text       = ! empty( $attributes['text'] ) ? wp_kses_post( self::decode_loose_unicode_escapes( (string) $attributes['text'] ) ) : '';
      $class      = 'wp-block-theme-factory-button';
      $className = ! empty( $attributes['className'] ) ? TFB_Sanitize::classes( $attributes['className'] ) : '';
      $aria_label = ! empty( $attributes['ariaLabel'] ) ? sanitize_text_field( $attributes['ariaLabel'] ) : '';
      $tag_name   = ! empty( $attributes['tagName'] ) && 'button' === strtolower( $attributes['tagName'] ) ? 'button' : 'a';
      $button_type = ! empty( $attributes['buttonType'] ) ? sanitize_text_field( $attributes['buttonType'] ) : 'button';
      $style      = self::style_object_to_css( self::normalize_style_object( $attributes ) );

        if ( '' !== $className ) {
            $class .= ' ' . $className;
        }

        $target = ! empty( $attributes['target'] ) ? sanitize_text_field( $attributes['target'] ) : '';
        $rel    = ! empty( $attributes['rel'] ) ? sanitize_text_field( $attributes['rel'] ) : '';

        $extra_attributes = array(
            'class' => $class,
        );

        if ( 'a' === $tag_name ) {
            $extra_attributes['href'] = '' !== $href ? $href : '#';
        } else {
            $extra_attributes['type'] = in_array( $button_type, array( 'button', 'submit', 'reset' ), true ) ? $button_type : 'button';
        }

        if ( 'a' === $tag_name && '' !== $target ) {
            $extra_attributes['target'] = $target;
        }

        if ( 'a' === $tag_name && '' !== $rel ) {
            $extra_attributes['rel'] = $rel;
        }

      if ( '' !== $aria_label ) {
          $extra_attributes['aria-label'] = $aria_label;
      }

        if ( '' !== $style ) {
            $extra_attributes['style'] = $style;
        }

        $html_attributes = self::normalize_html_attributes( $attributes );
        if ( ! empty( $html_attributes ) ) {
            $extra_attributes = array_merge( $extra_attributes, $html_attributes );
        }

      return '<' . $tag_name . self::build_attr_string( $extra_attributes ) . '>' . $text . '</' . $tag_name . '>';
  }

    public static function render_select( $attributes, $content ) {
        if ( '' !== trim( $content ) ) {
            return $content;
        }

        $class_name = 'wp-block-theme-factory-select';
        if ( ! empty( $attributes['className'] ) ) {
            $class_name .= ' ' . TFB_Sanitize::classes( $attributes['className'] );
        }

        $select_attributes = array(
            'class' => $class_name,
            'name'  => ! empty( $attributes['name'] ) ? sanitize_text_field( $attributes['name'] ) : '',
            'id'    => ! empty( $attributes['id'] ) ? self::sanitize_html_id( $attributes['id'] ) : '',
        );

        if ( ! empty( $attributes['required'] ) ) {
            $select_attributes['required'] = true;
        }

        $options = isset( $attributes['options'] ) && is_array( $attributes['options'] ) ? $attributes['options'] : array();
        if ( ! empty( $attributes['placeholder'] ) ) {
            $has_empty_option = false;
            foreach ( $options as &$option ) {
                if ( empty( $option['value'] ) ) {
                    $option['label'] = ! empty( $option['label'] ) ? $option['label'] : sanitize_text_field( $attributes['placeholder'] );
                    $has_empty_option = true;
                    break;
                }
            }
            unset( $option );

            if ( ! $has_empty_option ) {
                array_unshift(
                    $options,
                    array(
                        'label'    => sanitize_text_field( $attributes['placeholder'] ),
                        'value'    => '',
                        'selected' => true,
                    )
                );
            }
        }

        $option_markup = '';
        foreach ( $options as $option ) {
            $option_attributes = array(
                'value' => isset( $option['value'] ) ? sanitize_text_field( $option['value'] ) : '',
            );
            if ( ! empty( $option['selected'] ) ) {
                $option_attributes['selected'] = true;
            }
            $option_markup .= '<option' . self::build_attr_string( $option_attributes ) . '>' . esc_html( isset( $option['label'] ) ? $option['label'] : '' ) . '</option>';
        }

        return '<select' . self::build_attr_string( $select_attributes ) . '>' . $option_markup . '</select>';
    }

    public static function render_input( $attributes, $content ) {
        if ( '' !== trim( $content ) ) {
            return $content;
        }

        $class_name = 'wp-block-theme-factory-input';
        if ( ! empty( $attributes['className'] ) ) {
            $class_name .= ' ' . TFB_Sanitize::classes( $attributes['className'] );
        }

        $input_attributes = array(
            'class'       => $class_name,
            'type'        => ! empty( $attributes['type'] ) ? sanitize_text_field( $attributes['type'] ) : 'text',
            'name'        => ! empty( $attributes['name'] ) ? sanitize_text_field( $attributes['name'] ) : '',
            'id'          => ! empty( $attributes['id'] ) ? self::sanitize_html_id( $attributes['id'] ) : '',
            'placeholder' => ! empty( $attributes['placeholder'] ) ? sanitize_text_field( $attributes['placeholder'] ) : '',
        );

        if ( ! empty( $attributes['required'] ) ) {
            $input_attributes['required'] = true;
        }

        return '<input' . self::build_attr_string( $input_attributes ) . ' />';
    }

    public static function render_textarea( $attributes, $content ) {
        if ( '' !== trim( $content ) ) {
            return $content;
        }

        $class_name = 'wp-block-theme-factory-textarea';
        if ( ! empty( $attributes['className'] ) ) {
            $class_name .= ' ' . TFB_Sanitize::classes( $attributes['className'] );
        }

        $textarea_attributes = array(
            'class'       => $class_name,
            'name'        => ! empty( $attributes['name'] ) ? sanitize_text_field( $attributes['name'] ) : '',
            'id'          => ! empty( $attributes['id'] ) ? self::sanitize_html_id( $attributes['id'] ) : '',
            'placeholder' => ! empty( $attributes['placeholder'] ) ? sanitize_text_field( $attributes['placeholder'] ) : '',
            'rows'        => ! empty( $attributes['rows'] ) ? intval( $attributes['rows'] ) : 4,
        );

        if ( ! empty( $attributes['required'] ) ) {
            $textarea_attributes['required'] = true;
        }

        return '<textarea' . self::build_attr_string( $textarea_attributes ) . '></textarea>';
    }
}

endif;

TFB_Blocks::init();`,

  'inc/sanitize.php': `<?php
/**
 * Sanitization utilities for Theme Factory Blocks
 */

if (!defined('ABSPATH')) exit;

if ( ! class_exists( 'TFB_Sanitize' ) ) :

final class TFB_Sanitize {
    
    public static function text($v) { 
        return sanitize_text_field($v); 
    }
    
    public static function textarea($v) { 
        return sanitize_textarea_field($v); 
    }
    
    public static function url($v) { 
        return esc_url_raw($v); 
    }
    
    public static function int($v) { 
        return intval($v); 
    }
    
    public static function float($v) { 
        return floatval($v); 
    }
    
    public static function bool($v) { 
        return filter_var($v, FILTER_VALIDATE_BOOLEAN); 
    }
    
    public static function color($v) { 
        return (preg_match('/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/', $v)) ? $v : ''; 
    }
    
    public static function classes($v) {
        if (!is_string($v)) return '';
        $v = preg_replace_callback('/u([0-9a-fA-F]{4})/', function($matches) {
            return html_entity_decode('&#x' . $matches[1] . ';', ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }, $v);
        $v = html_entity_decode($v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        $classes = preg_split('/\\s+/', $v, -1, PREG_SPLIT_NO_EMPTY);
        $clean = array();
        
        foreach ($classes as $c) {
            if (preg_match('/^[\\w\\-:\\/\\.\\[\\]%&>]+$/', $c)) {
                $clean[] = $c;
            }
        }
        
        return implode(' ', array_values(array_unique($clean)));
    }
    
    public static function style($v) {
        if (!is_string($v)) return '';
        
        $v = preg_replace('/expression\\s*\\(/i', '', $v);
        $v = preg_replace('/javascript\\s*:/i', '', $v);
        $v = preg_replace('/url\\s*\\(\\s*["\\'?\\s*data:/i', '', $v);
        
        return $v;
    }
}

endif;`,

  'inc/import.php': `<?php
/**
 * Admin Importer with Strict Block Validation via WP Core Functions
 */

if (!defined('ABSPATH')) exit;

if ( ! class_exists( 'TFB_Import' ) ) :

class TFB_Import {
    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'add_menu'));
    }

    public static function add_menu() {
        add_submenu_page('tools.php', 'TF Import', 'TF Import', 'manage_options', 'tf-import', array(__CLASS__, 'render_page'));
    }

    public static function on_activate() { }

    public static function render_page() {
        $message = '';
        if (isset($_POST['run_import'])) {
            if ( ! isset( $_POST['tfb_import_nonce'] ) || ! wp_verify_nonce( $_POST['tfb_import_nonce'], 'tfb_import' ) ) {
                $message = 'Security check failed. Please refresh the page and try again.';
            } else {
                $force = isset($_POST['force_overwrite']) && $_POST['force_overwrite'] === '1';
                $message = self::run_import($force);
            }
        }
        ?>
        <div class="wrap">
            <h1>Theme Factory Content Import</h1>
            <?php if ($message) echo "<div class='updated'><p>" . esc_html($message) . "</p></div>"; ?>
            <form method="post">
                <?php wp_nonce_field('tfb_import', 'tfb_import_nonce'); ?>
                <p>Scans theme for <code>assets/data/routes.json</code> and imports content.</p>
                <div style="background:#fff; border:1px solid #ccd0d4; padding:15px; margin-bottom:20px; max-width:600px;">
                    <label>
                        <input type="checkbox" name="force_overwrite" value="1"> 
                        <strong>Force Overwrite Existing Content</strong>
                    </label>
                    <p class="description">If checked, existing pages with the same slug will be completely replaced.</p>
                </div>
                <input type="submit" name="run_import" class="button button-primary" value="Run Import">
            </form>
        </div>
        <?php
    }

    private static function run_import($force_overwrite = false) {
        $routes_file = get_template_directory() . '/assets/data/routes.json';
        if (!file_exists($routes_file)) return "Error: routes.json not found.";
        
        $json_content = file_get_contents($routes_file);
        if (!$json_content) return "Error: Could not read routes.json.";

        $routes = json_decode($json_content, true);
        if (!is_array($routes)) return "Error: Invalid routes format.";

        $page_results = self::import_pages($routes, $force_overwrite);
        $menu_results = self::import_menus($routes);

        return "Import Complete: {$page_results['count']} pages processed. {$menu_results['count']} menu items created.";
    }

    private static function import_pages($routes, $force_overwrite) {
        $count = 0;
        foreach ($routes as $route) {
            $slug = isset($route['slug']) ? $route['slug'] : basename($route['path']);
            if (!$slug || $slug === '/') $slug = 'home';
            
            $title = isset($route['title']) ? $route['title'] : ucfirst($slug);
            
            $blocks_file = get_template_directory() . "/assets/content/$slug.blocks.html";
            $content = file_exists($blocks_file) ? file_get_contents($blocks_file) : '';
            
            $content = self::process_content_for_import($content);
            
            $existing = get_page_by_path($slug);
            $post_id = 0;

            $post_data = array(
                'post_title' => $title,
                'post_status' => 'publish',
                'post_type' => 'page',
            );

            if ($existing) {
                if (!$force_overwrite) {
                    continue;
                }
                $post_id = $existing->ID;
                $post_data['ID'] = $post_id;
                $post_data['post_content'] = $content;
                wp_update_post($post_data);
            } else {
                $post_data['post_name'] = $slug;
                $post_data['post_content'] = $content;
                $post_id = wp_insert_post($post_data);
            }

            if ($post_id && !is_wp_error($post_id)) {
                $count++;
            }
        }
        return array('count' => $count);
    }

    private static function process_content_for_import($html) {
        if (empty($html)) return '';

        $blocks = parse_blocks($html);
        $has_shell = !empty($blocks) && isset($blocks[0]['blockName']) && $blocks[0]['blockName'] === 'theme-factory/page-shell';

        if ($has_shell) {
            return serialize_blocks(self::apply_curated_block_locks($blocks));
        }

        $shell_class = 'min-h-screen bg-white';
        $wrapped = '<!-- wp:theme-factory/page-shell {"className":"' . $shell_class . '"} -->' .
                   $html .
                   '<!-- /wp:theme-factory/page-shell -->';

        return serialize_blocks(self::apply_curated_block_locks(parse_blocks($wrapped)));
    }

    private static function apply_curated_block_locks($blocks) {
        $lockable_blocks = array(
            'theme-factory/page-shell',
            'theme-factory/container',
            'theme-factory/buttons',
        );

        foreach ($blocks as &$block) {
            $block_name = isset($block['blockName']) ? $block['blockName'] : '';

            if (in_array($block_name, $lockable_blocks, true)) {
                if (!isset($block['attrs']) || !is_array($block['attrs'])) {
                    $block['attrs'] = array();
                }

                $existing_lock = isset($block['attrs']['lock']) && is_array($block['attrs']['lock'])
                    ? $block['attrs']['lock']
                    : array();

                $block['attrs']['lock'] = array_merge(
                    $existing_lock,
                    array(
                        'move' => true,
                        'remove' => true,
                    )
                );
            }

            if (isset($block['innerBlocks']) && is_array($block['innerBlocks']) && !empty($block['innerBlocks'])) {
                $block['innerBlocks'] = self::apply_curated_block_locks($block['innerBlocks']);
            }
        }
        unset($block);

        return $blocks;
    }

    private static function import_menus($routes) {
        $menu_name = 'Primary Menu (TF Generated)';
        $menu_exists = wp_get_nav_menu_object($menu_name);
        if (!$menu_exists) { 
            $menu_id = wp_create_nav_menu($menu_name); 
        } else { 
            $menu_id = $menu_exists->term_id; 
        }
        if (is_wp_error($menu_id)) return array('count' => 0);

        $locations = get_theme_mod('nav_menu_locations');
        if (!is_array($locations)) $locations = array();
        $locations['tf_primary'] = $menu_id;
        set_theme_mod('nav_menu_locations', $locations);

        $count = 0;
        $existing_items = wp_get_nav_menu_items($menu_id);
        if ($existing_items) { 
            foreach ($existing_items as $item) {
                wp_delete_post($item->ID, true);
            }
        }

        foreach ($routes as $route) {
            $slug = isset($route['slug']) ? $route['slug'] : basename($route['path']);
            if (!$slug || $slug === '/') $slug = 'home';
            $title = isset($route['title']) ? $route['title'] : ucfirst($slug);
            $page = get_page_by_path($slug);
            if ($page) {
                wp_update_nav_menu_item($menu_id, 0, array(
                    'menu-item-title' => $title,
                    'menu-item-object-id' => $page->ID,
                    'menu-item-object' => 'page',
                    'menu-item-status' => 'publish',
                    'menu-item-type' => 'post_type',
                ));
                $count++;
            }
        }
        return array('count' => $count);
    }
}

endif;

TFB_Import::init();`,

  'inc/editor-assets.php': `<?php
/**
 * Editor Assets Loader
 * Injects theme CSS into the block editor iframe for visual parity
 */

if (!defined('ABSPATH')) exit;

if ( ! class_exists( 'TFB_Editor_Assets' ) ) :

class TFB_Editor_Assets {
    
    public static function init() {
        add_filter('block_editor_settings_all', array(__CLASS__, 'inject_iframe_styles'), 10, 2);
    }

    public static function on_activate() { }

    public static function inject_iframe_styles($settings, $context) {
        $theme_dir = get_stylesheet_directory();
        $theme_uri = get_stylesheet_directory_uri();
        $styles = '';

        if (!isset($settings['styles'])) {
            $settings['styles'] = array();
        }

        $all_css_files = array_merge(
            glob($theme_dir . '/assets/*.css') ?: array(),
            glob($theme_dir . '/build/*.css') ?: array(),
            glob($theme_dir . '/dist/*.css') ?: array()
        );

        if (file_exists($theme_dir . '/style.css')) {
            $all_css_files[] = $theme_dir . '/style.css';
        }

        foreach ($all_css_files as $file) {
            if (strpos($file, 'editor') !== false) continue;
            
            $content = file_get_contents($file);
            if (!$content) continue;

            $rel_path = '/'; 
            if (strpos($file, '/build/') !== false) $rel_path = '/build/';
            if (strpos($file, '/dist/') !== false) $rel_path = '/dist/';
            if (strpos($file, '/assets/') !== false) $rel_path = '/assets/';
            
            $content = str_replace("url('./", "url('" . $theme_uri . $rel_path, $content);
            $content = str_replace('url("./', 'url("' . $theme_uri . $rel_path, $content);
            $content = str_replace("url('../", "url('" . $theme_uri . "/", $content);
            $content = str_replace('url("../', 'url("' . $theme_uri . '/', $content);
            $content = str_replace('url(./', 'url(' . $theme_uri . $rel_path, $content);
            $content = str_replace('url(../', 'url(' . $theme_uri . '/', $content);

            $content = preg_replace('/(html|body)\\s*\\{[^}]*overflow\\s*:[^}]*\\}/i', '', $content);
            $content = preg_replace('/(html|body)\\s*\\{[^}]*pointer-events\\s*:[^}]*\\}/i', '', $content);
            $content = preg_replace('/(html|body)\\s*\\{[^}]*position\\s*:\\s*(absolute|fixed)[^}]*\\}/i', '', $content);
            $content = preg_replace('/(html|body)\\s*\\{[^}]*height\\s*:\\s*100%[^}]*\\}/i', '', $content);
            $content = preg_replace('/(html|body)\\s*\\{[^}]*z-index\\s*:[^}]*\\}/i', '', $content);

            $styles .= $content . "\\n";
        }

        $styles .= "body.block-editor-iframe__body{background:#fff;color:inherit;}\\n";
        $styles .= ".editor-styles-wrapper,.editor-styles-wrapper .is-root-container{max-width:none !important;}\\n";
        
        if (!empty($styles)) {
            $settings['styles'][] = array( 'css' => $styles );
        }
        
        return $settings;
    }
}

endif;

TFB_Editor_Assets::init();`,

  'inc/editor-curation.php': `<?php
/**
 * Curated Gutenberg editing surface for converted pages
 */

if (!defined('ABSPATH')) exit;

if ( ! class_exists( 'TFB_Editor_Curation' ) ) :

final class TFB_Editor_Curation {
    public static function init() {
        add_filter( 'allowed_block_types_all', array( __CLASS__, 'filter_allowed_block_types' ), 20, 2 );
        add_filter( 'block_editor_settings_all', array( __CLASS__, 'curate_editor_settings' ), 20, 2 );
    }

    private static function get_allowed_blocks() {
        return array(
            'core/heading',
            'core/paragraph',
            'core/button',
            'core/image',
            'core/list',
            'core/list-item',
            'core/group',
            'core/columns',
            'core/column',
            'core/spacer',
            'core/separator',
            'theme-factory/page-shell',
            'theme-factory/container',
            'theme-factory/buttons',
            'theme-factory/link-group',
            'theme-factory/table',
            'theme-factory/svg',
            'theme-factory/nav-toggle',
            'theme-factory/button',
            'theme-factory/select',
            'theme-factory/input',
            'theme-factory/textarea'
        );
    }

    private static function is_curated_context( $editor_context ) {
        $post = is_object( $editor_context ) && isset( $editor_context->post ) ? $editor_context->post : null;
        if ( ! $post || ! isset( $post->post_type ) || 'page' !== $post->post_type ) {
            return false;
        }

        $post_content = isset( $post->post_content ) && is_string( $post->post_content ) ? $post->post_content : '';
        return false !== strpos( $post_content, '<!-- wp:theme-factory/page-shell' );
    }

    public static function filter_allowed_block_types( $allowed_block_types, $editor_context ) {
        if ( ! self::is_curated_context( $editor_context ) ) {
            return $allowed_block_types;
        }

        return self::get_allowed_blocks();
    }

    public static function curate_editor_settings( $settings, $editor_context ) {
        if ( ! self::is_curated_context( $editor_context ) ) {
            return $settings;
        }

        $settings['canLockBlocks'] = false;
        $settings['allowedBlockTypes'] = self::get_allowed_blocks();

        return $settings;
    }
}

endif;

TFB_Editor_Curation::init();`,

  'inc/bindings.php': `<?php
/**
 * Block Bindings source for global Whipify site content
 */

if (!defined('ABSPATH')) exit;

if ( ! class_exists( 'TFB_Bindings' ) ) :

final class TFB_Bindings {
    const SOURCE_NAME = 'theme-factory/site-content';

    public static function init() {
        add_action( 'init', array( __CLASS__, 'register_source' ) );
        add_filter( 'block_bindings_supported_attributes_theme-factory/button', array( __CLASS__, 'filter_button_supported_attributes' ) );
    }

    public static function get_field_definitions() {
        return array(
            'primary_cta_text' => array(
                'label' => __( 'Header: Primary CTA Text', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'primary_cta_url' => array(
                'label' => __( 'Header: Primary CTA URL', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'url',
                'type'  => 'string',
            ),
            'secondary_cta_text' => array(
                'label' => __( 'Header: Secondary CTA Text', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'secondary_cta_url' => array(
                'label' => __( 'Header: Secondary CTA URL', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'url',
                'type'  => 'string',
            ),
            'phone' => array(
                'label' => __( 'Header: Phone', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'announcement_text' => array(
                'label' => __( 'Header: Announcement Text', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'announcement_url' => array(
                'label' => __( 'Header: Announcement URL', 'theme-factory-blocks' ),
                'scope' => 'header',
                'kind'  => 'url',
                'type'  => 'string',
            ),
            'business_name' => array(
                'label' => __( 'Footer: Business Name', 'theme-factory-blocks' ),
                'scope' => 'footer',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'address_line_1' => array(
                'label' => __( 'Footer: Address Line 1', 'theme-factory-blocks' ),
                'scope' => 'footer',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'address_line_2' => array(
                'label' => __( 'Footer: Address Line 2', 'theme-factory-blocks' ),
                'scope' => 'footer',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'contact_line' => array(
                'label' => __( 'Footer: Contact Line', 'theme-factory-blocks' ),
                'scope' => 'footer',
                'kind'  => 'text',
                'type'  => 'string',
            ),
            'facebook' => array(
                'label' => __( 'Social: Facebook URL', 'theme-factory-blocks' ),
                'scope' => 'social',
                'kind'  => 'url',
                'type'  => 'string',
            ),
            'instagram' => array(
                'label' => __( 'Social: Instagram URL', 'theme-factory-blocks' ),
                'scope' => 'social',
                'kind'  => 'url',
                'type'  => 'string',
            ),
            'linkedin' => array(
                'label' => __( 'Social: LinkedIn URL', 'theme-factory-blocks' ),
                'scope' => 'social',
                'kind'  => 'url',
                'type'  => 'string',
            ),
            'x' => array(
                'label' => __( 'Social: X URL', 'theme-factory-blocks' ),
                'scope' => 'social',
                'kind'  => 'url',
                'type'  => 'string',
            ),
        );
    }

    public static function register_source() {
        if ( ! function_exists( 'register_block_bindings_source' ) ) {
            return;
        }

        register_block_bindings_source(
            self::SOURCE_NAME,
            array(
                'label'              => __( 'Whipify Site Content', 'theme-factory-blocks' ),
                'get_value_callback' => array( __CLASS__, 'get_value' ),
            )
        );
    }

    public static function filter_button_supported_attributes( $supported_attributes ) {
        foreach ( array( 'text', 'href' ) as $attribute_name ) {
            if ( ! in_array( $attribute_name, $supported_attributes, true ) ) {
                $supported_attributes[] = $attribute_name;
            }
        }

        return $supported_attributes;
    }

    public static function get_settings() {
        $field_definitions = self::get_field_definitions();
        $settings = get_option( 'whipify_quick_editor_settings', array() );
        if ( ! is_array( $settings ) ) {
            $settings = array();
        }

        $normalized = array();
        foreach ( $field_definitions as $key => $definition ) {
            $value = isset( $settings[ $key ] ) ? $settings[ $key ] : '';
            $normalized[ $key ] = self::sanitize_value( $key, $value );
        }

        return $normalized;
    }

    public static function sanitize_value( $key, $value ) {
        $field_definitions = self::get_field_definitions();
        if ( ! isset( $field_definitions[ $key ] ) ) {
            return '';
        }

        $definition = $field_definitions[ $key ];
        $value = is_scalar( $value ) ? (string) $value : '';

        if ( 'url' === $definition['kind'] ) {
            return esc_url_raw( $value );
        }

        return sanitize_text_field( $value );
    }

    public static function get_revision_token( $settings = null ) {
        if ( ! is_array( $settings ) ) {
            $settings = self::get_settings();
        }

        return hash( 'sha256', wp_json_encode( $settings ) );
    }

    public static function get_value( array $source_args, $block_instance, $attribute_name ) {
        $key = isset( $source_args['key'] ) ? sanitize_key( $source_args['key'] ) : '';
        if ( ! $key ) {
            return null;
        }

        $settings = self::get_settings();
        if ( ! array_key_exists( $key, $settings ) ) {
            return null;
        }

        return $settings[ $key ];
    }

    public static function get_fields_for_editor() {
        $fields = array();
        foreach ( self::get_field_definitions() as $key => $definition ) {
            $fields[] = array(
                'key'   => $key,
                'label' => $definition['label'],
                'scope' => $definition['scope'],
                'kind'  => $definition['kind'],
                'type'  => $definition['type'],
                'args'  => array(
                    'key' => $key,
                ),
            );
        }

        return $fields;
    }
}

endif;

function tfb_site_content_binding_source_name() {
    return TFB_Bindings::SOURCE_NAME;
}

function tfb_site_content_binding_fields_for_editor() {
    return TFB_Bindings::get_fields_for_editor();
}

function tfb_site_content_binding_settings_for_editor() {
    return TFB_Bindings::get_settings();
}

function tfb_site_content_binding_revision_token( $settings = null ) {
    return TFB_Bindings::get_revision_token( $settings );
}

function tfb_site_content_binding_update_url() {
    if ( function_exists( 'tfb_frontend_editor_rest_base_url' ) ) {
        return tfb_frontend_editor_rest_base_url() . '/chrome';
    }

    return rest_url( 'tfb/v1/frontend-editor/chrome' );
}

TFB_Bindings::init();`,

  'inc/patterns.php': `<?php
/**
 * Block patterns for Theme Factory theme sections
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! class_exists( 'TFB_Patterns' ) ) :

final class TFB_Patterns {
    const PATTERN_CATEGORY = 'theme-factory';

    public static function init() {
        add_action( 'init', array( __CLASS__, 'register_pattern_category' ) );
        add_action( 'init', array( __CLASS__, 'register_patterns' ) );
    }

    public static function register_pattern_category() {
        if ( ! function_exists( 'register_block_pattern_category' ) ) {
            return;
        }

        register_block_pattern_category(
            self::PATTERN_CATEGORY,
            array(
                'label' => __( 'Theme Factory', 'theme-factory-blocks' ),
            )
        );
    }

    public static function register_patterns() {
        if ( ! function_exists( 'register_block_pattern' ) ) {
            return;
        }

        $theme_directory = get_stylesheet_directory();
        $patterns = array(
            array(
                'slug'        => 'theme-factory/part-header',
                'title'       => __( 'Theme Factory Header', 'theme-factory-blocks' ),
                'description' => __( 'Reusable header pattern generated from the active theme.', 'theme-factory-blocks' ),
                'file'        => $theme_directory . '/assets/content/part-header.blocks.html',
            ),
            array(
                'slug'        => 'theme-factory/part-footer',
                'title'       => __( 'Theme Factory Footer', 'theme-factory-blocks' ),
                'description' => __( 'Reusable footer pattern generated from the active theme.', 'theme-factory-blocks' ),
                'file'        => $theme_directory . '/assets/content/part-footer.blocks.html',
            ),
            array(
                'slug'        => 'theme-factory/hero',
                'title'       => __( 'Theme Factory Hero', 'theme-factory-blocks' ),
                'description' => __( 'A starter hero section with a headline, text, and calls to action.', 'theme-factory-blocks' ),
                'content'     => implode( "\n", array(
                    '<!-- wp:group {"align":"full","className":"tfb-pattern-hero","layout":{"type":"constrained"}} -->',
                    '<div class="wp-block-group alignfull tfb-pattern-hero">',
                    '<!-- wp:heading {"level":1} -->',
                    '<h1>Build a stronger local landing page</h1>',
                    '<!-- /wp:heading -->',
                    '<!-- wp:paragraph -->',
                    '<p>Start with a clear headline, supporting copy, and one or two high-intent actions.</p>',
                    '<!-- /wp:paragraph -->',
                    '<!-- wp:buttons -->',
                    '<div class="wp-block-buttons">',
                    '<!-- wp:button -->',
                    '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Primary action</a></div>',
                    '<!-- /wp:button -->',
                    '<!-- wp:button {"className":"is-style-outline"} -->',
                    '<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="#">Secondary action</a></div>',
                    '<!-- /wp:button -->',
                    '</div>',
                    '<!-- /wp:buttons -->',
                    '</div>',
                    '<!-- /wp:group -->',
                ) ),
            ),
            array(
                'slug'        => 'theme-factory/cta-band',
                'title'       => __( 'Theme Factory CTA Band', 'theme-factory-blocks' ),
                'description' => __( 'A compact call-to-action band for high-intent sections.', 'theme-factory-blocks' ),
                'content'     => implode( "\n", array(
                    '<!-- wp:group {"align":"full","className":"tfb-pattern-cta-band","layout":{"type":"constrained"}} -->',
                    '<div class="wp-block-group alignfull tfb-pattern-cta-band">',
                    '<!-- wp:heading {"level":2} -->',
                    '<h2>Need help turning this into a live page?</h2>',
                    '<!-- /wp:heading -->',
                    '<!-- wp:paragraph -->',
                    '<p>Use this section as a conversion-focused call to action with a simple value proposition.</p>',
                    '<!-- /wp:paragraph -->',
                    '<!-- wp:buttons -->',
                    '<div class="wp-block-buttons">',
                    '<!-- wp:button -->',
                    '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Book a call</a></div>',
                    '<!-- /wp:button -->',
                    '</div>',
                    '<!-- /wp:buttons -->',
                    '</div>',
                    '<!-- /wp:group -->',
                ) ),
            ),
        );

        foreach ( $patterns as $pattern ) {
            if ( empty( $pattern['file'] ) || ! file_exists( $pattern['file'] ) ) {
                if ( empty( $pattern['content'] ) ) {
                    continue;
                }
            }

            $content = ! empty( $pattern['file'] ) && file_exists( $pattern['file'] )
                ? trim( (string) file_get_contents( $pattern['file'] ) )
                : trim( (string) $pattern['content'] );
            if ( '' === $content ) {
                continue;
            }

            register_block_pattern(
                $pattern['slug'],
                array(
                    'title'       => $pattern['title'],
                    'description' => $pattern['description'],
                    'categories'  => array( self::PATTERN_CATEGORY ),
                    'content'     => $content,
                    'inserter'    => true,
                )
            );
        }
    }
}

endif;

TFB_Patterns::init();`,

  'inc/frontend-editor.php': `<?php
/**
 * Frontend editor REST transport and lightweight lock integration
 */

if (!defined('ABSPATH')) exit;

if ( ! class_exists( 'TFB_Frontend_Editor' ) ) :

final class TFB_Frontend_Editor {
    const REST_NAMESPACE = 'tfb/v1';
    const REST_BASE = '/frontend-editor';
    const LOCK_POLL_INTERVAL = 20;

    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
    }

    public static function on_activate() { }

    public static function register_rest_routes() {
        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_BASE . '/chrome',
            array(
                array(
                    'methods' => WP_REST_Server::CREATABLE,
                    'callback' => array( __CLASS__, 'save_chrome' ),
                    'permission_callback' => array( __CLASS__, 'can_edit_theme' ),
                ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_BASE . '/page-block',
            array(
                array(
                    'methods' => WP_REST_Server::CREATABLE,
                    'callback' => array( __CLASS__, 'save_page_block' ),
                    'permission_callback' => array( __CLASS__, 'can_edit_posts' ),
                ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_BASE . '/lock',
            array(
                array(
                    'methods' => WP_REST_Server::CREATABLE,
                    'callback' => array( __CLASS__, 'refresh_post_lock' ),
                    'permission_callback' => array( __CLASS__, 'can_edit_posts' ),
                ),
            )
        );
    }

    public static function can_edit_theme() {
        return current_user_can( 'edit_theme_options' );
    }

    public static function can_edit_posts() {
        return current_user_can( 'edit_pages' ) || current_user_can( 'edit_posts' );
    }

    private static function json_error( $message, $status = 400, $data = array() ) {
        return new WP_REST_Response(
            array(
                'success' => false,
                'data' => array_merge( array( 'message' => $message ), $data ),
            ),
            $status
        );
    }

    private static function json_success( $data = array(), $status = 200 ) {
        return new WP_REST_Response(
            array(
                'success' => true,
                'data' => $data,
            ),
            $status
        );
    }

    private static function get_payload( WP_REST_Request $request ) {
        $payload = $request->get_json_params();
        if ( ! is_array( $payload ) || empty( $payload ) ) {
            $payload = $request->get_params();
        }
        return is_array( $payload ) ? $payload : array();
    }

    private static function chrome_revision_token( $settings ) {
        if ( function_exists( 'tf_frontend_editor_global_chrome_revision_token' ) ) {
            return tf_frontend_editor_global_chrome_revision_token( $settings );
        }

        return hash( 'sha256', wp_json_encode( $settings ) );
    }

  private static function post_revision_token( $post ) {
      if ( function_exists( 'tf_frontend_editor_revision_token_for_post' ) ) {
          return tf_frontend_editor_revision_token_for_post( $post );
      }

        if ( ! $post || ! isset( $post->ID ) ) {
            return '';
        }

      return hash( 'sha256', $post->ID . '|' . $post->post_modified_gmt . '|' . $post->post_content );
  }

  private static function is_supported_page_post( $post ) {
      return $post && 'page' === get_post_type( $post );
  }

  private static function get_lock_owner_payload( $user_id ) {
      $user = get_userdata( $user_id );
        if ( ! $user ) {
            return array( 'id' => (int) $user_id, 'name' => '' );
        }

        return array(
            'id' => (int) $user->ID,
            'name' => $user->display_name,
        );
    }

    private static function ensure_post_lock_functions() {
        if ( ! function_exists( 'wp_check_post_lock' ) || ! function_exists( 'wp_set_post_lock' ) ) {
            require_once ABSPATH . 'wp-admin/includes/post.php';
        }
    }

    public static function save_chrome( WP_REST_Request $request ) {
        $payload = self::get_payload( $request );
        $scope = isset( $payload['scope'] ) ? sanitize_key( wp_unslash( $payload['scope'] ) ) : '';
        $field = isset( $payload['field'] ) ? sanitize_key( wp_unslash( $payload['field'] ) ) : '';
        $value = isset( $payload['value'] ) ? wp_unslash( $payload['value'] ) : '';
        $revision_token = isset( $payload['revisionToken'] ) ? sanitize_text_field( wp_unslash( $payload['revisionToken'] ) ) : '';
        $allowed_fields = function_exists( 'tf_frontend_editor_allowed_chrome_fields' )
            ? tf_frontend_editor_allowed_chrome_fields()
            : array();

        if ( ! isset( $allowed_fields[ $scope ] ) || ! in_array( $field, $allowed_fields[ $scope ], true ) ) {
            return self::json_error( 'Unsupported chrome field.', 400 );
        }

        $settings = get_option( 'whipify_quick_editor_settings', array() );
        if ( ! is_array( $settings ) ) {
            $settings = array();
        }

        $current_revision_token = self::chrome_revision_token( $settings );
        if ( $revision_token && ! hash_equals( $current_revision_token, $revision_token ) ) {
            return self::json_error(
                'Global chrome revision token mismatch.',
                409,
                array( 'revisionToken' => $current_revision_token )
            );
        }

        $settings[ $field ] = function_exists( 'tf_quick_editor_sanitize_value' )
            ? tf_quick_editor_sanitize_value( $field, $value )
            : sanitize_text_field( $value );
        update_option( 'whipify_quick_editor_settings', $settings );

        return self::json_success(
            array(
                'scope' => $scope,
                'field' => $field,
                'revisionToken' => self::chrome_revision_token( $settings ),
                'sourceHash' => function_exists( 'tf_frontend_editor_global_chrome_source_hash' )
                    ? tf_frontend_editor_global_chrome_source_hash( $scope, $field, $settings[ $field ] )
                    : '',
            )
        );
    }

    public static function save_page_block( WP_REST_Request $request ) {
        if ( ! function_exists( 'tf_frontend_editor_page_block_target_from_payload' ) ) {
            return self::json_error( 'Theme page-block adapter is unavailable.', 500 );
        }

        $payload = self::get_payload( $request );
        $target = tf_frontend_editor_page_block_target_from_payload( $payload );
        $operations = isset( $payload['operations'] ) && is_array( $payload['operations'] )
            ? $payload['operations']
            : array();
        if ( empty( $operations ) ) {
            $operations = array(
                array(
                    'field' => isset( $target['field'] ) ? $target['field'] : '',
                    'value' => isset( $payload['value'] ) ? wp_unslash( $payload['value'] ) : '',
                    'sourceHash' => isset( $target['sourceHash'] ) ? $target['sourceHash'] : '',
                ),
            );
        }
        $post_id = isset( $target['identity']['postId'] ) ? absint( $target['identity']['postId'] ) : 0;
        $post = get_post( $post_id );

      if ( ! $post ) {
          return self::json_error( 'Post not found.', 404 );
      }

      if ( ! self::is_supported_page_post( $post ) ) {
          return self::json_error( 'Only pages support frontend page-block editing.', 400 );
      }

      if ( ! current_user_can( 'edit_post', $post_id ) ) {
          return self::json_error( 'Permission denied.', 403 );
      }

        self::ensure_post_lock_functions();
        $lock_owner = wp_check_post_lock( $post_id );
        if ( $lock_owner && (int) $lock_owner !== get_current_user_id() ) {
            return self::json_error(
                'Page is locked by another editor.',
                409,
                array( 'lockOwner' => self::get_lock_owner_payload( $lock_owner ) )
            );
        }

        wp_set_post_lock( $post_id );

        $current_revision_token = self::post_revision_token( $post );
        $target_revision_token = isset( $target['revisionToken'] ) ? (string) $target['revisionToken'] : '';
        if ( ! $target_revision_token || ! hash_equals( $current_revision_token, $target_revision_token ) ) {
            return self::json_error(
                'Page block revision token mismatch.',
                409,
                array( 'revisionToken' => $current_revision_token )
            );
        }

        $blocks = parse_blocks( $post->post_content );
        $resolved_target = function_exists( 'tf_frontend_editor_resolver_v2_resolve_page_block_target' )
            ? tf_frontend_editor_resolver_v2_resolve_page_block_target( $blocks, $target )
            : null;
        if ( null === $resolved_target ) {
            return self::json_error(
                'Unsupported block path or field.',
                409,
                array( 'revisionToken' => $current_revision_token )
            );
        }

        $current_source_hash = isset( $resolved_target['sourceHash'] ) ? (string) $resolved_target['sourceHash'] : '';
        $target_source_hash = isset( $target['sourceHash'] ) ? (string) $target['sourceHash'] : '';
        if ( $target_source_hash && ( ! $current_source_hash || ! hash_equals( $current_source_hash, $target_source_hash ) ) ) {
            return self::json_error(
                'Page block source hash mismatch.',
                409,
                array(
                    'revisionToken' => $current_revision_token,
                    'sourceHash' => $current_source_hash,
                )
            );
        }

        $adapter_result = function_exists( 'tf_frontend_editor_save_adapter_apply_page_block_operations' )
            ? tf_frontend_editor_save_adapter_apply_page_block_operations( $blocks, $resolved_target, $operations )
            : null;
        if ( null === $adapter_result ) {
            return self::json_error(
                'Unsupported block path or field.',
                409,
                array( 'revisionToken' => $current_revision_token )
            );
        }

        if ( is_array( $adapter_result ) && ! empty( $adapter_result['conflict'] ) ) {
            $conflict_target = isset( $adapter_result['target'] ) && is_array( $adapter_result['target'] )
                ? $adapter_result['target']
                : array();
            return self::json_error(
                'Page block source hash mismatch.',
                409,
                array(
                    'revisionToken' => $current_revision_token,
                    'sourceHash' => isset( $conflict_target['sourceHash'] ) ? $conflict_target['sourceHash'] : '',
                    'target' => $conflict_target,
                    'field' => isset( $adapter_result['field'] ) ? $adapter_result['field'] : '',
                )
            );
        }

        if ( is_wp_error( $adapter_result ) ) {
            return self::json_error( $adapter_result->get_error_message(), 500 );
        }

        $updated_content = isset( $adapter_result['blocks'] ) ? serialize_blocks( $adapter_result['blocks'] ) : '';
        $update_result = wp_update_post(
            array(
                'ID' => $post->ID,
                'post_content' => $updated_content,
            ),
            true
        );
        if ( is_wp_error( $update_result ) ) {
            return self::json_error( $update_result->get_error_message(), 500 );
        }

        $fresh_post = get_post( $post_id );
        $result = function_exists( 'tf_frontend_editor_page_block_adapter_result' )
            ? tf_frontend_editor_page_block_adapter_result( $fresh_post, $adapter_result )
            : array(
                'postId' => $post_id,
                'revisionToken' => self::post_revision_token( $fresh_post ),
                'postContent' => $fresh_post ? $fresh_post->post_content : '',
            );

        return self::json_success( $result );
    }

  public static function refresh_post_lock( WP_REST_Request $request ) {
      $payload = self::get_payload( $request );
      $post_id = isset( $payload['postId'] ) ? absint( $payload['postId'] ) : 0;
      if ( ! $post_id ) {
          return self::json_error( 'Post not found.', 404 );
      }

      $post = get_post( $post_id );
      if ( ! $post ) {
          return self::json_error( 'Post not found.', 404 );
      }

      if ( ! self::is_supported_page_post( $post ) ) {
          return self::json_error( 'Only pages support frontend page-block editing.', 400 );
      }

      if ( ! current_user_can( 'edit_post', $post_id ) ) {
          return self::json_error( 'Permission denied.', 403 );
      }

        self::ensure_post_lock_functions();
        $lock_owner = wp_check_post_lock( $post_id );
        if ( $lock_owner && (int) $lock_owner !== get_current_user_id() ) {
            return self::json_error(
                'Page is locked by another editor.',
                409,
                array( 'lockOwner' => self::get_lock_owner_payload( $lock_owner ) )
            );
        }

        wp_set_post_lock( $post_id );

        return self::json_success(
            array(
                'postId' => $post_id,
                'locked' => true,
                'refreshInterval' => self::LOCK_POLL_INTERVAL,
            )
        );
    }
}

function tfb_frontend_editor_rest_base_url() {
    return rest_url( TFB_Frontend_Editor::REST_NAMESPACE . TFB_Frontend_Editor::REST_BASE );
}

function tfb_frontend_editor_lock_url() {
    return rest_url( TFB_Frontend_Editor::REST_NAMESPACE . TFB_Frontend_Editor::REST_BASE . '/lock' );
}

function tfb_frontend_editor_lock_interval() {
    return TFB_Frontend_Editor::LOCK_POLL_INTERVAL;
}

endif;

TFB_Frontend_Editor::init();`,

  'build/blocks.asset.php': `<?php
return array(
    'dependencies' => array(
        'wp-blocks',
        'wp-element',
        'wp-i18n',
        'wp-components',
        'wp-block-editor',
        'wp-data',
        'wp-compose',
    ),
    'version' => '2.6.1'
);`,

  'build/blocks.js': `(function(wp) {
'use strict';

if (!wp || !wp.blocks || !wp.element || !wp.blockEditor) {
    console.warn('Theme Factory Blocks: WordPress block API not available');
    return;
}

var registerBlockType = wp.blocks.registerBlockType;
var registerBlockBindingsSource = wp.blocks.registerBlockBindingsSource;
var el = wp.element.createElement;
var Fragment = wp.element.Fragment;
var useBlockProps = wp.blockEditor.useBlockProps;
var RichText = wp.blockEditor.RichText;
var InnerBlocks = wp.blockEditor.InnerBlocks;
var InspectorControls = wp.blockEditor.InspectorControls;
var PanelBody = wp.components.PanelBody;
var TextControl = wp.components.TextControl;
var SelectControl = wp.components.SelectControl;
var Button = wp.components.Button;
var MediaUpload = wp.blockEditor.MediaUpload;
var __ = wp.i18n.__;
var CONTENT_ONLY_TEMPLATE_LOCK = 'contentOnly';

var CONTAINER_TAG_OPTIONS = [
    { label: 'div', value: 'div' },
    { label: 'section', value: 'section' },
    { label: 'article', value: 'article' },
    { label: 'main', value: 'main' },
    { label: 'aside', value: 'aside' },
    { label: 'header', value: 'header' },
    { label: 'footer', value: 'footer' },
    { label: 'nav', value: 'nav' },
    { label: 'span', value: 'span' },
    { label: 'form', value: 'form' }
];

function getEditorClassName(className) {
    if (!className) return '';
    return className.split(' ').filter(function(c) {
        if (!c) return false;
        if (c.startsWith('fixed')) return false;
        if (c === 'h-screen' || c === 'w-screen' || c === 'min-h-screen') return false;
        if (c === 'pointer-events-none') return false;
        if (c === 'hidden') return false;
        if (c === 'z-40' || c === 'z-50' || c.startsWith('z-[')) return false;
        if (c === 'overflow-hidden') return false;
        return true;
    }).join(' ');
}

function getSafeTag(rawTag) {
    var tag = rawTag || 'div';
var safeTags = ['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav', 'span', 'form', 'button'];
    return safeTags.indexOf(tag) > -1 ? tag : 'div';
}

function parseLegacyStyle(styleString) {
    if (!styleString || typeof styleString !== 'string') return {};
    var style = {};
    styleString.split(';').forEach(function(rule) {
        if (!rule || rule.indexOf(':') === -1) return;
        var parts = rule.split(':');
        if (parts.length < 2) return;
        var key = parts.shift().trim();
        var value = parts.join(':').trim();
        if (!key || !value) return;
        style[key] = value;
    });
    return style;
}

function toReactStyle(styleObject) {
    if (!styleObject || typeof styleObject !== 'object' || Array.isArray(styleObject)) return {};
    var style = {};
    Object.keys(styleObject).forEach(function(key) {
        var value = styleObject[key];
        if (value === undefined || value === null || value === '') return;
        if (key.indexOf('--') === 0) {
            style[key] = value;
            return;
        }
        var reactKey = key.replace(/-([a-z])/g, function(_, char) { return char.toUpperCase(); });
        style[reactKey] = value;
    });
    return style;
}

function parseLegacyAttributes(value) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    try {
        var parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function normalizeHtmlIdValue(value) {
    if (!value || typeof value !== 'string') return '';
    return value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeHtmlIdReferenceValue(value) {
    if (!value || typeof value !== 'string') return '';
    return value.split(/\s+/).map(function(token) {
        var part = (token || '').trim();
        if (!part) return '';
        var prefix = '';
        if (part.charAt(0) === '#') {
            prefix = '#';
            part = part.slice(1);
        }
        var normalized = normalizeHtmlIdValue(part);
        return normalized ? prefix + normalized : '';
    }).filter(Boolean).join(' ');
}

function normalizeHtmlAttributeReferences(rawAttributes) {
    if (!rawAttributes || typeof rawAttributes !== 'object' || Array.isArray(rawAttributes)) return {};
    var normalized = {};
    Object.keys(rawAttributes).forEach(function(name) {
        var value = rawAttributes[name];
        if (value === undefined || value === null || value === '') return;
        if (name === 'aria-controls' || name === 'aria-labelledby' || name === 'aria-describedby' || name === 'aria-owns' || name === 'aria-details' || name === 'aria-flowto' || name === 'aria-activedescendant') {
            var normalizedValue = normalizeHtmlIdReferenceValue(String(value));
            if (normalizedValue) {
                normalized[name] = normalizedValue;
            }
            return;
        }
        normalized[name] = value;
    });
    return normalized;
}

function getEditableHtmlAttributes(rawAttributes) {
    var attrs = {};
    var normalizedAttributes = normalizeHtmlAttributeReferences(rawAttributes);
    if (!normalizedAttributes || typeof normalizedAttributes !== 'object' || Array.isArray(normalizedAttributes)) return attrs;
    Object.keys(normalizedAttributes).forEach(function(name) {
        var value = normalizedAttributes[name];
        if (value === undefined || value === null || value === '' || value === false) return;
        if (name === 'class' || name === 'className' || name === 'style' || name === 'id' || name === 'hidden') return;
        if (name === 'tabindex') {
            attrs.tabIndex = value;
            return;
        }
        if (name.indexOf('data-') === 0 || name.indexOf('aria-') === 0 || name === 'role') {
            attrs[name] = value;
        }
    });
    return attrs;
}

function decodeBase64Utf8(value) {
    if (!value || typeof value !== 'string') return '';
    try {
        return decodeURIComponent(escape(window.atob(value)));
    } catch (error) {
        return '';
    }
}

function createPreviewMarkup(className, html) {
    return el('div', {
        className: className,
        dangerouslySetInnerHTML: { __html: html || '' }
    });
}

function getContainerStyle(attributes) {
    var customStyle = attributes.customStyle;
    if (!customStyle || typeof customStyle !== 'object' || Array.isArray(customStyle)) {
        customStyle = parseLegacyStyle(attributes.style);
    }

    if (attributes.bgImage) {
        customStyle = Object.assign({}, customStyle, {
            'background-image': "url('" + attributes.bgImage + "')",
            'background-size': customStyle['background-size'] || 'cover',
            'background-position': customStyle['background-position'] || 'center'
        });
    }

    return customStyle;
}

function getContainerHtmlAttributes(attributes) {
    var htmlAttributes = attributes.htmlAttributes;
    if (!htmlAttributes || typeof htmlAttributes !== 'object' || Array.isArray(htmlAttributes)) {
        htmlAttributes = parseLegacyAttributes(attributes.extraAttributes);
    }
    return normalizeHtmlAttributeReferences(htmlAttributes);
}

function migrateLegacyContainerAttributes(attributes) {
    return {
        tagName: getSafeTag(attributes.tagName),
        className: attributes.className || '',
        id: normalizeHtmlIdValue(attributes.id || ''),
        customStyle: parseLegacyStyle(attributes.style),
        htmlAttributes: normalizeHtmlAttributeReferences(parseLegacyAttributes(attributes.extraAttributes)),
        bgImage: attributes.bgImage || ''
    };
}

function migrateLegacyLinkGroupAttributes(attributes) {
    return {
        href: attributes.href || attributes.url || '#',
        target: attributes.target || '',
        rel: attributes.rel || '',
        className: attributes.className || ''
    };
}

function getSiteContentBindingsConfig() {
    var blockBindings = window.tfbData && window.tfbData.blockBindings;
    if (!blockBindings || typeof blockBindings !== 'object' || Array.isArray(blockBindings)) {
        return {};
    }
    return blockBindings;
}

function getSiteContentBindingsFields() {
    var config = getSiteContentBindingsConfig();
    return Array.isArray(config.fields) ? config.fields : [];
}

function getSiteContentBindingsValues() {
    var config = getSiteContentBindingsConfig();
    if (!config.values || typeof config.values !== 'object' || Array.isArray(config.values)) {
        config.values = {};
    }
    return config.values;
}

function getSiteContentBindingsSourceName() {
    var config = getSiteContentBindingsConfig();
    return typeof config.sourceName === 'string' && config.sourceName
        ? config.sourceName
        : 'theme-factory/site-content';
}

function getSiteContentBindingsRevisionToken() {
    var config = getSiteContentBindingsConfig();
    return typeof config.revisionToken === 'string' ? config.revisionToken : '';
}

function setSiteContentBindingsRevisionToken(token) {
    var config = getSiteContentBindingsConfig();
    config.revisionToken = typeof token === 'string' ? token : '';
}

function getSiteContentBindingsField(key) {
    return getSiteContentBindingsFields().find(function(field) {
        return field && field.key === key;
    }) || null;
}

function getSiteContentBindingsFieldKey(source) {
    if (!source || typeof source !== 'object') return '';
    var args = source.args && typeof source.args === 'object' ? source.args : {};
    return typeof args.key === 'string' ? args.key : '';
}

function getSiteContentBindingsValue(key) {
    var values = getSiteContentBindingsValues();
    return typeof values[key] === 'string' ? values[key] : '';
}

function setSiteContentBindingsValue(key, value) {
    var values = getSiteContentBindingsValues();
    values[key] = value;
}

function readSiteContentBindingsPayload(response) {
    return response.json().catch(function() {
        return {
            success: false,
            data: {
                message: 'Block bindings request failed.'
            }
        };
    });
}

function saveSiteContentBindingValue(field, value) {
    var config = getSiteContentBindingsConfig();
    if (!config.updateUrl) {
        return Promise.resolve({
            success: false,
            data: {
                message: 'Block bindings update URL is unavailable.'
            }
        });
    }

    return fetch(config.updateUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': config.restNonce || ''
        },
        body: JSON.stringify({
            scope: field.scope,
            field: field.key,
            value: value,
            revisionToken: getSiteContentBindingsRevisionToken()
        })
    }).then(function(response) {
        return readSiteContentBindingsPayload(response).then(function(payload) {
            return {
                response: response,
                payload: payload
            };
        });
    }).then(function(result) {
        if (result.response.ok && result.payload && result.payload.success) {
            if (result.payload.data && typeof result.payload.data.revisionToken === 'string') {
                setSiteContentBindingsRevisionToken(result.payload.data.revisionToken);
            }
            return result.payload;
        }

        console.warn('Theme Factory Blocks: binding save failed', result.payload && result.payload.data ? result.payload.data.message : '');
        return result.payload;
    }).catch(function(error) {
        console.warn('Theme Factory Blocks: binding save failed', error);
        return {
            success: false,
            data: {
                message: 'Block bindings save failed.'
            }
        };
    });
}

function registerSiteContentBindingsSource() {
    if (typeof registerBlockBindingsSource !== 'function') {
        return;
    }

    registerBlockBindingsSource({
        name: getSiteContentBindingsSourceName(),
        getFieldsList: function() {
            return getSiteContentBindingsFields().map(function(field) {
                return {
                    label: field.label,
                    type: field.type || 'string',
                    args: field.args || { key: field.key }
                };
            });
        },
        getValues: function(args) {
            var bindings = args && args.bindings && typeof args.bindings === 'object' ? args.bindings : {};
            var values = {};

            Object.keys(bindings).forEach(function(attributeName) {
                var key = getSiteContentBindingsFieldKey(bindings[attributeName]);
                var field = getSiteContentBindingsField(key);
                if (!field) return;
                values[attributeName] = getSiteContentBindingsValue(field.key);
            });

            return values;
        },
        setValues: function(args) {
            var bindings = args && args.bindings && typeof args.bindings === 'object' ? args.bindings : {};

            Object.keys(bindings).forEach(function(attributeName) {
                var source = bindings[attributeName];
                var key = getSiteContentBindingsFieldKey(source);
                var field = getSiteContentBindingsField(key);
                if (!field || !source || !Object.prototype.hasOwnProperty.call(source, 'newValue')) {
                    return;
                }

                var nextValue = source.newValue == null ? '' : String(source.newValue);
                setSiteContentBindingsValue(field.key, nextValue);
                void saveSiteContentBindingValue(field, nextValue);
            });
        },
        canUserEditValue: function(args) {
            var field = getSiteContentBindingsField(args && args.args ? args.args.key : '');
            var config = getSiteContentBindingsConfig();
            return Boolean(field && config.updateUrl && config.restNonce);
        }
    });
}

function legacyPageShellSave(props) {
    var blockProps = useBlockProps.save({ className: getEditorClassName(props.attributes.className) });
    return el('div', blockProps, el(InnerBlocks.Content));
}

function legacyContainerSave(props) {
    var attributes = props.attributes || {};
    var Tag = getSafeTag(attributes.tagName);
    var styleObj = getContainerStyle(attributes);
    var htmlAttributes = getEditableHtmlAttributes(getContainerHtmlAttributes(attributes));
    var blockProps = useBlockProps.save(Object.assign({
        className: getEditorClassName(attributes.className),
        id: attributes.id || undefined,
        style: toReactStyle(styleObj)
    }, htmlAttributes));
    return el(Tag, blockProps, el(InnerBlocks.Content));
}

function legacyLinkGroupSave(props) {
    var attributes = props.attributes || {};
    var blockProps = useBlockProps.save(Object.assign({
        className: getEditorClassName(attributes.className),
        role: 'link',
        tabIndex: 0,
        'data-href': attributes.href || attributes.url || undefined,
        'data-target': attributes.target || undefined,
        'data-rel': attributes.rel || undefined
    }, getEditableHtmlAttributes(getContainerHtmlAttributes(attributes))));
    return el('div', blockProps, el(InnerBlocks.Content));
}

function legacyButtonSave(props) {
    var attributes = props.attributes || {};
    var blockProps = useBlockProps.save({
        className: getEditorClassName(attributes.className),
        href: attributes.href || '#',
        target: attributes.target || undefined,
        rel: attributes.rel || undefined
    });
    return el('a', blockProps, attributes.text || __('Button', 'theme-factory-blocks'));
}

function legacySvgSave(props) {
    var attributes = props.attributes || {};
    var svgHtml = decodeBase64Utf8(attributes.content || '');
    return el('div', {
        className: 'wp-block-theme-factory-svg',
        dangerouslySetInnerHTML: { __html: svgHtml }
    });
}

function renderContainerEditor(props, extraClassName) {
    var attributes = props.attributes;
    var Tag = getSafeTag(attributes.tagName || 'div');
    var htmlAttributes = getEditableHtmlAttributes(getContainerHtmlAttributes(attributes));
    var blockProps = useBlockProps(Object.assign({
        className: [extraClassName, getEditorClassName(attributes.className)].filter(Boolean).join(' ').trim(),
        id: normalizeHtmlIdValue(attributes.id || '') || undefined,
        style: toReactStyle(getContainerStyle(attributes))
    }, htmlAttributes));

    return el(Fragment, null,
        el(InspectorControls, null,
            el(PanelBody, { title: __('Container Settings', 'theme-factory-blocks'), initialOpen: true },
                el(SelectControl, {
                    label: __('HTML Tag', 'theme-factory-blocks'),
                    value: getSafeTag(attributes.tagName || 'div'),
                    options: CONTAINER_TAG_OPTIONS,
                    onChange: function(value) {
                        props.setAttributes({ tagName: value });
                    }
                }),
                el(TextControl, {
                    label: __('Anchor / ID', 'theme-factory-blocks'),
                    value: attributes.id || '',
                    onChange: function(value) {
                        props.setAttributes({ id: normalizeHtmlIdValue(value) });
                    }
                }),
                el('div', { style: { marginTop: '16px' } },
                    el('p', { style: { marginBottom: '8px' } }, __('Background Image', 'theme-factory-blocks')),
                    el(MediaUpload, {
                        onSelect: function(media) {
                            props.setAttributes({ bgImage: media && media.url ? media.url : '' });
                        },
                        allowedTypes: ['image'],
                        value: attributes.bgImage,
                        render: function(obj) {
                            return el(Button, {
                                isSecondary: true,
                                onClick: obj.open
                            }, attributes.bgImage ? __('Replace Image', 'theme-factory-blocks') : __('Select Image', 'theme-factory-blocks'));
                        }
                    }),
                    attributes.bgImage ? el(Button, {
                        isLink: true,
                        isDestructive: true,
                        style: { marginTop: '8px' },
                        onClick: function() {
                            props.setAttributes({ bgImage: '' });
                        }
                    }, __('Remove Image', 'theme-factory-blocks')) : null
                )
            )
        ),
        el(Tag, blockProps, el(InnerBlocks, {
            templateLock: CONTENT_ONLY_TEMPLATE_LOCK,
            renderAppender: InnerBlocks.ButtonBlockAppender
        }))
    );
}

registerBlockType('theme-factory/page-shell', {
    apiVersion: 3,
    title: __('Page Shell', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'layout',
    attributes: {
        className: { type: 'string', default: '' }
    },
    supports: {
        align: ['full', 'wide'],
        html: false,
        lock: false,
        color: { background: true, text: true, gradients: true },
        spacing: { margin: true, padding: true, blockGap: true },
        typography: { fontSize: true, lineHeight: true },
        border: { color: true, radius: true, style: true, width: true },
        dimensions: { minHeight: true }
    },
    edit: function(props) {
        var blockProps = useBlockProps({ className: ['tf-page-shell-editor', getEditorClassName(props.attributes.className)].filter(Boolean).join(' ').trim() });
        return el('div', blockProps, el(InnerBlocks, {
            templateLock: CONTENT_ONLY_TEMPLATE_LOCK,
            renderAppender: InnerBlocks.ButtonBlockAppender
        }));
    },
    save: function() { return el(InnerBlocks.Content); },
    deprecated: [
        {
            attributes: { className: { type: 'string', default: '' } },
            save: legacyPageShellSave
        }
    ]
});

registerBlockType('theme-factory/container', {
    apiVersion: 3,
    title: __('TF Container', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'box',
    attributes: {
        tagName: { type: 'string', default: 'div' },
        className: { type: 'string', default: '' },
        id: { type: 'string', default: '' },
        customStyle: { type: 'object', default: {} },
        htmlAttributes: { type: 'object', default: {} },
        bgImage: { type: 'string', default: '' }
    },
    supports: {
        align: ['full', 'wide'],
        html: false,
        lock: false,
        color: { background: true, text: true, gradients: true },
        spacing: { margin: true, padding: true, blockGap: true },
        typography: { fontSize: true, lineHeight: true },
        border: { color: true, radius: true, style: true, width: true },
        dimensions: { minHeight: true, aspectRatio: true }
    },
    edit: function(props) {
        return renderContainerEditor(props, 'tf-container-editor');
    },
    save: function() { return el(InnerBlocks.Content); },
    deprecated: [
        {
            attributes: {
                tagName: { type: 'string', default: 'div' },
                className: { type: 'string', default: '' },
                id: { type: 'string', default: '' },
                style: { type: 'string', default: '' },
                extraAttributes: { type: 'string', default: '{}' },
                bgImage: { type: 'string', default: '' }
            },
            migrate: migrateLegacyContainerAttributes,
            save: legacyContainerSave
        }
    ]
});

registerBlockType('theme-factory/buttons', {
    apiVersion: 3,
    title: __('TF Buttons', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'button',
    attributes: {
        className: { type: 'string', default: '' }
    },
    supports: {
        html: false,
        lock: false,
        spacing: { margin: true, padding: true, blockGap: true }
    },
    edit: function(props) {
        var blockProps = useBlockProps({ className: ['tf-buttons-editor', 'wp-block-buttons', getEditorClassName(props.attributes.className)].filter(Boolean).join(' ').trim() });
        return el('div', blockProps, el(InnerBlocks, {
            allowedBlocks: ['core/button', 'theme-factory/button'],
            orientation: 'horizontal',
            templateLock: CONTENT_ONLY_TEMPLATE_LOCK,
            renderAppender: InnerBlocks.ButtonBlockAppender
        }));
    },
    save: function() { return el(InnerBlocks.Content); }
});

registerBlockType('theme-factory/link-group', {
    apiVersion: 3,
    title: __('Link Group', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'admin-links',
    attributes: {
        href: { type: 'string', default: '#' },
        target: { type: 'string', default: '' },
        rel: { type: 'string', default: '' },
        className: { type: 'string', default: '' }
    },
    supports: {
        html: false,
        color: { background: true, text: true },
        spacing: { margin: true, padding: true, blockGap: true },
        typography: { fontSize: true, lineHeight: true },
        border: { color: true, radius: true, style: true, width: true },
        dimensions: { minHeight: true }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({
            className: ['tf-link-group-editor', getEditorClassName(attributes.className)].filter(Boolean).join(' ').trim(),
            role: 'link',
            tabIndex: 0,
            'data-href': attributes.href || undefined
        });

        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Link Settings', 'theme-factory-blocks'), initialOpen: true },
                    el(TextControl, {
                        label: __('URL', 'theme-factory-blocks'),
                        value: attributes.href || '',
                        onChange: function(value) { props.setAttributes({ href: value }); }
                    }),
                    el(TextControl, {
                        label: __('Target', 'theme-factory-blocks'),
                        value: attributes.target || '',
                        onChange: function(value) { props.setAttributes({ target: value }); }
                    }),
                    el(TextControl, {
                        label: __('Rel', 'theme-factory-blocks'),
                        value: attributes.rel || '',
                        onChange: function(value) { props.setAttributes({ rel: value }); }
                    })
                )
            ),
            el('div', blockProps,
                el('span', { className: 'tf-link-badge' }, attributes.href || '#'),
                el('div', { className: 'tf-link-group-inner' }, el(InnerBlocks, { renderAppender: InnerBlocks.ButtonBlockAppender }))
            )
        );
    },
    save: function() { return el(InnerBlocks.Content); },
    deprecated: [
        {
            attributes: {
                href: { type: 'string', default: '#' },
                url: { type: 'string', default: '' },
                target: { type: 'string', default: '' },
                rel: { type: 'string', default: '' },
                className: { type: 'string', default: '' },
                extraAttributes: { type: 'string', default: '{}' }
            },
            migrate: migrateLegacyLinkGroupAttributes,
            save: legacyLinkGroupSave
        }
    ]
});

registerBlockType('theme-factory/table', {
    apiVersion: 3,
    title: __('Rich Table', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'table-col-after',
    attributes: {
        content: { type: 'string', default: '' }
    },
    supports: { html: false },
    edit: function(props) {
        var blockProps = useBlockProps({ className: 'tf-table-preview' });
        var tableHtml = decodeBase64Utf8(props.attributes.content || '');

        if (!tableHtml) {
            return el('div', blockProps, el('div', { className: 'tf-label' }, __('Rich table preview unavailable', 'theme-factory-blocks')));
        }

        return el('div', blockProps,
            createPreviewMarkup('tf-table-preview__inner', tableHtml),
            el('p', { className: 'tf-table-preview__note' }, __('Rich table preserved from source layout. Update it in the source export if the structure needs to change.', 'theme-factory-blocks'))
        );
    },
    save: function() { return null; }
});

registerBlockType('theme-factory/svg', {
    apiVersion: 3,
    title: __('SVG Icon', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'art',
    attributes: { content: { type: 'string', default: '' } },
    supports: { html: false },
    edit: function(props) {
        var blockProps = useBlockProps({ className: 'tf-svg-preview' });
        var svgHtml = decodeBase64Utf8(props.attributes.content || '');
        if (!svgHtml) {
            return el('div', blockProps, el('div', { className: 'tf-label' }, __('SVG Icon (preserved)', 'theme-factory-blocks')));
        }
        return el('div', blockProps, createPreviewMarkup('tf-svg-preview__inner', svgHtml));
    },
    save: function() { return null; },
    deprecated: [
        {
            attributes: { content: { type: 'string', default: '' } },
            save: legacySvgSave
        }
    ]
});

registerBlockType('theme-factory/nav-toggle', {
    apiVersion: 3,
    title: __('Nav Toggle', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'menu',
    attributes: { className: { type: 'string', default: '' } },
    edit: function(props) {
        var blockProps = useBlockProps({ className: ['tf-nav-toggle-editor', getEditorClassName(props.attributes.className)].filter(Boolean).join(' ').trim() });
        return el('div', blockProps, el('div', { className: 'tf-nav-toggle-label' }, __('Nav Toggle', 'theme-factory-blocks')), el(InnerBlocks, { renderAppender: InnerBlocks.ButtonBlockAppender }));
    },
    save: function() { return el(InnerBlocks.Content); }
});

registerBlockType('theme-factory/button', {
    apiVersion: 3,
    title: __('TF Button', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'button',
    attributes: {
        text: { type: 'string', default: '', role: 'content' },
        href: { type: 'string', default: '#' },
        className: { type: 'string', default: '' },
        customStyle: { type: 'object', default: {} },
        target: { type: 'string', default: '' },
        rel: { type: 'string', default: '' },
        ariaLabel: { type: 'string', default: '' },
        tagName: { type: 'string', default: 'a' },
        buttonType: { type: 'string', default: 'button' }
    },
    supports: {
        html: false,
        color: { background: true, text: true, gradients: true },
        spacing: { margin: true, padding: true },
        typography: { fontSize: true, lineHeight: true },
        border: { color: true, radius: true, style: true, width: true },
        dimensions: { minHeight: true }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: 'tf-button-wrapper' });
        var previewClass = ['tf-button-preview', getEditorClassName(attributes.className)].filter(Boolean).join(' ').trim();
        var isDotButton = /\brounded-full\b/.test(previewClass) && /\b(?:w|h)-(?:2|2\\.5|3|3\\.5)\b/.test(previewClass);
        var previewTag = attributes.tagName === 'button' || !attributes.href ? 'button' : 'a';
        var previewStyle = attributes.customStyle;
        if (!previewStyle || typeof previewStyle !== 'object' || Array.isArray(previewStyle)) {
            previewStyle = parseLegacyStyle(attributes.style);
        }
        var previewProps = {
            className: previewClass,
            'aria-label': attributes.ariaLabel || undefined,
            style: previewStyle,
            onClick: function(event) { event.preventDefault(); }
        };
        if (previewTag === 'a') {
            previewProps.href = attributes.href || '#';
        } else {
            previewProps.type = attributes.buttonType || 'button';
        }

        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Button Settings', 'theme-factory-blocks'), initialOpen: true },
                    previewTag === 'a' ? el(TextControl, {
                        label: __('URL', 'theme-factory-blocks'),
                        value: attributes.href || '',
                        onChange: function(value) { props.setAttributes({ href: value }); }
                    }) : null,
                    previewTag === 'a' ? el(TextControl, {
                        label: __('Target', 'theme-factory-blocks'),
                        value: attributes.target || '',
                        onChange: function(value) { props.setAttributes({ target: value }); }
                    }) : null,
                    previewTag === 'a' ? el(TextControl, {
                        label: __('Rel', 'theme-factory-blocks'),
                        value: attributes.rel || '',
                        onChange: function(value) { props.setAttributes({ rel: value }); }
                    }) : null,
                    el(TextControl, {
                        label: __('ARIA Label', 'theme-factory-blocks'),
                        value: attributes.ariaLabel || '',
                        onChange: function(value) { props.setAttributes({ ariaLabel: value }); }
                    })
                )
            ),
            el('div', blockProps,
                isDotButton && !attributes.text
                    ? el(previewTag, previewProps)
                    : el(previewTag, previewProps,
                        el(RichText, {
                            tagName: 'span',
                            value: attributes.text,
                            onChange: function(value) { props.setAttributes({ text: value }); },
                            placeholder: __('Button text...', 'theme-factory-blocks'),
                            withoutInteractiveFormatting: true,
                            allowedFormats: []
                        })
                    )
            )
        );
    },
    save: function() { return null; },
    deprecated: [
        {
            attributes: {
                text: { type: 'string', default: '' },
                href: { type: 'string', default: '#' },
                className: { type: 'string', default: '' },
                target: { type: 'string', default: '' },
                rel: { type: 'string', default: '' }
            },
            save: legacyButtonSave
        }
    ]
});

registerBlockType('theme-factory/select', {
    apiVersion: 3,
    title: __('Form Select', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'list-view',
    attributes: {
        name: { type: 'string', default: '' },
        id: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
        required: { type: 'boolean', default: false },
        placeholder: { type: 'string', default: '' },
        options: { type: 'array', default: [] }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: ['tf-select-editor', getEditorClassName(attributes.className)].filter(Boolean).join(' ').trim() });
        var optionNodes = [];
        var options = Array.isArray(attributes.options) ? attributes.options.slice() : [];
        if (attributes.placeholder) {
            var hasEmpty = options.some(function(option) { return !option || !option.value; });
            if (!hasEmpty) {
                options.unshift({ label: attributes.placeholder, value: '' });
            }
        }
        options.forEach(function(option, index) {
            if (!option) return;
            optionNodes.push(el('option', { key: String(index), value: option.value || '' }, option.label || option.value || 'Option'));
        });
        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Select Settings', 'theme-factory-blocks'), initialOpen: true },
                    el(TextControl, { label: __('ID Attribute', 'theme-factory-blocks'), value: attributes.id || '', onChange: function(value) { props.setAttributes({ id: normalizeHtmlIdValue(value) }); } }),
                    el(TextControl, { label: __('Name Attribute', 'theme-factory-blocks'), value: attributes.name || '', onChange: function(value) { props.setAttributes({ name: value }); } }),
                    el(TextControl, { label: __('Placeholder Label', 'theme-factory-blocks'), value: attributes.placeholder || '', onChange: function(value) { props.setAttributes({ placeholder: value }); } })
                )
            ),
            el('div', blockProps, el('select', { id: attributes.id || undefined, disabled: true, style: { width: '100%', pointerEvents: 'none' } }, optionNodes))
        );
    },
    save: function() { return null; }
});

registerBlockType('theme-factory/input', {
    apiVersion: 3,
    title: __('Form Input', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'forms',
    attributes: {
        type: { type: 'string', default: 'text' },
        name: { type: 'string', default: '' },
        id: { type: 'string', default: '' },
        placeholder: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
        required: { type: 'boolean', default: false }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: ['tf-input-editor', getEditorClassName(attributes.className)].filter(Boolean).join(' ').trim() });

        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Input Settings', 'theme-factory-blocks'), initialOpen: true },
                    el(SelectControl, {
                        label: __('Input Type', 'theme-factory-blocks'),
                        value: attributes.type || 'text',
                        options: [
                            { label: 'Text', value: 'text' },
                            { label: 'Email', value: 'email' },
                            { label: 'Password', value: 'password' },
                            { label: 'Number', value: 'number' },
                            { label: 'Tel', value: 'tel' }
                        ],
                        onChange: function(value) { props.setAttributes({ type: value }); }
                    }),
                    el(TextControl, { label: __('ID Attribute', 'theme-factory-blocks'), value: attributes.id || '', onChange: function(value) { props.setAttributes({ id: normalizeHtmlIdValue(value) }); } }),
                    el(TextControl, { label: __('Name Attribute', 'theme-factory-blocks'), value: attributes.name, onChange: function(value) { props.setAttributes({ name: value }); } }),
                    el(TextControl, { label: __('Placeholder', 'theme-factory-blocks'), value: attributes.placeholder, onChange: function(value) { props.setAttributes({ placeholder: value }); } })
                )
            ),
            el('div', blockProps, el('input', {
                id: attributes.id || undefined,
                type: attributes.type || 'text',
                placeholder: attributes.placeholder || __('Type here...', 'theme-factory-blocks'),
                disabled: true,
                style: { width: '100%', pointerEvents: 'none' }
            }))
        );
    },
    save: function() { return null; }
});

registerBlockType('theme-factory/textarea', {
    apiVersion: 3,
    title: __('Form Textarea', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'editor-alignleft',
    attributes: {
        name: { type: 'string', default: '' },
        id: { type: 'string', default: '' },
        placeholder: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
        rows: { type: 'number', default: 4 },
        required: { type: 'boolean', default: false }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: ['tf-textarea-editor', getEditorClassName(attributes.className)].filter(Boolean).join(' ').trim() });
        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Textarea Settings', 'theme-factory-blocks'), initialOpen: true },
                    el(TextControl, { label: __('ID Attribute', 'theme-factory-blocks'), value: attributes.id || '', onChange: function(value) { props.setAttributes({ id: normalizeHtmlIdValue(value) }); } }),
                    el(TextControl, { label: __('Name Attribute', 'theme-factory-blocks'), value: attributes.name, onChange: function(value) { props.setAttributes({ name: value }); } }),
                    el(TextControl, { label: __('Placeholder', 'theme-factory-blocks'), value: attributes.placeholder, onChange: function(value) { props.setAttributes({ placeholder: value }); } }),
                    el(TextControl, { label: __('Rows', 'theme-factory-blocks'), type: 'number', value: attributes.rows, onChange: function(value) { props.setAttributes({ rows: parseInt(value, 10) || 4 }); } })
                )
            ),
            el('div', blockProps, el('textarea', {
                id: attributes.id || undefined,
                placeholder: attributes.placeholder || __('Type here...', 'theme-factory-blocks'),
                rows: attributes.rows,
                disabled: true,
                style: { width: '100%', pointerEvents: 'none' }
            }))
        );
    },
    save: function() { return null; }
});

registerSiteContentBindingsSource();

console.log('Theme Factory Blocks: All blocks registered successfully');

})(window.wp);`,

  'build/interactivity.js': `(function() {
    'use strict';

    function shouldIgnoreLinkGroupClick(target, group) {
        if (!target || !group) return true;
        var interactiveAncestor = target.closest('a, button, input, textarea, select, summary, [role="button"]');
        return !!interactiveAncestor && interactiveAncestor !== group;
    }

    function openLinkGroup(group) {
        if (!group) return;
        var href = group.getAttribute('data-href');
        if (!href) return;
        var target = group.getAttribute('data-target');
        if (target === '_blank') {
            window.open(href, '_blank', 'noopener');
            return;
        }
        window.location.assign(href);
    }

    document.addEventListener('click', function(e) {
        var group = e.target.closest('[data-href]');
        if (group && !shouldIgnoreLinkGroupClick(e.target, group)) {
            if (window.getSelection && String(window.getSelection()).length > 0) return;
            e.preventDefault();
            openLinkGroup(group);
            return;
        }

        var toggle = e.target.closest('.wp-block-theme-factory-nav-toggle');
        if (!toggle) return;
        e.preventDefault();
        var nav = toggle.closest('nav') || toggle.closest('.wp-block-theme-factory-container') || toggle.parentElement;
        if (!nav) return;
        var candidates = nav.querySelectorAll('.hidden, [class*="hidden"]');
        candidates.forEach(function(el) {
            if (el === toggle || el.contains(toggle) || toggle.contains(el)) return;
            if (el.querySelector('a') || el.tagName === 'UL') {
                el.classList.toggle('hidden');
                if (el.classList.contains('flex')) { el.classList.remove('flex'); }
                else if (!el.classList.contains('hidden')) { el.classList.add('flex'); }
            }
        });
        var isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    });

    document.addEventListener('keydown', function(e) {
        var group = e.target.closest('[data-href]');
        if (!group) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        openLinkGroup(group);
    });

    function restoreBrokenSelects() {
        document.querySelectorAll('button[role="combobox"][aria-controls]').forEach(function(trigger) {
            if (trigger.getAttribute('data-tf-select-fallback')) return;

            var controls = trigger.getAttribute('aria-controls');
            if (controls && document.getElementById(controls.replace(/^#/, ''))) return;

            var wrapper = trigger.parentElement;
            if (!wrapper) return;

            var select = wrapper.querySelector('select');
            if (!select) return;

            trigger.setAttribute('data-tf-select-fallback', 'true');
            trigger.setAttribute('aria-hidden', 'true');
            trigger.style.display = 'none';

            var triggerClass = trigger.getAttribute('class') || '';
            if (triggerClass) {
                select.setAttribute('class', triggerClass);
            }

            select.removeAttribute('aria-hidden');
            select.removeAttribute('tabindex');
            select.style.position = 'static';
            select.style.border = '';
            select.style.width = '100%';
            select.style.height = 'auto';
            select.style.padding = '';
            select.style.margin = '0';
            select.style.overflow = 'visible';
            select.style.clip = 'auto';
            select.style.whiteSpace = 'normal';
            select.style.overflowWrap = 'anywhere';
            select.style.opacity = '1';
            select.style.pointerEvents = 'auto';
            select.style.display = 'block';
            select.style.appearance = 'auto';
            select.style.webkitAppearance = 'auto';
            select.style.backgroundImage = 'none';
        });
    }

    restoreBrokenSelects();
})();`,

  'build/editor.css': `.editor-styles-wrapper { background: #fff; }
.editor-styles-wrapper .is-root-container { max-width: none !important; }
.tf-page-shell-editor { min-height: 60px; }
.tf-container-editor, .wp-block-theme-factory-container { min-height: 20px; }
.wp-block-theme-factory-container.is-selected, .wp-block-theme-factory-link-group.is-selected, .wp-block-theme-factory-buttons.is-selected { outline: 1px dashed var(--wp-admin-theme-color, #007cba); outline-offset: 2px; }
.tf-link-group-editor { position: relative; min-height: 20px; }
.tf-link-badge { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity 0.15s ease; background: rgba(17, 24, 39, 0.78); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-family: monospace; pointer-events: none; z-index: 2; }
.tf-link-group-editor:hover .tf-link-badge, .tf-link-group-editor.is-selected .tf-link-badge, .wp-block-theme-factory-link-group.is-selected .tf-link-badge { opacity: 1; }
.tf-link-group-inner { min-height: 20px; }
.tf-buttons-editor.wp-block-buttons { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.tf-nav-toggle-editor { background: #f8f9fa; border: 1px dashed #ccc; padding: 10px; text-align: center; }
.tf-nav-toggle-label { font-weight: 600; color: #666; margin-bottom: 8px; }
.tf-svg-preview { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; min-height: 24px; }
.tf-svg-preview__inner { display: inline-flex; align-items: center; justify-content: center; }
.tf-svg-preview__inner svg { display: inline-block; max-width: 100%; height: auto; }
.tf-button-wrapper { display: inline-flex; }
.tf-button-preview { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; text-decoration: none; color: inherit; }
.tf-button-preview[class*="bg-white"] { color: hsl(var(--primary, 160 100% 35%)); }
.tf-select-editor select { width: 100%; }
.tf-table-preview { overflow-x: auto; }
.tf-table-preview__inner { overflow-x: auto; }
.tf-table-preview__inner table { width: 100%; max-width: 100%; border-collapse: collapse; }
.tf-table-preview__note { margin: 12px 0 0; font-size: 12px; color: #666; }
.block-editor-block-list__layout .wp-block-theme-factory-container[class*="fixed"], .block-editor-block-list__layout .wp-block-theme-factory-container[class*="sticky"] { position: relative !important; }`,

  'build/style.css': `.wp-block-theme-factory-button { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
.wp-block-theme-factory-button[class*="bg-white"] { color: hsl(var(--primary, 160 100% 35%)); }
.wp-block-theme-factory-button[class*="bg-white"]:hover { color: hsl(var(--primary, 160 100% 35%)); }
.wp-block-theme-factory-select { display: block; width: 100%; }
.wp-block-theme-factory-buttons.wp-block-buttons { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.tf-related-links-module__buttons { justify-content: center; }
.wp-block-theme-factory-link-group { display: block; text-decoration: none; color: inherit; }
.wp-block-theme-factory-link-group[data-href] { cursor: pointer; }
.wp-block-theme-factory-nav-toggle { background: transparent; border: none; cursor: pointer; padding: 0; }
.wp-block-theme-factory-svg { display: inline-block; line-height: 0; }
.wp-block-theme-factory-svg svg { display: inline-block; vertical-align: middle; }
.wp-block-theme-factory-table { overflow-x: auto; }
.wp-block-theme-factory-table table { width: 100%; max-width: 100%; }
.wp-block-theme-factory-container { display: block; }
.wp-block-theme-factory-page-shell { display: block; }`,

  'blocks/page-shell/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/page-shell",
    "title": "Page Shell",
    "category": "theme-factory",
    "icon": "layout",
    "description": "Outer wrapper for full-page layouts",
    "attributes": { "className": { "type": "string", "default": "" } },
    "supports": { 
      "align": ["full", "wide"], 
      "html": false,
      "lock": false,
      "color": { "text": true, "background": true, "link": true, "gradients": true },
      "spacing": { "margin": true, "padding": true, "blockGap": true },
      "typography": { "fontSize": true, "lineHeight": true, "fontWeight": true, "fontStyle": true, "letterSpacing": true, "textDecoration": true, "textTransform": true },
      "border": { "color": true, "radius": true, "style": true, "width": true },
      "dimensions": { "minHeight": true, "aspectRatio": true }
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/container/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/container",
    "title": "TF Container",
    "category": "theme-factory",
    "icon": "box",
    "description": "Universal container block",
    "attributes": {
      "tagName": { "type": "string", "default": "div" },
      "className": { "type": "string", "default": "" },
      "id": { "type": "string", "default": "" },
      "customStyle": { "type": "object", "default": {} },
      "htmlAttributes": { "type": "object", "default": {} },
      "bgImage": { "type": "string", "default": "" }
    },
    "supports": { 
      "align": ["full", "wide"], 
      "html": false,
      "lock": false,
      "color": { "text": true, "background": true, "link": true, "gradients": true },
      "spacing": { "margin": true, "padding": true, "blockGap": true },
      "typography": { "fontSize": true, "lineHeight": true, "fontWeight": true, "fontStyle": true, "letterSpacing": true, "textDecoration": true, "textTransform": true },
      "border": { "color": true, "radius": true, "style": true, "width": true },
      "dimensions": { "minHeight": true, "aspectRatio": true }
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/buttons/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/buttons",
    "title": "TF Buttons",
    "category": "theme-factory",
    "icon": "button",
    "description": "Button group wrapper for custom buttons",
    "attributes": {
      "className": { "type": "string", "default": "" }
    },
    "supports": {
      "html": false,
      "lock": false,
      "spacing": { "margin": true, "padding": true, "blockGap": true }
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/link-group/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/link-group",
    "title": "Link Group",
    "category": "theme-factory",
    "icon": "admin-links",
    "description": "Clickable container (Link Wrapper)",
    "attributes": {
      "href": { "type": "string", "default": "#" },
      "target": { "type": "string" },
      "rel": { "type": "string" },
      "className": { "type": "string", "default": "" }
    },
    "supports": { 
      "align": ["full", "wide"], 
      "html": false,
      "color": { "text": true, "background": true, "link": true, "gradients": true },
      "spacing": { "margin": true, "padding": true, "blockGap": true },
      "typography": { "fontSize": true, "lineHeight": true, "fontWeight": true, "fontStyle": true, "letterSpacing": true, "textDecoration": true, "textTransform": true },
      "border": { "color": true, "radius": true, "style": true, "width": true },
      "dimensions": { "minHeight": true, "aspectRatio": true }
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/table/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/table",
    "title": "Rich Table",
    "category": "theme-factory",
    "icon": "table-col-after",
    "description": "Preserved rich table layout with visual editor preview",
    "attributes": {
      "content": { "type": "string", "default": "" }
    },
    "supports": { "html": false },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/svg/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/svg",
    "title": "SVG Icon",
    "category": "theme-factory",
    "icon": "art",
    "description": "Dynamic SVG Output (server-rendered)",
    "attributes": { "content": { "type": "string", "default": "" } },
    "supports": { "html": false },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/nav-toggle/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/nav-toggle",
    "title": "Nav Toggle",
    "category": "theme-factory",
    "icon": "menu",
    "description": "Mobile Navigation Toggle Button",
    "attributes": { "className": { "type": "string", "default": "" } },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/button/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/button",
    "title": "TF Button",
    "category": "theme-factory",
    "icon": "button",
    "description": "Custom styled button/link",
  "attributes": {
    "text": { "type": "string", "default": "", "role": "content" },
    "href": { "type": "string", "default": "#" },
    "className": { "type": "string", "default": "" },
    "customStyle": { "type": "object", "default": {} },
    "target": { "type": "string" },
    "rel": { "type": "string" },
    "ariaLabel": { "type": "string", "default": "" },
    "tagName": { "type": "string", "default": "a" },
      "buttonType": { "type": "string", "default": "button" }
    },
    "supports": { 
      "align": ["full", "wide"], 
      "html": false,
      "color": { "text": true, "background": true, "link": true, "gradients": true },
      "spacing": { "margin": true, "padding": true, "blockGap": true },
      "typography": { "fontSize": true, "lineHeight": true, "fontWeight": true, "fontStyle": true, "letterSpacing": true, "textDecoration": true, "textTransform": true },
      "border": { "color": true, "radius": true, "style": true, "width": true },
      "dimensions": { "minHeight": true, "aspectRatio": true }
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/select/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/select",
    "title": "Form Select",
    "category": "theme-factory",
    "icon": "list-view",
    "description": "Single-select form field",
    "attributes": {
      "name": { "type": "string", "default": "" },
      "id": { "type": "string", "default": "" },
      "placeholder": { "type": "string", "default": "" },
      "className": { "type": "string", "default": "" },
      "required": { "type": "boolean", "default": false },
      "options": { "type": "array", "default": [] }
    },
    "supports": {
      "html": false
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/input/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/input",
    "title": "Form Input",
    "category": "theme-factory",
    "icon": "forms",
    "description": "Single-line form input",
    "attributes": {
      "type": { "type": "string", "default": "text" },
      "name": { "type": "string", "default": "" },
      "id": { "type": "string", "default": "" },
      "placeholder": { "type": "string", "default": "" },
      "className": { "type": "string", "default": "" },
      "required": { "type": "boolean", "default": false }
    },
    "supports": {
      "html": false
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/textarea/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/textarea",
    "title": "Form Textarea",
    "category": "theme-factory",
    "icon": "editor-alignleft",
    "description": "Multi-line form textarea",
    "attributes": {
      "name": { "type": "string", "default": "" },
      "id": { "type": "string", "default": "" },
      "placeholder": { "type": "string", "default": "" },
      "className": { "type": "string", "default": "" },
      "rows": { "type": "number", "default": 4 },
      "required": { "type": "boolean", "default": false }
    },
    "supports": {
      "html": false
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2)
};
