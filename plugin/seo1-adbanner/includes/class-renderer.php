<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

/**
 * Generates escaped HTML for each ad placement type.
 * All public methods return a safe HTML string (fully escaped).
 */
final class SEO1_Renderer
{
    private readonly int   $rotate_interval;
    private readonly array $tracking_urls;
    private string         $prefix;

    public function __construct(
        int    $rotate_interval = 5000,
        array  $tracking_urls   = [],
        string $prefix          = '',
    ) {
        $this->rotate_interval = $rotate_interval;
        $this->tracking_urls   = $tracking_urls;
        $this->prefix          = $prefix ?: (string) get_option(SEO1_OPT_PREFIX, 'ab');
    }

    // ── Public dispatch ────────────────────────────────────────────────────────

    /**
     * @param array<int,array<string,mixed>> $slots
     * @param array<string,string>           $brand_urls
     * @param array<string,mixed>            $extra
     */
    public function render_placement(
        string $placement,
        array  $slots,
        array  $brand_urls,
        array  $extra = [],
    ): string {
        return match ($placement) {
            'catfish'      => $this->render_catfish($slots, $brand_urls),
            'button'       => $this->render_button($slots, $brand_urls, $extra),
            'popup'        => $this->render_popup($slots, $brand_urls, $extra),
            'slider'       => $this->render_slider($slots, $brand_urls),
            'brand-button' => $this->render_brand_button($slots, $brand_urls),
            default        => '',
        };
    }

    /**
     * Render global brand button grid (from API 'brands' key).
     *
     * @param array<int,array<string,mixed>> $brands
     * @param array<string,string>           $brand_urls
     */
    public function render_brands(array $brands, array $brand_urls): string
    {
        if (empty($brands)) {
            return '';
        }

        $p    = $this->prefix;
        $html = '<div class="' . esc_attr($p) . '_brands">';

        foreach ($brands as $brand) {
            $brand_id = $brand['id'] ?? '';
            if ($brand_id && !empty($this->tracking_urls[$brand_id])) {
                $url = esc_url($this->tracking_urls[$brand_id]);
            } else {
                $url = esc_url($brand_urls[$brand_id] ?? '');
            }
            $img  = esc_url($brand['button_image'] ?? '');
            $name = esc_attr($brand['name'] ?? $brand_id);

            if (!$url) {
                continue;
            }

            $html .= '<a href="' . $url . '" target="_blank" rel="noopener nofollow sponsored" aria-label="' . $name . '">';
            if ($img) {
                $html .= '<img src="' . $img . '" alt="' . $name . '" loading="lazy" decoding="async">';
            } else {
                $html .= '<span>' . esc_html($brand['name'] ?? $brand_id) . '</span>';
            }
            $html .= '</a>';
        }

        $html .= '</div>';
        return $html;
    }

    /**
     * Render toplist with rich layout: left block (logo+rank), body (name, badges, review, features), CTA.
     *
     * @param array<int,array<string,mixed>> $toplist
     * @param array<string,string>           $brand_urls
     */
    public function render_toplist(array $toplist, array $brand_urls): string
    {
        if (empty($toplist)) {
            return '';
        }

        $p       = $this->prefix;
        $reviews = (array) get_option(SEO1_OPT_REVIEWS, []);
        $html    = '<div class="' . esc_attr($p) . '_toplist" itemscope itemtype="https://schema.org/ItemList">';

        foreach ($toplist as $i => $entry) {
            $rank     = (int) ($entry['rank'] ?? ($i + 1));
            $brand_id = $entry['brand_id'] ?? '';

            if ($brand_id && !empty($this->tracking_urls[$brand_id])) {
                $url = esc_url($this->tracking_urls[$brand_id]);
            } else {
                $url = esc_url($brand_urls[$brand_id] ?? '');
            }

            $img  = esc_url($entry['image_url'] ?? '');
            $name = esc_html($entry['name'] ?? '');
            $alt  = esc_attr($entry['name'] ?? '');

            // Resolve review data — backward compat: plain string = review field
            $raw_rd = $reviews[$brand_id] ?? [];
            if (is_string($raw_rd)) {
                $rd = ['review' => $raw_rd];
            } else {
                $rd = (array) $raw_rd;
            }

            $bg        = esc_attr($rd['bg_color'] ?? '#1a3a6b');
            $rating    = esc_html($rd['rating'] ?? '');
            $rcount    = esc_html($rd['review_count'] ?? '');
            $trust     = esc_html($rd['trust_score'] ?? '');
            $b_trusted = !empty($rd['badge_trusted']);
            $b_editor  = !empty($rd['badge_editor_pick']);
            $review    = esc_html($rd['review'] ?? '');
            $feat1     = esc_html($rd['feature_1'] ?? '');
            $feat2     = esc_html($rd['feature_2'] ?? '');

            $html .= '<div class="' . esc_attr($p) . '_toplist_item" itemscope itemtype="https://schema.org/ListItem">'
                   . '<meta itemprop="position" content="' . $rank . '">';

            // Left block
            $html .= '<div class="' . esc_attr($p) . '_toplist_left" style="background:' . $bg . '">'
                   . '<span class="' . esc_attr($p) . '_toplist_rank" aria-label="Hạng ' . $rank . '">' . $rank . '</span>'
                   . ($img ? '<img class="' . esc_attr($p) . '_toplist_logo" src="' . $img . '" alt="' . $alt . '" loading="lazy" decoding="async" width="60" height="60">' : '')
                   . '</div>';

            // Body block
            $html .= '<div class="' . esc_attr($p) . '_toplist_body">'
                   . '<p class="' . esc_attr($p) . '_toplist_name" itemprop="name">' . $name . '</p>';

            // SVG icons for badges (no emoji — consistent cross-platform rendering)
            $svg_star    = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
            $svg_check   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
            $svg_shield  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
            $svg_dot_grn = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="#16a34a"/></svg>';
            $svg_dot_blu = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="#2563eb"/></svg>';

            // Badges
            $badges = '';
            if ($rating) {
                $badges .= '<span class="' . esc_attr($p) . '_toplist_badge ' . esc_attr($p) . '_toplist_badge_rating">' . $svg_star . ' ' . $rating . ($rcount ? ' (' . $rcount . ')' : '') . '</span>';
            }
            if ($trust) {
                $badges .= '<span class="' . esc_attr($p) . '_toplist_badge ' . esc_attr($p) . '_toplist_badge_trust">' . $svg_check . ' Uy t&#237;n: ' . $trust . '</span>';
            }
            if ($b_trusted) {
                $badges .= '<span class="' . esc_attr($p) . '_toplist_badge ' . esc_attr($p) . '_toplist_badge_trusted">' . $svg_shield . ' Trusted</span>';
            }
            if ($b_editor) {
                $badges .= '<span class="' . esc_attr($p) . '_toplist_badge ' . esc_attr($p) . '_toplist_badge_editor">' . $svg_star . ' Editor\'s Pick</span>';
            }
            if ($badges) {
                $html .= '<div class="' . esc_attr($p) . '_toplist_badges">' . $badges . '</div>';
            }

            if ($review) {
                $html .= '<p class="' . esc_attr($p) . '_toplist_review">' . $review . '</p>';
            }

            if ($feat1 || $feat2) {
                $html .= '<div class="' . esc_attr($p) . '_toplist_features">';
                if ($feat1) {
                    $html .= '<div class="' . esc_attr($p) . '_toplist_feature ' . esc_attr($p) . '_toplist_feature_1">' . $svg_dot_grn . ' ' . $feat1 . '</div>';
                }
                if ($feat2) {
                    $html .= '<div class="' . esc_attr($p) . '_toplist_feature ' . esc_attr($p) . '_toplist_feature_2">' . $svg_dot_blu . ' ' . $feat2 . '</div>';
                }
                $html .= '</div>';
            }

            $html .= '</div>'; // end body

            // CTA block
            if ($url) {
                $html .= '<div class="' . esc_attr($p) . '_toplist_cta_wrap">'
                       . '<a href="' . $url . '" class="' . esc_attr($p) . '_toplist_cta" target="_blank" rel="noopener nofollow sponsored">Ch&#417;i ngay</a>'
                       . '</div>';
            }

            $html .= '</div>'; // end toplist_item
        }

        $html .= '</div>';
        return $html;
    }

    // ── Placement renderers ────────────────────────────────────────────────────

    /**
     * Catfish: fixed bottom bar.
     * Desktop: 2 cols × 2 rows (up to 4 banners). Mobile: 1 col.
     * Rotate slots: random-pick 1 banner from pool each page load.
     */
    private function render_catfish(array $slots, array $brand_urls): string
    {
        if (empty($slots)) {
            return '';
        }

        $p     = $this->prefix;
        $items = '';
        $count = 0;

        foreach ($slots as $slot) {
            $mode    = $slot['mode'] ?? 'fixed';
            $banners = $mode === 'rotate'
                ? (array) ($slot['banners'] ?? [])
                : (isset($slot['banner']) ? [$slot['banner']] : []);

            if (empty($banners)) continue;

            // Rotate mode: random pick from pool
            $b = $mode === 'rotate'
                ? $banners[array_rand($banners)]
                : $banners[0];

            if (empty($b)) continue;
            $img = esc_url($b['image_url'] ?? '');
            if (!$img) continue;

            $alt   = esc_attr($b['title'] ?? '') ?: esc_attr($b['brand_id'] ?? '');
            $click = $this->resolve_click_url($b, $brand_urls);

            $items .= '<div class="' . esc_attr($p) . '_catfish_item">';
            if ($click) {
                $items .= '<a href="' . esc_url($click) . '" target="_blank" rel="noopener nofollow sponsored">'
                        . '<img src="' . $img . '" alt="' . $alt . '" loading="eager" decoding="async">'
                        . '</a>';
            } else {
                $items .= '<img src="' . $img . '" alt="' . $alt . '" loading="eager" decoding="async">';
            }
            $items .= '</div>';
            $count++;
        }

        if (!$items) {
            return '';
        }

        // Grid columns: 2 for 2+ banners, 1 for single banner
        $cols       = $count >= 2 ? 2 : 1;
        $grid_style = 'grid-template-columns:repeat(' . $cols . ',1fr)';

        return '<div class="' . esc_attr($p) . '_catfish" id="seo1-catfish" role="complementary">'
             . '<div class="' . esc_attr($p) . '_catfish_bar">'
             . '<button class="' . esc_attr($p) . '_catfish_close" type="button">&#10005; ' . esc_html__('Đóng', 'seo1-adbanner') . '</button>'
             . '<div class="' . esc_attr($p) . '_catfish_grid" style="' . $grid_style . '">'
             . $items
             . '</div>'
             . '</div>'
             . '</div>';
    }

    /**
     * Slider: prev/next button slider with all banners from all slots.
     */
    private function render_slider(array $slots, array $brand_urls): string
    {
        $p           = $this->prefix;
        $all_banners = [];

        foreach ($slots as $slot) {
            foreach ($this->get_banners_from_slot($slot) as $b) {
                $all_banners[] = $b;
            }
        }

        if (empty($all_banners)) {
            return '';
        }

        $items = '';
        foreach ($all_banners as $banner) {
            $img   = esc_url($banner['image_url'] ?? '');
            $alt   = esc_attr($banner['title'] ?? '') ?: esc_attr($banner['brand_id'] ?? '');
            $click = $this->resolve_click_url($banner, $brand_urls);
            if (!$img) continue;

            $items .= '<div class="' . esc_attr($p) . '_slider_item">';
            if ($click) {
                $items .= '<a href="' . esc_url($click) . '" target="_blank" rel="noopener nofollow sponsored">'
                        . '<img src="' . $img . '" alt="' . $alt . '" loading="lazy" decoding="async" width="80" height="80">'
                        . '</a>';
            } else {
                $items .= '<img src="' . $img . '" alt="' . $alt . '" loading="lazy" decoding="async" width="80" height="80">';
            }
            $items .= '</div>';
        }

        if (!$items) {
            return '';
        }

        return '<div class="' . esc_attr($p) . '_slider_wrap">'
             . '<button class="' . esc_attr($p) . '_slider_btn ' . esc_attr($p) . '_slider_prev" type="button" aria-label="Previous"></button>'
             . '<div class="' . esc_attr($p) . '_slider_viewport">'
             . '<div class="' . esc_attr($p) . '_slider_track">'
             . $items
             . '</div>'
             . '</div>'
             . '<button class="' . esc_attr($p) . '_slider_btn ' . esc_attr($p) . '_slider_next" type="button" aria-label="Next"></button>'
             . '</div>';
    }

    /**
     * Button: flex row of CTA buttons with preset styles.
     */
    private function render_button(array $slots, array $brand_urls, array $extra = []): string
    {
        $p              = $this->prefix;
        $cfg            = self::placement_defaults()['button'];
        $btn_styles_opt = (array) get_option(SEO1_OPT_BTN_STYLES, []);
        $html           = '';
        $any            = false;

        // Brand specified directly via shortcode attr → synthetic single slot
        $brand_override = isset($extra['brand']) ? (string) $extra['brand'] : '';
        $type_override  = isset($extra['type'])  ? (string) $extra['type']  : '';

        if ($brand_override) {
            $click = '';
            if (!empty($this->tracking_urls[$brand_override])) {
                $click = $this->tracking_urls[$brand_override];
            } elseif (!empty($brand_urls[$brand_override])) {
                $click = (string) $brand_urls[$brand_override];
            }
            if ($click) {
                // btn1 = type "login" (or first), btn2 = type "register" (or second)
                $btn_num      = $type_override === 'register' ? 2 : 1;
                $slot_key     = $btn_num === 1 ? 'btn1' : 'btn2';
                $plugin_style = $btn_styles_opt[$slot_key] ?? $btn_styles_opt[$slot_key === 'btn1' ? 'login' : 'register'] ?? [];
                $preset_num   = (int) ($plugin_style['style'] ?? $btn_num);
                $style_num    = $preset_num >= 1 && $preset_num <= 8 ? $preset_num : $btn_num;
                $default_lbl  = $btn_num === 1 ? 'Cược Ngay' : 'Xem Bóng Đá';
                $label        = esc_html($plugin_style['label'] ?: $default_lbl);
                $size         = intval($cfg['font_size']);
                $weight       = intval($cfg['font_weight']);
                $radius       = intval($cfg['border_radius']);
                
                $html .= '<a href="' . esc_url($click) . '" class="' . esc_attr($p . '_btn ' . $p . '_btn_' . $style_num) . '"'
                       . ' target="_blank" rel="noopener nofollow sponsored"'
                       . ' style="border-radius:' . $radius . 'px;font-size:' . $size . 'px;font-weight:' . $weight . '"'
                       . ' aria-label="' . esc_attr($label) . '">'
                       . '<span>' . $label . '</span></a>';
                $any = true;
            }
        } else {
            foreach ($slots as $slot_index => $slot) {
                $slot_style = is_array($slot['slot_style'] ?? null) ? $slot['slot_style'] : [];
                $brand_id   = (string) ($slot['brand_id'] ?? '');
                $click      = '';
                if ($brand_id && !empty($this->tracking_urls[$brand_id])) {
                    $click = $this->tracking_urls[$brand_id];
                }
                if (!$click) $click = (string) ($slot['click_url'] ?? '');
                if (!$click && $brand_id) $click = (string) ($brand_urls[$brand_id] ?? '');
                if (!$click) continue;

                // btn1 / btn2 keys (new), fallback to old login/register keys
                $btn_num      = $slot_index === 0 ? 1 : 2;
                $slot_key     = 'btn' . $btn_num;
                $plugin_style = $btn_styles_opt[$slot_key] ?? $btn_styles_opt[$btn_num === 1 ? 'login' : 'register'] ?? [];
                $preset_num   = (int) ($plugin_style['style'] ?? $btn_num);
                $style_num    = $preset_num >= 1 && $preset_num <= 8 ? $preset_num : $btn_num;

                $size   = intval($slot_style['fontSize']     ?? $cfg['font_size']);
                $weight = intval($slot_style['fontWeight']   ?? $cfg['font_weight']);
                $radius = intval($slot_style['borderRadius'] ?? $cfg['border_radius']);
                $default_lbl  = $btn_num === 1 ? 'Cược Ngay' : 'Xem Bóng Đá';
                $label        = esc_html($plugin_style['label'] ?: ($slot_style['label'] ?? $default_lbl));

                $html .= '<a href="' . esc_url($click) . '" class="' . esc_attr($p . '_btn ' . $p . '_btn_' . $style_num) . '"'
                       . ' target="_blank" rel="noopener nofollow sponsored"'
                       . ' style="border-radius:' . $radius . 'px;font-size:' . $size . 'px;font-weight:' . $weight . '"'
                       . ' aria-label="' . esc_attr(wp_strip_all_tags($label)) . '">'
                       . '<span>' . $label . '</span>'
                       . '</a>';
                $any = true;
            }
        }

        if (!$any) {
            return '';
        }

        return '<div class="' . esc_attr($p) . '_btns">' . $html . '</div>';
    }

    /**
     * Popup: full-screen overlay with one centered banner.
     */
    private function render_popup(array $slots, array $brand_urls, array $extra = []): string
    {
        $slot = $slots[0] ?? null;
        if (!$slot) {
            return '';
        }

        $p     = $this->prefix;
        $inner = $this->render_slot_content($slot, $brand_urls, 'popup-banner');
        if (!$inner) {
            return '';
        }

        $cfg       = self::placement_defaults()['popup'];
        $delay     = intval($extra['delay'] ?? $cfg['delay'] ?? 3);
        $frequency = esc_attr($cfg['frequency']);

        return '<div class="' . esc_attr($p) . '_popup" id="seo1-popup"'
             . ' role="dialog" aria-modal="true" aria-label="' . esc_attr__('Quảng cáo', 'seo1-adbanner') . '"'
             . ' data-delay="' . $delay . '"'
             . ' data-frequency="' . $frequency . '"'
             . ' aria-hidden="true">'
             . '<div class="' . esc_attr($p) . '_popup_inner">'
             . '<button class="' . esc_attr($p) . '_popup_close" type="button" aria-label="' . esc_attr__('Đóng', 'seo1-adbanner') . '">&#10005;</button>'
             . $inner
             . '</div>'
             . '</div>';
    }

    /**
     * Brand-button: slot-based brand buttons (CSS grid, 4/2 cols).
     */
    private function render_brand_button(array $slots, array $brand_urls): string
    {
        if (empty($slots)) {
            return '';
        }

        $p       = $this->prefix;
        $items   = [];

        foreach ($slots as $slot) {
            $brand_id = (string) ($slot['brand_id'] ?? '');
            $mode     = $slot['mode'] ?? 'fixed';

            // Slot-level fallback URL
            $click = '';
            if ($brand_id && !empty($this->tracking_urls[$brand_id])) {
                $click = $this->tracking_urls[$brand_id];
            }
            if (!$click && $brand_id) {
                $click = (string) ($brand_urls[$brand_id] ?? '');
            }

            if ($mode === 'rotate') {
                $banners = (array) ($slot['banners'] ?? []);
                foreach ($banners as $b) {
                    $img  = esc_url($b['image_url'] ?? '');
                    if (!$img) continue;
                    $href    = $this->resolve_click_url($b, $brand_urls) ?: $click;
                    if (!$href) continue;
                    $alt_btn = esc_attr($b['title'] ?? '') ?: esc_attr($brand_id);
                    $items[] = '<a href="' . esc_url($href) . '" target="_blank" rel="noopener nofollow sponsored" class="' . esc_attr($p) . '_brand_btn_item">'
                             . '<img src="' . $img . '" alt="' . $alt_btn . '" loading="lazy" decoding="async">'
                             . '</a>';
                }
            } else {
                $b = $slot['banner'] ?? null;
                if (!$b) continue;
                $img  = esc_url($b['image_url'] ?? '');
                if (!$img) continue;
                $href    = $this->resolve_click_url($b, $brand_urls) ?: $click;
                if (!$href) continue;
                $alt_btn = esc_attr($b['title'] ?? '') ?: esc_attr($brand_id);
                $items[] = '<a href="' . esc_url($href) . '" target="_blank" rel="noopener nofollow sponsored" class="' . esc_attr($p) . '_brand_btn_item">'
                         . '<img src="' . $img . '" alt="' . $alt_btn . '" loading="lazy" decoding="async">'
                         . '</a>';
            }
        }

        if (empty($items)) {
            return '';
        }

        $html = '<div class="' . esc_attr($p) . '_brand_btn_grid">' . implode('', $items) . '</div>';
        return $html;
    }

    // ── Slot content helpers ───────────────────────────────────────────────────

    private function render_slot_content(
        array  $slot,
        array  $brand_urls,
        string $class = 'seo1-banner',
    ): string {
        $mode = $slot['mode'] ?? 'fixed';

        if ($mode === 'rotate') {
            $banners = $slot['banners'] ?? [];
            if (empty($banners)) {
                return '';
            }
            return $this->render_rotate($banners, $brand_urls, $class);
        }

        $banner = $slot['banner'] ?? null;
        if (!$banner) {
            return '';
        }
        return $this->render_single($banner, $brand_urls, $class);
    }

    private function render_single(array $banner, array $brand_urls, string $class = 'seo1-banner'): string
    {
        $img   = esc_url($banner['image_url'] ?? '');
        $alt   = esc_attr($banner['title'] ?? '') ?: esc_attr($banner['brand_id'] ?? '');
        $click = $this->resolve_click_url($banner, $brand_urls);

        if (!$img) {
            return '';
        }

        $inner = '<img src="' . $img . '" alt="' . $alt . '" loading="lazy" decoding="async" class="' . esc_attr($class) . '">';

        if ($click) {
            return '<a href="' . esc_url($click) . '" target="_blank" rel="noopener nofollow sponsored">' . $inner . '</a>';
        }
        return $inner;
    }

    /**
     * Rotating banner: shows first image statically; JS cycles through the rest.
     */
    private function render_rotate(array $banners, array $brand_urls, string $class = 'seo1-banner'): string
    {
        $first = $banners[0];
        $img   = esc_url($first['image_url'] ?? '');
        $alt   = esc_attr($first['title'] ?? '') ?: esc_attr($first['brand_id'] ?? '');
        $click = $this->resolve_click_url($first, $brand_urls);

        if (!$img) {
            return '';
        }

        $json_banners = array_map(function (array $b) use ($brand_urls): array {
            return [
                'image_url' => esc_url_raw($b['image_url'] ?? ''),
                'click_url' => esc_url_raw($this->resolve_click_url($b, $brand_urls)),
                'title'     => wp_strip_all_tags($b['title'] ?? ''),
            ];
        }, $banners);

        $data_json = esc_attr(wp_json_encode($json_banners));

        $html  = '<div data-seo1-rotate="1" data-banners="' . $data_json . '" data-interval="' . intval($this->rotate_interval) . '">';
        if ($click) {
            $html .= '<a href="' . esc_url($click) . '" target="_blank" rel="noopener nofollow sponsored" class="seo1-rotate-link">';
        }
        $html .= '<img src="' . $img . '" alt="' . $alt . '" loading="lazy" decoding="async" class="' . esc_attr($class) . '">';
        if ($click) {
            $html .= '</a>';
        }
        $html .= '</div>';

        return $html;
    }

    private function resolve_click_url(array $banner, array $brand_urls): string
    {
        $brand_id = $banner['brand_id'] ?? '';
        if ($brand_id && !empty($this->tracking_urls[$brand_id])) {
            return (string) $this->tracking_urls[$brand_id];
        }
        if (!empty($banner['click_url'])) {
            return (string) $banner['click_url'];
        }
        if ($brand_id && isset($brand_urls[$brand_id])) {
            return (string) $brand_urls[$brand_id];
        }
        return '';
    }

    private function get_banners_from_slot(array $slot): array
    {
        if (($slot['mode'] ?? '') === 'rotate') {
            return (array) ($slot['banners'] ?? []);
        }
        $b = $slot['banner'] ?? null;
        return $b ? [$b] : [];
    }

    // ── Config ─────────────────────────────────────────────────────────────────

    /**
     * @return array<string, array<string, mixed>>
     */
    private static function placement_defaults(): array
    {
        if (function_exists('seo1_placement_defaults')) {
            return seo1_placement_defaults();
        }

        return [
            'catfish' => [
                'position' => 'bottom', 'z_index' => 9990, 'bg_color' => '#000000',
                'columns' => 2, 'columns_mobile' => 1, 'gap' => 0,
                'image_fit' => 'cover', 'aspect_ratio' => '16/3',
                'closable' => true, 'close_color' => '#ffffff', 'close_bg' => 'rgba(0,0,0,0.45)',
                'animation_in' => 'slide', 'animation_duration' => 300,
                'mobile_only' => false, 'shadow' => '0 -2px 16px rgba(0,0,0,0.4)',
            ],
            'slider' => [
                'mode' => 'slider', 'direction' => 'left', 'speed' => 60,
                'gap' => 8, 'image_width' => 80, 'aspect_ratio' => '1/1',
                'image_fit' => 'contain', 'border_radius' => 8, 'pause_on_hover' => true,
            ],
            'button' => [
                'layout' => 'horizontal', 'layout_mobile' => 'vertical', 'gap' => 8,
                'border_radius' => 8, 'height' => 40,
                'bg_color' => '#6366F1', 'bg_color_hover' => '#4F46E5', 'text_color' => '#ffffff',
                'font_size' => 14, 'font_weight' => 700, 'label' => 'Dang nhap',
                'icon' => 'LogIn', 'icon_position' => 'left', 'icon_size' => 18,
                'shadow_hover' => '0 4px 12px rgba(99,102,241,0.4)', 'transition' => 200, 'full_width' => true,
            ],
            'popup' => [
                'delay' => 3, 'frequency' => 'daily', 'overlay_color' => 'rgba(0,0,0,0.65)',
                'z_index' => 9999, 'max_width' => '90vw', 'max_height' => '90vh',
                'image_border_radius' => 4, 'animation_duration' => 300,
                'close_on_backdrop' => true, 'close_on_escape' => true,
            ],
            'brand-button' => [
                'columns' => 4, 'columns_mobile' => 3, 'gap' => 8,
                'image_fit' => 'contain', 'aspect_ratio' => '1/1', 'border_radius' => 10,
                'bg_color' => '#ffffff', 'border' => '1px solid #e5e7eb',
                'padding' => 4, 'hover_opacity' => 0.88, 'hover_lift' => true,
            ],
            'toplist' => [
                'show_login_btn' => true, 'login_btn_label' => 'Choi ngay',
                'login_btn_bg' => '#2563eb', 'login_btn_color' => '#ffffff', 'login_btn_radius' => 8,
                'border_radius' => 12,
            ],
        ];
    }

}
