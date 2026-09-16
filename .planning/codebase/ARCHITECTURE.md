# ARCHITECTURE.md

## System Overview

Centralized banner management system for 1500 WordPress sites in the online casino/gambling niche. One change on the server → all sites update instantly.

## Components

### 1. Backend API (`backend/`)
- **Role:** Single source of truth for all banner data
- **Tech:** Node.js 22 + Express 5 + SQLite
- **Port:** 4002 (production: `https://banners.aeseo1.com`)
- **Process:** PM2

### 2. Admin UI (`admin/`)
- **Role:** Dashboard to manage banners, brands, slots, toplist
- **Tech:** Next.js 15 + TypeScript
- **Port:** 4003 (production: `https://banners.aeseo1.com/admin`)
- **Process:** PM2

### 3. WordPress Plugin (`plugin/`)
- **Role:** Fetch data from API and render banners on WP sites
- **Tech:** PHP 7.4+
- **Style:** Managed entirely in plugin (not server)

## Data Flow

```
Admin UI
  ↓ REST API (x-admin-token)
Backend (Express + SQLite)
  ↓ Public API (cached 60s)
WordPress Plugin (PHP)
  ↓ render shortcode
WordPress Site (HTML)
  ↓ user sees banners
```

## Responsibility Split

| Concern | Owner |
|---------|-------|
| Banner images | Backend (uploads/ or R2) |
| Brand URLs (login links) | Backend (no cache, instant) |
| Toplist ranking | Backend |
| Slot assignment (which banner where) | Backend (Slot Manager) |
| CSS layout, colors, sizing | Plugin (adbanner-config.php) |
| Tracking links (affiliate IDs) | Plugin (wp_options per site) |
| Review text for toplist | WordPress theme/editor |

## Click URL Resolution (3-tier priority)

```
1. banner.click_url        → manual override per banner
2. wp_options tracking link → affiliate link set by WP admin
3. brand_urls API response  → default brand login URL (no cache)
```

## Caching Strategy

| Data | Cache | Location |
|------|-------|----------|
| Banner data | 60s | WP transient |
| Brand URLs | None | Always fresh |
| API config | 24h | WP transient |
| Static assets | 4h | Cloudflare CDN |

## Anti-Footprint Architecture (5 layers)

```
Layer 1 — API Domain:    *.api-pool.com → banners.aeseo1.com (wildcard CNAME)
Layer 2 — Image Domain:  Cloudflare Transform Rules proxy via site domain
Layer 3 — CSS Classes:   Random prefix per site (e68123-catfish)
Layer 4 — Plugin Name:   Deploy script renames plugin per site
Layer 5 — JavaScript:    Inline in footer, no separate enqueued file
```

## Server Infrastructure

```
VPS: 139.59.227.174 (DigitalOcean Singapore)
OLS: Reverse proxy → backend :4002 and admin :4003
CF:  Cloudflare proxy + SSL termination
PM2: Process management + auto-restart
```