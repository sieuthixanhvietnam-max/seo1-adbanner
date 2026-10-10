<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

/**
 * Registers and handles the [seo1_banner] shortcode.
 *
 * Usage examples:
 *   [seo1_banner placement="button" position="1"]
 *   [seo1_banner placement="slider"]
 *   [seo1_banner placement="toplist"]
 *   [seo1_banner placement="brands"]
 *   [seo1_banner placement="catfish" site="nganh-g"]
 *   [seo1_banner placement="popup" delay="5"]
 */
final class SEO1_Shortcode
{
    public static function register(): void
    {
        add_shortcode('seo1_banner', [self::class, 'render']);
    }

    /**
     * @param array<string,string>|string $atts
     */
    public static function render(array|string $atts): string
    {
        $atts = shortcode_atts(
            [
                'placement' => 'button',
                'position'  => '',    // empty = all positions
                'site'      => '',
                'delay'     => '',    // popup delay override (seconds)
                'type'      => '',    // button style: "login" (btn1) | "register" (btn2)
                'brand'     => '',    // button only: brand_id to render directly
            ],
            is_array($atts) ? $atts : [],
            'seo1_banner'
        );

        $settings = seo1_adbanner_settings();

        // Dữ liệu được đọc 1 lần/request và dùng chung cho mọi shortcode trên trang
        $ctx = seo1_adbanner_context((string) $atts['site']);
        if (!$ctx) {
            return defined('WP_DEBUG') && WP_DEBUG
                ? self::error(__('SEO1 AdBanner: Could not fetch data from API.', 'seo1-adbanner'))
                : '';
        }

        $site_data  = $ctx['site_data'];
        $brand_urls = $ctx['brand_urls'];
        $renderer   = new SEO1_Renderer((int) $settings['rotate_interval'], $ctx['tracking_urls']);
        $placement     = sanitize_key((string) $atts['placement']);

        // Special placements: toplist and brands are not slot-based
        if ($placement === 'toplist') {
            return $renderer->render_toplist($site_data['toplist'] ?? [], $brand_urls);
        }

        if ($placement === 'brands') {
            return $renderer->render_brands($site_data['brands'] ?? [], $brand_urls);
        }

        $slot_key = 'banners_' . $placement;
        $slots    = $site_data[$slot_key] ?? [];

        if (empty($slots)) {
            return '';
        }

        // Filter by position if specified
        $position = $atts['position'] !== '' ? (int) $atts['position'] : 0;
        if ($position > 0) {
            $slots = array_values(array_filter($slots, fn($s) => (int) ($s['position'] ?? 0) === $position));
        }

        if (empty($slots) && ($placement !== 'button' || $atts['brand'] === '')) {
            return '';
        }

        $extra = [];
        if ($atts['delay'] !== '') {
            $extra['delay'] = (int) $atts['delay'];
        } elseif (isset($settings['popup_delay'])) {
            $extra['delay'] = (int) $settings['popup_delay'];
        }

        // Button: pass brand + type directly to renderer (no slot filtering)
        if ($placement === 'button') {
            if ($atts['brand'] !== '') {
                $extra['brand'] = sanitize_key($atts['brand']);
            }
            if ($atts['type'] !== '') {
                $extra['type'] = sanitize_key($atts['type']);
            }
        }

        return $renderer->render_placement($placement, $slots, $brand_urls, $extra);
    }

    private static function error(string $message): string
    {
        if (!current_user_can('manage_options')) {
            return '';
        }
        return '<p class="seo1-error" style="color:red;font-size:13px;">' . esc_html($message) . '</p>';
    }
}
