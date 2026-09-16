# Cấu hình OpenLiteSpeed cho banners.aeseo1.com

## Virtual Host config

File: `/usr/local/lsws/conf/vhosts/banners.aeseo1.com/vhconf.conf`

```
extProcessor adbanner-backend {
  type                    proxy
  address                 http://localhost:3001
  maxConns                100
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

extProcessor adbanner-admin {
  type                    proxy
  address                 http://localhost:3000
  maxConns                100
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context /api {
  type                    proxy
  handler                 adbanner-backend
  addDefaultCharset       off
}

context /uploads {
  type                    proxy
  handler                 adbanner-backend
  addDefaultCharset       off
}

context /auth {
  type                    proxy
  handler                 adbanner-backend
  addDefaultCharset       off
}

context / {
  type                    proxy
  handler                 adbanner-admin
  addDefaultCharset       off
}
```

## Lưu ý
- `/api/*` và `/uploads/*` → Backend Express (port 3001)
- `/*` (còn lại) → Admin Next.js (port 3000)
- SSL cert quản lý bởi Cloudflare (Full SSL mode)
