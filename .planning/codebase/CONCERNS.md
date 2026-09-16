# CONCERNS.md

## Known Issues (Active)

### 1. Catfish images not displaying on WordPress
- **Status:** Active bug
- **Symptom:** Catfish container renders (black background visible) but images are broken
- **Debug:** Run in browser Console: `document.querySelector('[class$="-catfish"] img')?.src`
- **Likely cause:** Image URL returning 404 or CORS issue
- **Fix needed in:** `plugin/includes/class-render.php`

### 2. Appearance page — under review
- **Status:** Pending decision
- **Context:** May be removed entirely — style config moving to `plugin/adbanner-config.php`
- **Impact if removed:** Delete `admin/app/admin/appearance/`, remove `defaultStyles.js`, remove `styles` from public API response, add `site_type` to response

---

## Resolved Issues

### dotenv multiple calls (FIXED)
- **Was:** `require('dotenv').config()` called in db.js, storage.js, image-domains.js
- **Effect:** dotenvx overwrote env vars with empty values on subsequent calls → all API calls 401
- **Fix:** dotenv called ONLY in `backend/src/index.js` line 1

### Express 5 wildcard (FIXED)
- **Was:** `app.use('*', handler)` → PathError on startup
- **Fix:** Changed to `app.use('/(.*)', handler)` and `app.options(/.*/, cors())`

### Image src empty string (FIXED)
- **Was:** `<img src={entry.image_url}>` when image_url is ''
- **Effect:** Browser warning + downloads current page
- **Fix:** Guard all image src with conditional render

### Admin CORS (FIXED)
- **Was:** Next.js (localhost:3000) calling Express (localhost:3001) — CORS blocked
- **Fix:** `cors({ origin: '*' })` + explicit `app.options(/.*/, cors())` preflight handler

### Rotate mode not rendering (FIXED)
- **Was:** Plugin only checked `slot['banner']` (fixed mode), ignored `slot['banners']` (rotate mode)
- **Fix:** Check both — if `banner` is null, pick random from `banners[]` array

---

## Architectural Decisions

### Style config in plugin (not server)
- **Decision:** Plugin manages all CSS — server only provides data
- **Rationale:** 1500 sites don't need per-site style config, reduces API payload, simpler system
- **Trade-off:** Style changes require plugin redeployment (acceptable — rare event)

### Tracking links in wp_options (not server DB)
- **Decision:** Each WP site stores its own affiliate tracking links
- **Rationale:** Zero server config needed, WP admin self-manages, clean separation
- **Trade-off:** No centralized visibility of tracking links (acceptable)

### Brand URLs not cached
- **Decision:** `/api/brands/urls` has no cache (always fresh)
- **Rationale:** When brand blocks/changes domain, all 1500 sites must update instantly
- **Trade-off:** Extra API call per page load (3s timeout, lightweight response)

### SQLite over PostgreSQL
- **Decision:** SQLite with better-sqlite3
- **Rationale:** Single server, simple ops, no connection pooling issues, synchronous API
- **Trade-off:** Cannot horizontally scale backend (not needed at current scale)

---

## Performance Considerations

| Concern | Current | Target |
|---------|---------|--------|
| API response size | ~3KB (without styles) | <5KB |
| Banner cache TTL | 60s | Configurable per site |
| Brand URL cache | None | None (by design) |
| Image CDN | Cloudflare (auto) | + R2 for storage |
| Concurrent WP sites | 1500 | Sufficient with PM2 + cache |

---

## Security Notes

- `ADMIN_TOKEN` must be long and random — it's the only auth for all write operations
- Private keys (SSL, R2) must never be committed to git
- Plugin prefix is anti-footprint, not security — do not rely on it for access control
- Brand URLs endpoint is public — do not include sensitive data there