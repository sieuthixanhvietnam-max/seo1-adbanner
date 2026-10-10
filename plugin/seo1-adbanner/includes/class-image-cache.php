<?php
declare(strict_types=1);
defined('ABSPATH') || exit;

/**
 * Tải sẵn ảnh banner về máy chủ của site.
 *
 * Vì sao: một số plugin (WebP Express, Converter for Media...) ghi .htaccess có "RewriteEngine On"
 * vào wp-content/uploads, làm request tới ảnh chưa có trên đĩa không còn tới được proxy của plugin.
 * Tải sẵn ảnh về đúng đường dẫn thì web server trả file tĩnh, không phụ thuộc rewrite.
 *
 * Cách làm (1.1.7):
 *  - Khi in HTML: URL ảnh giữ nguyên như dữ liệu từ server (giống bản gốc). Ảnh nào chưa có trên
 *    đĩa được ghi vào hàng chờ.
 *  - Ngay sau khi trả trang cho khách (LiteSpeed / PHP-FPM), plugin tải các ảnh trong hàng chờ.
 *    WP-Cron chạy dự phòng. Tải xong → xoá page cache.
 *  - Ảnh được lưu nguyên bản (không nén, không đổi kích thước).
 */
final class SEO1_Image_Cache
{
    public const CRON_HOOK = 'seo1_adbanner_prefetch';

    private const FIELDS    = ['image_url', 'button_image', 'logo_url'];
    private const PATTERN   = '#/wp-content/uploads/(banners|brands|toplist)/([A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(?:webp|png|jpe?g|gif|avif))$#i';
    private const ALLOWED   = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    private const MAX_BYTES = 3145728; // 3MB
    private const QUEUE     = 'seo1_img_queue'; // ảnh đang chờ tải: "folder/file" => 1

    /** @var array<string,int> ảnh thiếu phát hiện trong request này */
    private static array $missing = [];

    /**
     * Dùng URL nội bộ cho ảnh đã có trên đĩa; ảnh chưa có giữ nguyên URL và đưa vào hàng chờ tải.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function localize(array $data): array
    {
        $data = self::walk($data);

        if (self::$missing) {
            $queue = get_option(self::QUEUE, []);
            $queue = is_array($queue) ? $queue : [];
            $new   = array_diff_key(self::$missing, $queue);
            if ($new) {
                update_option(self::QUEUE, $queue + $new, false);
            }
            // 1) Tải ngay sau khi đã trả trang cho khách
            if (!has_action('shutdown', [self::class, 'shutdown_prefetch'])) {
                add_action('shutdown', [self::class, 'shutdown_prefetch'], 100);
            }
            // 2) Dự phòng bằng WP-Cron
            if (!wp_next_scheduled(self::CRON_HOOK)) {
                wp_schedule_single_event(time(), self::CRON_HOOK);
            }
        }
        return $data;
    }

    private static function walk(array $node): array
    {
        foreach ($node as $k => $v) {
            if (is_array($v)) {
                $node[$k] = self::walk($v);
            } elseif (is_string($v) && $v !== '' && in_array($k, self::FIELDS, true)) {
                $node[$k] = self::resolve($v);
            }
        }
        return $node;
    }

    /** URL dùng để hiển thị cho 1 ảnh. */
    private static function resolve(string $url): string
    {
        $path = (string) wp_parse_url($url, PHP_URL_PATH);
        if (!preg_match(self::PATTERN, $path, $m)) {
            return $url; // không phải ảnh banner của hệ thống → giữ nguyên
        }
        $dir = self::dir($m[1]);
        if ($dir !== '' && is_file($dir . '/' . $m[2])) {
            return self::local_url($m[1], $m[2]);
        }
        self::$missing[$m[1] . '/' . $m[2]] = 1;
        return $url; // giữ nguyên như dữ liệu từ server (giống bản gốc)
    }

    /**
     * Cuối request: đóng kết nối với khách trước (LiteSpeed / PHP-FPM), rồi mới tải ảnh.
     * Máy chủ không hỗ trợ đóng sớm → để WP-Cron làm (không bắt khách chờ).
     */
    public static function shutdown_prefetch(): void
    {
        if (get_transient('seo1_prefetch_lock')) return;

        if (function_exists('litespeed_finish_request')) {
            litespeed_finish_request();
        } elseif (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            return;
        }
        ignore_user_abort(true);
        self::run(20);
    }

    /** WP-Cron. */
    public static function cron_prefetch(): void
    {
        self::run(25);
    }

    /** Tải các ảnh trong hàng chờ trong giới hạn thời gian. Trả về số ảnh đã tải. */
    public static function run(int $budget): int
    {
        if (get_transient('seo1_prefetch_lock')) return 0;
        set_transient('seo1_prefetch_lock', 1, $budget + 30);

        $done  = 0;
        $api   = SEO1_Remote_Config::get_api_url();
        $queue = get_option(self::QUEUE, []);
        $queue = is_array($queue) ? $queue : [];

        if ($api && $queue) {
            $start = time();
            foreach (array_keys($queue) as $rel) {
                if (time() - $start > $budget) break;
                [$folder, $file] = array_pad(explode('/', (string) $rel, 2), 2, '');
                $dir = self::dir($folder);
                if ($dir === '' || !preg_match(self::PATTERN, '/wp-content/uploads/' . $rel) || is_file($dir . '/' . $file)) {
                    unset($queue[$rel]);
                    continue;
                }
                if (get_transient('seo1_img_miss_' . md5((string) $rel))) continue; // vừa lỗi, thử lại sau

                if (self::download($api, $folder, $file)) {
                    unset($queue[$rel]);
                    $done++;
                } else {
                    set_transient('seo1_img_miss_' . md5((string) $rel), 1, 5 * MINUTE_IN_SECONDS);
                }
            }
            update_option(self::QUEUE, $queue, false);

            if ($queue && !wp_next_scheduled(self::CRON_HOOK)) {
                wp_schedule_single_event(time() + 300, self::CRON_HOOK);
            }

            // Có ảnh mới → xoá page cache để trang đã cache dùng URL nội bộ
            if ($done > 0 && function_exists('seo1_adbanner_purge_page_cache')) {
                delete_transient('seo1_purge_lock');
                seo1_adbanner_purge_page_cache();
            }
        }

        delete_transient('seo1_prefetch_lock');
        return $done;
    }

    /** Tải 1 ảnh từ server banner, kiểm tra là ảnh thật, ghi nguyên bản xuống đĩa. */
    private static function download(string $api, string $folder, string $file): bool
    {
        $resp = wp_remote_get(rtrim($api, '/') . '/wp-content/uploads/' . $folder . '/' . rawurlencode($file), [
            'timeout'             => 10,
            'redirection'         => 3,
            'limit_response_size' => self::MAX_BYTES + 1,
            'user-agent'          => 'Mozilla/5.0 (compatible; SEO1-AdBanner-WP/' . SEO1_ADBANNER_VERSION . ')',
        ]);
        if (is_wp_error($resp) || (int) wp_remote_retrieve_response_code($resp) !== 200) {
            return false;
        }
        $body = (string) wp_remote_retrieve_body($resp);
        if ($body === '' || strlen($body) > self::MAX_BYTES) {
            return false;
        }
        $info = @getimagesizefromstring($body);
        if (!$info || !in_array($info['mime'] ?? '', self::ALLOWED, true)) {
            return false;
        }

        $dir = self::dir($folder);
        if ($dir === '' || !wp_mkdir_p($dir)) {
            return false;
        }
        $tmp = $dir . '/.' . $file . '.' . wp_generate_password(6, false, false) . '.tmp';
        if (@file_put_contents($tmp, $body, LOCK_EX) === false) {
            return false;
        }
        @chmod($tmp, 0644);
        if (!@rename($tmp, $dir . '/' . $file)) {
            @unlink($tmp);
            return false;
        }
        return true;
    }

    private static function dir(string $folder): string
    {
        static $base = null;
        if ($base === null) {
            $up   = wp_upload_dir(null, false);
            $base = empty($up['error']) ? untrailingslashit($up['basedir']) : '';
        }
        return ($base === '' || $folder === '') ? '' : $base . '/' . $folder;
    }

    private static function local_url(string $folder, string $file): string
    {
        static $base = null;
        if ($base === null) {
            $up   = wp_upload_dir(null, false);
            $base = untrailingslashit(wp_make_link_relative($up['baseurl']));
        }
        return $base . '/' . $folder . '/' . $file;
    }
}
