# SEO1 Ad Banner — WordPress Plugin

Mã nguồn trong `seo1-adbanner/` là bản đang chạy trên các website (hiện **1.1.8**, xem `seo1-adbanner/CHANGELOG.md`).
Giữ thư mục này đồng bộ với bản triển khai: test backend đọc regex ảnh trực tiếp từ `seo1-adbanner.php`
và `includes/class-image-cache.php`.

- `adbanner-config.php`: style config mặc định, đóng gói vào `seo1-adbanner/` khi build ZIP.
- Shortcode `[seo1_banner]` và các shortcode theo tiền tố (`[ab_catfish]`, ...).
- Plugin gửi `?domain=<host>` mỗi lần gọi `/api/v2/site/:id/banners`; backend dùng để cấp tên file ảnh riêng cho từng domain.

## Build
Nén thư mục `seo1-adbanner/` thành ZIP để cài lên WordPress. File `*.zip` bị git bỏ qua.
