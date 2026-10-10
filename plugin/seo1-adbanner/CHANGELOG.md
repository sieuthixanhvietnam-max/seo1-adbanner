# SEO1 Ad Banner — Changelog

## 1.1.8 — Link quảng cáo rút gọn `https://domain.com/trackinglink`

- Mọi link quảng cáo (catfish, slider, popup, banner xoay, nút CTA, brand-button, toplist, brands)
  hiển thị đúng 1 link: `https://domain-cua-site.com/trackinglink` (không có tên brand trong link).
- Cách plugin biết khách bấm banner nào: thẻ `<a>` có thêm `data-sl="<brand>"`; một script inline nhỏ
  (~0,5 KB, in ở footer, có `data-no-optimize`/`data-cfasync="false"` để không bị trì hoãn) ghi brand vào
  cookie `seo1_sl` (60 giây) ngay khi khách nhấn/chạm link — kể cả bấm chuột giữa, mở tab mới. Máy chủ
  đọc cookie và chuyển hướng 302 tới link thật.
- Không có JavaScript / bot / mở `/trackinglink` trực tiếp → chuyển tới **brand mặc định** (cài đặt mới),
  nếu không chọn thì brand có tracking đầu tiên.
- Link cấp brand (tracking hoặc link brand): đích **tính lại mỗi lượt bấm** → brand đổi domain thì trang đã
  cache (LiteSpeed...) vẫn dẫn đúng link mới.
- Banner có `click_url` riêng: lưu đích trong option `seo1_short_links` (tối đa 500, tự dọn sau 60 ngày).
  API lỗi → dùng link đã lưu lần in trang gần nhất.
- Chỉ chuyển hướng tới link plugin đã in ra (không nhận URL từ tham số) → không bị lợi dụng làm open redirect.
- Phản hồi chuyển hướng không cache (no-store, LiteSpeed no-cache, `Vary: Cookie`), `X-Robots-Tag: noindex,
  nofollow`; robots.txt ảo tự thêm `Disallow: /trackinglink`. Thẻ `<a>` giữ `rel="nofollow sponsored"`.
- Cài đặt mới (API & Cache → **Link rút gọn**): bật/tắt (mặc định bật), đổi đường dẫn (mặc định
  `trackinglink`), chọn brand mặc định. Cần Đường dẫn tĩnh khác "Mặc định"; nếu đang "Mặc định" thì giữ link cũ.
- Đã kiểm thử trên Chromium: bấm từng banner/nút (kể cả catfish xoay, popup xoay, bấm chuột giữa) đều tới đúng
  link thật; không link nào lộ tên brand trong href.
- Hook cho dev: filter `seo1_adbanner_short_link_target`, action `seo1_adbanner_short_link_click`.

## 1.1.7 — Gỡ các tính năng theo checklist

Đã gỡ (theo yêu cầu):
- A1 Lưu dữ liệu 2 tầng · A2 Nghỉ 5 phút khi API lỗi · A3 Làm mới sau khi trả trang ·
  A4 Làm mới định kỳ 5 phút → cache dữ liệu trở lại **như bản gốc**: hết TTL (banner 60s,
  link brand 30s) thì lấy lại trực tiếp từ API trong lượt xem đó.
- B2 Hiện tạm ảnh từ server banner → URL ảnh trong HTML giữ nguyên như dữ liệu server gửi
  (giống bản gốc); không còn link `banners.aeseo1.com`.
- B4 Tự nén / thu nhỏ ảnh → ảnh được lưu nguyên bản.
- B5 Trang "Ảnh banner" trong admin.

Điều chỉnh để các tính năng còn giữ chạy độc lập:
- B1/B3 Tải sẵn ảnh: danh sách ảnh cần tải lấy từ lượt xem trang (hàng chờ `seo1_img_queue`),
  không còn dựa vào dữ liệu dự phòng của A1.
- D1 Tự xoá page cache khi banner/link đổi: so sánh mã băm dữ liệu với lần trước (`seo1_hash_*`).

Tự dọn khi nâng cấp từ 1.1.0–1.1.6: gỡ lịch cron `seo1_adbanner_refresh`, `seo1_adbanner_tick`;
xoá option `seo1_stale_*`, `seo1_img_optimized`, `seo1_img_errors`.

Lưu ý do gỡ A1/A2: khi server banner chậm hoặc lỗi, lượt xem nào gặp cache hết hạn sẽ chờ API
tối đa 5 giây/lần gọi như bản gốc. Do gỡ B2: trên site dùng WebP Express, ảnh banner mới có thể
chưa hiện ở 1–2 lượt xem đầu, cho tới khi được tải về (thường vài giây sau lượt xem đầu tiên).

## 1.1.6 — Khôi phục tự động đổi link brand

**Lỗi do 1.1.0–1.1.5 gây ra:** bản gốc lấy lại link brand mỗi 30 giây. Từ 1.1.0, khi hết hạn
plugin trả link đã lưu và giao việc làm mới cho WP-Cron — nhưng khi LiteSpeed cache gần như mọi
trang thì WP-Cron hầu như không chạy, nên link brand "đứng yên". TTL còn bị nâng lên tối thiểu 60s.

Sửa:
- **Làm mới ngay sau khi trả trang**: request gặp link brand / dữ liệu banner đã hết hạn sẽ đóng
  kết nối với khách rồi lấy dữ liệu mới (không chờ WP-Cron, khách không phải chờ API).
- **Làm mới định kỳ 5 phút** (WP-Cron lịch `seo1_5min`) — dự phòng khi mọi trang đều đang được cache.
- Link/banner đổi → **tự xoá page cache** (LiteSpeed...) như 1.1.1 → trang đã cache cũng nhận link mới.
- Trả TTL về như bản gốc: dữ liệu banner 60s, link brand 30s (cho phép tối thiểu 10s / 5s).

Đã thử: server đổi domain bin88 → lượt xem kế tiếp (không WP-Cron) vẫn link cũ nhưng kích hoạt
làm mới + xoá cache → lượt sau đó đã là link mới.

## 1.1.5 — Ảnh banner tải về chắc chắn hơn + trang theo dõi

Vấn đề: nhiều banner vẫn dùng link `banners.aeseo1.com` vì việc tải ảnh chỉ dựa vào WP-Cron,
mà khi LiteSpeed cache gần như mọi trang thì WP-Cron rất ít khi chạy.
- **Tải ngay sau khi trả trang cho khách**: lượt xem nào gặp ảnh chưa có sẽ đóng kết nối với khách
  trước (`litespeed_finish_request` / `fastcgi_finish_request`) rồi mới tải ảnh → không cần WP-Cron,
  khách không phải chờ. WP-Cron vẫn giữ làm dự phòng.
- **Trang mới: SEO1 Banners → Ảnh banner**: bao nhiêu ảnh đã nằm trên máy chủ, ảnh nào chưa tải,
  ảnh nào lỗi kèm lý do (lỗi kết nối, HTTP 403/404, không ghi được thư mục...), kiểm tra quyền ghi
  uploads / GD WebP / WP-Cron, và nút **"Tải & tối ưu ngay"** (bỏ qua thời gian chờ sau lỗi).
- Cho phép tối đa 3 lần chuyển hướng khi tải ảnh; User-Agent dạng trình duyệt để tránh WAF chặn.
- Ảnh lỗi chỉ chờ 5 phút trước khi thử lại (trước là 10 phút).

## 1.1.4 — Tự nén / thu nhỏ ảnh banner

PageSpeed báo ảnh catfish 347,8 KiB có thể giảm 337 KiB (WebP gần như không nén) và logo
500×500 chỉ hiển thị 120×120. Plugin nay tối ưu ảnh ngay khi tải về máy chủ:
- **Ảnh tĩnh**: logo (ảnh gần vuông) thu về cạnh dài tối đa 320px; banner ngang rộng tối đa 1200px;
  nén lại WebP chất lượng 80 / JPEG 82 (giữ nguyên định dạng và tên file). Chỉ dùng bản mới nếu
  nhỏ hơn ít nhất 10%.
- **Ảnh động (GIF, WebP động, APNG): giữ nguyên** để không mất hiệu ứng — loại này cần được
  tối ưu từ phía server banner.
- Ảnh đã tải từ các bản trước được tối ưu dần trong cron (mỗi file 1 lần).
- Kết quả thử: banner WebP lossless 1456×180 388 KB → 29 KB (−92%); logo WebP 500×500
  44 KB → 15 KB (−65%); logo JPEG 126 KB → 27 KB (−78%); ảnh động giữ nguyên.
- Cần thư viện GD có hỗ trợ WebP (hầu hết hosting có sẵn); không có thì ảnh giữ nguyên như cũ.

## 1.1.3 — Giảm LCP do catfish xoay

- Bản 1.1.1–1.1.2 chọn banner xoay của catfish bằng `frontend.js` (bị LiteSpeed trì hoãn) →
  trang hiện banner A, vài giây sau đổi sang banner B: tải 2 ảnh và ảnh B được tính là LCP mới
  rất muộn (trên mobile, ảnh catfish thường là phần tử LCP).
- Nay banner được chọn bởi một script inline rất nhỏ ngay sau HTML catfish, có
  `data-no-optimize` / `data-no-defer` / `data-cfasync="false"` để LiteSpeed, WP Rocket,
  Cloudflare Rocket Loader không trì hoãn → chọn trước khi ảnh được tải, chỉ tải 1 ảnh, không đổi ảnh.
  Có `<noscript>` dự phòng.
- Đo trên Chromium (LiteSpeed JS Delayed, 412px): 1.1.2 tải 2 ảnh catfish ở 50% lượt xem;
  1.1.3 luôn 1 ảnh.

## 1.1.2 — Sửa banner không hiện khi dùng WebP Express

**Nguyên nhân:** WebP Express ghi `.htaccess` có `RewriteEngine On` vào `wp-content/uploads`.
Trên Apache/LiteSpeed, file này thay thế rewrite của WordPress cho mọi request trong `uploads/`,
nên request tới ảnh banner chưa có trên đĩa không còn tới được proxy của plugin. Nếu bật
"Create webp files upon request", `webp-realizer.php` còn trả 404 kèm header
`X-WebP-Express-Error: ... could not find an existing jpg/png ...`.
Converter for Media và các plugin ghi rewrite vào `uploads/` cũng có thể gây lỗi tương tự.

**Cách sửa:** plugin không còn phụ thuộc cơ chế "file không tồn tại → WordPress":
- Ảnh được **tải sẵn bằng WP-Cron** về `uploads/{banners,brands,toplist}/` ngay khi có dữ liệu
  banner mới; kiểm tra là ảnh thật (không SVG, ≤ 3MB), ghi an toàn.
- Khi in HTML: ảnh đã có trên đĩa → URL nội bộ (file tĩnh, WebP Express để yên vì file tồn tại).
  Chưa có → **dùng tạm URL gốc trên server banner** nên banner luôn hiển thị, rồi cron tải về.
- Tải xong ảnh mới → tự xoá page cache để trang đã cache chuyển sang URL nội bộ.
- Proxy cũ giữ lại làm lớp dự phòng.

Đã kiểm thử bằng cách mô phỏng đúng hành vi WebP Express (file thiếu trong uploads → 404,
không chuyển cho WordPress): bản 1.1.1 vỡ toàn bộ ảnh; bản 1.1.2 hiển thị đủ ảnh ở lượt xem đầu
(từ server gốc) và sau khi cron chạy (từ máy chủ của site).

## 1.1.1 — Tương thích LiteSpeed Cache & plugin tối ưu ảnh

Đã kiểm thử với LiteSpeed Cache 7.9.1 (Lazy Load Images, CSS/JS Minify + Combine kèm inline,
JS Deferred và JS Delayed) trên Chromium: slider chạy, đủ ảnh kể cả bản nhân bản, catfish/popup
hiển thị, không lỗi JS.

- **Lazy-load bên ngoài**: ảnh slider, catfish, popup, banner xoay có `class="skip-lazy no-lazyload"`
  + `data-no-lazy="1" data-skip-lazy="1"` → LiteSpeed (đã xác minh trong mã nguồn `media.cls.php`),
  WP Rocket, EWWW, Smush... không thay `src` bằng ảnh giữ chỗ. Trước đây bản nhân bản của slider
  có thể bị trống. Ảnh toplist/brand vẫn để các plugin lazy-load bình thường.
- **UCSS (LiteSpeed "Generate UCSS")**: animation slider khai báo tĩnh trong CSS (thời lượng qua
  biến `--seo1-dur`), popup bật/tắt bằng inline style → không còn phụ thuộc CSS của class do JS thêm
  vào (loại CSS mà UCSS hay xoá).
- **JS bị gộp/trì hoãn**: JS tự đọc prefix từ HTML (`data-seo1-prefix`) nếu biến cấu hình bị mất.
- **Page cache**:
  - Dữ liệu banner/link thay đổi (cron làm mới) → tự xoá page cache: LiteSpeed (`litespeed_purge_all`),
    WP Rocket, W3 Total Cache, WP Super Cache, WP Fastest Cache. Tối đa 1 lần/60 giây; chỉ khi dữ liệu thật sự đổi.
  - Lưu cài đặt hoặc bấm "Xóa cache" trong trang SEO1 Banners cũng xoá page cache.
  - Catfish chế độ xoay: chọn ngẫu nhiên bằng JS ở mỗi lượt xem → vẫn xoay khi trang đã được cache
    (trước đây server chọn 1 lần rồi bị "đóng băng" trong cache).
- Proxy ảnh thoát trước khi LiteSpeed khởi tạo → phản hồi 404/415 của proxy không bị LiteSpeed cache.

## 1.1.0

### Hiệu năng
- **Image proxy ghi ảnh xuống đĩa**: ảnh banner chỉ tải từ server nguồn 1 lần, các lần sau web server trả file tĩnh (không chạy PHP, không gọi ra ngoài).
- **Không còn chặn trang khi API/R2 chậm hoặc lỗi**: dữ liệu được lưu 2 tầng (bản mới + bản tốt gần nhất). Khi hết hạn, trang dùng ngay bản gần nhất và WP-Cron làm mới nền. API lỗi → nghỉ 5 phút mới thử lại.
  - Đo trên môi trường thử khi API lỗi: bản 1.0.0 mất ~15 giây/lượt tải trang, bản 1.1.0 ~0,2 giây và banner vẫn hiển thị.
- Kiểm tra cấu hình R2 chuyển sang WP-Cron (trước đây chặn trang tối đa 2 giây mỗi 5 phút, và chặn mọi request khi R2 lỗi).
- Dữ liệu chỉ đọc 1 lần/request dù trang có nhiều shortcode.
- TTL cache mặc định 300 giây (tối thiểu 60).
- **CSS ghi ra file tĩnh** `wp-content/uploads/seo1-adbanner/style-<hash>.css` (đã minify, ~13KB) thay vì in inline vào HTML; trình duyệt cache được giữa các trang. Không ghi được file thì tự động in inline như cũ.
- Bỏ `assets/css/frontend.css` (1 request chặn render chỉ chứa 1 keyframe).
- `frontend.js` tải `defer` và **chỉ tải trên trang có vị trí cần JS** (catfish, slider, popup, banner xoay).

### SEO / Core Web Vitals / truy cập
- Sửa schema toplist: thêm `itemprop="itemListElement"` và `numberOfItems` (trước đây ItemList rỗng).
- Thêm `width`/`height` cho ảnh lưới brand; catfish/brand-button/popup/banner xoay nhận `width`/`height` nếu API trả về (`width`/`height` hoặc `image_width`/`image_height`) → giảm CLS.
- Slider: bỏ 2 nút prev/next bị ẩn; bản nhân bản có `aria-hidden` + `tabindex="-1"`; thêm `role="region"`; alt mặc định "Logo {brand}".
- Tôn trọng `prefers-reduced-motion` (dừng marquee, shimmer, animation).

### Sửa lỗi
- Popup chế độ `session` dùng `sessionStorage` (trước đây không bao giờ hiện lại); mọi thao tác storage bọc try/catch.
- Hết cảnh báo PHP 8 "Undefined array key 'label'" ở nút CTA.
- JSON banner xoay lỗi không còn làm hỏng toàn bộ script.

### Bảo mật
- Proxy: **bỏ SVG**, kiểm tra nội dung là ảnh thật (`getimagesizefromstring`), giới hạn 3MB, không theo redirect, chỉ HTTPS, tên file chặt chẽ.
- Bỏ rate limit theo IP (sai khi đứng sau Cloudflare); thay bằng giới hạn tổng 120 lần tải/phút từ server nguồn + nhớ ảnh không tồn tại 10 phút.
- Validate `catfish_width` trước khi đưa vào CSS.
- `wp_safe_redirect`, cron chỉ làm mới URL thuộc API đang cấu hình.
- Thêm `uninstall.php` dọn option, transient, cron và file CSS khi xoá plugin.

### Chưa thay đổi (cần quyết định)
- Các cài đặt giao diện `slider_*`, `catfish_height*`, `catfish_bg`, `catfish_cols` vẫn chưa được áp vào CSS. Nối vào sẽ đổi giao diện đang chạy của các site, nên để nguyên.
- Thứ tự ưu tiên API URL giữ như cũ: cấu hình từ R2 > ô API URL trong cài đặt.

### Lưu ý khi triển khai
1. Sau khi cập nhật: **Purge All** LiteSpeed Cache (và Cloudflare nếu có).
2. Nên dùng cron thật của server thay cho WP-Cron:
   `define('DISABLE_WP_CRON', true);` trong wp-config.php và crontab
   `*/5 * * * * curl -s https://domain.com/wp-cron.php?doing_wp_cron >/dev/null`
3. Thư mục `wp-content/uploads/` cần quyền ghi (đã cần sẵn cho upload ảnh của WordPress).
4. Cập nhật 1 site trước, theo dõi 24–48 giờ rồi mới cập nhật các site còn lại.
