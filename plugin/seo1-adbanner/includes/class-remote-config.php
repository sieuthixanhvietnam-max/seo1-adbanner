<?php
declare(strict_types=1);
defined('ABSPATH') || exit;

/**
 * Cấu hình từ xa (api_url) lưu trên R2.
 *
 * v1.1: việc kiểm tra phiên bản / làm mới chạy bằng WP-Cron, không chặn trang.
 * Chỉ khi site chưa từng có cấu hình mới tải trực tiếp (timeout 3s, lỗi thì nghỉ 5 phút).
 */
final class SEO1_Remote_Config {

    public const CRON_HOOK   = 'seo1_adbanner_remote_check';
    private const REMOTE_URL  = 'https://pub-c8df7821d08d4ccfa551ef8d99b79cf4.r2.dev/adbanner-config.json';
    private const DEFAULT_API = 'https://banners.aeseo1.com';
    private const CACHE_TTL   = 3600; // làm mới toàn bộ mỗi giờ
    private const VER_CHECK   = 300;  // kiểm tra phiên bản mỗi 5 phút (nền)
    private const FAIL_KEY    = 'seo1_remote_fail';

    public static function get(): array {
        static $mem = null;
        if ($mem !== null) return $mem;

        $stored = get_option(SEO1_OPT_REMOTE, []);
        $stored = is_array($stored) ? $stored : [];

        if (!empty($stored['api_url']) && self::is_valid_api_url((string) $stored['api_url'])) {
            if (time() - (int) ($stored['ver_checked_at'] ?? 0) > self::VER_CHECK) {
                self::schedule_check();
            }
            return $mem = $stored;
        }

        // Chưa có cấu hình hợp lệ: tải trực tiếp một lần
        if (!get_transient(self::FAIL_KEY)) {
            $fresh = self::fetch(3);
            if ($fresh !== null) {
                $now   = time();
                $fresh = array_merge($fresh, ['fetched_at' => $now, 'ver_checked_at' => $now]);
                update_option(SEO1_OPT_REMOTE, $fresh, false);
                return $mem = $fresh;
            }
            set_transient(self::FAIL_KEY, 1, 300);
        }

        return $mem = ['api_url' => self::DEFAULT_API];
    }

    /** WP-Cron callback. */
    public static function cron_check(): void {
        $stored = get_option(SEO1_OPT_REMOTE, []);
        $stored = is_array($stored) ? $stored : [];
        $now    = time();

        // Luôn cập nhật mốc kiểm tra, kể cả khi R2 lỗi → không thử lại liên tục
        $stored['ver_checked_at'] = $now;

        $fresh = self::fetch(5);
        if ($fresh !== null) {
            $expired = $now - (int) ($stored['fetched_at'] ?? 0) >= self::CACHE_TTL;
            $newer   = (int) ($fresh['v'] ?? 0) > (int) ($stored['v'] ?? 0);
            if ($expired || $newer || empty($stored['api_url'])) {
                $stored = array_merge($fresh, ['fetched_at' => $now, 'ver_checked_at' => $now]);
            }
        }

        if (!empty($stored['api_url'])) {
            update_option(SEO1_OPT_REMOTE, $stored, false);
        }
    }

    /**
     * CRIT-04: chỉ cho phép HTTPS + domain aeseo1.com hoặc subdomain.
     */
    private static function is_valid_api_url(string $url): bool {
        if (!$url || !str_starts_with($url, 'https://')) return false;
        $host = wp_parse_url($url, PHP_URL_HOST);
        if (!$host) return false;
        return $host === 'aeseo1.com' || str_ends_with($host, '.aeseo1.com');
    }

    /** @return array<string,mixed>|null */
    private static function fetch(int $timeout): ?array {
        $resp = wp_remote_get(self::REMOTE_URL, ['timeout' => $timeout]);
        if (is_wp_error($resp) || wp_remote_retrieve_response_code($resp) !== 200) return null;

        $data = json_decode(wp_remote_retrieve_body($resp), true);
        if (!is_array($data) || !self::is_valid_api_url((string) ($data['api_url'] ?? ''))) return null;
        return $data;
    }

    private static function schedule_check(): void {
        if (get_transient(self::FAIL_KEY)) return;
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_single_event(time(), self::CRON_HOOK);
        }
    }

    public static function clear(): void {
        delete_option(SEO1_OPT_REMOTE);
        delete_transient(self::FAIL_KEY);
    }

    /** Get API URL from remote config, then settings, then hardcoded fallback */
    public static function get_api_url(): string {
        $remote = self::get();
        if (!empty($remote['api_url'])) return rtrim($remote['api_url'], '/');

        $settings = seo1_adbanner_settings();
        if (!empty($settings['api_url'])) return rtrim($settings['api_url'], '/');

        return self::DEFAULT_API;
    }
}
