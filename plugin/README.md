# SEO1 Ad Banner — WordPress Plugin

Plugin đang dùng: `seo1-adbanner/` (shortcode `[seo1_banner]`).

## Cấu trúc
```
plugin/
├── adbanner-config.php        ← Style config mặc định (đóng gói vào seo1-adbanner/ khi build ZIP)
└── seo1-adbanner/
    ├── seo1-adbanner.php      ← Main plugin file
    ├── includes/
    │   ├── class-admin.php        ← Trang cài đặt WP Admin
    │   ├── class-api-client.php   ← Gọi backend API
    │   ├── class-remote-config.php
    │   ├── class-css.php
    │   ├── class-renderer.php     ← Render HTML
    │   ├── class-shortcode.php    ← Đăng ký shortcode
    │   └── frontend.js
    └── assets/{css,js}/       ← admin + frontend
```

## Build
Nén thư mục `seo1-adbanner/` thành ZIP để cài lên WordPress. File `*.zip` bị git bỏ qua, không commit.
