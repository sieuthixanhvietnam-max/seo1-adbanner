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
        $api_url  = SEO1_Remote_Config::get_api_url();
        if (!$api_url) {
            return self::error(__('SEO1 AdBanner: API URL is not configured.', 'seo1-adbanner'));
        }

        $site_id = seo1_adbanner_resolve_site_id((string) $atts['site']);
        if (!$site_id) {
            return self::error(__('SEO1 AdBanner: Site ID could not be determined.', 'seo1-adbanner'));
        }

        $host = wp_parse_url(home_url(), PHP_URL_HOST) ?? '';
        $host = preg_replace('/^www\./i', '', $host);

        $client    = new SEO1_API_Client($api_url, (int) $settings['cache_ttl'], (int) $settings['brand_cache_ttl']);
        $site_data = $client->get_site_data($site_id, $host);
        if (!$site_data) {
            return defined('WP_DEBUG') && WP_DEBUG
                ? self::error(__('SEO1 AdBanner: Could not fetch data from API.', 'seo1-adbanner'))
                : '';
        }

        $brand_urls      = $client->get_brand_urls();
        $api_tracking    = isset($site_data['tracking_urls']) && is_array($site_data['tracking_urls'])
                           ? $site_data['tracking_urls'] : [];
        $manual_tracking = seo1_build_tracking_urls($brand_urls);
        $tracking_urls   = array_merge($manual_tracking, $api_tracking);
        $renderer        = new SEO1_Renderer((int) $settings['rotate_interval'], $tracking_urls);
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
