export const ELEMENTOR_IMPORTER_PLUGIN_FILES: Record<string, string> = {
  'whipify-elementor-importer.php': `<?php
/**
 * Plugin Name: Whipify Elementor Importer
 * Description: Imports Theme Factory Elementor-native page data into real WordPress pages.
 * Version: 1.3.19
 * Author: Theme Factory AI
 * Text Domain: whipify-elementor-importer
 */

if (!defined('ABSPATH')) exit;

define('WEI_VERSION', '1.3.19');

$whipify_elementor_widget_runtime = plugin_dir_path(__FILE__) . 'includes/whipify-elementor-widgets.php';
if (file_exists($whipify_elementor_widget_runtime)) {
    require_once $whipify_elementor_widget_runtime;
}

if (!function_exists('whipify_elementor_allowed_svg_html')) {
    function whipify_elementor_allowed_svg_html() {
        $svg_attrs = array(
            'aria-hidden' => true,
            'class' => true,
            'clip-rule' => true,
            'cx' => true,
            'cy' => true,
            'd' => true,
            'fill' => true,
            'fill-rule' => true,
            'focusable' => true,
            'height' => true,
            'opacity' => true,
            'points' => true,
            'r' => true,
            'role' => true,
            'rx' => true,
            'ry' => true,
            'stroke' => true,
            'stroke-linecap' => true,
            'stroke-linejoin' => true,
            'stroke-miterlimit' => true,
            'stroke-width' => true,
            'viewbox' => true,
            'viewBox' => true,
            'width' => true,
            'x' => true,
            'x1' => true,
            'x2' => true,
            'xmlns' => true,
            'y' => true,
            'y1' => true,
            'y2' => true,
        );

        return array(
            'svg' => $svg_attrs,
            'g' => $svg_attrs,
            'path' => $svg_attrs,
            'circle' => $svg_attrs,
            'rect' => $svg_attrs,
            'line' => $svg_attrs,
            'polyline' => $svg_attrs,
            'polygon' => $svg_attrs,
            'ellipse' => $svg_attrs,
            'defs' => $svg_attrs,
            'lineargradient' => $svg_attrs,
            'linearGradient' => $svg_attrs,
            'stop' => array_merge($svg_attrs, array(
                'offset' => true,
                'stop-color' => true,
                'stop-opacity' => true,
            )),
        );
    }
}

if (!function_exists('whipify_elementor_kses_svg')) {
    function whipify_elementor_kses_svg($html) {
        return wp_kses((string) $html, whipify_elementor_allowed_svg_html());
    }
}

if (!function_exists('whipify_elementor_kses_post_with_svg')) {
    function whipify_elementor_kses_post_with_svg($html) {
        $allowed = array_merge(wp_kses_allowed_html('post'), whipify_elementor_allowed_svg_html());
        $elementor_inline_attrs = array(
            'contenteditable' => true,
            'data-elementor-inline-editing-toolbar' => true,
            'data-elementor-setting-key' => true,
        );

        foreach ($allowed as $tag => $attrs) {
            if (is_array($attrs)) {
                $allowed[$tag] = array_merge($attrs, $elementor_inline_attrs);
            }
        }

        return wp_kses((string) $html, $allowed);
    }
}

if (!function_exists('whipify_elementor_feature_grid_inject_icon_html')) {
    function whipify_elementor_feature_grid_inject_icon_html($html, $icon_html = '') {
        $html = (string) $html;
        $icon = whipify_elementor_kses_svg($icon_html);

        if ($html === '' || $icon === '') {
            return $html;
        }

        $pattern = '/(<div\\b[^>]*class="[^"]*(?:w-16|w-20|w-24)[^"]*(?:h-16|h-20|h-24)[^"]*"[^>]*>)(\\s*)(<\\/div>)/i';
        $updated = preg_replace($pattern, '$1' . $icon . '$3', $html, 1, $count);

        return $count > 0 ? $updated : $html;
    }
}

if (!function_exists('whipify_elementor_feature_grid_strip_empty_media_placeholders')) {
    function whipify_elementor_feature_grid_strip_empty_media_placeholders($html) {
        $html = (string) $html;
        $pattern = '/<div\\b[^>]*class="[^"]*(?:w-16|w-20|w-24)[^"]*(?:h-16|h-20|h-24)[^"]*"[^>]*>\\s*<\\/div>/i';

        return preg_replace($pattern, '', $html);
    }
}

if (!function_exists('whipify_elementor_feature_grid_body_owns_header')) {
    function whipify_elementor_feature_grid_body_owns_header($html) {
        $html = (string) $html;

        return strpos($html, 'flex items-start') !== false || strpos($html, '<dl') !== false || strpos($html, 'Property Type') !== false;
    }
}

if (!function_exists('whipify_elementor_feature_grid_extract_leading_body_icon')) {
    function whipify_elementor_feature_grid_extract_leading_body_icon($html) {
        $html = (string) $html;

        if (!preg_match('/^\\s*(<div\\b[^>]*class="[^"]*(?:w-20|w-24)[^"]*rounded-full[^"]*"[^>]*>[\\s\\S]*?<\\/div>)\\s*([\\s\\S]*)$/i', $html, $matches)) {
            return array('', $html);
        }

        return array($matches[1], $matches[2]);
    }
}

if (!function_exists('whipify_elementor_feature_grid_extract_leading_media_frame')) {
    function whipify_elementor_feature_grid_extract_leading_media_frame($html) {
        $html = (string) $html;

        if (!preg_match('/^\\s*(<div\\b[^>]*class="[^"]*relative[^"]*overflow-hidden[^"]*rounded-2xl[^"]*"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/div>)\\s*([\\s\\S]*)$/i', $html, $matches)) {
            return array('', $html);
        }

        return array($matches[1], $matches[2]);
    }
}

if (!function_exists('whipify_elementor_feature_grid_render_leading_media_frame')) {
    function whipify_elementor_feature_grid_render_leading_media_frame($frame, $card) {
        $frame = (string) $frame;

        if ($frame === '') {
            return;
        }

        if (stripos($frame, '<img') === false && !empty($card['card_image']['url'])) {
            $image = '<img class="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
            $frame = preg_replace_callback('/<div\\b[^>]*>/i', function ($matches) use ($image) {
                return $matches[0] . $image;
            }, $frame, 1);
        }

        echo whipify_elementor_kses_post_with_svg($frame);
    }
}

if (!function_exists('whipify_elementor_feature_grid_render_leading_body_icon')) {
    function whipify_elementor_feature_grid_render_leading_body_icon($icon_html, $card) {
        $icon_html = (string) $icon_html;

        if ($icon_html !== '' && stripos($icon_html, '<svg') === false && !empty($card['card_icon_html'])) {
            $icon = whipify_elementor_kses_svg($card['card_icon_html']);
            if ($icon !== '') {
                $icon_html = preg_replace_callback('/<div\\b[^>]*>/i', function ($matches) use ($icon) {
                    return $matches[0] . $icon;
                }, $icon_html, 1);
            }
        }

        if ($icon_html !== '') {
            echo whipify_elementor_kses_post_with_svg($icon_html);
        }
    }
}

if (!function_exists('whipify_elementor_feature_grid_insert_card_title')) {
    function whipify_elementor_feature_grid_insert_card_title($html, $title, $title_attributes = '') {
        $html = (string) $html;
        $title = trim(wp_strip_all_tags((string) $title));
        $title_attributes = trim((string) $title_attributes);

        if ($html === '' || $title === '' || stripos($html, '<h3') !== false) {
            return $html;
        }

        $title_html = '<h3' . ($title_attributes !== '' ? ' ' . $title_attributes : '') . '>' . esc_html($title) . '</h3>';
        $updated = preg_replace('/(<div\\b[^>]*class="[^"]*inline-block[^"]*"[^>]*>.*?<\\/div>)(\\s*<p\\b[^>]*class="[^"]*text-sm[^"]*text-muted-foreground[^"]*"[^>]*>)/is', '$1' . $title_html . '$2', $html, 1, $count);

        if ($count > 0) {
            return $updated;
        }

        $updated = preg_replace('/(<\\/div>\\s*<\\/div>)/', '$1' . $title_html, $html, 1, $count);

        return $count > 0 ? $updated : $title_html . $html;
    }
}

if (!function_exists('whipify_elementor_feature_grid_fix_source_spacing')) {
    function whipify_elementor_feature_grid_fix_source_spacing($html) {
        return preg_replace('/(<\\/strong>)([^\\s<])/', '$1 $2', (string) $html);
    }
}

if (!function_exists('whipify_elementor_feature_grid_render_card_body')) {
    function whipify_elementor_feature_grid_render_card_body($card) {
        $body = !empty($card['card_body_html']) ? (string) $card['card_body_html'] : '';
        $has_image = !empty($card['card_image']['url']);
        $has_body = trim($body) !== '';
        $body_owns_header = $has_body && whipify_elementor_feature_grid_body_owns_header($body);
        $leading_media_frame = '';
        $leading_body_icon = '';

        if (!$body_owns_header && $has_body) {
            list($leading_media_frame, $body) = whipify_elementor_feature_grid_extract_leading_media_frame($body);

            if ($leading_media_frame === '') {
                list($leading_body_icon, $body) = whipify_elementor_feature_grid_extract_leading_body_icon($body);
            }

            $has_body = trim($body) !== '';
        }

        if ($leading_media_frame !== '') {
            whipify_elementor_feature_grid_render_leading_media_frame($leading_media_frame, $card);
        } elseif ($has_image) {
            echo '<img class="whipify-feature-grid__image" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
        } elseif ($leading_body_icon !== '') {
            whipify_elementor_feature_grid_render_leading_body_icon($leading_body_icon, $card);
        } elseif (!$body_owns_header && !empty($card['card_icon_html'])) {
            echo '<div class="whipify-feature-grid__icon">' . whipify_elementor_kses_svg($card['card_icon_html']) . '</div>';
        }

        if ($body_owns_header) {
            $body = whipify_elementor_feature_grid_inject_icon_html($body, $card['card_icon_html'] ?? '');
            $body = whipify_elementor_feature_grid_insert_card_title($body, $card['card_title'] ?? '');
            $body = whipify_elementor_feature_grid_fix_source_spacing($body);
            echo '<div class="whipify-feature-grid__body whipify-feature-grid__body--source-layout">' . whipify_elementor_kses_post_with_svg($body) . '</div>';
        } else {
            if (!empty($card['card_title'])) {
                echo '<h3>' . esc_html($card['card_title']) . '</h3>';
            }

            if ($has_body) {
                $body = whipify_elementor_feature_grid_strip_empty_media_placeholders($body);
                $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                echo '<div class="whipify-feature-grid__body">' . whipify_elementor_kses_post_with_svg($body) . '</div>';
            } elseif (!empty($card['card_text'])) {
                echo '<p>' . esc_html($card['card_text']) . '</p>';
            }
        }
    }
}

if (!function_exists('whipify_clean_pricing_matrix_price')) {
    function whipify_clean_pricing_matrix_price($price, $cta_text = '') {
        $clean = wp_strip_all_tags((string) $price);
        $cta_text = trim(wp_strip_all_tags((string) $cta_text));

        if ($cta_text !== '') {
            $clean = preg_replace('/\\s*' . preg_quote($cta_text, '/') . '\\s*/i', ' ', $clean);
        }

        $clean = preg_replace('/\\s*(Book This Package|Book Now|Get Quote|Contact Us)\\s*/i', ' ', $clean);
        $clean = preg_replace('/\\s+/', ' ', $clean);

        return trim((string) $clean);
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Svg_Icon_Widget_V139')
) {
    class Whipify_Elementor_Svg_Icon_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_svg_icon';
        }

        public function get_title() {
            return __('Whipify SVG Icon', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-star';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Icon', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('svg_html', array(
                'label' => __('SVG HTML', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('aria_label', array(
                'label' => __('Accessible label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        private static function allowed_svg_tags() {
            $attrs = array(
                'class' => true,
                'xmlns' => true,
                'width' => true,
                'height' => true,
                'viewbox' => true,
                'viewBox' => true,
                'fill' => true,
                'stroke' => true,
                'stroke-width' => true,
                'stroke-linecap' => true,
                'stroke-linejoin' => true,
                'd' => true,
                'cx' => true,
                'cy' => true,
                'r' => true,
                'x' => true,
                'y' => true,
                'x1' => true,
                'x2' => true,
                'y1' => true,
                'y2' => true,
                'rx' => true,
                'ry' => true,
                'points' => true,
                'role' => true,
                'aria-hidden' => true,
                'aria-label' => true,
                'focusable' => true,
            );

            return array(
                'svg' => $attrs,
                'path' => $attrs,
                'circle' => $attrs,
                'rect' => $attrs,
                'polygon' => $attrs,
                'polyline' => $attrs,
                'line' => $attrs,
                'ellipse' => $attrs,
                'g' => $attrs,
                'defs' => $attrs,
                'lineargradient' => $attrs,
                'stop' => $attrs,
                'title' => array(),
            );
        }

        private static function sanitize_svg($svg_html) {
            return wp_kses((string) $svg_html, self::allowed_svg_tags());
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $svg_html = self::sanitize_svg($settings['svg_html'] ?? '');
            if ($svg_html === '') {
                return;
            }

            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<span class="whipify-svg-icon' . esc_attr($source_classes) . '">';
            echo $svg_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</span>';
        }

        protected function content_template() {
            ?>
            <span class="whipify-svg-icon {{{ settings.source_class_name }}}">
                {{{ settings.svg_html }}}
            </span>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Text_Fragment_Widget_V139')
) {
    class Whipify_Elementor_Text_Fragment_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_text_fragment';
        }

        public function get_title() {
            return __('Whipify Text Fragment', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-t-letter';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Text', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('text', array(
                'label' => __('Text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('html_tag', array(
                'label' => __('HTML tag', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SELECT,
                'default' => 'div',
                'options' => array(
                    'div' => 'div',
                    'span' => 'span',
                ),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        private static function safe_tag($tag) {
            return in_array($tag, array('div', 'span'), true) ? $tag : 'div';
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $text = isset($settings['text']) ? (string) $settings['text'] : '';
            if ($text === '') {
                return;
            }

            $tag = self::safe_tag($settings['html_tag'] ?? 'div');
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            $this->add_inline_editing_attributes('text', 'none');
            $this->add_render_attribute('text', 'class', 'whipify-text-fragment' . $source_classes);

            echo '<' . esc_attr($tag) . ' ' . $this->get_render_attribute_string('text') . '>';
            echo esc_html($text);
            echo '</' . esc_attr($tag) . '>';
        }

        protected function content_template() {
            ?>
            <#
            var tag = [ 'div', 'span' ].indexOf( settings.html_tag ) !== -1 ? settings.html_tag : 'div';
            #>
            <{{{ tag }}} class="whipify-text-fragment {{{ settings.source_class_name }}}">
                {{{ settings.text }}}
            </{{{ tag }}}>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Neighborhood_List_Widget_V139')
) {
    class Whipify_Elementor_Neighborhood_List_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_neighborhood_list';
        }

        public function get_title() {
            return __('Whipify Neighborhood List', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-bullet-list';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Neighborhoods', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $repeater = new \\Elementor\\Repeater();

            $repeater->add_control('name', array(
                'label' => __('Name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $repeater->add_control('description', array(
                'label' => __('Description', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater->add_control('url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $repeater->add_control('icon_html', array(
                'label' => __('Icon SVG', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater->add_control('item_class_name', array(
                'label' => __('Source item classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('items', array(
                'label' => __('Items', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            echo '<ul class="whipify-neighborhood-list' . esc_attr($source_classes) . '">';
            foreach (($settings['items'] ?? array()) as $index => $item) {
                $item_classes = !empty($item['item_class_name']) ? ' ' . $item['item_class_name'] : '';
                $name = isset($item['name']) ? (string) $item['name'] : '';
                $description = isset($item['description']) ? (string) $item['description'] : '';
                $url = $item['url']['url'] ?? '';
                $icon = !empty($item['icon_html']) ? whipify_elementor_kses_svg($item['icon_html']) : '';

                echo '<li class="whipify-neighborhood-list__item' . esc_attr($item_classes) . '">';
                if ($icon !== '') {
                    echo '<span class="whipify-neighborhood-list__icon">' . $icon . '</span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                }
                echo '<div class="whipify-neighborhood-list__content">';
                if ($name !== '') {
                    $setting_key = 'items.' . $index . '.name';
                    $this->add_inline_editing_attributes($setting_key, 'none');
                    $this->add_render_attribute($setting_key, 'class', 'whipify-neighborhood-list__name');
                    if ($url !== '') {
                        echo '<a ' . $this->get_render_attribute_string($setting_key) . ' href="' . esc_url($url) . '">' . esc_html($name) . '</a>';
                    } else {
                        echo '<span ' . $this->get_render_attribute_string($setting_key) . '>' . esc_html($name) . '</span>';
                    }
                }
                if ($description !== '') {
                    echo '<span class="whipify-neighborhood-list__description">' . esc_html($description) . '</span>';
                }
                echo '</div></li>';
            }
            echo '</ul>';
        }

        protected function content_template() {
            ?>
            <ul class="whipify-neighborhood-list {{{ settings.source_class_name }}}">
                <# _.each( settings.items, function( item ) { #>
                    <li class="whipify-neighborhood-list__item {{{ item.item_class_name }}}">
                        <# if ( item.icon_html ) { #><span class="whipify-neighborhood-list__icon">{{{ item.icon_html }}}</span><# } #>
                        <div class="whipify-neighborhood-list__content">
                            <# if ( item.url && item.url.url ) { #>
                                <a class="whipify-neighborhood-list__name" href="{{ item.url.url }}">{{{ item.name }}}</a>
                            <# } else { #>
                                <span class="whipify-neighborhood-list__name">{{{ item.name }}}</span>
                            <# } #>
                            <# if ( item.description ) { #><span class="whipify-neighborhood-list__description">{{{ item.description }}}</span><# } #>
                        </div>
                    </li>
                <# }); #>
            </ul>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Breadcrumbs_Widget_V139')
) {
    class Whipify_Elementor_Breadcrumbs_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_breadcrumbs'; }
        public function get_title() { return __('Whipify Breadcrumbs', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-navigation-horizontal'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Breadcrumbs', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $this->add_control('home_label', array('label' => __('Home label', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => 'Home'));
            $this->add_control('home_url', array('label' => __('Home URL', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::URL, 'default' => array('url' => '/')));
            $this->add_control('current_label', array('label' => __('Current label', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            $home = $settings['home_label'] ?? 'Home';
            $home_url = $settings['home_url']['url'] ?? '/';
            $current = $settings['current_label'] ?? '';
            echo '<nav class="tf-elementor-breadcrumbs" aria-label="Breadcrumb"><a href="' . esc_url($home_url ?: '/') . '">' . esc_html($home ?: 'Home') . '</a><span class="tf-elementor-breadcrumbs__separator" aria-hidden="true">&rsaquo;</span><span class="tf-elementor-breadcrumbs__current">' . esc_html($current) . '</span></nav>';
        }
        protected function content_template() { ?>
            <nav class="tf-elementor-breadcrumbs" aria-label="Breadcrumb"><a href="{{ settings.home_url && settings.home_url.url ? settings.home_url.url : '/' }}">{{{ settings.home_label || 'Home' }}}</a><span class="tf-elementor-breadcrumbs__separator" aria-hidden="true">&rsaquo;</span><span class="tf-elementor-breadcrumbs__current">{{{ settings.current_label }}}</span></nav>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Trust_Logo_Row_Widget_V139')
) {
    class Whipify_Elementor_Trust_Logo_Row_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_trust_logo_row'; }
        public function get_title() { return __('Whipify Trust Logo Row', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-logo'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Logos', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('image_url', array('label' => __('Image URL', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => ''));
            $repeater->add_control('image_alt', array('label' => __('Image alt', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => ''));
            $repeater->add_control('link_url', array('label' => __('Link', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::URL, 'default' => array('url' => '')));
            $repeater->add_control('link_class_name', array('label' => __('Source link classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $repeater->add_control('image_class_name', array('label' => __('Source image classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->add_control('logos', array('label' => __('Logos', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::REPEATER, 'fields' => $repeater->get_controls(), 'title_field' => '{{{ image_alt }}}', 'default' => array()));
            $this->add_control('source_class_name', array('label' => __('Source classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<div class="whipify-trust-logo-row' . esc_attr($source_classes) . '">';
            foreach (($settings['logos'] ?? array()) as $logo) {
                $href = $logo['link_url']['url'] ?? '';
                $link_classes = !empty($logo['link_class_name']) ? ' ' . $logo['link_class_name'] : '';
                $image_classes = !empty($logo['image_class_name']) ? ' ' . $logo['image_class_name'] : '';
                if ($href !== '') echo '<a class="whipify-trust-logo-row__link' . esc_attr($link_classes) . '" href="' . esc_url($href) . '">';
                echo '<img class="whipify-trust-logo-row__image' . esc_attr($image_classes) . '" src="' . esc_url($logo['image_url'] ?? '') . '" alt="' . esc_attr($logo['image_alt'] ?? '') . '">';
                if ($href !== '') echo '</a>';
            }
            echo '</div>';
        }
        protected function content_template() { ?>
            <div class="whipify-trust-logo-row {{{ settings.source_class_name }}}"><# _.each( settings.logos, function( logo ) { #><# if ( logo.link_url && logo.link_url.url ) { #><a class="whipify-trust-logo-row__link {{{ logo.link_class_name }}}" href="{{ logo.link_url.url }}"><# } #><img class="whipify-trust-logo-row__image {{{ logo.image_class_name }}}" src="{{ logo.image_url }}" alt="{{ logo.image_alt || '' }}"><# if ( logo.link_url && logo.link_url.url ) { #></a><# } #><# }); #></div>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Carousel_Dots_Widget_V139')
) {
    class Whipify_Elementor_Carousel_Dots_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_carousel_dots'; }
        public function get_title() { return __('Whipify Carousel Dots', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-circle'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Dots', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $this->add_control('dot_count', array('label' => __('Dot count', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::NUMBER, 'default' => 3, 'min' => 1));
            $this->add_control('active_index', array('label' => __('Active dot', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::NUMBER, 'default' => 1, 'min' => 1));
            $this->add_control('source_class_name', array('label' => __('Source classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            $count = max(1, (int) ($settings['dot_count'] ?? 3));
            $active = max(1, (int) ($settings['active_index'] ?? 1));
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<div class="whipify-carousel-dots' . esc_attr($source_classes) . '">';
            for ($i = 1; $i <= $count; $i++) echo '<button type="button" class="w-2.5 h-2.5 rounded-full transition-colors ' . esc_attr($i === $active ? 'bg-primary' : 'bg-muted-foreground/30') . '"></button>';
            echo '</div>';
        }
        protected function content_template() { ?>
            <div class="whipify-carousel-dots {{{ settings.source_class_name }}}"><# for ( var i = 1; i <= ( settings.dot_count || 3 ); i++ ) { #><button type="button" class="w-2.5 h-2.5 rounded-full transition-colors <# if ( i === ( settings.active_index || 1 ) ) { #>bg-primary<# } else { #>bg-muted-foreground/30<# } #>"></button><# } #></div>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Map_Embed_Widget_V139')
) {
    class Whipify_Elementor_Map_Embed_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_map_embed'; }
        public function get_title() { return __('Whipify Map Embed', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-google-maps'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Map', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $this->add_control('iframe_src', array('label' => __('Iframe URL', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXTAREA, 'default' => ''));
            $this->add_control('title', array('label' => __('Title', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => 'Map'));
            $this->add_control('height', array('label' => __('Height', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => '400'));
            $this->add_control('source_class_name', array('label' => __('Source classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            if (empty($settings['iframe_src'])) return;
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<iframe class="whipify-map-embed' . esc_attr($source_classes) . '" src="' . esc_url($settings['iframe_src']) . '" title="' . esc_attr($settings['title'] ?? 'Map') . '" width="100%" height="' . esc_attr($settings['height'] ?? '400') . '" style="border:0;" loading="lazy" allowfullscreen></iframe>';
        }
        protected function content_template() { ?>
            <iframe class="whipify-map-embed {{{ settings.source_class_name }}}" src="{{ settings.iframe_src }}" title="{{ settings.title || 'Map' }}" width="100%" height="{{ settings.height || '400' }}" style="border:0;" loading="lazy" allowfullscreen></iframe>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Feature_Grid_Widget_V139')
) {
    class Whipify_Elementor_Feature_Grid_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_feature_grid';
        }

        public function get_title() {
            return __('Whipify Feature Grid', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-gallery-grid';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('section_body_html', array(
                'label' => __('Section body', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $this->add_control('section_footer_html', array(
                'label' => __('Section footer', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('card_title', array(
                'label' => __('Card title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('card_text', array(
                'label' => __('Card text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('card_body_html', array(
                'label' => __('Card details', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));
            $repeater->add_control('card_link_text', array(
                'label' => __('Link label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('card_url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));
            $repeater->add_control('card_image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('card_icon_html', array(
                'label' => __('Icon HTML', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('card_class_name', array(
                'label' => __('Source card classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('cards', array(
                'label' => __('Cards', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ card_title }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render_card_body($card, $index) {
            $body = !empty($card['card_body_html']) ? (string) $card['card_body_html'] : '';
            $has_image = !empty($card['card_image']['url']);
            $has_body = trim($body) !== '';
            $body_owns_header = $has_body && whipify_elementor_feature_grid_body_owns_header($body);
            $leading_media_frame = '';
            $leading_body_icon = '';

            if (!$body_owns_header && $has_body) {
                list($leading_media_frame, $body) = whipify_elementor_feature_grid_extract_leading_media_frame($body);

                if ($leading_media_frame === '') {
                    list($leading_body_icon, $body) = whipify_elementor_feature_grid_extract_leading_body_icon($body);
                }

                $has_body = trim($body) !== '';
            }

            if ($leading_media_frame !== '') {
                whipify_elementor_feature_grid_render_leading_media_frame($leading_media_frame, $card);
            } elseif ($has_image) {
                echo '<img class="whipify-feature-grid__image" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
            } elseif ($leading_body_icon !== '') {
                whipify_elementor_feature_grid_render_leading_body_icon($leading_body_icon, $card);
            } elseif (!$body_owns_header && !empty($card['card_icon_html'])) {
                echo '<div class="whipify-feature-grid__icon">' . whipify_elementor_kses_svg($card['card_icon_html']) . '</div>';
            }

            if ($body_owns_header) {
                $title_key = $this->get_repeater_setting_key('card_title', 'cards', $index);
                $this->add_render_attribute($title_key, 'class', 'whipify-feature-grid__card-title');
                $this->add_inline_editing_attributes($title_key, 'none');
                $body_key = $this->get_repeater_setting_key('card_body_html', 'cards', $index);
                $this->add_render_attribute($body_key, 'class', 'whipify-feature-grid__body');
                $this->add_render_attribute($body_key, 'class', 'whipify-feature-grid__body--source-layout');
                $this->add_inline_editing_attributes($body_key, 'advanced');

                $body = whipify_elementor_feature_grid_inject_icon_html($body, $card['card_icon_html'] ?? '');
                $body = whipify_elementor_feature_grid_insert_card_title($body, $card['card_title'] ?? '', $this->get_render_attribute_string($title_key));
                $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                echo '<div ' . $this->get_render_attribute_string($body_key) . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
            } else {
                if (!empty($card['card_title'])) {
                    $title_key = $this->get_repeater_setting_key('card_title', 'cards', $index);
                    $this->add_render_attribute($title_key, 'class', 'whipify-feature-grid__card-title');
                    $this->add_inline_editing_attributes($title_key, 'none');
                    echo '<h3 ' . $this->get_render_attribute_string($title_key) . '>' . esc_html($card['card_title']) . '</h3>';
                }

                if ($has_body) {
                    $body_key = $this->get_repeater_setting_key('card_body_html', 'cards', $index);
                    $this->add_render_attribute($body_key, 'class', 'whipify-feature-grid__body');
                    $this->add_inline_editing_attributes($body_key, 'advanced');
                    $body = whipify_elementor_feature_grid_strip_empty_media_placeholders($body);
                    $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                    echo '<div ' . $this->get_render_attribute_string($body_key) . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
                } elseif (!empty($card['card_text'])) {
                    $text_key = $this->get_repeater_setting_key('card_text', 'cards', $index);
                    $this->add_render_attribute($text_key, 'class', 'whipify-feature-grid__card-text');
                    $this->add_inline_editing_attributes($text_key, 'basic');
                    echo '<p ' . $this->get_render_attribute_string($text_key) . '>' . esc_html($card['card_text']) . '</p>';
                }
            }
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-feature-grid__title');
            $this->add_inline_editing_attributes('section_intro', 'basic');
            $this->add_render_attribute('section_intro', 'class', 'whipify-feature-grid__intro');
            $this->add_inline_editing_attributes('section_body_html', 'advanced');
            $this->add_render_attribute('section_body_html', 'class', 'whipify-feature-grid__body-main');
            $this->add_inline_editing_attributes('section_footer_html', 'advanced');
            $this->add_render_attribute('section_footer_html', 'class', 'whipify-feature-grid__footer');

            echo '<section class="whipify-feature-grid" data-whipify-widget-version="' . esc_attr(WEI_VERSION) . '">';
            echo '<div class="whipify-feature-grid__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p ' . $this->get_render_attribute_string('section_intro') . '>' . esc_html($settings['section_intro']) . '</p>';
            }

            if (!empty($settings['section_body_html'])) {
                echo '<div ' . $this->get_render_attribute_string('section_body_html') . '>' . wp_kses_post($settings['section_body_html']) . '</div>';
            }

            echo '<div class="whipify-feature-grid__cards' . esc_attr($source_classes) . '">';
            foreach (($settings['cards'] ?? array()) as $index => $card) {
                $card_classes = !empty($card['card_class_name']) ? ' ' . $card['card_class_name'] : '';
                echo '<article class="whipify-feature-grid__card' . esc_attr($card_classes) . '" data-whipify-card-index="' . esc_attr((string) $index) . '" data-whipify-card-title="' . esc_attr($card['card_title'] ?? '') . '">';

                $this->render_card_body($card, $index);

                if (!empty($card['card_url']['url']) && !empty($card['card_link_text'])) {
                    $link_key = $this->get_repeater_setting_key('card_link_text', 'cards', $index);
                    $this->add_render_attribute($link_key, 'href', esc_url($card['card_url']['url']));
                    $this->add_inline_editing_attributes($link_key, 'none');
                    echo '<a ' . $this->get_render_attribute_string($link_key) . '>' . esc_html($card['card_link_text']) . '</a>';
                }

                echo '</article>';
            }
            echo '</div>';

            if (!empty($settings['section_footer_html'])) {
                echo '<div ' . $this->get_render_attribute_string('section_footer_html') . '>' . wp_kses_post($settings['section_footer_html']) . '</div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-feature-grid" data-whipify-widget-version="<?php echo esc_attr(WEI_VERSION); ?>">
                <div class="whipify-feature-grid__inner">
                    <#
                    view.addRenderAttribute( 'section_title', 'class', 'whipify-feature-grid__title' );
                    view.addInlineEditingAttributes( 'section_title', 'none' );
                    view.addRenderAttribute( 'section_intro', 'class', 'whipify-feature-grid__intro' );
                    view.addInlineEditingAttributes( 'section_intro', 'basic' );
                    view.addRenderAttribute( 'section_body_html', 'class', 'whipify-feature-grid__body-main' );
                    view.addInlineEditingAttributes( 'section_body_html', 'advanced' );
                    view.addRenderAttribute( 'section_footer_html', 'class', 'whipify-feature-grid__footer' );
                    view.addInlineEditingAttributes( 'section_footer_html', 'advanced' );
                    #>
                    <# if ( settings.section_title ) { #>
                        <h2 {{{ view.getRenderAttributeString( 'section_title' ) }}}>{{{ settings.section_title }}}</h2>
                    <# } #>
                    <# if ( settings.section_intro ) { #>
                        <p {{{ view.getRenderAttributeString( 'section_intro' ) }}}>{{{ settings.section_intro }}}</p>
                    <# } #>
                    <# if ( settings.section_body_html ) { #>
                        <div {{{ view.getRenderAttributeString( 'section_body_html' ) }}}>{{{ settings.section_body_html }}}</div>
                    <# } #>
                    <div class="whipify-feature-grid__cards {{{ settings.source_class_name }}}">
                        <# _.each( settings.cards, function( card, index ) {
                            var cardTitleKey = view.getRepeaterSettingKey( 'card_title', 'cards', index );
                            var cardTextKey = view.getRepeaterSettingKey( 'card_text', 'cards', index );
                            var cardBodyKey = view.getRepeaterSettingKey( 'card_body_html', 'cards', index );
                            var cardLinkTextKey = view.getRepeaterSettingKey( 'card_link_text', 'cards', index );
                            view.addRenderAttribute( cardTitleKey, 'class', 'whipify-feature-grid__card-title' );
                            view.addInlineEditingAttributes( cardTitleKey, 'none' );
                            view.addRenderAttribute( cardTextKey, 'class', 'whipify-feature-grid__card-text' );
                            view.addInlineEditingAttributes( cardTextKey, 'basic' );
                            view.addRenderAttribute( cardBodyKey, 'class', 'whipify-feature-grid__body' );
                            view.addInlineEditingAttributes( cardBodyKey, 'advanced' );
                            if ( card.card_url && card.card_url.url ) {
                                view.addRenderAttribute( cardLinkTextKey, 'href', card.card_url.url );
                            }
                            view.addInlineEditingAttributes( cardLinkTextKey, 'none' );
                        #>
                            <article class="whipify-feature-grid__card {{{ card.card_class_name }}}" data-whipify-card-index="{{ index }}" data-whipify-card-title="{{ card.card_title || '' }}">
                                <#
                                var bodyHtml = card.card_body_html || '';
                                var leadingMediaFrame = '';
                                var leadingBodyIcon = '';
                                var mediaMatch = bodyHtml.match(/^\\s*(<div\\b[^>]*class="[^"]*relative[^"]*overflow-hidden[^"]*rounded-2xl[^"]*"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/div>)\\s*([\\s\\S]*)$/i);
                                if ( mediaMatch ) {
                                    leadingMediaFrame = mediaMatch[1];
                                    bodyHtml = mediaMatch[2];
                                    if ( card.card_image && card.card_image.url && leadingMediaFrame.indexOf( '<img' ) === -1 ) {
                                        leadingMediaFrame = leadingMediaFrame.replace( /<div\\b[^>]*>/i, function( openingTag ) {
                                            return openingTag + '<img class="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" src="' + card.card_image.url + '" alt="' + ( card.card_image.alt || '' ) + '">';
                                        } );
                                    }
                                } else {
                                    var iconMatch = bodyHtml.match(/^\\s*(<div\\b[^>]*class="[^"]*(?:w-20|w-24)[^"]*rounded-full[^"]*"[^>]*>[\\s\\S]*?<\\/div>)\\s*([\\s\\S]*)$/i);
                                    if ( iconMatch ) {
                                        leadingBodyIcon = iconMatch[1];
                                        bodyHtml = iconMatch[2];
                                        if ( card.card_icon_html && leadingBodyIcon.indexOf( '<svg' ) === -1 ) {
                                            leadingBodyIcon = leadingBodyIcon.replace( /<div\\b[^>]*>/i, function( openingTag ) {
                                                return openingTag + card.card_icon_html;
                                            } );
                                        }
                                    }
                                }
                                #>
                                <# if ( leadingMediaFrame ) { #>
                                    {{{ leadingMediaFrame }}}
                                <# } else if ( card.card_image && card.card_image.url ) { #>
                                    <img class="whipify-feature-grid__image" src="{{ card.card_image.url }}" alt="{{ card.card_image.alt || '' }}">
                                <# } else if ( leadingBodyIcon ) { #>
                                    {{{ leadingBodyIcon }}}
                                <# } else if ( card.card_icon_html ) { #>
                                    <div class="whipify-feature-grid__icon">{{{ card.card_icon_html }}}</div>
                                <# } #>
                                <# if ( card.card_title ) { #><h3 {{{ view.getRenderAttributeString( cardTitleKey ) }}}>{{{ card.card_title }}}</h3><# } #>
                                <# if ( bodyHtml ) { #><div {{{ view.getRenderAttributeString( cardBodyKey ) }}}>{{{ bodyHtml }}}</div><# } else if ( card.card_text ) { #><p {{{ view.getRenderAttributeString( cardTextKey ) }}}>{{{ card.card_text }}}</p><# } #>
                                <# if ( card.card_url && card.card_url.url && card.card_link_text ) { #>
                                    <a {{{ view.getRenderAttributeString( cardLinkTextKey ) }}}>{{{ card.card_link_text }}}</a>
                                <# } #>
                            </article>
                        <# }); #>
                    </div>
                    <# if ( settings.section_footer_html ) { #>
                        <div {{{ view.getRenderAttributeString( 'section_footer_html' ) }}}>{{{ settings.section_footer_html }}}</div>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Feature_Card_Widget_V139')
) {
    class Whipify_Elementor_Feature_Card_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_feature_card';
        }

        public function get_title() {
            return __('Whipify Feature Card', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-info-box';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('card_title', array(
                'label' => __('Card title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('card_text', array(
                'label' => __('Card text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('card_body_html', array(
                'label' => __('Card details', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $this->add_control('card_link_text', array(
                'label' => __('Link label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('card_url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('card_image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));

            $this->add_control('card_icon_html', array(
                'label' => __('Icon HTML', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('card_class_name', array(
                'label' => __('Source card classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render_card_body($card) {
            $body = !empty($card['card_body_html']) ? (string) $card['card_body_html'] : '';
            $has_image = !empty($card['card_image']['url']);
            $has_body = trim($body) !== '';
            $body_owns_header = $has_body && whipify_elementor_feature_grid_body_owns_header($body);
            $leading_media_frame = '';
            $leading_body_icon = '';

            if (!$body_owns_header && $has_body) {
                list($leading_media_frame, $body) = whipify_elementor_feature_grid_extract_leading_media_frame($body);

                if ($leading_media_frame === '') {
                    list($leading_body_icon, $body) = whipify_elementor_feature_grid_extract_leading_body_icon($body);
                }

                $has_body = trim($body) !== '';
            }

            if ($leading_media_frame !== '') {
                whipify_elementor_feature_grid_render_leading_media_frame($leading_media_frame, $card);
            } elseif ($has_image) {
                echo '<img class="whipify-feature-grid__image" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
            } elseif ($leading_body_icon !== '') {
                whipify_elementor_feature_grid_render_leading_body_icon($leading_body_icon, $card);
            } elseif (!$body_owns_header && !empty($card['card_icon_html'])) {
                echo '<div class="whipify-feature-grid__icon">' . whipify_elementor_kses_svg($card['card_icon_html']) . '</div>';
            }

            if ($body_owns_header) {
                $this->add_render_attribute('card_body_html', 'class', 'whipify-feature-grid__body--source-layout');
                $body = whipify_elementor_feature_grid_inject_icon_html($body, $card['card_icon_html'] ?? '');
                $body = whipify_elementor_feature_grid_insert_card_title($body, $card['card_title'] ?? '', $this->get_render_attribute_string('card_title'));
                $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                echo '<div ' . $this->get_render_attribute_string('card_body_html') . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
            } else {
                if (!empty($card['card_title'])) {
                    echo '<h3 ' . $this->get_render_attribute_string('card_title') . '>' . esc_html($card['card_title']) . '</h3>';
                }

                if ($has_body) {
                    $body = whipify_elementor_feature_grid_strip_empty_media_placeholders($body);
                    $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                    echo '<div ' . $this->get_render_attribute_string('card_body_html') . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
                } elseif (!empty($card['card_text'])) {
                    echo '<p ' . $this->get_render_attribute_string('card_text') . '>' . esc_html($card['card_text']) . '</p>';
                }
            }
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $card_classes = !empty($settings['card_class_name']) ? ' ' . $settings['card_class_name'] : '';

            $this->add_inline_editing_attributes('card_title', 'none');
            $this->add_render_attribute('card_title', 'class', 'whipify-feature-grid__card-title');
            $this->add_inline_editing_attributes('card_text', 'basic');
            $this->add_render_attribute('card_text', 'class', 'whipify-feature-grid__card-text');
            $this->add_inline_editing_attributes('card_body_html', 'advanced');
            $this->add_render_attribute('card_body_html', 'class', 'whipify-feature-grid__body');
            $this->add_inline_editing_attributes('card_link_text', 'none');

            echo '<article class="whipify-feature-grid__card' . esc_attr($card_classes) . '" data-whipify-feature-card="1" data-whipify-card-title="' . esc_attr($settings['card_title'] ?? '') . '">';

            $this->render_card_body($settings);

            if (!empty($settings['card_url']['url']) && !empty($settings['card_link_text'])) {
                $this->add_render_attribute('card_link_text', 'href', esc_url($settings['card_url']['url']));
                echo '<a ' . $this->get_render_attribute_string('card_link_text') . '>' . esc_html($settings['card_link_text']) . '</a>';
            }

            echo '</article>';
        }

        protected function content_template() {
            ?>
            <#
            view.addRenderAttribute( 'card_title', 'class', 'whipify-feature-grid__card-title' );
            view.addInlineEditingAttributes( 'card_title', 'none' );
            view.addRenderAttribute( 'card_text', 'class', 'whipify-feature-grid__card-text' );
            view.addInlineEditingAttributes( 'card_text', 'basic' );
            view.addRenderAttribute( 'card_body_html', 'class', 'whipify-feature-grid__body' );
            view.addInlineEditingAttributes( 'card_body_html', 'advanced' );
            if ( settings.card_url && settings.card_url.url ) {
                view.addRenderAttribute( 'card_link_text', 'href', settings.card_url.url );
            }
            view.addInlineEditingAttributes( 'card_link_text', 'none' );
            #>
            <article class="whipify-feature-grid__card {{{ settings.card_class_name }}}" data-whipify-feature-card="1" data-whipify-card-title="{{ settings.card_title || '' }}">
                <# if ( settings.card_image && settings.card_image.url ) { #>
                    <img class="whipify-feature-grid__image" src="{{ settings.card_image.url }}" alt="{{ settings.card_image.alt || '' }}">
                <# } else if ( settings.card_icon_html ) { #>
                    <div class="whipify-feature-grid__icon">{{{ settings.card_icon_html }}}</div>
                <# } #>
                <# if ( settings.card_title ) { #><h3 {{{ view.getRenderAttributeString( 'card_title' ) }}}>{{{ settings.card_title }}}</h3><# } #>
                <# if ( settings.card_body_html ) { #><div {{{ view.getRenderAttributeString( 'card_body_html' ) }}}>{{{ settings.card_body_html }}}</div><# } else if ( settings.card_text ) { #><p {{{ view.getRenderAttributeString( 'card_text' ) }}}>{{{ settings.card_text }}}</p><# } #>
                <# if ( settings.card_url && settings.card_url.url && settings.card_link_text ) { #>
                    <a {{{ view.getRenderAttributeString( 'card_link_text' ) }}}>{{{ settings.card_link_text }}}</a>
                <# } #>
            </article>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Pricing_Table_Widget_V139')
) {
    class Whipify_Elementor_Pricing_Table_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_pricing_table';
        }

        public function get_title() {
            return __('Whipify Pricing Table', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-price-table';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('section_footer_html', array(
                'label' => __('Section footer', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('plan_name', array(
                'label' => __('Plan name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('plan_description', array(
                'label' => __('Description', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('plan_price', array(
                'label' => __('Price', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('plan_interval', array(
                'label' => __('Interval', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('plan_features', array(
                'label' => __('Features', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One feature per line.', 'whipify-elementor-importer'),
                'default' => '',
            ));
            $repeater->add_control('cta_text', array(
                'label' => __('Button label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('cta_url', array(
                'label' => __('Button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));
            $repeater->add_control('is_highlighted', array(
                'label' => __('Highlighted', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SWITCHER,
                'return_value' => 'yes',
                'default' => '',
            ));
            $repeater->add_control('plan_class_name', array(
                'label' => __('Source plan classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('plans', array(
                'label' => __('Plans', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ plan_name }}}',
                'default' => array(),
            ));

            $this->add_control('pricing_columns', array(
                'label' => __('Matrix columns', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One pricing column per line.', 'whipify-elementor-importer'),
                'default' => '',
            ));

            $matrix_repeater = new \\Elementor\\Repeater();
            $matrix_repeater->add_control('service_type', array(
                'label' => __('Service type', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $matrix_repeater->add_control('service_badge', array(
                'label' => __('Badge', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $matrix_repeater->add_control('prices', array(
                'label' => __('Prices', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One price per matrix column.', 'whipify-elementor-importer'),
                'default' => '',
            ));
            $matrix_repeater->add_control('cta_text', array(
                'label' => __('Button label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $matrix_repeater->add_control('cta_url', array(
                'label' => __('Button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('pricing_rows', array(
                'label' => __('Matrix rows', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $matrix_repeater->get_controls(),
                'title_field' => '{{{ service_type }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-pricing-table__title');
            $this->add_inline_editing_attributes('section_intro', 'basic');
            $this->add_render_attribute('section_intro', 'class', 'whipify-pricing-table__intro');
            $this->add_inline_editing_attributes('section_footer_html', 'advanced');
            $this->add_render_attribute('section_footer_html', 'class', 'whipify-pricing-table__footer');

            echo '<section class="whipify-pricing-table">';
            echo '<div class="whipify-pricing-table__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p ' . $this->get_render_attribute_string('section_intro') . '>' . esc_html($settings['section_intro']) . '</p>';
            }

            $matrix_columns = !empty($settings['pricing_columns']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $settings['pricing_columns']) : array();
            $matrix_columns = array_values(array_filter(array_map('trim', $matrix_columns)));
            $matrix_rows = !empty($settings['pricing_rows']) && is_array($settings['pricing_rows']) ? $settings['pricing_rows'] : array();
            if (!empty($matrix_columns) && !empty($matrix_rows)) {
                echo '<div class="whipify-pricing-table__matrix-wrap">';
                echo '<table class="whipify-pricing-table__matrix"><thead><tr><th>' . esc_html__('Service Type', 'whipify-elementor-importer') . '</th>';
                foreach ($matrix_columns as $column) {
                    echo '<th>' . esc_html($column) . '</th>';
                }
                echo '</tr></thead><tbody>';
                foreach ($matrix_rows as $index => $row) {
                    $service_type_key = $this->get_repeater_setting_key('service_type', 'pricing_rows', $index);
                    $service_badge_key = $this->get_repeater_setting_key('service_badge', 'pricing_rows', $index);
                    $prices_key = $this->get_repeater_setting_key('prices', 'pricing_rows', $index);
                    $cta_text_key = $this->get_repeater_setting_key('cta_text', 'pricing_rows', $index);
                    $this->add_render_attribute($service_type_key, 'class', 'whipify-pricing-table__service-type');
                    $this->add_inline_editing_attributes($service_type_key, 'none');
                    $this->add_render_attribute($service_badge_key, 'class', 'whipify-pricing-table__badge');
                    $this->add_inline_editing_attributes($service_badge_key, 'none');
                    $this->add_render_attribute($prices_key, 'class', 'whipify-pricing-table__matrix-price');
                    $this->add_inline_editing_attributes($prices_key, 'basic');
                    $this->add_render_attribute($cta_text_key, 'class', 'whipify-pricing-table__button');
                    if (!empty($row['cta_url']['url'])) {
                        $this->add_render_attribute($cta_text_key, 'href', esc_url($row['cta_url']['url']));
                    }
                    $this->add_inline_editing_attributes($cta_text_key, 'none');
                    $prices = !empty($row['prices']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $row['prices']) : array();
                    echo '<tr><th scope="row">';
                    echo '<span ' . $this->get_render_attribute_string($service_type_key) . '>' . esc_html($row['service_type'] ?? '') . '</span>';
                    if (!empty($row['service_badge'])) {
                        echo '<span ' . $this->get_render_attribute_string($service_badge_key) . '>' . esc_html($row['service_badge']) . '</span>';
                    }
                    echo '</th>';
                    foreach ($matrix_columns as $index => $column) {
                        $price = whipify_clean_pricing_matrix_price($prices[$index] ?? '', $row['cta_text'] ?? '');
                        echo '<td>';
                        if ($price !== '') {
                            echo '<strong ' . $this->get_render_attribute_string($prices_key) . '>' . esc_html($price) . '</strong>';
                        }
                        if (!empty($row['cta_url']['url']) && !empty($row['cta_text'])) {
                            echo '<a ' . $this->get_render_attribute_string($cta_text_key) . '>' . esc_html($row['cta_text']) . '</a>';
                        }
                        echo '</td>';
                    }
                    echo '</tr>';
                }
                echo '</tbody></table></div>';

                if (!empty($settings['section_footer_html'])) {
                    echo '<div ' . $this->get_render_attribute_string('section_footer_html') . '>' . whipify_elementor_kses_post_with_svg($settings['section_footer_html']) . '</div>';
                }

                echo '</div></section>';
                return;
            }

            echo '<div class="whipify-pricing-table__plans' . esc_attr($source_classes) . '">';
            foreach (($settings['plans'] ?? array()) as $index => $plan) {
                $plan_name_key = $this->get_repeater_setting_key('plan_name', 'plans', $index);
                $plan_description_key = $this->get_repeater_setting_key('plan_description', 'plans', $index);
                $plan_price_key = $this->get_repeater_setting_key('plan_price', 'plans', $index);
                $plan_interval_key = $this->get_repeater_setting_key('plan_interval', 'plans', $index);
                $plan_features_key = $this->get_repeater_setting_key('plan_features', 'plans', $index);
                $cta_text_key = $this->get_repeater_setting_key('cta_text', 'plans', $index);
                $this->add_inline_editing_attributes($plan_name_key, 'none');
                $this->add_inline_editing_attributes($plan_description_key, 'basic');
                $this->add_inline_editing_attributes($plan_price_key, 'none');
                $this->add_inline_editing_attributes($plan_interval_key, 'none');
                $this->add_inline_editing_attributes($plan_features_key, 'basic');
                $this->add_render_attribute($cta_text_key, 'class', 'whipify-pricing-table__button');
                if (!empty($plan['cta_url']['url'])) {
                    $this->add_render_attribute($cta_text_key, 'href', esc_url($plan['cta_url']['url']));
                }
                $this->add_inline_editing_attributes($cta_text_key, 'none');
                $plan_classes = !empty($plan['plan_class_name']) ? ' ' . $plan['plan_class_name'] : '';
                $highlighted_class = !empty($plan['is_highlighted']) ? ' is-highlighted' : '';
                echo '<article class="whipify-pricing-table__plan' . esc_attr($highlighted_class . $plan_classes) . '">';

                if (!empty($plan['plan_name'])) {
                    echo '<h3 ' . $this->get_render_attribute_string($plan_name_key) . '>' . esc_html($plan['plan_name']) . '</h3>';
                }

                if (!empty($plan['plan_description'])) {
                    echo '<p class="whipify-pricing-table__description" ' . $this->get_render_attribute_string($plan_description_key) . '>' . esc_html($plan['plan_description']) . '</p>';
                }

                if (!empty($plan['plan_price'])) {
                    echo '<div class="whipify-pricing-table__price"><span ' . $this->get_render_attribute_string($plan_price_key) . '>' . esc_html($plan['plan_price']) . '</span>';
                    if (!empty($plan['plan_interval'])) {
                        echo '<span ' . $this->get_render_attribute_string($plan_interval_key) . '>' . esc_html($plan['plan_interval']) . '</span>';
                    }
                    echo '</div>';
                }

                $features = !empty($plan['plan_features']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $plan['plan_features']) : array();
                if (!empty($features)) {
                    echo '<ul class="whipify-pricing-table__features" ' . $this->get_render_attribute_string($plan_features_key) . '>';
                    foreach ($features as $feature) {
                        $feature = trim((string) $feature);
                        if ($feature !== '') {
                            echo '<li>' . esc_html($feature) . '</li>';
                        }
                    }
                    echo '</ul>';
                }

                if (!empty($plan['cta_url']['url']) && !empty($plan['cta_text'])) {
                    echo '<a ' . $this->get_render_attribute_string($cta_text_key) . '>' . esc_html($plan['cta_text']) . '</a>';
                }

                echo '</article>';
            }
            echo '</div>';

            if (!empty($settings['section_footer_html'])) {
                echo '<div ' . $this->get_render_attribute_string('section_footer_html') . '>' . whipify_elementor_kses_post_with_svg($settings['section_footer_html']) . '</div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-pricing-table">
                <div class="whipify-pricing-table__inner">
                    <#
                    view.addRenderAttribute( 'section_title', 'class', 'whipify-pricing-table__title' );
                    view.addInlineEditingAttributes( 'section_title', 'none' );
                    view.addRenderAttribute( 'section_intro', 'class', 'whipify-pricing-table__intro' );
                    view.addInlineEditingAttributes( 'section_intro', 'basic' );
                    view.addRenderAttribute( 'section_footer_html', 'class', 'whipify-pricing-table__footer' );
                    view.addInlineEditingAttributes( 'section_footer_html', 'advanced' );
                    #>
                    <# if ( settings.section_title ) { #>
                        <h2 {{{ view.getRenderAttributeString( 'section_title' ) }}}>{{{ settings.section_title }}}</h2>
                    <# } #>
                    <# if ( settings.section_intro ) { #>
                        <p {{{ view.getRenderAttributeString( 'section_intro' ) }}}>{{{ settings.section_intro }}}</p>
                    <# } #>
                    <# var pricingColumns = ( settings.pricing_columns || '' ).split(/\\r\\n|\\r|\\n/).filter(function(column) { return column.trim(); }); #>
                    <# var cleanPricingMatrixPrice = function(price, ctaText) {
                        var value = String(price || '');
                        if (ctaText) value = value.split(String(ctaText)).join(' ');
                        return value.replace(/Book This Package|Book Now|Get Quote|Contact Us/g, ' ').replace(/\\s+/g, ' ').trim();
                    }; #>
                    <# if ( pricingColumns.length && settings.pricing_rows && settings.pricing_rows.length ) { #>
                        <div class="whipify-pricing-table__matrix-wrap">
                            <table class="whipify-pricing-table__matrix">
                                <thead>
                                    <tr>
                                        <th>Service Type</th>
                                        <# _.each( pricingColumns, function( column ) { #><th>{{{ column.trim() }}}</th><# }); #>
                                    </tr>
                                </thead>
                                <tbody>
                                    <# _.each( settings.pricing_rows, function( row, index ) {
                                        var serviceTypeKey = view.getRepeaterSettingKey( 'service_type', 'pricing_rows', index );
                                        var serviceBadgeKey = view.getRepeaterSettingKey( 'service_badge', 'pricing_rows', index );
                                        var pricesKey = view.getRepeaterSettingKey( 'prices', 'pricing_rows', index );
                                        var ctaTextKey = view.getRepeaterSettingKey( 'cta_text', 'pricing_rows', index );
                                        view.addRenderAttribute( serviceTypeKey, 'class', 'whipify-pricing-table__service-type' );
                                        view.addInlineEditingAttributes( serviceTypeKey, 'none' );
                                        view.addRenderAttribute( serviceBadgeKey, 'class', 'whipify-pricing-table__badge' );
                                        view.addInlineEditingAttributes( serviceBadgeKey, 'none' );
                                        view.addRenderAttribute( pricesKey, 'class', 'whipify-pricing-table__matrix-price' );
                                        view.addInlineEditingAttributes( pricesKey, 'basic' );
                                        view.addRenderAttribute( ctaTextKey, 'class', 'whipify-pricing-table__button' );
                                        if ( row.cta_url && row.cta_url.url ) {
                                            view.addRenderAttribute( ctaTextKey, 'href', row.cta_url.url );
                                        }
                                        view.addInlineEditingAttributes( ctaTextKey, 'none' );
                                        var prices = ( row.prices || '' ).split(/\\r\\n|\\r|\\n/);
                                    #>
                                        <tr>
                                            <th scope="row"><span {{{ view.getRenderAttributeString( serviceTypeKey ) }}}>{{{ row.service_type || '' }}}</span><# if ( row.service_badge ) { #><span {{{ view.getRenderAttributeString( serviceBadgeKey ) }}}>{{{ row.service_badge }}}</span><# } #></th>
                                            <# _.each( pricingColumns, function( column, index ) { #>
                                                <td>
                                                    <# if ( prices[index] ) { #><strong {{{ view.getRenderAttributeString( pricesKey ) }}}>{{{ cleanPricingMatrixPrice(prices[index], row.cta_text) }}}</strong><# } #>
                                                    <# if ( row.cta_url && row.cta_url.url && row.cta_text ) { #><a {{{ view.getRenderAttributeString( ctaTextKey ) }}}>{{{ row.cta_text }}}</a><# } #>
                                                </td>
                                            <# }); #>
                                        </tr>
                                    <# }); #>
                                </tbody>
                            </table>
                        </div>
                        <# if ( settings.section_footer_html ) { #>
                            <div {{{ view.getRenderAttributeString( 'section_footer_html' ) }}}>{{{ settings.section_footer_html }}}</div>
                        <# } #>
                    <# } else { #>
                    <div class="whipify-pricing-table__plans {{{ settings.source_class_name }}}">
                        <# _.each( settings.plans, function( plan, index ) {
                            var planNameKey = view.getRepeaterSettingKey( 'plan_name', 'plans', index );
                            var planDescriptionKey = view.getRepeaterSettingKey( 'plan_description', 'plans', index );
                            var planPriceKey = view.getRepeaterSettingKey( 'plan_price', 'plans', index );
                            var planIntervalKey = view.getRepeaterSettingKey( 'plan_interval', 'plans', index );
                            var planFeaturesKey = view.getRepeaterSettingKey( 'plan_features', 'plans', index );
                            var planCtaTextKey = view.getRepeaterSettingKey( 'cta_text', 'plans', index );
                            view.addInlineEditingAttributes( planNameKey, 'none' );
                            view.addInlineEditingAttributes( planDescriptionKey, 'basic' );
                            view.addInlineEditingAttributes( planPriceKey, 'none' );
                            view.addInlineEditingAttributes( planIntervalKey, 'none' );
                            view.addInlineEditingAttributes( planFeaturesKey, 'basic' );
                            view.addRenderAttribute( planCtaTextKey, 'class', 'whipify-pricing-table__button' );
                            if ( plan.cta_url && plan.cta_url.url ) {
                                view.addRenderAttribute( planCtaTextKey, 'href', plan.cta_url.url );
                            }
                            view.addInlineEditingAttributes( planCtaTextKey, 'none' );
                        #>
                            <article class="whipify-pricing-table__plan <# if ( plan.is_highlighted ) { #>is-highlighted<# } #> {{{ plan.plan_class_name }}}">
                                <# if ( plan.plan_name ) { #><h3 {{{ view.getRenderAttributeString( planNameKey ) }}}>{{{ plan.plan_name }}}</h3><# } #>
                                <# if ( plan.plan_description ) { #><p class="whipify-pricing-table__description" {{{ view.getRenderAttributeString( planDescriptionKey ) }}}>{{{ plan.plan_description }}}</p><# } #>
                                <# if ( plan.plan_price ) { #>
                                    <div class="whipify-pricing-table__price"><span {{{ view.getRenderAttributeString( planPriceKey ) }}}>{{{ plan.plan_price }}}</span><# if ( plan.plan_interval ) { #><span {{{ view.getRenderAttributeString( planIntervalKey ) }}}>{{{ plan.plan_interval }}}</span><# } #></div>
                                <# } #>
                                <# if ( plan.plan_features ) { #>
                                    <ul class="whipify-pricing-table__features" {{{ view.getRenderAttributeString( planFeaturesKey ) }}}>
                                        <# _.each( plan.plan_features.split(/\\r\\n|\\r|\\n/), function( feature ) { if ( feature.trim() ) { #>
                                            <li>{{{ feature.trim() }}}</li>
                                        <# } }); #>
                                    </ul>
                                <# } #>
                                <# if ( plan.cta_url && plan.cta_url.url && plan.cta_text ) { #>
                                    <a {{{ view.getRenderAttributeString( planCtaTextKey ) }}}>{{{ plan.cta_text }}}</a>
                                <# } #>
                            </article>
                        <# }); #>
                    </div>
                    <# if ( settings.section_footer_html ) { #>
                        <div {{{ view.getRenderAttributeString( 'section_footer_html' ) }}}>{{{ settings.section_footer_html }}}</div>
                    <# } #>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Testimonial_Grid_Widget_V139')
) {
    class Whipify_Elementor_Testimonial_Grid_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_testimonial_grid';
        }

        public function get_title() {
            return __('Whipify Testimonial Grid', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-testimonial-carousel';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('quote_text', array(
                'label' => __('Quote', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('person_name', array(
                'label' => __('Name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('person_title', array(
                'label' => __('Title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('rating', array(
                'label' => __('Rating', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('testimonial_class_name', array(
                'label' => __('Source testimonial classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('testimonials', array(
                'label' => __('Testimonials', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ person_name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-testimonial-grid__title');

            echo '<section class="whipify-testimonial-grid">';
            echo '<div class="whipify-testimonial-grid__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-testimonial-grid__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-testimonial-grid__cards' . esc_attr($source_classes) . '">';
            foreach (($settings['testimonials'] ?? array()) as $testimonial) {
                $testimonial_classes = !empty($testimonial['testimonial_class_name']) ? ' ' . $testimonial['testimonial_class_name'] : '';
                echo '<article class="whipify-testimonial-grid__card' . esc_attr($testimonial_classes) . '">';

                if (!empty($testimonial['rating'])) {
                    echo '<div class="whipify-testimonial-grid__rating">' . esc_html($testimonial['rating']) . '</div>';
                }

                if (!empty($testimonial['quote_text'])) {
                    echo '<blockquote>' . esc_html($testimonial['quote_text']) . '</blockquote>';
                }

                echo '<div class="whipify-testimonial-grid__person">';
                if (!empty($testimonial['image']['url'])) {
                    echo '<img src="' . esc_url($testimonial['image']['url']) . '" alt="' . esc_attr($testimonial['image']['alt'] ?? '') . '">';
                }
                echo '<div>';
                if (!empty($testimonial['person_name'])) {
                    echo '<h3>' . esc_html($testimonial['person_name']) . '</h3>';
                }
                if (!empty($testimonial['person_title'])) {
                    echo '<p>' . esc_html($testimonial['person_title']) . '</p>';
                }
                echo '</div></div></article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-testimonial-grid">
                <div class="whipify-testimonial-grid__inner">
                    <# if ( settings.section_title ) { #>
                        <h2 class="whipify-testimonial-grid__title">{{{ settings.section_title }}}</h2>
                    <# } #>
                    <# if ( settings.section_intro ) { #>
                        <p class="whipify-testimonial-grid__intro">{{{ settings.section_intro }}}</p>
                    <# } #>
                    <div class="whipify-testimonial-grid__cards {{{ settings.source_class_name }}}">
                        <# _.each( settings.testimonials, function( testimonial ) { #>
                            <article class="whipify-testimonial-grid__card {{{ testimonial.testimonial_class_name }}}">
                                <# if ( testimonial.rating ) { #><div class="whipify-testimonial-grid__rating">{{{ testimonial.rating }}}</div><# } #>
                                <# if ( testimonial.quote_text ) { #><blockquote>{{{ testimonial.quote_text }}}</blockquote><# } #>
                                <div class="whipify-testimonial-grid__person">
                                    <# if ( testimonial.image && testimonial.image.url ) { #>
                                        <img src="{{ testimonial.image.url }}" alt="{{ testimonial.image.alt || '' }}">
                                    <# } #>
                                    <div>
                                        <# if ( testimonial.person_name ) { #><h3>{{{ testimonial.person_name }}}</h3><# } #>
                                        <# if ( testimonial.person_title ) { #><p>{{{ testimonial.person_title }}}</p><# } #>
                                    </div>
                                </div>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Cta_Section_Widget_V139')
) {
    class Whipify_Elementor_Cta_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_cta_section';
        }

        public function get_title() {
            return __('Whipify CTA Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-call-to-action';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('eyebrow_text', array(
                'label' => __('Eyebrow', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('heading_text', array(
                'label' => __('Heading', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('body_text', array(
                'label' => __('Body', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('primary_button_text', array(
                'label' => __('Primary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('primary_button_url', array(
                'label' => __('Primary link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('secondary_button_text', array(
                'label' => __('Secondary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('secondary_button_url', array(
                'label' => __('Secondary link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('heading_text', 'none');
            $this->add_render_attribute('heading_text', 'class', 'whipify-cta-section__heading');

            echo '<section class="whipify-cta-section' . esc_attr($source_classes) . '">';
            echo '<div class="whipify-cta-section__inner">';
            echo '<div class="whipify-cta-section__copy">';

            if (!empty($settings['eyebrow_text'])) {
                echo '<div class="whipify-cta-section__eyebrow">' . esc_html($settings['eyebrow_text']) . '</div>';
            }

            if (!empty($settings['heading_text'])) {
                echo '<h2 ' . $this->get_render_attribute_string('heading_text') . '>' . esc_html($settings['heading_text']) . '</h2>';
            }

            if (!empty($settings['body_text'])) {
                echo '<p class="whipify-cta-section__body">' . esc_html($settings['body_text']) . '</p>';
            }

            echo '<div class="whipify-cta-section__actions">';
            if (!empty($settings['primary_button_url']['url']) && !empty($settings['primary_button_text'])) {
                echo '<a class="whipify-cta-section__button is-primary" href="' . esc_url($settings['primary_button_url']['url']) . '">' . esc_html($settings['primary_button_text']) . '</a>';
            }
            if (!empty($settings['secondary_button_url']['url']) && !empty($settings['secondary_button_text'])) {
                echo '<a class="whipify-cta-section__button is-secondary" href="' . esc_url($settings['secondary_button_url']['url']) . '">' . esc_html($settings['secondary_button_text']) . '</a>';
            }
            echo '</div></div>';

            if (!empty($settings['image']['url'])) {
                echo '<div class="whipify-cta-section__media"><img src="' . esc_url($settings['image']['url']) . '" alt="' . esc_attr($settings['image']['alt'] ?? '') . '"></div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-cta-section {{{ settings.source_class_name }}}">
                <div class="whipify-cta-section__inner">
                    <div class="whipify-cta-section__copy">
                        <# if ( settings.eyebrow_text ) { #><div class="whipify-cta-section__eyebrow">{{{ settings.eyebrow_text }}}</div><# } #>
                        <# if ( settings.heading_text ) { #><h2 class="whipify-cta-section__heading">{{{ settings.heading_text }}}</h2><# } #>
                        <# if ( settings.body_text ) { #><p class="whipify-cta-section__body">{{{ settings.body_text }}}</p><# } #>
                        <div class="whipify-cta-section__actions">
                            <# if ( settings.primary_button_url && settings.primary_button_url.url && settings.primary_button_text ) { #>
                                <a class="whipify-cta-section__button is-primary" href="{{ settings.primary_button_url.url }}">{{{ settings.primary_button_text }}}</a>
                            <# } #>
                            <# if ( settings.secondary_button_url && settings.secondary_button_url.url && settings.secondary_button_text ) { #>
                                <a class="whipify-cta-section__button is-secondary" href="{{ settings.secondary_button_url.url }}">{{{ settings.secondary_button_text }}}</a>
                            <# } #>
                        </div>
                    </div>
                    <# if ( settings.image && settings.image.url ) { #>
                        <div class="whipify-cta-section__media"><img src="{{ settings.image.url }}" alt="{{ settings.image.alt || '' }}"></div>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Stats_Section_Widget_V139')
) {
    class Whipify_Elementor_Stats_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_stats_section';
        }

        public function get_title() {
            return __('Whipify Stats Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-counter';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('stat_value', array(
                'label' => __('Value', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('stat_label', array(
                'label' => __('Label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('stat_description', array(
                'label' => __('Description', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('stat_class_name', array(
                'label' => __('Source stat classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('stats', array(
                'label' => __('Stats', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ stat_label }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-stats-section__title');

            echo '<section class="whipify-stats-section">';
            echo '<div class="whipify-stats-section__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-stats-section__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-stats-section__grid' . esc_attr($source_classes) . '">';
            foreach (($settings['stats'] ?? array()) as $stat) {
                $stat_classes = !empty($stat['stat_class_name']) ? ' ' . $stat['stat_class_name'] : '';
                echo '<article class="whipify-stats-section__item' . esc_attr($stat_classes) . '">';
                if (!empty($stat['stat_value'])) {
                    echo '<div class="whipify-stats-section__value">' . esc_html($stat['stat_value']) . '</div>';
                }
                if (!empty($stat['stat_label'])) {
                    echo '<h3>' . esc_html($stat['stat_label']) . '</h3>';
                }
                if (!empty($stat['stat_description'])) {
                    echo '<p>' . esc_html($stat['stat_description']) . '</p>';
                }
                echo '</article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-stats-section">
                <div class="whipify-stats-section__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-stats-section__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-stats-section__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-stats-section__grid {{{ settings.source_class_name }}}">
                        <# _.each( settings.stats, function( stat ) { #>
                            <article class="whipify-stats-section__item {{{ stat.stat_class_name }}}">
                                <# if ( stat.stat_value ) { #><div class="whipify-stats-section__value">{{{ stat.stat_value }}}</div><# } #>
                                <# if ( stat.stat_label ) { #><h3>{{{ stat.stat_label }}}</h3><# } #>
                                <# if ( stat.stat_description ) { #><p>{{{ stat.stat_description }}}</p><# } #>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Team_Grid_Widget_V139')
) {
    class Whipify_Elementor_Team_Grid_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_team_grid';
        }

        public function get_title() {
            return __('Whipify Team Grid', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-person';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('member_name', array(
                'label' => __('Name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('member_role', array(
                'label' => __('Role', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('member_bio', array(
                'label' => __('Bio', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('member_class_name', array(
                'label' => __('Source member classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('members', array(
                'label' => __('Members', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ member_name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-team-grid__title');

            echo '<section class="whipify-team-grid">';
            echo '<div class="whipify-team-grid__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-team-grid__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-team-grid__grid' . esc_attr($source_classes) . '">';
            foreach (($settings['members'] ?? array()) as $member) {
                $member_classes = !empty($member['member_class_name']) ? ' ' . $member['member_class_name'] : '';
                echo '<article class="whipify-team-grid__member' . esc_attr($member_classes) . '">';
                if (!empty($member['image']['url'])) {
                    echo '<img src="' . esc_url($member['image']['url']) . '" alt="' . esc_attr($member['image']['alt'] ?? '') . '">';
                }
                if (!empty($member['member_name'])) {
                    echo '<h3>' . esc_html($member['member_name']) . '</h3>';
                }
                if (!empty($member['member_role'])) {
                    echo '<p class="whipify-team-grid__role">' . esc_html($member['member_role']) . '</p>';
                }
                if (!empty($member['member_bio'])) {
                    echo '<p class="whipify-team-grid__bio">' . esc_html($member['member_bio']) . '</p>';
                }
                echo '</article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-team-grid">
                <div class="whipify-team-grid__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-team-grid__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-team-grid__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-team-grid__grid {{{ settings.source_class_name }}}">
                        <# _.each( settings.members, function( member ) { #>
                            <article class="whipify-team-grid__member {{{ member.member_class_name }}}">
                                <# if ( member.image && member.image.url ) { #><img src="{{ member.image.url }}" alt="{{ member.image.alt || '' }}"><# } #>
                                <# if ( member.member_name ) { #><h3>{{{ member.member_name }}}</h3><# } #>
                                <# if ( member.member_role ) { #><p class="whipify-team-grid__role">{{{ member.member_role }}}</p><# } #>
                                <# if ( member.member_bio ) { #><p class="whipify-team-grid__bio">{{{ member.member_bio }}}</p><# } #>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Logo_Cloud_Widget_V139')
) {
    class Whipify_Elementor_Logo_Cloud_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_logo_cloud';
        }

        public function get_title() {
            return __('Whipify Logo Cloud', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-gallery-grid';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('logo_name', array(
                'label' => __('Logo name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('logo_image', array(
                'label' => __('Logo image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('logo_class_name', array(
                'label' => __('Source logo classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('logos', array(
                'label' => __('Logos', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ logo_name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-logo-cloud__title');

            echo '<section class="whipify-logo-cloud">';
            echo '<div class="whipify-logo-cloud__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-logo-cloud__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-logo-cloud__grid' . esc_attr($source_classes) . '">';
            foreach (($settings['logos'] ?? array()) as $logo) {
                $logo_classes = !empty($logo['logo_class_name']) ? ' ' . $logo['logo_class_name'] : '';
                echo '<article class="whipify-logo-cloud__item' . esc_attr($logo_classes) . '">';
                if (!empty($logo['logo_image']['url'])) {
                    echo '<img src="' . esc_url($logo['logo_image']['url']) . '" alt="' . esc_attr($logo['logo_image']['alt'] ?? '') . '">';
                }
                if (!empty($logo['logo_name'])) {
                    echo '<h3>' . esc_html($logo['logo_name']) . '</h3>';
                }
                echo '</article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-logo-cloud">
                <div class="whipify-logo-cloud__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-logo-cloud__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-logo-cloud__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-logo-cloud__grid {{{ settings.source_class_name }}}">
                        <# _.each( settings.logos, function( logo ) { #>
                            <article class="whipify-logo-cloud__item {{{ logo.logo_class_name }}}">
                                <# if ( logo.logo_image && logo.logo_image.url ) { #><img src="{{ logo.logo_image.url }}" alt="{{ logo.logo_image.alt || '' }}"><# } #>
                                <# if ( logo.logo_name ) { #><h3>{{{ logo.logo_name }}}</h3><# } #>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Faq_Section_Widget_V139')
) {
    class Whipify_Elementor_Faq_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_faq_section';
        }

        public function get_title() {
            return __('Whipify FAQ Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-accordion';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('question_text', array(
                'label' => __('Question', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('answer_text', array(
                'label' => __('Answer', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));
            $repeater->add_control('item_class_name', array(
                'label' => __('Source item classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('items', array(
                'label' => __('FAQ items', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ question_text }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-faq-section__title');

            echo '<section class="whipify-faq-section">';
            echo '<div class="whipify-faq-section__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-faq-section__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-faq-section__items' . esc_attr($source_classes) . '">';
            foreach (($settings['items'] ?? array()) as $item) {
                $item_classes = !empty($item['item_class_name']) ? ' ' . $item['item_class_name'] : '';
                echo '<details class="whipify-faq-section__item' . esc_attr($item_classes) . '">';
                if (!empty($item['question_text'])) {
                    echo '<summary>' . esc_html($item['question_text']) . '</summary>';
                }
                if (!empty($item['answer_text'])) {
                    echo '<div class="whipify-faq-section__answer">' . wp_kses_post($item['answer_text']) . '</div>';
                }
                echo '</details>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-faq-section">
                <div class="whipify-faq-section__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-faq-section__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-faq-section__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-faq-section__items {{{ settings.source_class_name }}}">
                        <# _.each( settings.items, function( item ) { #>
                            <details class="whipify-faq-section__item {{{ item.item_class_name }}}">
                                <# if ( item.question_text ) { #><summary>{{{ item.question_text }}}</summary><# } #>
                                <# if ( item.answer_text ) { #><div class="whipify-faq-section__answer">{{{ item.answer_text }}}</div><# } #>
                            </details>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Lead_Form_Widget_V139')
) {
    class Whipify_Elementor_Lead_Form_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_lead_form';
        }

        public function get_title() {
            return __('Whipify Lead Form', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-form-horizontal';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('form_id', array(
                'label' => __('Whipify form ID', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('submit_text', array(
                'label' => __('Submit button text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('field_label', array(
                'label' => __('Field label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('field_type', array(
                'label' => __('Field type', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SELECT,
                'default' => 'text',
                'options' => array(
                    'text' => __('Text', 'whipify-elementor-importer'),
                    'email' => __('Email', 'whipify-elementor-importer'),
                    'tel' => __('Phone', 'whipify-elementor-importer'),
                    'textarea' => __('Textarea', 'whipify-elementor-importer'),
                    'select' => __('Select', 'whipify-elementor-importer'),
                    'number' => __('Number', 'whipify-elementor-importer'),
                ),
            ));
            $repeater->add_control('field_name', array(
                'label' => __('Field name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('field_placeholder', array(
                'label' => __('Placeholder', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('field_required', array(
                'label' => __('Required', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SWITCHER,
                'return_value' => 'yes',
                'default' => '',
            ));
            $repeater->add_control('field_options', array(
                'label' => __('Options', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One option per line for select fields.', 'whipify-elementor-importer'),
                'default' => '',
            ));
            $repeater->add_control('field_class_name', array(
                'label' => __('Source field classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('fields', array(
                'label' => __('Fields', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ field_label }}}',
                'default' => array(),
            ));

            $this->add_control('form_class_name', array(
                'label' => __('Source form classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            $form_classes = !empty($settings['form_class_name']) ? ' ' . $settings['form_class_name'] : '';
            $form_id = !empty($settings['form_id']) ? $settings['form_id'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-lead-form__title');

            echo '<section class="whipify-lead-form' . esc_attr($source_classes) . '">';
            echo '<div class="whipify-lead-form__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-lead-form__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<form class="whipify-lead-form__form' . esc_attr($form_classes) . '" data-whipify-form="needs-wiring" data-whipify-form-id="' . esc_attr($form_id) . '">';
            foreach (($settings['fields'] ?? array()) as $field) {
                $field_classes = !empty($field['field_class_name']) ? ' ' . $field['field_class_name'] : '';
                $field_name = !empty($field['field_name']) ? $field['field_name'] : sanitize_title($field['field_label'] ?? 'field');
                $required = !empty($field['field_required']) ? ' required' : '';

                echo '<label class="whipify-lead-form__field' . esc_attr($field_classes) . '">';
                if (!empty($field['field_label'])) {
                    echo '<span>' . esc_html($field['field_label']) . '</span>';
                }

                if (($field['field_type'] ?? 'text') === 'textarea') {
                    echo '<textarea name="' . esc_attr($field_name) . '" placeholder="' . esc_attr($field['field_placeholder'] ?? '') . '"' . $required . '></textarea>';
                } elseif (($field['field_type'] ?? 'text') === 'select') {
                    echo '<select name="' . esc_attr($field_name) . '"' . $required . '>';
                    $options = !empty($field['field_options']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $field['field_options']) : array();
                    foreach ($options as $option) {
                        $option = trim((string) $option);
                        if ($option === '') {
                            continue;
                        }
                        echo '<option value="' . esc_attr($option) . '">' . esc_html($option) . '</option>';
                    }
                    echo '</select>';
                } else {
                    $type = !empty($field['field_type']) ? $field['field_type'] : 'text';
                    echo '<input type="' . esc_attr($type) . '" name="' . esc_attr($field_name) . '" placeholder="' . esc_attr($field['field_placeholder'] ?? '') . '"' . $required . '>';
                }

                echo '</label>';
            }
            echo '<button type="submit" class="whipify-lead-form__submit">' . esc_html($settings['submit_text'] ?? __('Submit', 'whipify-elementor-importer')) . '</button>';
            echo '</form></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-lead-form {{{ settings.source_class_name }}}">
                <div class="whipify-lead-form__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-lead-form__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-lead-form__intro">{{{ settings.section_intro }}}</p><# } #>
                    <form class="whipify-lead-form__form {{{ settings.form_class_name }}}" data-whipify-form="needs-wiring" data-whipify-form-id="{{ settings.form_id || '' }}">
                        <# _.each( settings.fields, function( field ) { #>
                            <label class="whipify-lead-form__field {{{ field.field_class_name }}}">
                                <# if ( field.field_label ) { #><span>{{{ field.field_label }}}</span><# } #>
                                <# if ( field.field_type === 'textarea' ) { #>
                                    <textarea name="{{ field.field_name || '' }}" placeholder="{{ field.field_placeholder || '' }}"></textarea>
                                <# } else if ( field.field_type === 'select' ) { #>
                                    <select name="{{ field.field_name || '' }}">
                                        <# _.each( ( field.field_options || '' ).split(/\r\n|\r|\n/), function( option ) { if ( option.trim() ) { #>
                                            <option value="{{ option.trim() }}">{{{ option.trim() }}}</option>
                                        <# } }); #>
                                    </select>
                                <# } else { #>
                                    <input type="{{ field.field_type || 'text' }}" name="{{ field.field_name || '' }}" placeholder="{{ field.field_placeholder || '' }}">
                                <# } #>
                            </label>
                        <# }); #>
                        <button type="submit" class="whipify-lead-form__submit">{{{ settings.submit_text || 'Submit' }}}</button>
                    </form>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Hero_Section_Widget_V139')
) {
    class Whipify_Elementor_Hero_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_hero_section';
        }

        public function get_title() {
            return __('Whipify Hero Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-banner';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('eyebrow_text', array(
                'label' => __('Eyebrow', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('heading_text', array(
                'label' => __('Heading', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('body_text', array(
                'label' => __('Body', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('primary_button_text', array(
                'label' => __('Primary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('primary_button_url', array(
                'label' => __('Primary button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('secondary_button_text', array(
                'label' => __('Secondary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('secondary_button_url', array(
                'label' => __('Secondary button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('image', array(
                'label' => __('Hero image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('heading_text', 'none');
            $this->add_render_attribute('heading_text', 'class', 'whipify-hero-section__title');

            echo '<section class="whipify-hero-section' . esc_attr($source_classes) . '">';
            echo '<div class="whipify-hero-section__inner">';
            echo '<div class="whipify-hero-section__copy">';

            if (!empty($settings['eyebrow_text'])) {
                echo '<span class="whipify-hero-section__eyebrow">' . esc_html($settings['eyebrow_text']) . '</span>';
            }

            if (!empty($settings['heading_text'])) {
                echo '<h1 ' . $this->get_render_attribute_string('heading_text') . '>' . esc_html($settings['heading_text']) . '</h1>';
            }

            if (!empty($settings['body_text'])) {
                echo '<p class="whipify-hero-section__body">' . esc_html($settings['body_text']) . '</p>';
            }

            echo '<div class="whipify-hero-section__actions">';
            if (!empty($settings['primary_button_url']['url']) && !empty($settings['primary_button_text'])) {
                echo '<a class="whipify-hero-section__button whipify-hero-section__button--primary" href="' . esc_url($settings['primary_button_url']['url']) . '">' . esc_html($settings['primary_button_text']) . '</a>';
            }
            if (!empty($settings['secondary_button_url']['url']) && !empty($settings['secondary_button_text'])) {
                echo '<a class="whipify-hero-section__button whipify-hero-section__button--secondary" href="' . esc_url($settings['secondary_button_url']['url']) . '">' . esc_html($settings['secondary_button_text']) . '</a>';
            }
            echo '</div></div>';

            if (!empty($settings['image']['url'])) {
                echo '<div class="whipify-hero-section__media"><img src="' . esc_url($settings['image']['url']) . '" alt="' . esc_attr($settings['image']['alt'] ?? '') . '"></div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-hero-section {{{ settings.source_class_name }}}">
                <div class="whipify-hero-section__inner">
                    <div class="whipify-hero-section__copy">
                        <# if ( settings.eyebrow_text ) { #><span class="whipify-hero-section__eyebrow">{{{ settings.eyebrow_text }}}</span><# } #>
                        <# if ( settings.heading_text ) { #><h1 class="whipify-hero-section__title">{{{ settings.heading_text }}}</h1><# } #>
                        <# if ( settings.body_text ) { #><p class="whipify-hero-section__body">{{{ settings.body_text }}}</p><# } #>
                        <div class="whipify-hero-section__actions">
                            <# if ( settings.primary_button_url && settings.primary_button_url.url && settings.primary_button_text ) { #>
                                <a class="whipify-hero-section__button whipify-hero-section__button--primary" href="{{ settings.primary_button_url.url }}">{{{ settings.primary_button_text }}}</a>
                            <# } #>
                            <# if ( settings.secondary_button_url && settings.secondary_button_url.url && settings.secondary_button_text ) { #>
                                <a class="whipify-hero-section__button whipify-hero-section__button--secondary" href="{{ settings.secondary_button_url.url }}">{{{ settings.secondary_button_text }}}</a>
                            <# } #>
                        </div>
                    </div>
                    <# if ( settings.image && settings.image.url ) { #>
                        <div class="whipify-hero-section__media"><img src="{{ settings.image.url }}" alt="{{ settings.image.alt || '' }}"></div>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

final class Whipify_Elementor_Importer {
    const MENU_SLUG = 'whipify-elementor-importer';
    const MANIFEST_FILE = 'assets/data/elementor-pages.json';

    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'register_menu'));
        add_action('admin_post_whipify_elementor_import', array(__CLASS__, 'handle_import'));
        add_action('elementor/widgets/register', array(__CLASS__, 'register_generated_widgets'), 30);
        add_action('wp_enqueue_scripts', array(__CLASS__, 'enqueue_visual_fidelity_assets'), 99);
        add_filter('body_class', array(__CLASS__, 'add_visual_fidelity_body_class'));

        if (defined('WP_CLI') && WP_CLI) {
            WP_CLI::add_command('whipify-elementor import', array(__CLASS__, 'cli_import'));
        }
    }

    private static function is_whipify_elementor_page() {
        if (isset($_GET['elementor-preview'])) {
            return true;
        }

        if (!is_singular()) {
            return false;
        }

        $post_id = get_queried_object_id();
        if (!$post_id) {
            return false;
        }

        if (get_post_meta($post_id, '_converter_lane', true) === 'elementor-native') {
            return true;
        }

        return get_post_meta($post_id, '_elementor_edit_mode', true) === 'builder'
            && get_post_meta($post_id, '_elementor_data', true) !== '';
    }

    public static function enqueue_visual_fidelity_assets() {
        if (!self::is_whipify_elementor_page()) {
            return;
        }

        $css_path = plugin_dir_path(__FILE__) . 'assets/css/whipify-elementor-visual-fidelity.css';
        $css_overrides_path = plugin_dir_path(__FILE__) . 'assets/css/whipify-elementor-visual-fidelity-overrides.css';
        $js_path = plugin_dir_path(__FILE__) . 'assets/js/whipify-elementor-visual-fidelity.js';

        if (file_exists($css_path) && !self::has_registered_visual_fidelity_asset('style')) {
            wp_enqueue_style(
                'whipify-elementor-importer-visual-fidelity',
                plugins_url('assets/css/whipify-elementor-visual-fidelity.css', __FILE__),
                array(),
                filemtime($css_path) ?: WEI_VERSION
            );
        }

        if (file_exists($css_overrides_path)) {
            wp_enqueue_style(
                'whipify-elementor-importer-visual-fidelity-overrides',
                plugins_url('assets/css/whipify-elementor-visual-fidelity-overrides.css', __FILE__),
                array(),
                filemtime($css_overrides_path) ?: WEI_VERSION
            );
        }

        if (file_exists($js_path)) {
            wp_enqueue_script(
                'whipify-elementor-importer-visual-fidelity',
                plugins_url('assets/js/whipify-elementor-visual-fidelity.js', __FILE__),
                array(),
                filemtime($js_path) ?: WEI_VERSION,
                true
            );
        }
    }

    private static function has_registered_visual_fidelity_asset($type) {
        $registry = $type === 'script' ? wp_scripts() : wp_styles();
        $needle = $type === 'script'
            ? 'whipify-elementor-visual-fidelity.js'
            : 'whipify-elementor-visual-fidelity.css';

        if (!is_object($registry) || empty($registry->registered) || !is_array($registry->registered)) {
            return false;
        }

        foreach ($registry->registered as $asset) {
            $src = isset($asset->src) ? (string) $asset->src : '';

            if (strpos($src, $needle) !== false && strpos($src, 'whipify-elementor-importer') === false) {
                return true;
            }
        }

        return false;
    }

    public static function add_visual_fidelity_body_class($classes) {
        if (!is_array($classes)) {
            $classes = array();
        }

        if (self::is_whipify_elementor_page()) {
            $classes[] = 'whipify-elementor-visual-fidelity-mode';
        }

        return array_values(array_unique($classes));
    }

    public static function register_generated_widgets($widgets_manager) {
        if (function_exists('whipify_elementor_define_generated_widget_classes')) {
            whipify_elementor_define_generated_widget_classes();
        }

        $widget_classes = array(
            'Whipify_Elementor_Svg_Icon_Widget_V139',
            'Whipify_Elementor_Text_Fragment_Widget_V139',
            'Whipify_Elementor_Neighborhood_List_Widget_V139',
            'Whipify_Elementor_Breadcrumbs_Widget_V139',
            'Whipify_Elementor_Trust_Logo_Row_Widget_V139',
            'Whipify_Elementor_Carousel_Dots_Widget_V139',
            'Whipify_Elementor_Map_Embed_Widget_V139',
            'Whipify_Elementor_Feature_Grid_Widget_V139',
            'Whipify_Elementor_Feature_Card_Widget_V139',
            'Whipify_Elementor_Pricing_Table_Widget_V139',
            'Whipify_Elementor_Testimonial_Grid_Widget_V139',
            'Whipify_Elementor_Cta_Section_Widget_V139',
            'Whipify_Elementor_Stats_Section_Widget_V139',
            'Whipify_Elementor_Team_Grid_Widget_V139',
            'Whipify_Elementor_Logo_Cloud_Widget_V139',
            'Whipify_Elementor_Faq_Section_Widget_V139',
            'Whipify_Elementor_Lead_Form_Widget_V139',
            'Whipify_Elementor_Hero_Section_Widget_V139',
        );

        foreach ($widget_classes as $widget_class) {
            if (!class_exists($widget_class)) {
                continue;
            }

            $widget = new $widget_class();
            $widget_name = method_exists($widget, 'get_name') ? $widget->get_name() : '';

            if ($widget_name && method_exists($widgets_manager, 'unregister')) {
                $widgets_manager->unregister($widget_name);
            } elseif ($widget_name && method_exists($widgets_manager, 'unregister_widget_type')) {
                $widgets_manager->unregister_widget_type($widget_name);
            }

            if (method_exists($widgets_manager, 'register')) {
                $widgets_manager->register($widget);
            } elseif (method_exists($widgets_manager, 'register_widget_type')) {
                $widgets_manager->register_widget_type($widget);
            }
        }
    }

    public static function register_menu() {
        add_theme_page(
            __('Whipify Elementor Import', 'whipify-elementor-importer'),
            __('Whipify Elementor Import', 'whipify-elementor-importer'),
            'manage_options',
            self::MENU_SLUG,
            array(__CLASS__, 'render_page')
        );
    }

    private static function elementor_is_available() {
        return did_action('elementor/loaded') || class_exists('\\\\Elementor\\\\Plugin');
    }

    private static function manifest_path() {
        $child_manifest = trailingslashit(get_stylesheet_directory()) . self::MANIFEST_FILE;
        if (file_exists($child_manifest)) {
            return $child_manifest;
        }

        return trailingslashit(get_template_directory()) . self::MANIFEST_FILE;
    }

    private static function read_manifest() {
        $manifest_path = self::manifest_path();
        if (!file_exists($manifest_path)) {
            return new WP_Error('missing_manifest', sprintf(__('Missing Elementor manifest: %s', 'whipify-elementor-importer'), esc_html($manifest_path)));
        }

        $raw = file_get_contents($manifest_path);
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || empty($decoded['pages']) || !is_array($decoded['pages'])) {
            return new WP_Error('invalid_manifest', __('The Elementor manifest is invalid or contains no pages.', 'whipify-elementor-importer'));
        }

        return $decoded;
    }

    private static function save_elementor_atomic_readiness($readiness) {
        $readiness = is_array($readiness) ? $readiness : array();
        $readiness['elementorVersion'] = defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '';
        $readiness['atomicCapable'] = defined('ELEMENTOR_VERSION') && version_compare(ELEMENTOR_VERSION, '4.0.0', '>=');
        $readiness['usesDocumentedElementorData'] = true;
        $readiness['usesAtomicInternals'] = false;

        update_option('whipify_elementor_atomic_readiness', $readiness, false);
    }

    private static function replace_theme_uri($value) {
        if (is_string($value)) {
            return str_replace('__THEME_URI__', get_stylesheet_directory_uri(), $value);
        }

        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $value[$key] = self::replace_theme_uri($item);
            }
        }

        return $value;
    }

    private static function ensure_media_functions() {
        if (!function_exists('media_sideload_image')) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
    }

    private static function sideload_media($url, $alt = '') {
        $url = esc_url_raw($url);
        if (!$url || !wp_http_validate_url($url)) {
            return 0;
        }

        $existing_id = attachment_url_to_postid($url);
        if ($existing_id) {
            return (int) $existing_id;
        }

        self::ensure_media_functions();
        $attachment_id = media_sideload_image($url, 0, null, 'id');
        if (is_wp_error($attachment_id) || !$attachment_id) {
            return 0;
        }

        if ($alt !== '') {
            update_post_meta((int) $attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt));
        }

        return (int) $attachment_id;
    }

    private static function import_elementor_media($value) {
        if (!is_array($value)) {
            return $value;
        }

        foreach (array('image', 'card_image', 'logo_image') as $image_key) {
            if (isset($value[$image_key]) && is_array($value[$image_key]) && !empty($value[$image_key]['url']) && empty($value[$image_key]['id'])) {
                $attachment_id = self::sideload_media($value[$image_key]['url'], $value[$image_key]['alt'] ?? '');
                if ($attachment_id) {
                    $value[$image_key]['id'] = $attachment_id;
                    $value[$image_key]['url'] = wp_get_attachment_url($attachment_id);
                }
            }
        }

        foreach ($value as $key => $item) {
            $value[$key] = self::import_elementor_media($item);
        }

        return $value;
    }

    private static function migrated_element_id($seed) {
        return substr(md5((string) $seed), 0, 8);
    }

    private static function migrated_elementor_widget($id, $widget_type, $settings) {
        return array(
            'id' => self::migrated_element_id($id),
            'elType' => 'widget',
            'isInner' => false,
            'widgetType' => $widget_type,
            'settings' => is_array($settings) ? $settings : array(),
            'elements' => array(),
        );
    }

    private static function migrated_elementor_container($id, $settings, $elements) {
        return array(
            'id' => self::migrated_element_id($id),
            'elType' => 'container',
            'isInner' => false,
            'settings' => array_merge(array(
                'content_width' => 'full',
                'padding' => array(
                    'unit' => 'px',
                    'top' => '0',
                    'right' => '0',
                    'bottom' => '0',
                    'left' => '0',
                    'isLinked' => true,
                ),
            ), is_array($settings) ? $settings : array()),
            'elements' => is_array($elements) ? $elements : array(),
        );
    }

    private static function migrate_feature_grid_widget_to_card_section($element) {
        $settings = is_array($element['settings'] ?? null) ? $element['settings'] : array();
        $cards = is_array($settings['cards'] ?? null) ? $settings['cards'] : array();
        if (count($cards) < 1) {
            return array($element);
        }

        $base_id = $element['id'] ?? 'feature-grid';
        $children = array();

        if (!empty($settings['section_title'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':title', 'heading', array(
                '_css_classes' => 'whipify-feature-grid__title',
                'title' => (string) $settings['section_title'],
                'header_size' => 'h2',
            ));
        }

        if (!empty($settings['section_intro'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':intro', 'text-editor', array(
                '_css_classes' => 'whipify-feature-grid__intro',
                'editor' => (string) $settings['section_intro'],
            ));
        }

        if (!empty($settings['section_body_html'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':body', 'text-editor', array(
                '_css_classes' => 'whipify-feature-grid__body-main',
                'editor' => (string) $settings['section_body_html'],
            ));
        }

        $card_widgets = array();
        foreach ($cards as $index => $card) {
            $card_widgets[] = self::migrated_elementor_widget($base_id . ':card:' . $index . ':' . ($card['card_title'] ?? ''), 'whipify_feature_card', is_array($card) ? $card : array());
        }

        $source_classes = trim((string) ($settings['source_class_name'] ?? ''));
        $children[] = self::migrated_elementor_container($base_id . ':cards', array(
            'css_classes' => trim('whipify-feature-grid__cards ' . $source_classes),
        ), $card_widgets);

        if (!empty($settings['section_footer_html'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':footer', 'text-editor', array(
                '_css_classes' => 'whipify-feature-grid__footer',
                'editor' => (string) $settings['section_footer_html'],
            ));
        }

        return array(self::migrated_elementor_container($base_id . ':section', array(
            'html_tag' => 'section',
            'css_classes' => 'whipify-feature-grid',
        ), array(
            self::migrated_elementor_container($base_id . ':inner', array(
                'css_classes' => 'whipify-feature-grid__inner',
            ), $children),
        )));
    }

    private static function upgrade_feature_grid_widgets_to_card_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        $upgraded = array();
        foreach ($elements as $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'whipify_feature_grid') {
                foreach (self::migrate_feature_grid_widget_to_card_section($element) as $replacement) {
                    $upgraded[] = $replacement;
                }
                continue;
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_feature_grid_widgets_to_card_widgets($element['elements']);
            }

            $upgraded[] = $element;
        }

        return $upgraded;
    }

    private static function is_standalone_svg_html($html) {
        $html = trim((string) $html);
        return $html !== '' && preg_match('/^\\s*<svg\\b[\\s\\S]*<\\/svg>\\s*$/i', $html);
    }

    private static function svg_attr_from_html($svg_html, $attr) {
        if (!preg_match('/<svg\\b([^>]*)>/i', (string) $svg_html, $tag_match)) {
            return '';
        }

        $attr_pattern = '/\\s' . preg_quote($attr, '/') . '\\s*=\\s*([\\\"\\'])(.*?)\\1/i';
        if (!preg_match($attr_pattern, $tag_match[1] ?? '', $attr_match)) {
            return '';
        }

        return html_entity_decode((string) ($attr_match[2] ?? ''), ENT_QUOTES, 'UTF-8');
    }

    private static function upgrade_svg_icon_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $html = $element['settings']['html'] ?? '';
                if (self::is_standalone_svg_html($html)) {
                    $element['widgetType'] = 'whipify_svg_icon';
                    $element['settings'] = array(
                        'svg_html' => (string) $html,
                        'source_class_name' => sanitize_text_field(self::svg_attr_from_html($html, 'class')),
                        'aria_label' => sanitize_text_field(self::svg_attr_from_html($html, 'aria-label')),
                    );
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_svg_icon_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function text_fragment_attr_from_attrs($attrs, $attr) {
        $attr_pattern = '/\\s' . preg_quote($attr, '/') . '\\s*=\\s*([\\\"\\'])(.*?)\\1/i';
        if (!preg_match($attr_pattern, (string) $attrs, $attr_match)) {
            return '';
        }

        return html_entity_decode((string) ($attr_match[2] ?? ''), ENT_QUOTES, 'UTF-8');
    }

    private static function text_fragment_settings_from_html($html) {
        $html = trim((string) $html);
        if (!preg_match('/^\\s*<(div|span)\\b([^>]*)>([^<]*)<\\/\\1>\\s*$/i', $html, $matches)) {
            return false;
        }

        $text = trim(wp_strip_all_tags(html_entity_decode((string) ($matches[3] ?? ''), ENT_QUOTES, 'UTF-8')));
        if ($text === '' || strlen($text) > 80) {
            return false;
        }

        $tag = strtolower((string) ($matches[1] ?? 'div')) === 'span' ? 'span' : 'div';

        return array(
            'text' => sanitize_text_field($text),
            'html_tag' => $tag,
            'source_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($matches[2] ?? '', 'class')),
        );
    }

    private static function upgrade_text_fragment_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $settings = self::text_fragment_settings_from_html($element['settings']['html'] ?? '');
                if (is_array($settings)) {
                    $element['widgetType'] = 'whipify_text_fragment';
                    $element['settings'] = $settings;
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_text_fragment_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function neighborhood_list_settings_from_html($html) {
        $html = trim((string) $html);
        if (!preg_match('/<ul\\b([^>]*)>[\\s\\S]*<\\/ul>/i', $html, $ul_match)) {
            return false;
        }

        if (!preg_match_all('/<li\\b([^>]*)>([\\s\\S]*?)<\\/li>/i', $html, $li_matches, PREG_SET_ORDER)) {
            return false;
        }

        $items = array();
        foreach ($li_matches as $li_match) {
            $item_attrs = $li_match[1] ?? '';
            $item_html = $li_match[2] ?? '';
            $link_match = array();
            preg_match('/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/i', $item_html, $link_match);
            $description_match = array();
            preg_match('/<(?:span|p|small)\\b[^>]*>([\\s\\S]*?)<\\/(?:span|p|small)>/i', $item_html, $description_match);
            $icon_match = array();
            preg_match('/<svg\\b[\\s\\S]*?<\\/svg>/i', $item_html, $icon_match);

            $name = !empty($link_match[2])
                ? trim(wp_strip_all_tags(html_entity_decode((string) $link_match[2], ENT_QUOTES, 'UTF-8')))
                : '';
            $description = !empty($description_match[1])
                ? trim(wp_strip_all_tags(html_entity_decode((string) $description_match[1], ENT_QUOTES, 'UTF-8')))
                : '';

            if ($name === '' || $description === '') {
                continue;
            }

            $items[] = array(
                'name' => sanitize_text_field($name),
                'description' => sanitize_text_field($description),
                'url' => array('url' => esc_url_raw(self::text_fragment_attr_from_attrs($link_match[1] ?? '', 'href'))),
                'icon_html' => !empty($icon_match[0]) ? whipify_elementor_kses_svg($icon_match[0]) : '',
                'item_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($item_attrs, 'class')),
            );
        }

        if (count($items) < 2) {
            return false;
        }

        return array(
            'items' => $items,
            'source_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($ul_match[1] ?? '', 'class')),
        );
    }

    private static function upgrade_neighborhood_list_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $settings = self::neighborhood_list_settings_from_html($element['settings']['html'] ?? '');
                if (is_array($settings)) {
                    $element['widgetType'] = 'whipify_neighborhood_list';
                    $element['settings'] = $settings;
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_neighborhood_list_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function remaining_html_widget_upgrade($html) {
        $html = trim((string) $html);

        if (preg_match('/<nav\\b[^>]*tf-elementor-breadcrumbs[\\s\\S]*?<\\/nav>/i', $html)) {
            preg_match('/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/i', $html, $home_match);
            preg_match('/<span\\b[^>]*tf-elementor-breadcrumbs__current[^>]*>([\\s\\S]*?)<\\/span>/i', $html, $current_match);
            return array(
                'widgetType' => 'whipify_breadcrumbs',
                'settings' => array(
                    'home_label' => sanitize_text_field(wp_strip_all_tags(html_entity_decode((string) ($home_match[2] ?? 'Home'), ENT_QUOTES, 'UTF-8'))),
                    'home_url' => array('url' => esc_url_raw(self::text_fragment_attr_from_attrs($home_match[1] ?? '', 'href') ?: '/')),
                    'current_label' => sanitize_text_field(wp_strip_all_tags(html_entity_decode((string) ($current_match[1] ?? ''), ENT_QUOTES, 'UTF-8'))),
                ),
            );
        }

        if (preg_match('/<iframe\\b([^>]*)>/i', $html, $iframe_match)) {
            $src = self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'src');
            if (preg_match('/google\\.com\\/maps\\/embed/i', $src)) {
                return array(
                    'widgetType' => 'whipify_map_embed',
                    'settings' => array(
                        'iframe_src' => esc_url_raw($src),
                        'title' => sanitize_text_field(self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'title') ?: 'Map'),
                        'height' => sanitize_text_field(self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'height') ?: '400'),
                        'source_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'class')),
                    ),
                );
            }
        }

        if (preg_match('/<div\\b([^>]*)>([\\s\\S]*?)<\\/div>/i', $html, $div_match)) {
            $div_attrs = $div_match[1] ?? '';
            $div_body = $div_match[2] ?? '';
            $div_classes = self::text_fragment_attr_from_attrs($div_attrs, 'class');

            if (preg_match_all('/<a\\b([^>]*)>([\\s\\S]*?<img\\b[^>]*>[\\s\\S]*?)<\\/a>/i', $div_body, $logo_matches, PREG_SET_ORDER)) {
                $logos = array();
                foreach ($logo_matches as $logo_match) {
                    preg_match('/<img\\b([^>]*)>/i', $logo_match[2] ?? '', $img_match);
                    $image_url = self::text_fragment_attr_from_attrs($img_match[1] ?? '', 'src');
                    if ($image_url === '') continue;
                    $logos[] = array(
                        'link_url' => array('url' => esc_url_raw(self::text_fragment_attr_from_attrs($logo_match[1] ?? '', 'href'))),
                        'image_url' => esc_url_raw($image_url),
                        'image_alt' => sanitize_text_field(self::text_fragment_attr_from_attrs($img_match[1] ?? '', 'alt')),
                        'link_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($logo_match[1] ?? '', 'class')),
                        'image_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($img_match[1] ?? '', 'class')),
                    );
                }
                if (!empty($logos)) {
                    return array(
                        'widgetType' => 'whipify_trust_logo_row',
                        'settings' => array(
                            'logos' => $logos,
                            'source_class_name' => sanitize_text_field($div_classes),
                        ),
                    );
                }
            }

            if (preg_match_all('/<button\\b([^>]*)>/i', $div_body, $dot_matches, PREG_SET_ORDER) && count($dot_matches) >= 2 && preg_match('/justify-center|gap-/', $div_classes)) {
                $active_index = 1;
                foreach ($dot_matches as $dot_index => $dot_match) {
                    if (preg_match('/\\bbg-primary\\b/', self::text_fragment_attr_from_attrs($dot_match[1] ?? '', 'class'))) {
                        $active_index = $dot_index + 1;
                        break;
                    }
                }
                return array(
                    'widgetType' => 'whipify_carousel_dots',
                    'settings' => array(
                        'dot_count' => count($dot_matches),
                        'active_index' => $active_index,
                        'source_class_name' => sanitize_text_field($div_classes),
                    ),
                );
            }
        }

        return false;
    }

    private static function upgrade_remaining_html_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $upgrade = self::remaining_html_widget_upgrade($element['settings']['html'] ?? '');
                if (is_array($upgrade)) {
                    $element['widgetType'] = $upgrade['widgetType'];
                    $element['settings'] = $upgrade['settings'];
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_remaining_html_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function sanitize_status($status) {
        $status = sanitize_key($status ?: 'publish');
        return in_array($status, array('publish', 'draft', 'private', 'pending'), true) ? $status : 'publish';
    }

    private static function sanitize_page_template($template) {
        $template = is_string($template) ? sanitize_text_field($template) : 'default';
        return $template !== '' ? $template : 'default';
    }

    private static function page_source_id($page, $slug) {
        if (!empty($page['sourceId'])) {
            return sanitize_text_field($page['sourceId']);
        }

        if (!empty($page['path'])) {
            return sanitize_text_field($page['path']);
        }

        return $slug;
    }

    private static function page_import_hash($page) {
        return hash('sha256', wp_json_encode(array(
            'path' => $page['path'] ?? '',
            'title' => $page['title'] ?? '',
            'elements' => $page['elementorData'] ?? array(),
            'settings' => $page['pageSettings'] ?? array(),
        )));
    }

    private static function create_or_update_page($page) {
        $title = sanitize_text_field($page['title'] ?? 'Untitled');
        $slug = sanitize_title($page['slug'] ?? $title);
        if ($slug === 'home') {
            $slug = 'front-page';
        }

        $status = self::sanitize_status($page['status'] ?? 'publish');
        $page_template = self::sanitize_page_template($page['pageTemplate'] ?? 'default');
        $existing = get_page_by_path($slug, OBJECT, 'page');
        $postarr = array(
            'post_title' => $title,
            'post_name' => $slug,
            'post_type' => 'page',
            'post_status' => $status,
            'post_content' => '',
            'page_template' => $page_template,
        );

        if ($existing) {
            $postarr['ID'] = $existing->ID;
            $post_id = wp_update_post(wp_slash($postarr), true);
        } else {
            $post_id = wp_insert_post(wp_slash($postarr), true);
        }

        if (is_wp_error($post_id) || !$post_id) {
            return $post_id;
        }

        update_post_meta($post_id, '_wp_page_template', $page_template);

        return (int) $post_id;
    }

    private static function create_or_update_template($template) {
        $title = sanitize_text_field($template['title'] ?? 'Untitled Template');
        $slug = sanitize_title($template['slug'] ?? $title);
        $existing = get_page_by_path($slug, OBJECT, 'elementor_library');
        $postarr = array(
            'post_title' => $title,
            'post_name' => $slug,
            'post_type' => 'elementor_library',
            'post_status' => 'publish',
            'post_content' => '',
        );

        if ($existing) {
            $postarr['ID'] = $existing->ID;
            $post_id = wp_update_post(wp_slash($postarr), true);
        } else {
            $post_id = wp_insert_post(wp_slash($postarr), true);
        }

        return is_wp_error($post_id) ? $post_id : (int) $post_id;
    }

    private static function save_converter_provenance($post_id, $page) {
        $slug = sanitize_title($page['slug'] ?? get_post_field('post_name', $post_id));
        update_post_meta($post_id, '_converter_lane', 'elementor-native');
        update_post_meta($post_id, '_converter_source_id', self::page_source_id($page, $slug));
        update_post_meta($post_id, '_converter_import_hash', self::page_import_hash($page));
        update_post_meta($post_id, '_converter_version', WEI_VERSION);
    }

    private static function save_template_provenance($post_id, $template) {
        update_post_meta($post_id, '_converter_lane', 'elementor-native');
        update_post_meta($post_id, '_converter_template_source_id', sanitize_text_field($template['sourceId'] ?? get_post_field('post_name', $post_id)));
        update_post_meta($post_id, '_converter_import_hash', hash('sha256', wp_json_encode($template)));
        update_post_meta($post_id, '_converter_version', WEI_VERSION);
    }

    private static function save_elementor_meta_fallback($post_id, $page, $elementor_data, $page_settings) {
        update_post_meta($post_id, '_elementor_edit_mode', 'builder');
        update_post_meta($post_id, '_elementor_template_type', sanitize_key($page['templateType'] ?? 'wp-page'));
        update_post_meta($post_id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
        update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($elementor_data)));
        update_post_meta($post_id, '_elementor_page_settings', $page_settings);
        self::save_converter_provenance($post_id, $page);
    }

    private static function save_elementor_document($post_id, $page) {
        $elementor_data = self::replace_theme_uri($page['elementorData'] ?? array());
        $page_settings = self::replace_theme_uri($page['pageSettings'] ?? array());
        $elementor_data = self::import_elementor_media($elementor_data);
        $elementor_data = self::upgrade_feature_grid_widgets_to_card_widgets($elementor_data);
        $elementor_data = self::upgrade_svg_icon_widgets($elementor_data);
        $elementor_data = self::upgrade_text_fragment_widgets($elementor_data);
        $elementor_data = self::upgrade_neighborhood_list_widgets($elementor_data);
        $elementor_data = self::upgrade_remaining_html_widgets($elementor_data);
        $page_settings = self::import_elementor_media($page_settings);

        if (class_exists('\\\\Elementor\\\\Plugin') && isset(\\Elementor\\Plugin::$instance->documents)) {
            $document = \\Elementor\\Plugin::$instance->documents->get($post_id);

            if ($document && method_exists($document, 'save')) {
                if (method_exists($document, 'set_is_built_with_elementor')) {
                    $document->set_is_built_with_elementor(true);
                } else {
                    update_post_meta($post_id, '_elementor_edit_mode', 'builder');
                }

                if (method_exists($document, 'is_editable_by_current_user') && !$document->is_editable_by_current_user()) {
                    self::save_elementor_meta_fallback($post_id, $page, $elementor_data, $page_settings);
                    self::clear_elementor_cache($post_id);

                    return false;
                }

                $saved = $document->save(array(
                    'elements' => $elementor_data,
                    'settings' => $page_settings,
                ));

                if ($saved) {
                    update_post_meta($post_id, '_elementor_template_type', sanitize_key($page['templateType'] ?? 'wp-page'));
                    update_post_meta($post_id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
                    self::save_converter_provenance($post_id, $page);
                    self::clear_elementor_cache($post_id);

                    return true;
                }
            }
        }

        self::save_elementor_meta_fallback($post_id, $page, $elementor_data, $page_settings);
        self::clear_elementor_cache($post_id);

        return false;
    }

    private static function save_elementor_template($post_id, $template) {
        $elementor_data = self::import_elementor_media(self::replace_theme_uri($template['elementorData'] ?? array()));
        $elementor_data = self::upgrade_feature_grid_widgets_to_card_widgets($elementor_data);
        $elementor_data = self::upgrade_svg_icon_widgets($elementor_data);
        $elementor_data = self::upgrade_text_fragment_widgets($elementor_data);
        $elementor_data = self::upgrade_neighborhood_list_widgets($elementor_data);
        $elementor_data = self::upgrade_remaining_html_widgets($elementor_data);
        $page_settings = self::import_elementor_media(self::replace_theme_uri($template['pageSettings'] ?? array()));

        update_post_meta($post_id, '_elementor_edit_mode', 'builder');
        update_post_meta($post_id, '_elementor_template_type', sanitize_key($template['templateType'] ?? 'section'));
        update_post_meta($post_id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
        update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($elementor_data)));
        update_post_meta($post_id, '_elementor_page_settings', $page_settings);
        self::save_template_provenance($post_id, $template);
        self::clear_elementor_cache($post_id);
    }

    private static function clear_elementor_cache($post_id) {
        if (class_exists('\\\\Elementor\\\\Core\\\\Files\\\\CSS\\\\Post')) {
            $css_file = new \\Elementor\\Core\\Files\\CSS\\Post($post_id);
            $css_file->delete();
        }

        if (class_exists('\\\\Elementor\\\\Plugin') && isset(\\Elementor\\Plugin::$instance->files_manager)) {
            \\Elementor\\Plugin::$instance->files_manager->clear_cache();
        }
    }

    private static function elementor_edit_url($post_id) {
        return admin_url('post.php?post=' . $post_id . '&action=elementor');
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', 'whipify-elementor-importer'));
        }

        $manifest = self::read_manifest();
        $page_count = is_wp_error($manifest) ? 0 : count($manifest['pages']);
        $template_count = is_wp_error($manifest) ? 0 : count($manifest['templates'] ?? array());
        $imported = isset($_GET['imported']) ? absint($_GET['imported']) : 0;
        $skipped = isset($_GET['skipped']) ? absint($_GET['skipped']) : 0;
        $templates = isset($_GET['templates']) ? absint($_GET['templates']) : 0;
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Whipify Elementor Import', 'whipify-elementor-importer'); ?></h1>
            <?php if ($imported > 0 || $skipped > 0 || $templates > 0) : ?>
                <div class="notice notice-success"><p><?php echo esc_html(sprintf(__('Imported %1$d Elementor page(s), %2$d template(s). Skipped %3$d item(s).', 'whipify-elementor-importer'), $imported, $templates, $skipped)); ?></p></div>
            <?php endif; ?>
            <?php if (!self::elementor_is_available()) : ?>
                <div class="notice notice-error"><p><?php esc_html_e('Elementor must be installed and active before importing Elementor-native pages.', 'whipify-elementor-importer'); ?></p></div>
            <?php endif; ?>
            <?php if (is_wp_error($manifest)) : ?>
                <div class="notice notice-error"><p><?php echo esc_html($manifest->get_error_message()); ?></p></div>
            <?php else : ?>
                <p><?php echo esc_html(sprintf(__('Ready to import %1$d Elementor page(s) and %2$d template(s) from the active theme.', 'whipify-elementor-importer'), $page_count, $template_count)); ?></p>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <?php wp_nonce_field('whipify_elementor_import'); ?>
                    <input type="hidden" name="action" value="whipify_elementor_import" />
                    <?php submit_button(__('Import Elementor Pages', 'whipify-elementor-importer')); ?>
                </form>
            <?php endif; ?>
        </div>
        <?php
    }

    public static function handle_import() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', 'whipify-elementor-importer'));
        }

        check_admin_referer('whipify_elementor_import');

        if (!self::elementor_is_available()) {
            wp_die(__('Elementor must be active before importing.', 'whipify-elementor-importer'));
        }

        $result = self::import_pages();
        if (is_wp_error($result)) {
            wp_die(esc_html($result->get_error_message()));
        }

        wp_safe_redirect(add_query_arg(array(
            'page' => self::MENU_SLUG,
            'imported' => $result['imported'],
            'skipped' => $result['skipped'],
            'templates' => $result['templates'],
        ), admin_url('themes.php')));
        exit;
    }

    public static function cli_import() {
        if (!self::elementor_is_available()) {
            WP_CLI::error(__('Elementor must be active before importing.', 'whipify-elementor-importer'));
        }

        $result = self::import_pages();
        if (is_wp_error($result)) {
            WP_CLI::error($result->get_error_message());
        }

        WP_CLI::success(sprintf(
            'Imported %1$d Elementor page(s), %2$d template(s). Skipped %3$d item(s).',
            $result['imported'],
            $result['templates'],
            $result['skipped']
        ));
    }

    private static function import_templates($manifest) {
        $count = 0;
        $skipped = 0;
        foreach (($manifest['templates'] ?? array()) as $template) {
            $post_id = self::create_or_update_template($template);

            if (is_wp_error($post_id) || !$post_id) {
                $skipped++;
                continue;
            }

            self::save_elementor_template($post_id, $template);
            $count++;
        }

        return array(
            'imported' => $count,
            'skipped' => $skipped,
        );
    }

    private static function import_pages() {
        $manifest = self::read_manifest();
        if (is_wp_error($manifest)) {
            return $manifest;
        }

        self::save_elementor_atomic_readiness($manifest['elementorAtomicReadiness'] ?? array());

        $count = 0;
        $skipped = 0;
        foreach ($manifest['pages'] as $page) {
            $post_id = self::create_or_update_page($page);

            if (is_wp_error($post_id) || !$post_id) {
                $skipped++;
                continue;
            }

            self::save_elementor_document($post_id, $page);

            if (($page['path'] ?? '') === '/' || get_post_field('post_name', $post_id) === 'front-page') {
                update_option('show_on_front', 'page');
                update_option('page_on_front', $post_id);
            }

            $edit_url = self::elementor_edit_url($post_id);
            update_post_meta($post_id, '_converter_elementor_edit_url', esc_url_raw($edit_url));

            $count++;
        }

        $template_result = self::import_templates($manifest);

        return array(
            'imported' => $count,
            'templates' => $template_result['imported'],
            'skipped' => $skipped + $template_result['skipped'],
        );
    }
}

Whipify_Elementor_Importer::init();
`,
  'assets/css/whipify-elementor-visual-fidelity.css': `body.whipify-elementor-visual-fidelity-mode {
  --primary: 180 100% 25%;
  --accent: 14 100% 60%;
  --foreground: 222 47% 11%;
  --muted-foreground: 215 16% 47%;
  --border: 214 32% 91%;
}

.whipify-elementor-visual-fidelity-mode .elementor,
.whipify-elementor-visual-fidelity-mode .elementor-section-wrap,
.whipify-elementor-visual-fidelity-mode .elementor-widget-wrap {
  width: 100%;
}

.whipify-elementor-visual-fidelity-mode .elementor .mx-auto,
.whipify-elementor-visual-fidelity-mode .elementor .e-con.mx-auto {
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .text-center,
.whipify-elementor-visual-fidelity-mode .elementor .e-con.text-center {
  text-align: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.items-center {
  align-items: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.justify-center {
  justify-content: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid,
.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="grid-cols"] {
  --display: grid;
  display: grid !important;
  grid-auto-rows: auto !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex:not(.flex-col):not(.flex-col-reverse):not(.flex-row-reverse) {
  --flex-direction: row;
  flex-direction: row !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex,
.whipify-elementor-visual-fidelity-mode .elementor-widget-button:not(.w-full) {
  display: inline-flex !important;
  width: auto !important;
  max-width: max-content !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex .elementor-button,
.whipify-elementor-visual-fidelity-mode .elementor-widget-button:not(.w-full) .elementor-button {
  width: auto !important;
  max-width: max-content !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.bg-primary .elementor-button {
  background: hsl(var(--primary)) !important;
  color: #fff !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.bg-accent .elementor-button {
  background: hsl(var(--accent)) !important;
  color: #fff !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.px-8 .elementor-button {
  padding-left: 2rem !important;
  padding-right: 2rem !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.px-10 .elementor-button {
  padding-left: 2.5rem !important;
  padding-right: 2.5rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section {
  padding: 5rem 1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__inner,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__inner,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section__inner,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section__inner {
  width: 100%;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__title,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__title,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section__title,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section__title {
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.03em;
  text-align: center;
  max-width: 1368px;
  margin: 0 auto 1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__intro,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__intro,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section__intro,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section__intro {
  font-size: 1.125rem;
  line-height: 1.555;
  color: hsl(var(--muted-foreground));
  text-align: center;
  max-width: 48rem;
  margin: 0 auto 3rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-7xl) .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.lg\\:grid-cols-4:not(.mb-8)) .whipify-feature-grid__intro {
  max-width: 42rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-12) .whipify-feature-grid__intro {
  max-width: 1368px;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-8) .whipify-feature-grid__intro {
  max-width: 48rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.max-w-6xl {
  max-width: 72rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__title {
  margin-bottom: 0.75rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__intro {
  line-height: 1.555 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body--source-layout .flex.items-start p.text-sm {
  margin-bottom: 0 !important;
  line-height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  color: hsl(var(--primary));
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__icon svg {
  width: 2.5rem !important;
  height: 2.5rem !important;
  display: block;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card > .elementor-widget-container,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card .whipify-feature-grid__card {
  height: 100%;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon {
  display: flex !important;
  width: 6rem !important;
  height: 6rem !important;
  margin: 0 auto 1rem !important;
  border-radius: 9999px !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon svg {
  width: 3rem !important;
  height: 3rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card h3 {
  font-size: 1.25rem;
  line-height: 1.35;
  font-weight: 700;
  margin: 0 0 0.75rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__card h3,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__card h3 {
  line-height: 1.4 !important;
  margin-bottom: 0.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card p {
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.leading-relaxed {
  line-height: 1.625 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-1 {
  margin-bottom: 0.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-2 {
  margin-bottom: 0.5rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p:last-child {
  margin-bottom: 0 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body .relative.overflow-hidden.rounded-2xl img {
  display: block !important;
  width: 100% !important;
  aspect-ratio: 1 / 1 !important;
  object-fit: cover !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card a {
  color: hsl(var(--primary)) !important;
  font-weight: 600 !important;
  text-decoration: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix-wrap {
  width: 100%;
  max-width: 64rem;
  margin: 0 auto 3rem;
  overflow-x: auto;
  border-radius: 0.75rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
  background: #fff;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix th,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix td {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
  text-align: center;
  vertical-align: middle;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix thead th {
  background: hsl(var(--primary));
  color: #fff;
  font-weight: 800;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody th {
  text-align: left;
  font-weight: 800;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 11.75rem !important;
  height: 2.75rem !important;
  margin-top: 0.75rem !important;
  padding: 0.75rem 1.5rem !important;
  border-radius: 0.375rem !important;
  background: hsl(var(--accent)) !important;
  color: #fff !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-align: center !important;
  text-decoration: none !important;
  box-shadow: 0 10px 22px rgba(255, 102, 51, 0.22) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro {
  margin-bottom: 2rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main {
  max-width: 42rem !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  margin-bottom: 2rem !important;
  border-left: 4px solid hsl(var(--primary, 174 100% 29%)) !important;
  border-radius: 0 0.75rem 0.75rem 0 !important;
  background: linear-gradient(135deg, hsl(var(--primary, 174 100% 29%) / 0.05), hsl(var(--accent, 14 100% 60%) / 0.05)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p {
  line-height: 1.45 !important;
  margin-bottom: 0.75rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p:last-child {
  color: hsl(var(--primary, 174 100% 29%)) !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-bottom: 0 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p.text-lg.text-muted-foreground.leading-relaxed.mb-12.text-center,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br + h3 {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 1.5rem !important;
  padding: 0 !important;
  margin-bottom: 3rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card {
  display: grid !important;
  grid-template-columns: 1.25rem minmax(0, 1fr) !important;
  column-gap: 0.75rem !important;
  row-gap: 0 !important;
  align-items: start !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  box-shadow: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon {
  grid-column: 1 !important;
  grid-row: 1 !important;
  width: 1.25rem !important;
  height: 1.25rem !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0.15rem 0 0 !important;
  padding: 0 !important;
  background: transparent !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon svg {
  width: 1.25rem !important;
  height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card h3 {
  grid-column: 2 !important;
  margin: 0 0 0.75rem !important;
  font-size: 1.125rem !important;
  line-height: 1.55 !important;
  font-weight: 700 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card p {
  grid-column: 1 / -1 !important;
  margin: 0 !important;
  font-size: 0.875rem !important;
  line-height: 1.55 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-faq-section__items,
.whipify-elementor-visual-fidelity-mode .elementor .max-w-3xl {
  max-width: 48rem !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-faq-section__item:not([open]) .whipify-faq-section__answer,
.whipify-elementor-visual-fidelity-mode .elementor .whipify-faq-answer {
  display: none;
}

.whipify-elementor-visual-fidelity-mode .elementor .is-whipify-faq-open > .whipify-faq-answer {
  display: block;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-prev,
.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-next {
  position: absolute;
  top: 50%;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  border: 2px solid hsl(var(--foreground));
  background: #fff;
  color: hsl(var(--foreground));
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.16);
  transform: translateY(-50%);
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-prev {
  left: -1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-next {
  right: -1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-floating-pricing {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
  z-index: 50;
  display: none;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-floating-pricing a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 11.875rem;
  height: 3rem;
  padding: 0.75rem 2rem;
  border-radius: 9999px;
  background: hsl(var(--accent));
  color: #fff;
  font-size: 1.125rem;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 20px 35px rgba(255, 102, 51, 0.28);
}

@media (min-width: 768px) {
  .whipify-elementor-visual-fidelity-mode .whipify-elementor-floating-pricing {
    display: block;
  }
}
`,
  'assets/css/whipify-elementor-visual-fidelity-overrides.css': `body.whipify-elementor-visual-fidelity-mode .tf-elementor-breadcrumbs {
  margin: 1rem auto 0 !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .elementor-widget-whipify_map_embed iframe.whipify-map-embed,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .elementor-widget-whipify_map_embed iframe.whipify-map-embed {
  pointer-events: none !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .elementor-widget-whipify_map_embed,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .elementor-widget-whipify_map_embed {
  cursor: pointer !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .whipify-feature-grid__card--editor-target,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .whipify-feature-grid__card--editor-target {
  cursor: pointer !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .is-whipify-editor-selected-card,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .is-whipify-editor-selected-card {
  outline: 2px solid #39bdf8 !important;
  outline-offset: 4px !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element[class~="md:w-1/3"]:not(#whipify-width-authority),
body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:w-1/3"]:not(#whipify-width-authority) {
  width: 33.333333% !important;
  flex-basis: 33.333333% !important;
  max-width: 33.333333% !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__footer > button[class*="inline-flex"],
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__footer > a[class*="inline-flex"] {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 2.75rem !important;
  padding: 0.5rem 2rem !important;
  margin-left: auto !important;
  margin-right: auto !important;
  border: 0 !important;
  border-radius: 0.375rem !important;
  background: hsl(var(--primary, 180 100% 25%)) !important;
  color: #fff !important;
  font-weight: 700 !important;
  line-height: 1.25rem !important;
  text-decoration: none !important;
  box-shadow: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 11.75rem !important;
  height: 2.75rem !important;
  margin-top: 0.75rem !important;
  padding: 0.75rem 1.5rem !important;
  border-radius: 0.375rem !important;
  background: hsl(var(--accent, 14 100% 60%)) !important;
  color: #fff !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-align: center !important;
  text-decoration: none !important;
  box-shadow: 0 10px 22px rgba(255, 102, 51, 0.22) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__title {
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__intro {
  line-height: 1.555 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body--source-layout .flex.items-start p.text-sm {
  margin-bottom: 0 !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__intro {
  line-height: 1.555 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-7xl) .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.lg\\:grid-cols-4:not(.mb-8)) .whipify-feature-grid__intro {
  max-width: 42rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-12) .whipify-feature-grid__intro {
  max-width: 1368px !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-8) .whipify-feature-grid__intro {
  max-width: 48rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.leading-relaxed {
  line-height: 1.625 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-1 {
  margin-bottom: 0.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-2 {
  margin-bottom: 0.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p:last-child {
  margin-bottom: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body .relative.overflow-hidden.rounded-2xl img {
  display: block !important;
  width: 100% !important;
  aspect-ratio: 1 / 1 !important;
  object-fit: cover !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card .whipify-feature-grid__card {
  height: 100%;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon {
  display: flex !important;
  width: 6rem !important;
  height: 6rem !important;
  margin: 0 auto 1rem !important;
  border-radius: 9999px !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon svg {
  width: 3rem !important;
  height: 3rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__card h3,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__card h3 {
  line-height: 1.4 !important;
  margin-bottom: 0.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__inner,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__title,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro {
  margin-bottom: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main {
  max-width: 42rem !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  margin-bottom: 2rem !important;
  border-left: 4px solid hsl(var(--primary, 174 100% 29%)) !important;
  border-radius: 0 0.75rem 0.75rem 0 !important;
  background: linear-gradient(135deg, hsl(var(--primary, 174 100% 29%) / 0.05), hsl(var(--accent, 14 100% 60%) / 0.05)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p {
  line-height: 1.45 !important;
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p:last-child {
  color: hsl(var(--primary, 174 100% 29%)) !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-bottom: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p.text-lg.text-muted-foreground.leading-relaxed.mb-12.text-center,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br + h3 {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 1.5rem !important;
  padding: 0 !important;
  margin-bottom: 3rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card {
  display: grid !important;
  grid-template-columns: 1.25rem minmax(0, 1fr) !important;
  column-gap: 0.75rem !important;
  row-gap: 0 !important;
  align-items: start !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  box-shadow: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon {
  grid-column: 1 !important;
  grid-row: 1 !important;
  width: 1.25rem !important;
  height: 1.25rem !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0.15rem 0 0 !important;
  padding: 0 !important;
  background: transparent !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon svg {
  width: 1.25rem !important;
  height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card h3 {
  grid-column: 2 !important;
  margin: 0 0 0.75rem !important;
  font-size: 1.125rem !important;
  line-height: 1.55 !important;
  font-weight: 700 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card p {
  grid-column: 1 / -1 !important;
  margin: 0 !important;
  font-size: 0.875rem !important;
  line-height: 1.55 !important;
}
`,
  'assets/js/whipify-elementor-visual-fidelity.js': `(function() {
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  if (!window.setupWhipifyElementorFaqs) {
    window.setupWhipifyElementorFaqs = function setupWhipifyElementorFaqs(root) {
      root = root || document;

      root.querySelectorAll('.whipify-faq-section details[open]').forEach(function(details) {
        details.removeAttribute('open');
      });

      root.querySelectorAll('.elementor .max-w-3xl .elementor-widget-button.w-full, .elementor .max-w-3xl .elementor-widget-button[class*="justify-between"]').forEach(function(trigger) {
        if (trigger.dataset.whipifyFaqReady === 'true') return;
        var link = trigger.querySelector('a, button');
        if (!link) return;

        var answer = trigger.nextElementSibling;
        if (!answer || answer.classList.contains('whipify-faq-answer')) return;
        answer.classList.add('whipify-faq-answer');
        link.setAttribute('aria-expanded', 'false');
        trigger.dataset.whipifyFaqReady = 'true';

        link.addEventListener('click', function(event) {
          event.preventDefault();
          var open = trigger.classList.toggle('is-whipify-faq-open');
          link.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      });
    };
  }

  {
    window.setupWhipifyElementorCarousels = function setupWhipifyElementorCarousels(root) {
      root = root || document;
      var tracks = Array.prototype.slice.call(root.querySelectorAll('.elementor .e-con.overflow-hidden > .e-con.flex, .elementor .e-con.overflow-hidden > .elementor-element.e-con'));

      tracks.forEach(function(track) {
        var cards = Array.prototype.slice.call(track.children).filter(function(child) {
          return /flex-shrink-0|md:w-1\\/3|min-w-\\[/.test(child.className || '');
        });
        if (cards.length < 2) return;

        var clip = track.parentElement;
        var shell = clip && clip.parentElement ? clip.parentElement : track.parentElement;
        var visible = window.matchMedia('(min-width: 768px)').matches ? 3 : 1;
        var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '24') || 24;
        var maxIndex = Math.max(0, cards.length - visible);
        var index = Math.min(parseInt(track.dataset.whipifyCarouselIndex || '0', 10) || 0, maxIndex);
        var prevBtn = null;
        var nextBtn = null;

        if (clip) {
          clip.style.overflow = 'hidden';
          clip.style.overflowX = 'hidden';
        }

        if (shell && maxIndex > 0) {
          if (window.getComputedStyle(shell).position === 'static') {
            shell.style.position = 'relative';
          }

          prevBtn = shell.querySelector('.whipify-elementor-carousel-prev');
          nextBtn = shell.querySelector('.whipify-elementor-carousel-next');

          if (!prevBtn) {
            prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'whipify-elementor-carousel-prev';
            prevBtn.setAttribute('aria-label', 'Previous reviews');
            prevBtn.innerHTML = '&#8249;';
            shell.appendChild(prevBtn);
          }

          if (!nextBtn) {
            nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'whipify-elementor-carousel-next';
            nextBtn.setAttribute('aria-label', 'Next reviews');
            nextBtn.innerHTML = '&#8250;';
            shell.appendChild(nextBtn);
          }
        }

        track.style.display = 'flex';
        track.style.flexDirection = 'row';
        track.style.transition = 'transform 500ms ease';
        track.style.willChange = 'transform';

        cards.forEach(function(card) {
          var width = visible === 1 ? '100%' : (100 / visible) + '%';
          card.style.flex = '0 0 ' + width;
          card.style.width = width;
          card.style.maxWidth = width;
        });

        function render(nextIndex) {
          index = Math.max(0, Math.min(maxIndex, nextIndex));
          track.dataset.whipifyCarouselIndex = String(index);
          var cardWidth = cards[0] ? cards[0].getBoundingClientRect().width : 0;
          track.style.transform = 'translateX(' + (index * -1 * (cardWidth + gap)) + 'px)';
          if (prevBtn) prevBtn.disabled = index === 0;
          if (nextBtn) nextBtn.disabled = index === maxIndex;
        }

        if (prevBtn && prevBtn.dataset.whipifyCarouselReady !== 'true') {
          prevBtn.dataset.whipifyCarouselReady = 'true';
          prevBtn.addEventListener('click', function(event) {
            event.preventDefault();
            render(index - 1);
          });
        }

        if (nextBtn && nextBtn.dataset.whipifyCarouselReady !== 'true') {
          nextBtn.dataset.whipifyCarouselReady = 'true';
          nextBtn.addEventListener('click', function(event) {
            event.preventDefault();
            render(index + 1);
          });
        }

        render(index);
      });
    };
  }

  {
    window.setupWhipifyElementorFeatureGridEditability = function setupWhipifyElementorFeatureGridEditability(root) {
      root = root || document;
      var isElementorPreview = window.location.search.indexOf('elementor-preview=') !== -1 || document.body.classList.contains('elementor-editor-active');
      if (!isElementorPreview) return;

      function annotate(el, key, toolbar) {
        if (!el || !key) return;
        el.classList.add('elementor-inline-editing');
        el.setAttribute('data-elementor-setting-key', key);
        el.setAttribute('data-elementor-inline-editing-toolbar', toolbar || 'basic');
      }

      function compactText(el) {
        return ((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();
      }

      function getParentDocument() {
        try {
          return window.parent && window.parent !== window ? window.parent.document : null;
        } catch (error) {
          return null;
        }
      }

      function focusRepeaterControl(row, target) {
        if (!row) return;
        var selector = 'input[data-setting="card_title"]';

        if (target && target.closest && target.closest('.whipify-feature-grid__card-text')) {
          selector = 'textarea[data-setting="card_text"]';
        } else if (target && target.closest && target.closest('.whipify-feature-grid__body')) {
          selector = '.elementor-control-card_body_html textarea, textarea[data-setting="card_text"], input[data-setting="card_title"]';
        } else if (target && target.closest && target.closest('a')) {
          selector = 'input[data-setting="card_link_text"]';
        }

        var control = row.querySelector(selector) || row.querySelector('input[data-setting="card_title"]');
        if (!control) return;
        if (typeof control.focus === 'function') control.focus();
        if (typeof control.select === 'function' && control.tagName === 'INPUT') control.select();
      }

      function syncFeatureGridCardToPanel(card, index, target) {
        var parentDocument = getParentDocument();
        if (!parentDocument) return false;

        var panelTitle = (parentDocument.querySelector('#elementor-panel-header-title') || {}).textContent || '';
        if (panelTitle.indexOf('Whipify Feature Grid') === -1) return false;

        var rows = Array.prototype.slice.call(parentDocument.querySelectorAll('#elementor-panel .elementor-control-cards .elementor-repeater-fields'));
        if (!rows.length) return false;

        var cardTitle = card.getAttribute('data-whipify-card-title') || compactText(card.querySelector('.whipify-feature-grid__card-title') || card.querySelector('h3'));
        var row = rows[index] || null;
        var rowTitle = row ? compactText(row.querySelector('.elementor-repeater-row-item-title')) : '';

        if (cardTitle && rowTitle && rowTitle !== cardTitle) {
          row = rows.filter(function(candidate) {
            return compactText(candidate.querySelector('.elementor-repeater-row-item-title')) === cardTitle;
          })[0] || row;
        }

        if (!row) return false;

        var controls = row.querySelector('.elementor-repeater-row-controls');
        var controlsHidden = !controls || window.parent.getComputedStyle(controls).display === 'none' || controls.offsetHeight === 0;
        var rowButton = row.querySelector('.elementor-repeater-row-item-title');
        if (controlsHidden && rowButton) {
          rowButton.click();
        }

        if (typeof row.scrollIntoView === 'function') {
          row.scrollIntoView({ block: 'center', inline: 'nearest' });
        }

        window.setTimeout(function() {
          focusRepeaterControl(row, target);
        }, 80);

        Array.prototype.slice.call(document.querySelectorAll('.is-whipify-editor-selected-card')).forEach(function(activeCard) {
          if (activeCard !== card) activeCard.classList.remove('is-whipify-editor-selected-card');
        });
        card.classList.add('is-whipify-editor-selected-card');

        return true;
      }

      function scheduleCardPanelSync(card, index, target) {
        [120, 400, 900].forEach(function(delay) {
          window.setTimeout(function() {
            syncFeatureGridCardToPanel(card, index, target);
          }, delay);
        });
      }

      Array.prototype.slice.call(root.querySelectorAll('.elementor-widget-whipify_feature_grid .whipify-feature-grid')).forEach(function(grid) {
        grid.setAttribute('data-whipify-widget-version', '1.3.19');
        annotate(grid.querySelector('.whipify-feature-grid__title'), 'section_title', 'none');
        annotate(grid.querySelector('.whipify-feature-grid__intro'), 'section_intro', 'basic');
        annotate(grid.querySelector('.whipify-feature-grid__body-main'), 'section_body_html', 'advanced');
        annotate(grid.querySelector('.whipify-feature-grid__footer'), 'section_footer_html', 'advanced');

        Array.prototype.slice.call(grid.querySelectorAll('.whipify-feature-grid__card')).forEach(function(card, index) {
          var prefix = 'cards.' + index + '.';
          var cardTitle = compactText(card.querySelector('.whipify-feature-grid__card-title') || card.querySelector('h3'));
          card.setAttribute('data-whipify-card-index', String(index));
          card.setAttribute('data-whipify-card-title', cardTitle);
          card.classList.add('whipify-feature-grid__card--editor-target');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-label', cardTitle ? 'Edit card: ' + cardTitle : 'Edit Feature Grid card');

          if (card.dataset.whipifyCardPanelSyncReady !== 'true') {
            card.dataset.whipifyCardPanelSyncReady = 'true';
            card.addEventListener('click', function(event) {
              scheduleCardPanelSync(card, index, event.target);
            });
            card.addEventListener('keydown', function(event) {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              scheduleCardPanelSync(card, index, event.target);
            });
          }

          annotate(card.querySelector('.whipify-feature-grid__card-title') || card.querySelector('h3'), prefix + 'card_title', 'none');
          annotate(card.querySelector('.whipify-feature-grid__card-text'), prefix + 'card_text', 'basic');
          annotate(card.querySelector('.whipify-feature-grid__body'), prefix + 'card_body_html', 'advanced');

          var links = Array.prototype.slice.call(card.querySelectorAll('a'));
          var cardLink = links.filter(function(link) {
            return (link.textContent || '').trim() !== '';
          }).pop();
          annotate(cardLink, prefix + 'card_link_text', 'none');
        });
      });
    };

    window.observeWhipifyElementorFeatureGridEditability = function observeWhipifyElementorFeatureGridEditability() {
      if (window.__whipifyFeatureGridEditabilityObserverReady === 'true') return;
      if (!('MutationObserver' in window) || !document.body) return;
      window.__whipifyFeatureGridEditabilityObserverReady = 'true';

      var pending = false;
      var observer = new MutationObserver(function(mutations) {
        var shouldRefresh = mutations.some(function(mutation) {
          return Array.prototype.slice.call(mutation.addedNodes || []).some(function(node) {
            if (!node || node.nodeType !== 1) return false;
            return (node.matches && node.matches('.elementor-widget-whipify_feature_grid, .whipify-feature-grid, .whipify-feature-grid__card')) ||
              (node.querySelector && node.querySelector('.elementor-widget-whipify_feature_grid, .whipify-feature-grid, .whipify-feature-grid__card'));
          });
        });

        if (!shouldRefresh || pending) return;
        pending = true;
        window.setTimeout(function() {
          pending = false;
          window.setupWhipifyElementorFeatureGridEditability(document);
        }, 80);
      });

      observer.observe(document.body, { childList: true, subtree: true });
    };

    window.bootWhipifyElementorFeatureGridEditability = function bootWhipifyElementorFeatureGridEditability() {
      window.setupWhipifyElementorFeatureGridEditability(document);
      window.observeWhipifyElementorFeatureGridEditability();
      [250, 750, 2500, 5000, 9000, 15000].forEach(function(delay) {
        window.setTimeout(function() {
          window.setupWhipifyElementorFeatureGridEditability(document);
        }, delay);
      });
    };
  }

  if (!window.setupWhipifyElementorFloatingPricingCta) {
    window.setupWhipifyElementorFloatingPricingCta = function setupWhipifyElementorFloatingPricingCta(root) {
      root = root || document;
      if (root.querySelector('.whipify-elementor-floating-pricing')) return;
      var pricingTarget = document.getElementById('pricing') || document.querySelector('[id*="pricing" i], a[href="#pricing"], a[href*="#pricing"]');
      var contactTarget = document.getElementById('contact') || document.querySelector('[id*="contact" i], a[href="#contact"], a[href*="#contact"]');
      if (!pricingTarget || !contactTarget) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'whipify-elementor-floating-pricing';

      var link = document.createElement('a');
      link.href = '#contact';
      link.textContent = 'See Pricing';
      link.setAttribute('aria-label', 'See pricing and booking options');
      wrapper.appendChild(link);
      document.body.appendChild(wrapper);
    };
  }

  {
    window.setupWhipifyElementorCapturedStatCounters = function setupWhipifyElementorCapturedStatCounters(root) {
      root = root || document;
      var bodyText = ((document.body && document.body.textContent) || '').replace(/\\s+/g, ' ');
      if (bodyText.indexOf('Duty Cleaners') === -1 || bodyText.indexOf('Homes Cleaned') === -1) return;

      var expected = {
        'Years in Business': '10+',
        'Homes Cleaned': '5,000+',
        'Five-Star Reviews': '500+',
        'Customer Retention': '95%',
        'Team Members': '15+',
        'Satisfaction Guarantee': '100%'
      };

      function compactText(el) {
        return ((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();
      }

      function findLabel(label) {
        return Array.prototype.slice.call(root.querySelectorAll('p, span, div, h3, h4')).filter(function(el) {
          return compactText(el) === label;
        }).sort(function(a, b) {
          var aRect = a.getBoundingClientRect();
          var bRect = b.getBoundingClientRect();
          return (aRect.width * aRect.height) - (bRect.width * bRect.height);
        })[0] || null;
      }

      function formatValue(rawValue, targetText) {
        var rounded = Math.round(Math.max(0, rawValue));
        var formatted = rounded.toLocaleString('en-US');
        if (targetText.indexOf('%') !== -1) return formatted + '%';
        if (targetText.indexOf('+') !== -1) return formatted + '+';
        return formatted;
      }

      function animateValue(valueEl) {
        if (!valueEl || valueEl.dataset.whipifyStatAnimated === 'true') return;
        valueEl.dataset.whipifyStatAnimated = 'true';
        var targetText = valueEl.dataset.whipifyStatTargetText || '';
        var targetNumber = parseFloat(valueEl.dataset.whipifyStatTargetNumber || '0') || 0;
        var startTime = window.performance && performance.now ? performance.now() : Date.now();
        var duration = 2200;

        function tick(now) {
          var elapsed = Math.max(0, (now || Date.now()) - startTime);
          var progress = Math.min(1, elapsed / duration);
          var eased = progress;
          valueEl.textContent = progress >= 1 ? targetText : formatValue(targetNumber * eased, targetText);
          if (progress < 1) {
            window.requestAnimationFrame(tick);
          }
        }

        window.requestAnimationFrame(tick);
      }

      function shouldAnimateNow(card) {
        if (!card || !card.getBoundingClientRect) return true;
        var rect = card.getBoundingClientRect();
        return rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
      }

      Object.keys(expected).forEach(function(label) {
        var labelEl = findLabel(label);
        if (!labelEl) return;

        var card = labelEl.parentElement;
        for (var depth = 0; card && depth < 5; depth += 1) {
          var cardText = compactText(card);
          if (cardText.indexOf(label) !== -1 && /\\d/.test(cardText)) break;
          card = card.parentElement;
        }
        if (!card) return;

        var valueEl = Array.prototype.slice.call(card.children).find(function(child) {
          var value = compactText(child);
          return value !== label && /\\d/.test(value) && value.length <= 14;
        });

        if (valueEl) {
          var targetText = expected[label];
          var targetNumber = parseFloat(targetText.replace(/[^0-9.]/g, '')) || 0;
          var shouldAnimateStat = label !== 'Team Members' && label !== 'Satisfaction Guarantee';
          valueEl.dataset.whipifyStatTargetText = targetText;
          valueEl.dataset.whipifyStatTargetNumber = String(targetNumber);

          if (!shouldAnimateStat) {
            valueEl.dataset.whipifyStatAnimated = 'true';
            valueEl.textContent = targetText;
            return;
          }

          if (valueEl.dataset.whipifyStatAnimated !== 'true') {
            valueEl.textContent = formatValue(0, targetText);
          }

          if (shouldAnimateNow(card)) {
            animateValue(valueEl);
          } else if ('IntersectionObserver' in window && valueEl.dataset.whipifyStatObserved !== 'true') {
            valueEl.dataset.whipifyStatObserved = 'true';
            var observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                animateValue(valueEl);
                observer.disconnect();
              });
            }, { threshold: 0.25 });
            observer.observe(card);
          }
        }
      });

      Array.prototype.slice.call(root.querySelectorAll('p, div, span')).forEach(function(el) {
        if (el.childNodes.length !== 1 || el.childNodes[0].nodeType !== 3) return;
        el.textContent = el.textContent.replace('10 years ,', '10 years,');
      });
    };
  }

  ready(function() {
    document.body.classList.add('whipify-elementor-visual-fidelity-mode');
    window.setupWhipifyElementorFaqs(document);
    window.setupWhipifyElementorCarousels(document);
    window.bootWhipifyElementorFeatureGridEditability();
    window.setupWhipifyElementorFloatingPricingCta(document);
    window.setupWhipifyElementorCapturedStatCounters(document);
    window.addEventListener('resize', function() {
      window.setupWhipifyElementorCarousels(document);
      window.setupWhipifyElementorFeatureGridEditability(document);
      window.setupWhipifyElementorCapturedStatCounters(document);
    });
  });
})();`,
  'README.txt': `Whipify Elementor Importer
===========================

This plugin imports Elementor-native page data generated by Theme Factory AI.

Install order:
1. Install and activate Elementor.
2. Install and activate the generated WordPress theme.
3. Install and activate this importer plugin.
4. Go to Appearance > Whipify Elementor Import.
5. Click "Import Elementor Pages".

The importer creates real WordPress pages and saves Elementor page bodies through Elementor's document lifecycle when available.
It also bundles the generic Whipify Elementor visual-fidelity CSS/JS fallback so no site-specific patch plugin is required for converted Elementor pages.

Primary persistence:
- wp_posts.post_type = page
- _elementor_edit_mode = builder
- _elementor_data = generated Elementor JSON
- _converter_lane = elementor-native

It does not modify the Platinum Gutenberg export mode.
`,
};

const ELEMENTOR_PLUGIN_BOOTSTRAP = ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'] || '';
const WIDGET_HELPERS_START = ELEMENTOR_PLUGIN_BOOTSTRAP.indexOf("if (!function_exists('whipify_elementor_allowed_svg_html'))");
const WIDGET_CLASSES_START = ELEMENTOR_PLUGIN_BOOTSTRAP.indexOf("if (\n    class_exists('\\\\Elementor\\\\Widget_Base')");
const WIDGET_DEFINITIONS_START = WIDGET_HELPERS_START >= 0 ? WIDGET_HELPERS_START : WIDGET_CLASSES_START;
const WIDGET_DEFINITIONS_END = ELEMENTOR_PLUGIN_BOOTSTRAP.indexOf('\nfinal class Whipify_Elementor_Importer');
const WIDGET_DEFINITIONS = WIDGET_DEFINITIONS_START >= 0 && WIDGET_DEFINITIONS_END > WIDGET_DEFINITIONS_START
  ? ELEMENTOR_PLUGIN_BOOTSTRAP.slice(WIDGET_DEFINITIONS_START, WIDGET_DEFINITIONS_END).trim()
  : '';

const GENERATED_WIDGET_CLASSES = [
  'Whipify_Elementor_Svg_Icon_Widget_V139',
  'Whipify_Elementor_Text_Fragment_Widget_V139',
  'Whipify_Elementor_Neighborhood_List_Widget_V139',
  'Whipify_Elementor_Breadcrumbs_Widget_V139',
  'Whipify_Elementor_Trust_Logo_Row_Widget_V139',
  'Whipify_Elementor_Carousel_Dots_Widget_V139',
  'Whipify_Elementor_Map_Embed_Widget_V139',
  'Whipify_Elementor_Feature_Grid_Widget_V139',
  'Whipify_Elementor_Feature_Card_Widget_V139',
  'Whipify_Elementor_Pricing_Table_Widget_V139',
  'Whipify_Elementor_Testimonial_Grid_Widget_V139',
  'Whipify_Elementor_Cta_Section_Widget_V139',
  'Whipify_Elementor_Stats_Section_Widget_V139',
  'Whipify_Elementor_Team_Grid_Widget_V139',
  'Whipify_Elementor_Logo_Cloud_Widget_V139',
  'Whipify_Elementor_Faq_Section_Widget_V139',
  'Whipify_Elementor_Lead_Form_Widget_V139',
  'Whipify_Elementor_Hero_Section_Widget_V139',
];

const GENERATED_WIDGET_CLASS_ARRAY_PHP = GENERATED_WIDGET_CLASSES
  .map((widgetClass) => `            '${widgetClass}',`)
  .join('\n');

export const WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP = `<?php
/**
 * Whipify generated Elementor widget runtime.
 *
 * This file is bundled with Elementor theme exports so imported pages can
 * render generated custom widgets even if the importer plugin is inactive or
 * Elementor loads after the importer plugin bootstrap.
 */
if (!defined('ABSPATH')) exit;

if (!function_exists('whipify_elementor_define_generated_widget_classes')) {
    function whipify_elementor_define_generated_widget_classes() {
${WIDGET_DEFINITIONS}
    }
}

if (!class_exists('Whipify_Elementor_Widget_Runtime')) {
    final class Whipify_Elementor_Widget_Runtime {
        public static function init() {
            add_action('elementor/widgets/register', array(__CLASS__, 'register_generated_widgets'), 20);
        }

        public static function register_generated_widgets($widgets_manager) {
            if (function_exists('whipify_elementor_define_generated_widget_classes')) {
                whipify_elementor_define_generated_widget_classes();
            }

            $widget_classes = array(
${GENERATED_WIDGET_CLASS_ARRAY_PHP}
            );

            foreach ($widget_classes as $widget_class) {
                if (!class_exists($widget_class)) {
                    continue;
                }

                $widget = new $widget_class();
                $widget_name = method_exists($widget, 'get_name') ? $widget->get_name() : '';

                if ($widget_name && method_exists($widgets_manager, 'get_widget_types')) {
                    $registered_widgets = $widgets_manager->get_widget_types();
                    if (is_array($registered_widgets) && isset($registered_widgets[$widget_name])) {
                        continue;
                    }
                }

                if (method_exists($widgets_manager, 'register')) {
                    $widgets_manager->register($widget);
                } elseif (method_exists($widgets_manager, 'register_widget_type')) {
                    $widgets_manager->register_widget_type($widget);
                }
            }
        }
    }
}

Whipify_Elementor_Widget_Runtime::init();
`;

ELEMENTOR_IMPORTER_PLUGIN_FILES['includes/whipify-elementor-widgets.php'] = WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP;
