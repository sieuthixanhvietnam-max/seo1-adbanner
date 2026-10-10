<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

/**
 * Handles all HTTP communication with the SEO1 Ad Banner server.
 *
 * Cache (1.1.7, như bản gốc): transient theo TTL; hết hạn thì lấy lại trực tiếp từ API.
 * Thêm: mỗi trang chỉ đọc 1 lần; dữ liệu đổi so với lần trước → báo xoá page cache.
 */
final class SEO1_API_Client
{
    private const REQUEST_TIMEOUT = 5; // seconds
    private const HASH_PREFIX     = 'seo1_hash_'; // md5 dữ liệu lần trước (để phát hiện thay đổi)

    /** Lịch cron của bản 1.1.0–1.1.6, chỉ còn dùng để gỡ khi nâng cấp. */
    public const LEGACY_HOOKS = ['seo1_adbanner_refresh', 'seo1_adbanner_tick'];

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
    public function get_site_data(string $site_id, string $domain = '', bool $force = false): array|false
    {
        $key  = 'seo1_site_' . sanitize_key($site_id);
        $base = trailingslashit($this->api_url) . 'api/v2/site/' . rawurlencode($site_id) . '/banners';
        // Gửi domain để backend inject tracking_urls vào response
        $url  = $domain ? add_query_arg('domain', rawurlencode($domain), $base) : $base;

        return $this->cached($key, $url, $this->cache_ttl, $force);
    }

    /**
     * Fetch flat brand URL map: brand_id => login_url string.
     *
     * @return array<string,string>
     */
    public function get_brand_urls(bool $force = false): array
    {
        $data = $this->cached('seo1_brand_urls', trailingslashit($this->api_url) . 'api/brands/urls', $this->brand_cache_ttl, $force);
        if ($data === false) return [];

        $urls = [];
        foreach ($data as $bid => $val) {
            if (is_string($val)) {
                $urls[$bid] = $val;
            } elseif (is_array($val) && !empty($val['login_url'])) {
                $urls[$bid] = (string) $val['login_url'];
            }
        }
        return $urls;
    }

    /**
     * Get full brand objects: brand_id => { login_url, name, logo_url, button_image }
     * Admin only — always fresh.
     *
     * @return array<string,array<string,mixed>>
     */
    public function get_brand_objects(): array
    {
        $data = self::request(trailingslashit($this->api_url) . 'api/brands/urls', self::REQUEST_TIMEOUT);
        if ($data === false) return [];

        $base   = rtrim($this->api_url, '/');
        $result = [];
        foreach ($data as $bid => $val) {
            if (is_array($val)) {
                foreach (['button_image', 'logo_url'] as $field) {
                    if (!empty($val[$field]) && str_starts_with($val[$field], '/')) {
                        $val[$field] = $base . $val[$field];
                    }
                }
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
     * Get list of active sites: [{id, name}] — cached 5 minutes (admin).
     *
     * @return array<int,array<string,mixed>>
     */
    public function get_sites(bool $force = false): array
    {
        $data = $this->cached('seo1_sites_list', trailingslashit($this->api_url) . 'api/v2/sites', 5 * MINUTE_IN_SECONDS, $force);
        return $data === false ? [] : $data;
    }

    /**
     * Get brand_id → button_image map for admin UI logo display. Always fresh.
     *
     * @return array<string,string>
     */
    public function get_brand_images_for_admin(): array
    {
        $sites = $this->get_sites(true);
        if (empty($sites)) return [];

        $site_id = sanitize_key($sites[0]['id'] ?? '');
        if (!$site_id) return [];

        $site_data = $this->get_site_data($site_id, '', true);
        if (empty($site_data['brands'])) return [];

        $images = [];
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
     * Auto-detect site ID from a domain name. Cached 1 hour (+ bản cũ khi API lỗi).
     */
    public function detect_site(string $domain): string|false
    {
        $url  = add_query_arg('domain', rawurlencode($domain), trailingslashit($this->api_url) . 'api/v2/site/detect');
        $data = $this->cached('seo1_detect_' . md5($domain), $url, HOUR_IN_SECONDS, false);
        if ($data === false || empty($data['id'])) {
            return false;
        }
        return sanitize_key((string) $data['id']);
    }

    // ── Cache core ─────────────────────────────────────────────────────────────

    /**
     * @return array<string,mixed>|false
     */
    private function cached(string $key, string $url, int $ttl, bool $force): array|false
    {
        static $memo = [];

        if (!$force) {
            if (isset($memo[$key])) {
                return $memo[$key];
            }
            $cached = get_transient($key);
            if (is_array($cached)) {
                return $memo[$key] = $cached;
            }
        }

        $data = self::request($url, self::REQUEST_TIMEOUT);
        if ($data === false) {
            return false;
        }

        set_transient($key, $data, max(5, $ttl));
        $memo[$key] = $data;

        // Banner / link brand đổi so với lần lấy trước → báo để xoá page cache,
        // nếu không trang đã cache (LiteSpeed...) vẫn hiện banner/link cũ đến khi hết TTL.
        if (str_starts_with($key, 'seo1_site_') || $key === 'seo1_brand_urls') {
            $hash = md5(serialize($data));
            $old  = get_option(self::HASH_PREFIX . $key, '');
            if ($old !== $hash) {
                update_option(self::HASH_PREFIX . $key, $hash, false);
                if ($old !== '') {
                    do_action('seo1_adbanner_data_changed', $key);
                }
            }
        }
        return $data;
    }

    /**
     * Perform a GET request and return the `data` payload.
     *
     * @return array<string,mixed>|false
     */
    private static function request(string $url, int $timeout): array|false
    {
        $response = wp_remote_get($url, [
            'timeout'    => $timeout,
            'user-agent' => 'SEO1-AdBanner-WP/' . SEO1_ADBANNER_VERSION . '; ' . home_url(),
        ]);

        if (is_wp_error($response)) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('[SEO1 AdBanner] API error: ' . $response->get_error_message());
            }
            return false;
        }

        if (wp_remote_retrieve_response_code($response) !== 200) {
            return false;
        }

        $json = json_decode(wp_remote_retrieve_body($response), associative: true);
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
            return;
        }

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
