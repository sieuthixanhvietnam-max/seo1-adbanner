# INTEGRATIONS.md

## Cloudflare

### Current Setup
- **Domain:** `aeseo1.com` managed on Cloudflare
- **Proxy:** All subdomains behind Cloudflare (orange cloud ON)
- **SSL mode:** Full (banners.aeseo1.com), Flexible (price.aeseo1.com)

### banners.aeseo1.com
```
DNS: A record → 139.59.227.174 (Cloudflare proxy ON)
SSL: Cloudflare Origin Certificate (/etc/ssl/banners.aeseo1.com.crt)
Mode: Full SSL
```

### Planned: Wildcard CNAME for anti-footprint
```
*.api-pool.com  → CNAME → banners.aeseo1.com [Proxy ON]
*.img-pool.com  → CNAME → banners.aeseo1.com [Proxy ON]
```
Setup once → unlimited random subdomains work automatically.

### Planned: Transform Rules for image proxy
```
Rule: If URI path starts with /bimg/
→ Rewrite origin to banners.aeseo1.com
→ Rewrite path: /bimg/* → /uploads/*
```
Apply to each of 1500 WP site domains via Cloudflare API (bulk script).
Result: Images served from site's own domain, server hidden.

---

## OpenLiteSpeed (OLS)

### Current Virtual Hosts
```
banners.aeseo1.com → backend :4002 (API + admin)
price.aeseo1.com   → Next.js :3000 + FastAPI :8000
superseo8386.com   → WordPress
site-trang.com     → WordPress
```

### banners.aeseo1.com routing
```
/         → adbanner backend :4002
/admin/*  → adbanner admin :4003
/_next/*  → adbanner admin :4003
/uploads/ → static files served by Express
```

### Config files
```
/usr/local/lsws/conf/httpd_config.conf         # listeners, vhost mapping
/usr/local/lsws/conf/vhosts/banners.aeseo1.com/vhconf.conf  # extprocessors
/etc/ssl/banners.aeseo1.com.crt                # Cloudflare origin cert
/etc/ssl/banners.aeseo1.com.key                # Private key
```

### Restart OLS
```bash
/usr/local/lsws/bin/lswsctrl restart
```

---

## PM2

### Current Processes
```
ID  Name               Port  Status
0   adbanner-backend   4002  Online
1   adbanner-admin     4003  Online
```

### Commands
```bash
pm2 status              # view all
pm2 logs adbanner-backend
pm2 restart adbanner-backend
pm2 save                # persist after reboot
```

---

## Cloudflare R2 (Planned)

For production image storage (replaces local /uploads/).

```
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET=adbanner-images
```

When configured, `storage.js` automatically uses R2 instead of local disk.
Public URL: `https://cdn.banners.aeseo1.com/{key}`

---

## WordPress Sites

### Plugin Installation
```
1. Download adbanner-client.zip
2. WP Admin → Plugins → Add New → Upload
3. Activate
4. Settings → AdBanner:
   - API URL: https://banners.aeseo1.com
   - Select site from dropdown
   - Add tracking links (Tab: Tracking Links)
```

### Shortcodes
```
[adbanner type="catfish"]
[adbanner type="slider"]
[adbanner type="button"]
[adbanner type="popup"]
[adbanner type="toplist"]
[adbanner type="brand-button"]
```

### Anti-footprint deployment
```bash
# Each site gets a different plugin name
bash scripts/deploy-plugin.sh "Media Optimizer"
bash scripts/deploy-plugin.sh "Content Flow"
bash scripts/deploy-plugin.sh "Site Enhancer"
```

---

## SSH Access

```bash
ssh -i /Users/peter/Documents/aws/seo1-key-do-root.pem root@139.59.227.174
```

### Upload code
```bash
rsync -av \
  --exclude='node_modules' --exclude='.next' \
  --exclude='data' --exclude='uploads' --exclude='.git' \
  -e "ssh -i /Users/peter/Documents/aws/seo1-key-do-root.pem" \
  . root@139.59.227.174:/root/seo1-adbanner/
```