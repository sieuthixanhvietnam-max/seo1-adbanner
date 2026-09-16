# TESTING.md

## Before Every Commit

```bash
# Backend syntax check
cd backend
node --check src/index.js
for f in src/routes/*.js src/utils/*.js; do node --check "$f"; done

# Admin TypeScript check
cd admin
npx tsc --noEmit

# Admin build check
npm run build
```

---

## Backend API Tests

### Health check
```bash
curl https://banners.aeseo1.com/
# Expected: {"success":true,"message":"Ad Banner Server v5.1",...}
```

### Auth
```bash
# Login
curl -X POST https://banners.aeseo1.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_PASSWORD"}'
# Expected: {"success":true,"token":"..."}

# Unauthorized write (no token)
curl -X POST https://banners.aeseo1.com/api/sites \
  -H "Content-Type: application/json" \
  -d '{"id":"test"}'
# Expected: 401 Unauthorized
```

### Public API (WordPress plugin calls this)
```bash
curl https://banners.aeseo1.com/api/v2/site/nganh-s/banners | python3 -m json.tool
# Expected: success:true, data contains banners_catfish, site_type, toplist...

# Verify NO styles object (removed)
curl https://banners.aeseo1.com/api/v2/site/nganh-s/banners | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'styles' not in d.get('data',{}), 'styles should be removed!'
assert 'site_type' in d.get('data',{}), 'site_type should be present!'
print('OK')
"

# Brand URLs (verify no cache header)
curl -I https://banners.aeseo1.com/api/brands/urls
# Expected: no cache-control or max-age=0
```

### Image serving
```bash
# Verify image loads
curl -I https://banners.aeseo1.com/uploads/banners/FILENAME.gif
# Expected: 200 OK, content-type: image/gif
```

---

## WordPress Plugin Tests

### After installation
1. Activate plugin → no PHP errors in WP debug log
2. Settings → AdBanner → API URL → "Test kết nối" → shows "OK"
3. Site dropdown loads correctly
4. Site Prefix shows 6-character random string (e.g., `e68123`)

### Shortcode rendering
```
[adbanner type="catfish"]
→ Renders black bar at bottom
→ 4 images visible in 2×2 grid (not black squares)
→ CSS class uses prefix: .e68123-catfish
→ Inspect HTML: <img src="https://banners.aeseo1.com/uploads/...">

[adbanner type="slider"]
→ Images scroll continuously from right to left
→ No pause/stop (infinite marquee)
→ Hover pauses if pauseOnHover=true

[adbanner type="button"]
→ 2 styled buttons side by side
→ Each button has correct brand text/color
→ Click opens brand site in new tab

[adbanner type="popup"]
→ Nothing visible immediately
→ After 3 seconds: overlay appears with banner image
→ Click X closes popup
→ Refresh page: popup does NOT reappear (once-per-day)

[adbanner type="toplist"]
→ List of brands with rank badges (#1 gold, #2 silver, #3 bronze)
→ "Đăng nhập" CTA button per brand

[adbanner type="brand-button"]
→ Grid of brand button images
→ Click each → correct brand URL
```

### Tracking links
```
WP Admin → Settings → AdBanner → Tab: Tracking Links
→ Enter: net88 = https://net88.cool?a=TEST123
→ Save
→ View page with [adbanner type="catfish"]
→ Inspect link href on net88 banner
→ Should be https://net88.cool?a=TEST123 (not server default)
```

### Click URL priority
```
1. Set banner.click_url = "https://override.com" in admin
   → Plugin should use this URL

2. Remove banner.click_url, set wp_options tracking link for net88
   → Plugin should use tracking link

3. Remove tracking link
   → Plugin should use /api/brands/urls response
```

### Mobile responsiveness
```
Catfish:      1 column (stacked vertically)
Slider:       Same marquee, images may be narrower
Button:       Stacks vertically on small screens
Brand-button: 2 columns on mobile (columns_mobile: 2)
Popup:        max-width: 90vw
```

---

## Anti-Footprint Verification

```bash
# Different sites should have different CSS classes
# Site A: class="e68123-catfish"
# Site B: class="a7f219-catfish"
curl https://site-a.com | grep 'catfish'
curl https://site-b.com | grep 'catfish'
# Should be different prefixes
```

---

## Performance

```bash
# API response time
time curl -s https://banners.aeseo1.com/api/v2/site/nganh-s/banners > /dev/null
# Target: < 200ms

# Image load time
time curl -s https://banners.aeseo1.com/uploads/banners/FILENAME.gif > /dev/null
# Target: < 500ms (Cloudflare cache)
```

---

## Deployment Checklist

```
Before deploying plugin to new WP site:
[ ] Backend running: curl https://banners.aeseo1.com/ returns 200
[ ] Correct site created in Admin UI with right placements
[ ] Brands imported with correct domains
[ ] Banners uploaded and assigned to slots
[ ] Toplist configured (for nganh sites)
[ ] Plugin zip downloaded with unique name
[ ] WP site installed and activated
[ ] Settings configured: API URL + site selected
[ ] Tracking links entered for all brands
[ ] Test each shortcode renders correctly
[ ] Verify images load (not broken)
[ ] Verify links go to correct affiliate URLs
```