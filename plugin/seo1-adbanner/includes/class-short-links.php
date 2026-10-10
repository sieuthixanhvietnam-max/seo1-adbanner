<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

/**
 * Link rút gọn: mọi link quảng cáo hiển thị đúng 1 dạng https://domain.com/trackinglink
 * → 302 tới link quảng cáo thật của banner/nút khách vừa bấm.
 *
 * Cách biết khách bấm brand nào (URL không chứa brand):
 * - Thẻ <a> có href="https://domain.com/trackinglink" và data-sl="<slug>".
 * - Script inline nhỏ (in ở footer) ghi slug vào cookie seo1_sl (60 giây) ngay lúc khách nhấn/chạm
 *   link, trước khi trình duyệt mở link. Máy chủ đọc cookie → chuyển hướng.
 * - Không có JS / không có cookie → chuyển tới brand mặc định (cài đặt) hoặc brand đầu tiên.
 *
 * Slug:
 * - Link chỉ phụ thuộc brand (tracking hoặc link brand): slug = brand_id. Đích được tính lại ở mỗi
 *   lượt bấm → brand đổi domain thì trang đã cache vẫn dẫn đúng link mới.
 * - Banner có click_url riêng: slug = <brand>-<mã băm 8 ký tự> (hoặc l-<mã băm>), đích lưu trong
 *   option seo1_short_links.
 * - Chỉ chuyển hướng tới URL plugin đã từng in ra (không nhận URL từ query) → không phải open redirect.
 * - Link đã in ra vẫn hoạt động kể cả khi tắt tính năng (trang cũ trong cache không bị gãy link).
 */
final class SEO1_Short_Links
{
    public const OPTION       = 'seo1_short_links';  // slug => ['u' => url, 't' => last_seen, 'b' => 1 nếu là slug brand]
    public const DEFAULT_BASE = 'trackinglink';
    public const COOKIE       = 'seo1_sl';
    /** Tham số nội bộ: renderer đổi "...?seo1sl=x" thành href sạch + data-sl="x" (không bao giờ hiện ra). */
    public const MARK         = 'seo1sl';

    private const MAX_ENTRIES = 500;
    private const TOUCH_EVERY = DAY_IN_SECONDS;      // cập nhật mốc "còn dùng" tối đa 1 lần/ngày/slug
    private const PRUNE_AFTER = 60 * DAY_IN_SECONDS;

    private const RESERVED = ['wp-admin', 'wp-content', 'wp-includes', 'wp-json', 'feed', 'page', 'category', 'tag', 'author', 'search', 'comments'];

    /** @var array<string,array{u:string,t:int,b?:int}>|null */
    private static ?array $map = null;
    private static bool   $dirty = false;
    private static bool   $shutdown_hooked = false;
    private static bool   $used = false;   // trang này có in link rút gọn → cần script ghi cookie

    public static function register(): void
    {
        add_action('init', [self::class, 'maybe_redirect'], 0);
        add_action('wp_footer', [self::class, 'print_click_script'], 99);
        add_filter('robots_txt', [self::class, 'robots_txt'], 10, 2);
    }

    // ── Cấu hình ───────────────────────────────────────────────────────────────

    /** Path gốc đã làm sạch, ví dụ "trackinglink". */
    public static function base(): string
    {
        $settings = seo1_adbanner_settings();
        return self::sanitize_base((string) ($settings['short_base'] ?? self::DEFAULT_BASE));
    }

    public static function sanitize_base(string $raw): string
    {
        $b = strtolower(trim($raw, " /\t\n\r"));
        $b = (string) preg_replace('/[^a-z0-9-]/', '', $b);
        $b = substr($b, 0, 40);
        if ($b === '' || in_array($b, self::RESERVED, true)) {
            return self::DEFAULT_BASE;
        }
        return $b;
    }

    /** Pretty permalink tắt thì máy chủ thường không chuyển /trackinglink/... về WordPress → không rút gọn. */
    public static function permalinks_ok(): bool
    {
        return (string) get_option('permalink_structure', '') !== '';
    }

    public static function enabled(): bool
    {
        $settings = seo1_adbanner_settings();
        return !empty($settings['short_links']) && self::permalinks_ok();
    }

    /** Link hiển thị cho khách: https://domain.com/trackinglink */
    public static function public_url(): string
    {
        return home_url('/' . self::base());
    }

    /** Link nội bộ mang slug (renderer tách thành href sạch + data-sl). */
    public static function url_for(string $slug): string
    {
        self::$used = true;
        return self::public_url() . '?' . self::MARK . '=' . $slug;
    }

    /**
     * Đổi href="https://domain.com/trackinglink?seo1sl=x" thành href="https://domain.com/trackinglink" data-sl="x".
     * Gọi trên HTML đã escape của renderer.
     */
    public static function finalize_html(string $html): string
    {
        if (!str_contains($html, self::MARK . '=')) {
            return $html;
        }
        $pattern = '#href="(' . preg_quote(esc_url(self::public_url()), '#') . ')\?' . self::MARK . '=([a-z0-9_-]+)"#';
        return (string) preg_replace($pattern, 'href="$1" data-sl="$2"', $html);
    }

    // ── Rút gọn khi in HTML ───────────────────────────────────────────────────

    /**
     * @param string $url         link thật (đã chọn theo thứ tự ưu tiên của renderer)
     * @param string $brand_id    brand của banner/nút (có thể rỗng)
     * @param bool   $brand_level true nếu $url chính là link cấp brand (tracking hoặc link brand)
     */
    public static function shorten(string $url, string $brand_id = '', bool $brand_level = false): string
    {
        $url = trim($url);
        if ($url === '' || !self::enabled()) {
            return $url;
        }
        if (!self::is_external_http($url)) {
            return $url; // link nội bộ / mailto / tel... giữ nguyên
        }
        if (str_starts_with($url, self::public_url())) {
            return $url; // đã rút gọn
        }

        $bid = strtolower($brand_id);
        if ($brand_level && $bid !== '' && preg_match('/^[a-z0-9][a-z0-9_-]{0,63}$/', $bid)) {
            $slug = $bid;
            self::remember($slug, $url, true);
        } else {
            $hash = substr(md5($url), 0, 8);
            $pre  = ($bid !== '' && preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $bid)) ? $bid : 'l';
            $slug = $pre . '-' . $hash;
            self::remember($slug, $url, false);
        }
        return self::url_for($slug);
    }

    private static function is_external_http(string $url): bool
    {
        $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
        if ($scheme !== 'http' && $scheme !== 'https') {
            return false;
        }
        $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
        $home = strtolower((string) wp_parse_url(home_url(), PHP_URL_HOST));
        return $host !== '' && $host !== $home;
    }

    // ── Bảng slug → URL ────────────────────────────────────────────────────────

    /** @return array<string,array{u:string,t:int,b?:int}> */
    private static function map(): array
    {
        if (self::$map === null) {
            $m         = get_option(self::OPTION, []);
            self::$map = is_array($m) ? $m : [];
        }
        return self::$map;
    }

    private static function remember(string $slug, string $url, bool $brand): void
    {
        $map = self::map();
        $now = time();
        $cur = $map[$slug] ?? null;

        if (is_array($cur) && ($cur['u'] ?? '') === $url && $now - (int) ($cur['t'] ?? 0) < self::TOUCH_EVERY) {
            return; // không đổi → không ghi DB
        }
        $entry = ['u' => $url, 't' => $now];
        if ($brand) {
            $entry['b'] = 1;
        }
        self::$map[$slug] = $entry;
        self::$dirty      = true;

        if (!self::$shutdown_hooked) {
            self::$shutdown_hooked = true;
            add_action('shutdown', [self::class, 'save']);
        }
    }

    public static function save(): void
    {
        if (!self::$dirty || self::$map === null) {
            return;
        }
        $map = self::$map;

        if (count($map) > self::MAX_ENTRIES) {
            $limit = time() - self::PRUNE_AFTER;
            $map   = array_filter($map, static fn($e) => (int) ($e['t'] ?? 0) >= $limit);
            if (count($map) > self::MAX_ENTRIES) {
                uasort($map, static fn($a, $b) => (int) ($b['t'] ?? 0) <=> (int) ($a['t'] ?? 0));
                $map = array_slice($map, 0, self::MAX_ENTRIES, true);
            }
        }
        update_option(self::OPTION, $map, true);
        self::$dirty = false;
    }

    // ── Xử lý lượt bấm ─────────────────────────────────────────────────────────

    public static function maybe_redirect(): void
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method !== 'GET' && $method !== 'HEAD') {
            return;
        }
        $path      = (string) (wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?? '');
        $home_path = rtrim((string) (wp_parse_url(home_url(), PHP_URL_PATH) ?? ''), '/');
        // /trackinglink  (và /trackinglink/<slug> của bản 1.1.8 cũ)
        $pattern   = '#^' . preg_quote($home_path . '/' . self::base(), '#') . '(?:/([A-Za-z0-9][A-Za-z0-9_-]{0,80}))?/?$#';
        if (!preg_match($pattern, rawurldecode($path), $m)) {
            return;
        }

        // Slug: path (bản cũ) > tham số nội bộ > cookie do script ghi lúc bấm
        $slug = '';
        foreach ([$m[1] ?? '', $_GET[self::MARK] ?? '', $_COOKIE[self::COOKIE] ?? ''] as $cand) {
            $cand = strtolower(trim((string) $cand));
            if ($cand !== '' && preg_match('/^[a-z0-9][a-z0-9_-]{0,80}$/', $cand)) {
                $slug = $cand;
                break;
            }
        }

        $target = $slug !== '' ? self::resolve($slug) : '';
        if ($target === '') {
            [$slug, $target] = self::default_target();
        }

        // Không bao giờ cache phản hồi chuyển hướng (đích có thể đổi bất cứ lúc nào)
        do_action('litespeed_control_set_nocache', 'seo1 short link');
        nocache_headers();
        header('X-LiteSpeed-Cache-Control: no-cache');
        header('Vary: Cookie');
        header('X-Robots-Tag: noindex, nofollow', true);
        header('Referrer-Policy: no-referrer-when-downgrade');

        if ($target === '') {
            wp_redirect(home_url('/'), 302, 'SEO1 AdBanner');
            exit;
        }

        /** Cho phép đổi đích trước khi chuyển hướng (ví dụ thêm tham số). */
        $target = (string) apply_filters('seo1_adbanner_short_link_target', $target, $slug);
        do_action('seo1_adbanner_short_link_click', $slug, $target);

        wp_redirect($target, 302, 'SEO1 AdBanner');
        exit;
    }

    /** Tìm link thật cho slug. Trả '' nếu không biết slug. */
    public static function resolve(string $slug): string
    {
        $map   = self::map();
        $entry = $map[$slug] ?? null;

        // Slug cấp brand: tính lại từ dữ liệu mới nhất (tracking > link brand)
        $is_hashed = (bool) preg_match('/-[0-9a-f]{8}$/', $slug) && !(is_array($entry) && !empty($entry['b']));
        if (!$is_hashed) {
            $ctx = seo1_adbanner_context();
            if ($ctx) {
                $live = self::find_ci((array) $ctx['tracking_urls'], $slug);
                if ($live === '') {
                    $live = self::find_ci((array) $ctx['brand_urls'], $slug);
                }
                if ($live !== '' && self::is_external_http($live)) {
                    return $live;
                }
            }
        }

        // Banner có link riêng, hoặc API đang lỗi → dùng link đã lưu khi in trang
        $saved = is_array($entry) ? (string) ($entry['u'] ?? '') : '';
        return ($saved !== '' && self::is_external_http($saved)) ? $saved : '';
    }

    /**
     * Đích khi không biết khách bấm gì (không JS, bot, mở link trực tiếp):
     * brand mặc định trong cài đặt > brand có tracking đầu tiên > brand đầu tiên.
     *
     * @return array{0:string,1:string} [slug, url]
     */
    public static function default_target(): array
    {
        $settings = seo1_adbanner_settings();
        $want     = strtolower((string) ($settings['short_default'] ?? ''));
        if ($want !== '') {
            $u = self::resolve($want);
            if ($u !== '') {
                return [$want, $u];
            }
        }
        $ctx = seo1_adbanner_context();
        if ($ctx) {
            $manual = array_keys((array) get_option(SEO1_OPT_TRACKING, []));
            $order  = array_merge($manual, array_keys((array) $ctx['tracking_urls']), array_keys((array) $ctx['brand_urls']));
            foreach ($order as $bid) {
                $bid = strtolower((string) $bid);
                $u   = self::resolve($bid);
                if ($u !== '') {
                    return [$bid, $u];
                }
            }
        }
        foreach (self::map() as $slug => $e) {
            if (!empty($e['b']) && self::is_external_http((string) ($e['u'] ?? ''))) {
                return [(string) $slug, (string) $e['u']];
            }
        }
        return ['', ''];
    }

    /**
     * Script ghi slug vào cookie ngay khi khách nhấn / chạm / mở menu chuột phải trên link
     * (trước khi trình duyệt mở link, kể cả mở tab mới). Không bị LiteSpeed/WP Rocket/Cloudflare trì hoãn.
     */
    public static function print_click_script(): void
    {
        if (!self::$used) {
            return;
        }
        $secure = is_ssl() ? ';Secure' : '';
        echo '<script data-no-optimize="1" data-no-defer="1" data-no-minify="1" data-cfasync="false">'
           . '(function(){function s(e){var t=e.target,a=t&&t.closest?t.closest("a[data-sl]"):null;if(!a)return;'
           . 'document.cookie="' . self::COOKIE . '="+encodeURIComponent(a.getAttribute("data-sl"))+";path=/;max-age=60;SameSite=Lax' . $secure . '";}'
           . '["pointerdown","mousedown","touchstart","keydown","click","auxclick","contextmenu"].forEach(function(n){'
           . 'document.addEventListener(n,s,{capture:true,passive:true});});})();</script>' . "\n";
    }

    /** Tra cứu brand_id không phân biệt hoa/thường (slug luôn viết thường). */
    private static function find_ci(array $urls, string $slug): string
    {
        if (!empty($urls[$slug])) {
            return (string) $urls[$slug];
        }
        foreach ($urls as $bid => $u) {
            if (strtolower((string) $bid) === $slug && !empty($u)) {
                return (string) $u;
            }
        }
        return '';
    }

    /** Thêm "Disallow: /trackinglink" vào robots.txt ảo của WordPress. */
    public static function robots_txt(string $output, $public): string
    {
        if (!$public) {
            return $output;
        }
        $home_path = rtrim((string) (wp_parse_url(home_url(), PHP_URL_PATH) ?? ''), '/');
        $line      = 'Disallow: ' . $home_path . '/' . self::base();
        if (str_contains($output, $line)) {
            return $output;
        }
        if (preg_match('/^User-agent:\s*\*\s*$/mi', $output)) {
            return (string) preg_replace('/^(User-agent:\s*\*\s*)$/mi', "$1\n" . $line, $output, 1);
        }
        return rtrim($output) . "\n\nUser-agent: *\n" . $line . "\n";
    }
}
