# STACK.md

## Backend

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | 22 | |
| Framework | Express | 5 | Wildcard routes use `/(.*)/` not `'*'` |
| Database | SQLite (better-sqlite3) | latest | Single file, auto-migration on start |
| Process | PM2 | 7 | Auto-restart, port 4002 |
| Storage | Local `/uploads/` | — | R2 when configured |
| Auth | Custom token | — | `x-admin-token` header |

## Admin UI

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 15.3 | App Router |
| Language | TypeScript | 5 | Strict mode |
| Styling | CSS Variables | — | No Tailwind, no CSS modules |
| Icons | Lucide React | 0.511 | No emoji |
| Drag-drop | @dnd-kit | latest | Slot Manager + Toplist |
| Fonts | Inter + JetBrains Mono | — | Google Fonts |
| Port | 4003 | — | Production via OLS proxy |

## WordPress Plugin

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | PHP | 7.4+ compatible |
| HTTP | wp_remote_get | WP native, no Guzzle |
| Cache | WP Transients | 60s for banner data |
| Storage | wp_options | Tracking links, prefix, site_id |
| CSS | Inline `<style>` | Catfish/slider inject inline with prefix |
| JS | Inline `<script>` | Footer injection, no enqueue |

## Infrastructure

| Service | Tech | Notes |
|---------|------|-------|
| VPS | DigitalOcean Singapore | 139.59.227.174 |
| Web Server | OpenLiteSpeed (OLS) | Reverse proxy |
| CDN/Proxy | Cloudflare | SSL + cache |
| Process Manager | PM2 7 | Both backend and admin |
| SSL | Cloudflare Origin Cert | Full SSL mode |

## Key Constraints

- Express 5: use `/(.*)/` for wildcard, NOT `'*'`
- `require('dotenv').config()` ONLY at top of `backend/src/index.js`
- No Tailwind in admin — CSS variables only
- No emoji anywhere — Lucide icons only
- Image `src` must be guarded: `{url ? <img src={url}/> : <Placeholder/>}`
- Brand URLs API call: NEVER cache (must be instant on domain change)