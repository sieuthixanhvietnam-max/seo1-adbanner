const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
// dotenv loaded once in index.js

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'adserver.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Core tables ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    domain          TEXT DEFAULT '',
    placements      TEXT NOT NULL,
    image_domain_id TEXT,
    is_active       INTEGER DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS image_domains (
    id          TEXT PRIMARY KEY,
    base_url    TEXT NOT NULL UNIQUE,
    is_active   INTEGER DEFAULT 1,
    is_blocked  INTEGER DEFAULT 0,
    assigned_to TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS brands (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    domain       TEXT DEFAULT '',
    logo_url     TEXT DEFAULT '',
    button_image TEXT DEFAULT '',
    is_active    INTEGER DEFAULT 1,
    sort_order   INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS brand_domain_history (
    id         TEXT PRIMARY KEY,
    brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    old_domain TEXT NOT NULL,
    new_domain TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS banners (
    id         TEXT PRIMARY KEY,
    brand_id   TEXT REFERENCES brands(id) ON DELETE SET NULL,
    placement  TEXT NOT NULL DEFAULT '',
    title      TEXT DEFAULT '',
    image_key  TEXT NOT NULL DEFAULT '',
    click_url  TEXT DEFAULT '',
    file_hash  TEXT DEFAULT '',
    file_size  INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS slots (
    id           TEXT PRIMARY KEY,
    site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    placement    TEXT NOT NULL,
    position     INTEGER NOT NULL,
    display_mode TEXT DEFAULT 'fixed',
    is_active    INTEGER DEFAULT 1,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(site_id, placement, position)
  );

  CREATE TABLE IF NOT EXISTS slot_banners (
    slot_id           TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    banner_id         TEXT NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
    order_in_rotation INTEGER DEFAULT 0,
    PRIMARY KEY (slot_id, banner_id)
  );

  CREATE TABLE IF NOT EXISTS toplist_entries (
    id         TEXT PRIMARY KEY,
    site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    rank       INTEGER NOT NULL DEFAULT 0,
    image_key  TEXT DEFAULT '',
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_banners_brand     ON banners(brand_id);
  CREATE INDEX IF NOT EXISTS idx_banners_placement ON banners(placement);
  CREATE INDEX IF NOT EXISTS idx_banners_deleted   ON banners(is_deleted);
  CREATE INDEX IF NOT EXISTS idx_slots_site        ON slots(site_id);
  CREATE INDEX IF NOT EXISTS idx_slot_banners_slot ON slot_banners(slot_id);
  CREATE INDEX IF NOT EXISTS idx_brand_history     ON brand_domain_history(brand_id);
  CREATE INDEX IF NOT EXISTS idx_toplist_site      ON toplist_entries(site_id, rank);
`);

// ─── Safe migration helpers ───────────────────────────────────────────────────
const runSafe = (sql) => { try { db.exec(sql); } catch (_) {} };

// Brands: thêm cột mới nếu chưa có
runSafe(`ALTER TABLE brands ADD COLUMN domain TEXT DEFAULT ''`);
runSafe(`ALTER TABLE brands ADD COLUMN logo_url TEXT DEFAULT ''`);
runSafe(`ALTER TABLE brands ADD COLUMN button_image TEXT DEFAULT ''`);

// Backfill domain từ login_url cũ (login_url = domain đầy đủ)
try {
  const old = db.prepare(
    `SELECT id, login_url FROM brands WHERE login_url IS NOT NULL AND login_url != '' AND domain = ''`
  ).all();
  const upd = db.prepare(`UPDATE brands SET domain = ? WHERE id = ?`);
  db.transaction(() => {
    old.forEach(b => upd.run(b.login_url, b.id));
  })();
} catch (_) {}

// Banners: thêm cột mới nếu chưa có
runSafe(`ALTER TABLE banners ADD COLUMN placement TEXT DEFAULT ''`);
runSafe(`ALTER TABLE banners ADD COLUMN image_key TEXT DEFAULT ''`);
runSafe(`ALTER TABLE banners ADD COLUMN file_hash TEXT DEFAULT ''`);
runSafe(`ALTER TABLE banners ADD COLUMN file_size INTEGER DEFAULT 0`);
runSafe(`ALTER TABLE banners ADD COLUMN is_deleted INTEGER DEFAULT 0`);

// Backfill banners cũ: grp → placement, image_url → image_key
try {
  db.exec(`
    UPDATE banners SET placement = grp   WHERE placement = '' AND grp IS NOT NULL AND grp != '';
    UPDATE banners SET image_key = image_url WHERE image_key = '' AND image_url IS NOT NULL AND image_url != '';
  `);
} catch (_) {}

// Sites: thêm cột domain nếu chưa có (cho auto-detect)
runSafe(`ALTER TABLE sites ADD COLUMN domain TEXT DEFAULT ''`);

// Sites: site_type field (nganh-g, phishing-s, etc.)
runSafe(`ALTER TABLE sites ADD COLUMN site_type TEXT DEFAULT ''`);

// Slots: per-slot style (button per-slot styling)
runSafe(`ALTER TABLE slots ADD COLUMN slot_style TEXT DEFAULT ''`);

// Slots: button placement lưu brand trực tiếp (không qua banner)
runSafe(`ALTER TABLE slots ADD COLUMN brand_id TEXT DEFAULT NULL REFERENCES brands(id) ON DELETE SET NULL`);

// Tracking links — mỗi (domain × brand) = 1 tracking URL (từ Google Sheet)
runSafe(`
  CREATE TABLE IF NOT EXISTS site_tracking (
    domain    TEXT NOT NULL,
    brand_id  TEXT NOT NULL,
    track_url TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (domain, brand_id)
  )
`);
runSafe(`CREATE INDEX IF NOT EXISTS idx_site_tracking_domain ON site_tracking(domain)`);

// Lưu metadata của lần sync cuối
runSafe(`
  CREATE TABLE IF NOT EXISTS sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Index bổ sung cho query slot theo site (fix N+1 performance)
runSafe(`CREATE INDEX IF NOT EXISTS idx_slots_site_placement ON slots(site_id, placement, position)`);
runSafe(`CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain)`);
runSafe(`CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(is_active)`);

// Tạo site mặc định cho data cũ
try {
  if (!db.prepare(`SELECT id FROM sites WHERE id = 'martech-s'`).get()) {
    db.prepare(`INSERT INTO sites (id, name, placements, sort_order) VALUES (?, ?, ?, ?)`)
      .run('martech-s', 'Martech S', JSON.stringify({
        catfish: { label: 'Catfish', limit: 4, default_mode: 'rotate' },
        button:  { label: 'Nút bấm', limit: 2, default_mode: 'fixed' },
        popup:   { label: 'Popup',   limit: 1, default_mode: 'fixed' },
      }), 0);
  }
} catch (_) {}

module.exports = db;
