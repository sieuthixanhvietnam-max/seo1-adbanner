<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

/**
 * Handles all HTTP communication with the SEO1 Ad Banner server.
 * All responses are cached in WordPress transients.
 */
final class SEO1_API_Client
{
    private const REQUEST_TIMEOUT = 5; // seconds

    public function __construct(
        private readonly string $api_url,
        private readonly int    $cache_ttl       = 60,
        private readonly int    $brand_cache_ttl = 30,
    ) {}

    /**
     * Fetch banner/slot/toplist data for a site.
     *
     * @return array<string,mixed>|false
     */
    public function get_site_data(string $site_id, string $domain = ''): array|false
    {
        $key    = 'seo1_site_' . sanitize_key($site_id);
        $cached = get_transient($key);
        if ($cached !== false) {
            return $cached;
        }

        $base = trailingslashit($this->api_url) . 'api/v2/site/' . rawurlencode($site_id) . '/banners';
        // Gửi domain để backend inject tracking_urls vào response
        $url  = $domain ? add_query_arg('domain', rawurlencode($domain), $base) : $base;
        $data = $this->request($url);
        if ($data === false) {
            return false;
        }

        set_transient($key, $data, $this->cache_ttl);
        return $data;
    }

    /**
     * Fetch flat brand URL map: brand_id => login_url string.
     * Handles both plain string values and object values with login_url key.
     *
     * @return array<string,string>
     */
    public function get_brand_urls(): array
    {
        $key    = 'seo1_brand_urls';
        $cached = get_transient($key);
        if ($cached !== false) return (array) $cached;

        $url  = trailingslashit($this->api_url) . 'api/brands/urls';
        $data = $this->request($url);
        if ($data === false) return [];

        $urls = [];
        foreach ($data as $bid => $val) {
            if (is_string($val)) {
                $urls[$bid] = $val;
            } elseif (is_array($val) && !empty($val['login_url'])) {
                $urls[$bid] = (string) $val['login_url'];
            }
        }
        set_transient($key, $urls, $this->brand_cache_ttl);
        return $urls;
    }

    /**
     * Get full brand objects: brand_id => { login_url, name, logo_url, button_image }
     * Not cached — used only in admin context.
     *
     * @return array<string,array<string,mixed>>
     */
    public function get_brand_objects(): array
    {
        $url  = trailingslashit($this->api_url) . 'api/brands/urls';
        $data = $this->request($url);
        if ($data === false) return [];

        $base = rtrim($this->api_url, '/');

        $result = [];
        foreach ($data as $bid => $val) {
            if (is_array($val)) {
                // Resolve relative logo paths — prefer button_image, fall back to logo_url
                foreach (['button_image', 'logo_url'] as $field) {
                    if (!empty($val[$field]) && str_starts_with($val[$field], '/')) {
                        $val[$field] = $base . $val[$field];
                    }
                }
                // Normalise: always expose as button_image for admin rendering
                if (empty($val['button_image']) && !empty($val['logo_url'])) {
                    $val['button_image'] = $val['logo_url'];
                }
                $result[$bid] = $val;
            } elseif (is_string($val)) {
                $result[$bid] = ['login_url' => $val, 'name' => $bid, 'logo_url' => '', 'button_image' => ''];
            }
        }
        return $result;
    }

    /**
     * Get list of active sites: [{id, name}]
     * Cached for 5 minutes.
     *
     * @return array<int,array<string,mixed>>
     */
    public function get_sites(): array
    {
        $key    = 'seo1_sites_list';
        $cached = get_transient($key);
        if ($cached !== false) return (array) $cached;

        $url  = trailingslashit($this->api_url) . 'api/v2/sites';
        $data = $this->request($url);
        if ($data === false) return [];

        set_transient($key, $data, 5 * MINUTE_IN_SECONDS);
        return $data;
    }

    /**
     * Get brand_id → button_image map for admin UI logo display.
     * Always fetches fresh from the API (no transient) — admin only.
     * Tries /api/v2/sites to get a valid site ID, then /api/v2/site/:id/banners.
     *
     * @return array<string,string> brand_id → absolute image URL
     */
    public function get_brand_images_for_admin(): array
    {
        // Step 1: get any valid site ID (no transient — bypass stale cache)
        delete_transient('seo1_sites_list');
        $sites = $this->get_sites();
        if (empty($sites)) {
            return [];
        }

        $images = [];
        // Fetch the first site's data (brands list is global, not site-specific)
        $site_id = sanitize_key($sites[0]['id'] ?? '');
        if (!$site_id) return [];

        $trans_key = 'seo1_site_' . $site_id;
        delete_transient($trans_key);
        $site_data = $this->get_site_data($site_id);
        if (empty($site_data['brands'])) return [];

        foreach ($site_data['brands'] as $b) {
            $bid = $b['id'] ?? '';
            $img = $b['button_image'] ?? '';
            if (!$bid || !$img) continue;
            if (!str_starts_with($img, 'http')) {
                $img = rtrim($this->api_url, '/') . '/' . ltrim($img, '/');
            }
            $images[$bid] = $img;
        }
        return $images;
    }

    /**
     * Auto-detect site ID from a domain name.
     * Result is cached for 1 hour (domain→site mapping rarely changes).
     */
    public function detect_site(string $domain): string|false
    {
        $key    = 'seo1_detect_' . md5($domain);
        $cached = get_transient($key);
        if ($cached !== false) {
            return (string) $cached;
        }

        $url  = add_query_arg('domain', rawurlencode($domain), trailingslashit($this->api_url) . 'api/v2/site/detect');
        $data = $this->request($url);
        if ($data === false || empty($data['id'])) {
            return false;
        }

        $site_id = sanitize_key($data['id']);
        set_transient($key, $site_id, HOUR_IN_SECONDS);
        return $site_id;
    }

    /**
     * Perform a GET request and return the `data` payload.
     *
     * @return array<string,mixed>|false
     */
    private function request(string $url): array|false
    {
        $response = wp_remote_get($url, [
            'timeout'    => self::REQUEST_TIMEOUT,
            'user-agent' => 'SEO1-AdBanner-WP/' . SEO1_ADBANNER_VERSION . '; ' . home_url(),
        ]);

        if (is_wp_error($response)) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('[SEO1 AdBanner] API error: ' . $response->get_error_message());
            }
            return false;
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) {
            return false;
        }

        $body = wp_remote_retrieve_body($response);
        $json = json_decode($body, associative: true);

        if (!is_array($json) || empty($json['success']) || !isset($json['data'])) {
            return false;
        }

        return (array) $json['data'];
    }

    /**
     * Clear all cached data for a specific site (or all sites).
     */
    public function clear_cache(?string $site_id = null): void
    {
        if ($site_id !== null) {
            delete_transient('seo1_site_' . sanitize_key($site_id));
        } else {
            global $wpdb;
            $wpdb->query(
                $wpdb->prepare(
                    "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
                    '_transient_seo1_%',
                    '_transient_timeout_seo1_%'
                )
            );
        }
    }
}
