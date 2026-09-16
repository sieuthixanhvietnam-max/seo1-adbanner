# STRUCTURE.md

## Monorepo Layout

```
seo1-adbanner/
├── CLAUDE.md                    # Primary context for Claude Code
├── package.json                 # npm workspaces: backend + admin
├── .gitignore
│
├── backend/                     # Express API server
│   ├── package.json
│   ├── .env                     # PORT, ADMIN_PASSWORD, ADMIN_TOKEN, BASE_URL
│   ├── .env.example
│   └── src/
│       ├── index.js             # Entry: dotenv (ONLY HERE), CORS, routes
│       ├── db.js                # SQLite schema + auto-migration
│       ├── routes/
│       │   ├── sites.js         # CRUD + bulk import + styles
│       │   ├── brands.js        # CRUD + domain history + bulk JSON import
│       │   ├── banners.js       # Pool + multi-upload + hash dedup
│       │   ├── slots.js         # Slot manager + slot_style per slot
│       │   ├── toplist.js       # Rankings + reorder + image upload
│       │   ├── public.js        # Public API for WP plugin (no auth)
│       │   ├── preview.js       # HTML preview endpoint for iframe
│       │   └── image-domains.js # Anti-footprint domain pool
│       └── utils/
│           ├── cache.js         # node-cache: banners 60s, brands 10s
│           ├── storage.js       # R2 or local /uploads/, buildImageUrl()
│           └── defaultStyles.js # May be removed if Appearance page dropped
│
├── admin/                       # Next.js Admin UI
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── globals.css          # Design tokens, component classes
│   │   ├── layout.tsx           # Root layout
│   │   ├── login/page.tsx
│   │   └── admin/
│   │       ├── layout.tsx       # Shell: Sidebar + CommandBar + Cmd+K
│   │       ├── sites/page.tsx   # CRUD + bulk JSON import
│   │       ├── slots/page.tsx   # Drag banner from pool into slot
│   │       ├── toplist/page.tsx # Drag-drop ranking
│   │       ├── appearance/page.tsx  # Style config (may be removed)
│   │       ├── brands/page.tsx  # CRUD + bulk import + domain history
│   │       ├── banners/page.tsx # Pool + drag-drop upload + preview
│   │       ├── image-domains/page.tsx
│   │       └── recycle/page.tsx
│   ├── components/
│   │   ├── Sidebar.tsx          # Groups: Vận hành / Nội dung / Hệ thống
│   │   ├── Header.tsx           # Title + actions + settings modal
│   │   ├── SiteSwitcher.tsx     # Dropdown: select active site
│   │   ├── CommandBar.tsx       # Cmd+K: jump to page or switch site
│   │   └── ui/
│   │       ├── StyleControls.tsx    # Slider, Color, Toggle, Segment
│   │       └── PlacementPreview.tsx # Live preview (if Appearance kept)
│   └── lib/
│       ├── api.ts               # siteApi, brandApi, bannerApi, slotApi, toplistApi...
│       ├── types.ts             # Interfaces, PLACEMENT_COLORS, PLACEMENT_ICONS
│       └── icons.tsx            # PlacementIcon component
│
├── plugin/                      # WordPress PHP Plugin
│   ├── adbanner.php             # Plugin header + init + activation hook
│   ├── adbanner-config.php      # STYLE CONFIG — admin edits this file
│   ├── includes/
│   │   ├── class-settings.php   # WP Admin menu + tracking links tab
│   │   ├── class-api.php        # get_banners() + get_brand_urls()
│   │   ├── class-render.php     # Shortcode rendering all placements
│   │   └── class-assets.php     # Enqueue CSS/JS
│   └── assets/
│       ├── adbanner.css         # Structural CSS only (popup position)
│       └── adbanner.js          # Popup delay/frequency logic
│
└── scripts/
    ├── deploy.sh                # git pull + npm install + build + pm2 restart
    ├── setup-vps.sh             # First-time VPS setup
    └── deploy-plugin.sh         # Rename plugin for anti-footprint
```

## Database Tables

```
sites              id, name, domain, placements (JSON), site_type, image_domain_id
brands             id, name, domain, url_path, logo_url, button_image, sort_order
brand_domain_history  brand_id, old_domain, new_domain, changed_at
banners            id, brand_id, placement, image_key, title, click_url, file_hash
slots              id, site_id, placement, position, display_mode, is_active, slot_style (JSON)
slot_banners       slot_id, banner_id, order_in_rotation
toplist_entries    id, site_id, brand_id, rank, image_key, is_active
image_domains      id, subdomain, base_url, site_id
```

## Key Files to Know

| File | What it does |
|------|-------------|
| `backend/src/index.js` | Only place `dotenv.config()` is called |
| `backend/src/routes/public.js` | What WP plugin receives — know this format |
| `admin/app/globals.css` | All design tokens and utility classes |
| `admin/lib/api.ts` | All API calls — add new endpoints here |
| `plugin/adbanner-config.php` | Style config — WP admin edits per site |
| `plugin/includes/class-render.php` | All placement rendering logic |