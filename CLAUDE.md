# CLAUDE.md — seo1-adbanner (Monorepo)

## Cấu trúc monorepo

```
seo1-adbanner/
├── CLAUDE.md
├── package.json          # npm workspaces root
├── ecosystem.config.js   # PM2 config cho cả 2 service
├── .env.example
├── .gitignore
├── scripts/
│   └── deploy.sh         # 1 lệnh deploy toàn bộ
│
├── backend/              # Express 5 + SQLite API server
│   ├── package.json      # name: @seo1/backend
│   └── src/
│       ├── index.js      # Entry point, CORS, auth, routes
│       ├── db.js         # SQLite schema + auto migration
│       ├── routes/
│       │   ├── sites.js          # CRUD sites + style config
│       │   ├── brands.js         # CRUD brands + bulk import + domain history
│       │   ├── banners.js        # Pool ảnh + multi-upload
│       │   ├── slots.js          # Slot manager
│       │   ├── toplist.js        # Bảng xếp hạng
│       │   ├── image-domains.js  # Pool domain chống footprint
│       │   └── public.js         # Public API cho WP plugin
│       └── utils/
│           ├── cache.js          # 2-tier cache (node-cache)
│           ├── storage.js        # R2 + local fallback
│           └── defaultStyles.js  # Style mặc định mỗi placement
│
├── admin/                # Next.js 15 Admin Dashboard
│   ├── package.json      # name: @seo1/admin
│   ├── app/
│   │   ├── globals.css   # Design system: CSS variables + utility classes
│   │   ├── login/        # Trang đăng nhập
│   │   └── admin/
│   │       ├── layout.tsx      # Sidebar + CommandBar + Cmd+K
│   │       ├── sites/          # CRUD sites
│   │       ├── slots/          # Slot Manager drag-drop
│   │       ├── toplist/        # Toplist drag-drop
│   │       ├── appearance/     # Style config + live preview
│   │       ├── brands/         # CRUD + bulk import JSON
│   │       ├── banners/        # Banner pool upload
│   │       ├── image-domains/  # Domain pool manager
│   │       └── recycle/        # Recycle bin
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── SiteSwitcher.tsx
│   │   ├── CommandBar.tsx    # Cmd+K navigation
│   │   └── ui/
│   │       ├── StyleControls.tsx   # SliderControl, ColorControl, Toggle, Segment
│   │       └── PlacementPreview.tsx # Live preview 6 placement types
│   └── lib/
│       ├── api.ts        # siteApi, brandApi, bannerApi, slotApi, toplistApi...
│       ├── types.ts      # TypeScript interfaces + PLACEMENT_COLORS/ICONS
│       └── icons.tsx     # PlacementIcon component
│
└── plugin/               # WordPress Plugin (cần implement)
    └── package.json
```

---

## Lệnh phổ biến

```bash
# Development (chạy cả 2)
npm run dev

# Chỉ backend
npm run dev:backend

# Chỉ admin UI
npm run dev:admin

# Production build admin
npm run build

# Deploy lên VPS (pull + build + pm2 restart)
npm run deploy

# PM2
npm run logs      # xem log cả 2 service
npm run status    # trạng thái
npm run restart   # restart cả 2
```

---

## Environment Variables

Backend đọc từ `backend/.env`:
```
BACKEND_PORT=4001
ADMIN_PASSWORD=xxx
ADMIN_TOKEN=xxx
BASE_URL=https://banners.aeseo1.com
R2_ENDPOINT=       # trống = dùng local
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=
IMAGE_POOL_DOMAIN=img-pool.com
```

**QUAN TRỌNG:** `require('dotenv').config()` chỉ gọi 1 lần ở đầu `backend/src/index.js`. KHÔNG gọi lại ở bất kỳ file nào khác.

---

## URLs

| Service | Dev | Production |
|---------|-----|-----------|
| Backend API | http://localhost:3001 | https://banners.aeseo1.com |
| Admin UI | http://localhost:3000 | https://banners.aeseo1.com/admin (hoặc admin.aeseo1.com) |

---

## Database Schema (SQLite)

```
sites              → mỗi WordPress site (nganh-g, phishing-s...)
brands             → nhà cái global (net88, 789, sun...)
brand_domain_history → lịch sử đổi domain
banners            → pool ảnh (gắn brand + placement, không gắn site)
slots              → vị trí hiển thị (site + placement + position)
slot_banners       → join: slot ↔ banner (nhiều banner khi rotate)
toplist_entries    → bảng xếp hạng nhà cái theo site
image_domains      → pool subdomain chống footprint SEO
```

DB tự migrate khi start — không cần chạy migration thủ công.

---

## API chính

### Public (WordPress plugin gọi)
```
GET /api/v2/site/:id/banners   # banner + slot data + toplist + site_type (cache 60s)
GET /api/brands/urls           # brand login URLs (KHÔNG cache — tức thì)
GET /api/v2/site/detect        # auto-detect site từ domain
```

**Response shape — `/api/brands/urls`:**
```json
{
  "success": true,
  "data": {
    "net88":  "https://net88.com/login",
    "789bet": "https://789bet.net/go"
  }
}
```
Flat map: `brand_id → url` (string). Plugin dùng `data[banner.brand_id]` để resolve click URL.

**Response shape — `/api/v2/site/:id/banners`:**
```json
{
  "success": true,
  "data": {
    "banners_catfish": [{ "position": 1, "mode": "rotate", "banners": [...], "slot_style": null }],
    "banners_button":  [{ "position": 1, "mode": "fixed",  "banner": {...}, "slot_style": {...} }],
    "brands":   [{ "id": "net88", "name": "Net88", "button_image": "https://..." }],
    "toplist":  [{ "rank": 1, "brand_id": "net88", "name": "Net88", "image_url": "https://..." }],
    "site_type": "nganh-g"
  }
}
```
Banner object: `{ id, brand_id, title, image_url, click_url }`. `click_url` là null nếu dùng brand URL.

### Admin (cần header x-admin-token)
```
POST /auth/login
CRUD /api/sites
CRUD /api/brands
POST /api/brands/bulk          # import JSON hàng loạt
CRUD /api/banners
CRUD /api/slots
PUT  /api/slots/:id/banners    # gán banner vào slot
CRUD /api/toplist
PUT  /api/toplist/reorder
CRUD /api/image-domains
POST /api/image-domains/generate
POST /api/cache/clear
```

---

## Design System (admin/app/globals.css)

**KHÔNG dùng Tailwind. KHÔNG dùng emoji.**

CSS classes tái sử dụng:
```
.btn .btn-primary .btn-secondary .btn-ghost .btn-danger .btn-sm
.input
.card
.label
.dot .dot-active .dot-off .dot-warn
.chip
.modal-overlay .modal .modal-header .modal-body .modal-footer
.empty .empty-icon
.mono
.fade-in
```

CSS Variables:
```
--accent: #6366F1 (indigo)
--bg, --bg-subtle, --bg-hover
--border, --border-strong
--text, --text-secondary, --text-muted
--sidebar-w: 208px, --topbar-h: 52px
--font-sans: Inter, --font-mono: JetBrains Mono
```

---

## Quy tắc code

1. **Image guard** — `{url ? <img src={url}/> : <FallbackIcon/>}` — KHÔNG `<img src={url||''}>`
2. **Icon** — Lucide React, strokeWidth 1.6-2, KHÔNG emoji
3. **Empty state** — class `.empty` + `.empty-icon` với Lucide icon
4. **PlacementIcon** — `<PlacementIcon name={PLACEMENT_ICONS[p]}/>` từ `lib/icons.tsx`
5. **Click URL** — plugin resolve: `banner.click_url || brandUrls[banner.brand_id]`
6. **CORS** — Express 5 wildcard: `app.options(/.*/, cors())` không phải `'*'`

---

## Việc cần làm

- [ ] WordPress Plugin (`plugin/`) — shortcode, settings, render, cache, JS rotate
- [ ] OLS reverse proxy config cho `banners.aeseo1.com`
- [ ] Cloudflare R2 setup cho production
- [ ] Image domain pool wildcard CNAME
- [ ] Test end-to-end toàn bộ flow

---

## Git

```
Repo: https://github.com/hoangphihongchoibet-collab/seo1-adbanner
Branch: main
```

Deploy:
```bash
# Local → push
git add . && git commit -m "feat: ..." && git push

# VPS → pull + restart
ssh user@server "cd ~/seo1-adbanner && npm run deploy"
```
