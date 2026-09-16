# AdBanner Client — WordPress Plugin

**Status: TODO**

Xem thiết kế chi tiết trong `CLAUDE.md` phần "WordPress Plugin".

## Shortcodes
```
[adbanner type="catfish"]
[adbanner type="popup"]
[adbanner type="slider"]
[adbanner type="button"]
[adbanner type="brand-button"]
[adbanner type="toplist"]
```

## Cấu trúc dự kiến
```
plugin/
├── adbanner.php           ← Main plugin file
├── includes/
│   ├── class-settings.php ← WP Admin settings page
│   ├── class-api.php      ← Gọi API + WP transient cache
│   ├── class-render.php   ← Render shortcode HTML
│   └── class-assets.php   ← Enqueue CSS/JS
└── assets/
    ├── adbanner.css       ← Structural CSS (position:fixed, overlay...)
    └── adbanner.js        ← Rotate logic, popup delay, slider carousel
```
