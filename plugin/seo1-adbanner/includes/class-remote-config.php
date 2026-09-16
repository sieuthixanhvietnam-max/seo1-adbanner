<?php
declare(strict_types=1);
defined('ABSPATH') || exit;

final class SEO1_Remote_Config {

    private const REMOTE_URL   = 'https://pub-c8df7821d08d4ccfa551ef8d99b79cf4.r2.dev/adbanner-config.json';
    private const CACHE_TTL    = 3600; // 1 hour full cache
    private const VER_CHECK    = 300;  // check version every 5 min (background, non-blocking)

    public static function get(): array {
        static $mem = null;
        if ($mem !== null) return $mem;

        $stored = (array) get_option(SEO1_OPT_REMOTE, []);
        $now    = time();

        // Still within full cache TTL
        if (!empty($stored['api_url']) && !empty($stored['fetched_at'])) {
            $age = $now - (int) $stored['fetched_at'];
            if ($age < self::CACHE_TTL) {
                // Background version check every 5 min — non-blocking
                $last_check = (int) ($stored['ver_checked_at'] ?? 0);
                if ($now - $last_check > self::VER_CHECK) {
                    self::background_version_check($stored, $now);
                }
                return $mem = (array) get_option(SEO1_OPT_REMOTE, $stored);
            }
        }

        return $mem = self::fetch_full($stored, $now);
    }

    /**
     * CRIT-04: Validate api_url chỉ cho phép domain aeseo1.com
     * Ngăn R2 bucket bị compromise dẫn đến endpoint hijack.
     */
    private static function is_valid_api_url(string $url): bool {
        if (!$url) return false;
        $host = wp_parse_url($url, PHP_URL_HOST);
        if (!$host) return false;
        // Chỉ cho phép HTTPS + domain aeseo1.com hoặc subdomain của nó
        return str_starts_with($url, 'https://')
            && (
                $host === 'aeseo1.com'
                || str_ends_with($host, '.aeseo1.com')
            );
    }

    private static function background_version_check(array $stored, int $now): void {
        $resp = wp_remote_get(self::REMOTE_URL, ['timeout' => 2]);
        if (is_wp_error($resp) || wp_remote_retrieve_response_code($resp) !== 200) return;

        $fresh = json_decode(wp_remote_retrieve_body($resp), true);
        if (!is_array($fresh)) return;

        $stored['ver_checked_at'] = $now;
        if (isset($fresh['v']) && (int) $fresh['v'] > (int) ($stored['v'] ?? 0)) {
            $fresh_url = $fresh['api_url'] ?? '';
            // CRIT-04: validate trước khi lưu
            if ($fresh_url && self::is_valid_api_url($fresh_url)) {
                $stored = array_merge($fresh, ['fetched_at' => $now, 'ver_checked_at' => $now]);
            }
        }
        update_option(SEO1_OPT_REMOTE, $stored, false);
    }

    private static function fetch_full(array $stored, int $now): array {
        $resp = wp_remote_get(self::REMOTE_URL, ['timeout' => 3]);
        if (!is_wp_error($resp) && wp_remote_retrieve_response_code($resp) === 200) {
            $data = json_decode(wp_remote_retrieve_body($resp), true);
            $fetched_url = is_array($data) ? ($data['api_url'] ?? '') : '';
            // CRIT-04: validate domain trước khi lưu vào DB
            if ($fetched_url && self::is_valid_api_url($fetched_url)) {
                $data['fetched_at']     = $now;
                $data['ver_checked_at'] = $now;
                update_option(SEO1_OPT_REMOTE, $data, false);
                return $data;
            }
        }
        // Fallback: use stored (đã validated khi lưu) hoặc hardcoded
        if (!empty($stored['api_url'])) return $stored;
        return ['api_url' => 'https://banners.aeseo1.com'];
    }

    public static function clear(): void {
        delete_option(SEO1_OPT_REMOTE);
    }

    /** Get API URL from remote config, then settings, then hardcoded fallback */
    public static function get_api_url(): string {
        $remote = self::get();
        if (!empty($remote['api_url'])) return rtrim($remote['api_url'], '/');

        $settings = seo1_adbanner_settings();
        if (!empty($settings['api_url'])) return rtrim($settings['api_url'], '/');

        return 'https://banners.aeseo1.com';
    }
}
