/**
 * Theme Factory Blocks - Plugin Templates
 * Version: 2.2.0
 * 
 * This file contains the PHP code for the companion plugin.
 * IMPORTANT: All PHP code must use straight quotes (', ") not curly quotes.
 */

export const PLUGIN_FILES: Record<string, string> = {
  'theme-factory-blocks.php': `<?php
/**
 * Plugin Name: Theme Factory Blocks
 * Description: Custom Gutenberg blocks and editor parity for Theme Factory themes.
 * Version: 2.2.0
 * Author: Theme Factory AI
 * Text Domain: theme-factory-blocks
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('TFB_VERSION', '2.2.0');
define('TFB_PATH', plugin_dir_path(__FILE__));
define('TFB_URL', plugin_dir_url(__FILE__));

require_once TFB_PATH . 'inc/sanitize.php';
require_once TFB_PATH . 'inc/blocks.php';
require_once TFB_PATH . 'inc/import.php';
require_once TFB_PATH . 'inc/editor-assets.php';

register_activation_hook(__FILE__, function() {
    if (class_exists('TFB_Import')) {
        TFB_Import::on_activate();
    }
    if (class_exists('TFB_Editor_Assets')) {
        TFB_Editor_Assets::on_activate();
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
        'link-group',
        'svg',
        'nav-toggle',
        'button',
        'input',
        'textarea'
    );

    public static function init() {
        add_action( 'init', array( __CLASS__, 'register_menus' ) );
        add_action( 'init', array( __CLASS__, 'register_blocks' ) );
        add_action( 'init', array( __CLASS__, 'register_block_category' ) );
        add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_editor_assets' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_assets' ) );
    }

    public static function register_menus() {
        register_nav_menus( array(
            'tf_primary' => __( 'Primary Menu (TF)', 'theme-factory-blocks' ),
            'tf_footer'  => __( 'Footer Menu (TF)', 'theme-factory-blocks' ),
        ) );
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
        $script_url = TFB_URL . 'build/blocks.js';
        
        $asset_file = TFB_PATH . 'build/blocks.asset.php';
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
        wp_localize_script( 'tfb-blocks', 'tfbData', array(
            'siteUrl'  => home_url( '/' ),
            'siteName' => get_bloginfo( 'name' ),
            'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'tfb_nonce' ),
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
        
        $classes = preg_split('/\\s+/', $v, -1, PREG_SPLIT_NO_EMPTY);
        $clean = array();
        
        foreach ($classes as $c) {
            if (preg_match('/^[\\w\\-:\\/\\.\\[\\]%&>]+$/', $c)) {
                $clean[] = $c;
            }
        }
        
        return implode(' ', $clean);
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
             $blocks = self::fix_block_classes($blocks);
             return serialize_blocks($blocks);
        }

        $shell_class = 'min-h-screen bg-white';
        $wrapped = '<!-- wp:theme-factory/page-shell {"className":"' . $shell_class . '"} -->' .
                   '<div class="wp-block-theme-factory-page-shell ' . $shell_class . '">' .
                   $html .
                   '</div>' .
                   '<!-- /wp:theme-factory/page-shell -->';

        $blocks = parse_blocks($wrapped);
        $blocks = self::fix_block_classes($blocks);

        return serialize_blocks($blocks);
    }

    private static function fix_block_classes($blocks) {
        $targets = array(
            'theme-factory/container'  => 'wp-block-theme-factory-container',
            'theme-factory/link-group' => 'wp-block-theme-factory-link-group',
            'theme-factory/button'     => 'wp-block-theme-factory-button',
            'theme-factory/nav-toggle' => 'wp-block-theme-factory-nav-toggle'
        );

        foreach ($blocks as &$block) {
            if (!empty($block['innerBlocks'])) {
                $block['innerBlocks'] = self::fix_block_classes($block['innerBlocks']);
            }

            if (isset($block['blockName']) && isset($targets[$block['blockName']])) {
                $default_class = $targets[$block['blockName']];
                
                if (!empty($block['innerContent'])) {
                    foreach ($block['innerContent'] as &$content_part) {
                        if (is_string($content_part) && !empty($content_part)) {
                             if (class_exists('WP_HTML_Tag_Processor')) {
                                 $p = new WP_HTML_Tag_Processor($content_part);
                                 if ($p->next_tag()) {
                                     $p->add_class($default_class);
                                     $content_part = $p->get_updated_html();
                                 }
                             } else {
                                 if (strpos($content_part, $default_class) === false) {
                                     if (preg_match('/class=["\\']//', $content_part)) {
                                          $content_part = preg_replace('/class=["\\']([^"\\']*)["\\']/', 'class="$1 ' . $default_class . '"', $content_part, 1);
                                     } else {
                                          $content_part = preg_replace('/(<\\w+)/', '$1 class="' . $default_class . '"', $content_part, 1);
                                     }
                                 }
                             }
                        }
                    }
                }
            }
        }
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

        if (!empty($styles)) {
            $settings['styles'][] = array( 'css' => $styles );
        }
        
        return $settings;
    }
}

endif;

TFB_Editor_Assets::init();`,

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
    'version' => '2.2.0'
);`,

  'build/blocks.js': `(function(wp) {
'use strict';

if (!wp || !wp.blocks || !wp.element || !wp.blockEditor) {
    console.warn('Theme Factory Blocks: WordPress block API not available');
    return;
}

var registerBlockType = wp.blocks.registerBlockType;
var el = wp.element.createElement;
var Fragment = wp.element.Fragment;
var useBlockProps = wp.blockEditor.useBlockProps;
var RichText = wp.blockEditor.RichText;
var InnerBlocks = wp.blockEditor.InnerBlocks;
var InspectorControls = wp.blockEditor.InspectorControls;
var PanelBody = wp.components.PanelBody;
var TextControl = wp.components.TextControl;
var Button = wp.components.Button;
var MediaUpload = wp.blockEditor.MediaUpload;
var __ = wp.i18n.__;

function getEditorClassName(className) {
    if (!className) return '';
    return className.split(' ').filter(function(c) {
        if (c.startsWith('fixed')) return false;
        if (c === 'h-screen' || c === 'w-screen' || c === 'min-h-screen') return false;
        if (c === 'pointer-events-none') return false;
        if (c === 'z-40' || c === 'z-50' || c.startsWith('z-[')) return false;
        if (c === 'overflow-hidden') return false;
        return true;
    }).join(' ');
}

function parseStyle(styleString) {
    if (!styleString) return {};
    if (typeof styleString === 'object') return styleString;
    var style = {};
    styleString.split(';').forEach(function(rule) {
        var parts = rule.split(':');
        if (parts.length === 2) {
            var key = parts[0].trim().replace(/-([a-z])/g, function(g) { return g[1].toUpperCase(); });
            style[key] = parts[1].trim();
        }
    });
    return style;
}

registerBlockType('theme-factory/page-shell', {
    title: __('Page Shell', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'layout',
    attributes: { className: { type: 'string', default: '' } },
    supports: { align: ['full', 'wide'] },
    edit: function(props) {
        var blockProps = useBlockProps({ className: 'tf-page-shell-editor ' + getEditorClassName(props.attributes.className) });
        return el('div', blockProps, el(InnerBlocks));
    },
    save: function(props) {
        var blockProps = useBlockProps.save({ className: props.attributes.className });
        return el('div', blockProps, el(InnerBlocks.Content));
    }
});

registerBlockType('theme-factory/container', {
    title: __('TF Container', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'box',
    attributes: {
        tagName: { type: 'string', default: 'div' },
        className: { type: 'string', default: '' },
        id: { type: 'string', default: '' },
        style: { type: 'string', default: '' },
        extraAttributes: { type: 'string', default: '{}' },
        bgImage: { type: 'string', default: '' }
    },
    supports: { align: ['full', 'wide'], html: false },
    edit: function(props) {
        var attributes = props.attributes;
        var Tag = attributes.tagName || 'div';
        var styleObj = parseStyle(attributes.style);
        
        if (attributes.bgImage) {
            styleObj.backgroundImage = "url('" + attributes.bgImage + "')";
            styleObj.backgroundSize = "cover";
            styleObj.backgroundPosition = "center";
        }
        
        var extraProps = {};
        try {
            if (attributes.extraAttributes) {
                var parsed = JSON.parse(attributes.extraAttributes);
                if (parsed && typeof parsed === 'object') {
                    extraProps = parsed;
                }
            }
        } catch(e) {}
        
        var blockProps = useBlockProps({ 
            className: getEditorClassName(attributes.className), 
            id: attributes.id || undefined, 
            style: styleObj,
            ...extraProps
        });
        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Container Settings', 'theme-factory-blocks') },
                    el(TextControl, { label: __('HTML Tag', 'theme-factory-blocks'), value: attributes.tagName, onChange: function(val) { props.setAttributes({ tagName: val }); } }),
                    el(TextControl, { label: __('ID', 'theme-factory-blocks'), value: attributes.id, onChange: function(val) { props.setAttributes({ id: val }); } }),
                    el('div', { style: { marginTop: '16px' } },
                        el('p', { style: { marginBottom: '8px' } }, 'Background Image'),
                        el(MediaUpload, {
                            onSelect: function(media) { props.setAttributes({ bgImage: media.url }); },
                            allowedTypes: ['image'],
                            value: attributes.bgImage,
                            render: function(obj) {
                                return el(Button, {
                                    isSecondary: true,
                                    onClick: obj.open
                                }, attributes.bgImage ? 'Replace Image' : 'Select Image');
                            }
                        }),
                        attributes.bgImage && el(Button, {
                            isLink: true,
                            isDestructive: true,
                            style: { marginTop: '8px' },
                            onClick: function() { props.setAttributes({ bgImage: '' }); }
                        }, 'Remove Image')
                    )
                )
            ),
            el(Tag, blockProps, el(InnerBlocks))
        );
    },
    save: function(props) {
        var attributes = props.attributes;
        var Tag = attributes.tagName || 'div';
        var styleObj = parseStyle(attributes.style);
        
        if (attributes.bgImage) {
            styleObj.backgroundImage = "url('" + attributes.bgImage + "')";
            styleObj.backgroundSize = "cover";
            styleObj.backgroundPosition = "center";
        }
        
        var extraProps = {};
        try {
            if (attributes.extraAttributes) {
                var parsed = JSON.parse(attributes.extraAttributes);
                if (parsed && typeof parsed === 'object') {
                    extraProps = parsed;
                }
            }
        } catch(e) {}
        
        var blockProps = useBlockProps.save({ 
            className: attributes.className, 
            id: attributes.id || undefined, 
            style: Object.keys(styleObj).length > 0 ? styleObj : undefined,
            ...extraProps
        });
        return el(Tag, blockProps, el(InnerBlocks.Content));
    }
});

registerBlockType('theme-factory/link-group', {
    title: __('Link Group', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'admin-links',
    attributes: { href: { type: 'string', default: '#' }, target: { type: 'string' }, rel: { type: 'string' }, className: { type: 'string', default: '' } },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: 'tf-link-group-editor ' + getEditorClassName(attributes.className) });
        return el(Fragment, null,
            el(InspectorControls, null, el(PanelBody, { title: __('Link Settings', 'theme-factory-blocks') },
                el(TextControl, { label: __('URL', 'theme-factory-blocks'), value: attributes.href, onChange: function(val) { props.setAttributes({ href: val }); } }),
                el(TextControl, { label: __('Target', 'theme-factory-blocks'), value: attributes.target, onChange: function(val) { props.setAttributes({ target: val }); } })
            )),
            el('div', blockProps, el('span', { className: 'tf-link-badge' }, 'LINK: ' + (attributes.href || '#')), el('div', null, el(InnerBlocks)))
        );
    },
    save: function(props) {
        var attributes = props.attributes;
        var linkProps = { href: attributes.href, className: attributes.className };
        if (attributes.target) linkProps.target = attributes.target;
        if (attributes.rel) linkProps.rel = attributes.rel;
        var blockProps = useBlockProps.save(linkProps);
        return el('a', blockProps, el(InnerBlocks.Content));
    }
});

registerBlockType('theme-factory/svg', {
    title: __('SVG Icon', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'art',
    attributes: { svgHtml: { type: 'string', default: '' } },
    edit: function(props) {
        var blockProps = useBlockProps({ className: 'tf-svg-preview' });
        return el('div', blockProps,
            el('textarea', { className: 'tf-code-editor', value: props.attributes.svgHtml, onChange: function(e) { props.setAttributes({ svgHtml: e.target.value }); }, placeholder: 'Paste SVG code here...', rows: 4 }),
            el('div', { className: 'tf-svg-render', dangerouslySetInnerHTML: { __html: props.attributes.svgHtml } })
        );
    },
    save: function(props) {
        var blockProps = useBlockProps.save();
        return el('div', blockProps, el(wp.element.RawHTML, null, props.attributes.svgHtml));
    }
});

registerBlockType('theme-factory/nav-toggle', {
    title: __('Nav Toggle', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'menu',
    attributes: { className: { type: 'string', default: '' } },
    edit: function(props) {
        var blockProps = useBlockProps({ className: 'tf-nav-toggle-editor' });
        return el('div', blockProps, el('div', { className: 'tf-nav-toggle-label' }, 'Nav Toggle'), el(InnerBlocks));
    },
    save: function(props) {
        var blockProps = useBlockProps.save({ className: props.attributes.className });
        return el('button', blockProps, el(InnerBlocks.Content));
    }
});

registerBlockType('theme-factory/button', {
    title: __('TF Button', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'button',
    attributes: { text: { type: 'string', default: '' }, href: { type: 'string', default: '#' }, className: { type: 'string', default: '' }, target: { type: 'string' }, rel: { type: 'string' } },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: 'tf-button-wrapper' });
        return el(Fragment, null,
            el(InspectorControls, null, el(PanelBody, { title: __('Button Settings', 'theme-factory-blocks') },
                el(TextControl, { label: __('URL', 'theme-factory-blocks'), value: attributes.href, onChange: function(val) { props.setAttributes({ href: val }); } }),
                el(TextControl, { label: __('Target', 'theme-factory-blocks'), value: attributes.target, onChange: function(val) { props.setAttributes({ target: val }); } })
            )),
            el('div', blockProps,
                el('span', { className: 'tf-button-preview ' + getEditorClassName(attributes.className) }, attributes.text || 'Button'),
                el('div', { className: 'tf-button-controls' },
                    el(RichText, { tagName: 'span', value: attributes.text, onChange: function(val) { props.setAttributes({ text: val }); }, placeholder: __('Button text...', 'theme-factory-blocks') }),
                    el(TextControl, { value: attributes.href, onChange: function(val) { props.setAttributes({ href: val }); }, placeholder: 'https://...' })
                )
            )
        );
    },
    save: function(props) {
        var attributes = props.attributes;
        var linkProps = { href: attributes.href, className: attributes.className };
        if (attributes.target) linkProps.target = attributes.target;
        if (attributes.rel) linkProps.rel = attributes.rel;
        var blockProps = useBlockProps.save(linkProps);
        return el('a', blockProps, el(RichText.Content, { value: attributes.text }));
    }
});

registerBlockType('theme-factory/input', {
    title: __('Form Input', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'forms',
    attributes: {
        type: { type: 'string', default: 'text' },
        name: { type: 'string', default: '' },
        placeholder: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
        required: { type: 'boolean', default: false }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: 'tf-input-editor ' + getEditorClassName(attributes.className) });
        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Input Settings', 'theme-factory-blocks') },
                    el(SelectControl, {
                        label: __('Input Type', 'theme-factory-blocks'),
                        value: attributes.type,
                        options: [
                            { label: 'Text', value: 'text' },
                            { label: 'Email', value: 'email' },
                            { label: 'Password', value: 'password' },
                            { label: 'Number', value: 'number' },
                            { label: 'Tel', value: 'tel' }
                        ],
                        onChange: function(val) { props.setAttributes({ type: val }); }
                    }),
                    el(TextControl, { label: __('Name Attribute', 'theme-factory-blocks'), value: attributes.name, onChange: function(val) { props.setAttributes({ name: val }); } }),
                    el(TextControl, { label: __('Placeholder', 'theme-factory-blocks'), value: attributes.placeholder, onChange: function(val) { props.setAttributes({ placeholder: val }); } })
                )
            ),
            el('div', blockProps, 
                el('input', {
                    type: attributes.type,
                    placeholder: attributes.placeholder || 'Type here...',
                    disabled: true,
                    style: { width: '100%', pointerEvents: 'none' }
                })
            )
        );
    },
    save: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps.save({ className: attributes.className });
        var inputProps = {
            type: attributes.type,
            name: attributes.name || undefined,
            placeholder: attributes.placeholder || undefined
        };
        if (attributes.required) inputProps.required = true;
        return el('input', Object.assign({}, blockProps, inputProps));
    }
});

registerBlockType('theme-factory/textarea', {
    title: __('Form Textarea', 'theme-factory-blocks'),
    category: 'theme-factory',
    icon: 'editor-alignleft',
    attributes: {
        name: { type: 'string', default: '' },
        placeholder: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
        rows: { type: 'number', default: 4 },
        required: { type: 'boolean', default: false }
    },
    edit: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps({ className: 'tf-textarea-editor ' + getEditorClassName(attributes.className) });
        return el(Fragment, null,
            el(InspectorControls, null,
                el(PanelBody, { title: __('Textarea Settings', 'theme-factory-blocks') },
                    el(TextControl, { label: __('Name Attribute', 'theme-factory-blocks'), value: attributes.name, onChange: function(val) { props.setAttributes({ name: val }); } }),
                    el(TextControl, { label: __('Placeholder', 'theme-factory-blocks'), value: attributes.placeholder, onChange: function(val) { props.setAttributes({ placeholder: val }); } }),
                    el(TextControl, { label: __('Rows', 'theme-factory-blocks'), type: 'number', value: attributes.rows, onChange: function(val) { props.setAttributes({ rows: parseInt(val, 10) }); } })
                )
            ),
            el('div', blockProps, 
                el('textarea', {
                    placeholder: attributes.placeholder || 'Type here...',
                    rows: attributes.rows,
                    disabled: true,
                    style: { width: '100%', pointerEvents: 'none' }
                })
            )
        );
    },
    save: function(props) {
        var attributes = props.attributes;
        var blockProps = useBlockProps.save({ className: attributes.className });
        var textareaProps = {
            name: attributes.name || undefined,
            placeholder: attributes.placeholder || undefined,
            rows: attributes.rows || undefined
        };
        if (attributes.required) textareaProps.required = true;
        return el('textarea', Object.assign({}, blockProps, textareaProps));
    }
});

console.log('Theme Factory Blocks: All blocks registered successfully');

})(window.wp);`,

  'build/interactivity.js': `(function() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function() {
        document.addEventListener('click', function(e) {
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
            toggle.setAttribute('aria-expanded', !isExpanded);
        });
    });
})();`,

  'build/editor.css': `.tf-page-shell-editor { min-height: 100px; border: 1px dashed rgba(0,0,0,0.1); padding: 10px; }
.wp-block-theme-factory-container { min-height: 20px; outline: 1px dashed rgba(0,0,0,0.1); transition: outline 0.2s; }
.wp-block-theme-factory-container:hover, .wp-block-theme-factory-container.is-selected { outline: 1px dashed var(--wp-admin-theme-color, #007cba); }
.tf-link-group-editor { border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: #fdfdfd; }
.tf-link-badge { display: inline-block; background: #e0e0e0; color: #555; font-size: 10px; padding: 2px 8px; border-radius: 3px; margin-bottom: 8px; font-family: monospace; }
.tf-nav-toggle-editor { background: #f8f9fa; border: 1px dashed #ccc; padding: 10px; text-align: center; }
.tf-nav-toggle-label { font-weight: bold; color: #666; margin-bottom: 8px; }
.tf-svg-preview { padding: 10px; background: #fafafa; border: 1px solid #eee; }
.tf-code-editor { width: 100%; font-family: monospace; font-size: 11px; background: #f0f0f0; padding: 8px; border: 1px solid #ccc; border-radius: 3px; resize: vertical; min-height: 60px; }
.tf-svg-render { margin-top: 10px; padding: 10px; background: white; border: 1px solid #eee; text-align: center; }
.tf-svg-render svg { max-width: 100px; max-height: 100px; }
.tf-button-wrapper { padding: 4px; }
.tf-button-preview { display: inline-block; padding: 8px 16px; background: #f0f0f0; border-radius: 4px; cursor: default; }
.tf-button-controls { margin-top: 10px; display: flex; gap: 8px; align-items: center; padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 4px; }
.block-editor-block-list__layout .wp-block-theme-factory-container[class*="fixed"], .block-editor-block-list__layout .wp-block-theme-factory-container[class*="sticky"] { position: relative !important; }`,

  'build/style.css': `.wp-block-theme-factory-button { display: inline-block; text-decoration: none; }
.wp-block-theme-factory-link-group { display: block; text-decoration: none; color: inherit; }
.wp-block-theme-factory-nav-toggle { background: transparent; border: none; cursor: pointer; padding: 0; }
.wp-block-theme-factory-svg { display: inline-block; line-height: 0; }
.wp-block-theme-factory-svg svg { display: inline-block; vertical-align: middle; }
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
    "supports": { "align": ["full", "wide"], "html": false },
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
      "style": { "type": "string", "default": "" },
      "extraAttributes": { "type": "string", "default": "{}" }
    },
    "supports": { "align": ["full", "wide"], "html": false },
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
    "textdomain": "theme-factory-blocks"
  }, null, 2),

  'blocks/svg/block.json': JSON.stringify({
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "theme-factory/svg",
    "title": "SVG Icon",
    "category": "theme-factory",
    "icon": "art",
    "description": "Raw SVG Output",
    "attributes": { "svgHtml": { "type": "string", "default": "" } },
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
      "text": { "type": "string", "default": "" },
      "href": { "type": "string", "default": "#" },
      "className": { "type": "string", "default": "" },
      "target": { "type": "string" },
      "rel": { "type": "string" }
    },
    "textdomain": "theme-factory-blocks"
  }, null, 2)
};
