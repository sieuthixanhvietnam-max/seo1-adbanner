const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Phải set env TRƯỚC khi require module dùng db
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo1-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.VARIANT_DIR = path.join(tmpDir, 'variants');
process.env.ADMIN_TOKEN = 'test-token';
process.env.IMAGE_VARIANTS = 'on'; // test phần biến thể (mặc định production là off)
process.env.IMAGE_ALIAS_PER_DOMAIN = 'off';
process.env.IMAGE_ALIAS_PILOT_DOMAINS = 'pilot.example.com';
process.env.IMAGE_ALIAS_MAX_DOMAINS = '1000';

const sharp = require('sharp');
{
  // Bảng ở định dạng CŨ (chưa có cột domain, UNIQUE(site_id,image_key)) + alias đang dùng + alias dạng YYYY/MM
  const Database = require('better-sqlite3');
  const pre = new Database(process.env.DB_PATH);
  pre.pragma('foreign_keys = OFF');
  pre.exec(`CREATE TABLE sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT DEFAULT '', placements TEXT NOT NULL, image_domain_id TEXT, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  pre.exec(`INSERT INTO sites (id, name, placements) VALUES ('site-a','a','{}')`);
  pre.exec(`CREATE TABLE image_aliases (alias TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, image_key TEXT NOT NULL, seed TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (site_id, image_key))`);
  pre.prepare(`INSERT INTO image_aliases (alias, site_id, image_key, seed) VALUES ('banners/inuse12345.webp', 'site-a', 'banners/inuse.webp', 'x')`).run();
  pre.prepare(`INSERT INTO image_aliases (alias, site_id, image_key, seed) VALUES ('2026/05/legacyslug1.webp', 'site-a', 'banners/legacy.webp', 'x')`).run();
  pre.prepare(`INSERT INTO image_aliases (alias, site_id, image_key, seed) VALUES ('banners/orphan12345.webp', 'site-deleted', 'banners/orphan.webp', 'x')`).run(); // nhóm đã xóa
  pre.close();
}
const db = require('../src/db');
const { getAlias, publicImageUrl, resolveAlias, normalizeDomain, aliasDomainFor } = require('../src/utils/imageAlias');
const { getAliasImage } = require('../src/utils/imageVariant');

const uploadsDir = path.join(__dirname, '../uploads/banners');
const createdFiles = [];
const KEY = 'banners/1712345678-a3f9c2e1.webp';

test.before(() => {
  const ins = db.prepare(`INSERT OR IGNORE INTO sites (id, name, placements) VALUES (?, ?, '{}')`);
  ['site-a', 'site-b', 'site-c'].forEach(id => ins.run(id, id));
});

test.after(() => {
  createdFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tương thích plugin WP (đọc regex thẳng từ mã nguồn plugin đang triển khai) ───
function phpRegexes() {
  const dir = path.join(__dirname, '../../plugin/seo1-adbanner');
  const out = [];
  const main = fs.readFileSync(path.join(dir, 'seo1-adbanner.php'), 'utf8');
  const cache = fs.readFileSync(path.join(dir, 'includes/class-image-cache.php'), 'utf8');
  const m1 = main.match(/preg_match\('#(\^\/wp-content\/uploads\/.+?)#(i?)', \$uri/);
  const m2 = cache.match(/PATTERN\s*=\s*'#(.+?)#(i?)';/);
  assert.ok(m1, 'không thấy regex proxy trong seo1-adbanner.php — cập nhật test nếu plugin đổi');
  assert.ok(m2, 'không thấy PATTERN trong class-image-cache.php — cập nhật test nếu plugin đổi');
  for (const m of [m1, m2]) out.push(new RegExp(m[1], m[2]));
  return out;
}

test('TƯƠNG THÍCH PLUGIN 1.1.8: mọi URL alias khớp regex proxy và regex tải ảnh về đĩa', () => {
  const res = phpRegexes();
  for (const domain of ['', 'foo.com']) {
    for (const key of [KEY, 'brands/logo.webp', 'toplist/t.jpg', 'banners/a.png', 'banners/a.gif', 'misc/other.webp']) {
      const url = publicImageUrl('site-a', key, null, domain);
      for (const re of res) assert.match(url, re, `plugin sẽ không xử lý ${url}`);
    }
  }
});

// ─── Định dạng alias ───
test('alias dạng <dir>/<slug>.<ext>, slug [a-z0-9] dài 8–16, giữ thư mục gốc và đuôi file', () => {
  assert.match(getAlias('site-a', KEY), /^banners\/[a-z0-9]{8,16}\.webp$/);
  assert.match(getAlias('site-a', 'banners/x.png'), /^banners\/[a-z0-9]{8,16}\.png$/);
  assert.match(getAlias('site-a', 'brands/logo.webp'), /^brands\/[a-z0-9]{8,16}\.webp$/);
  assert.match(getAlias('site-a', 'toplist/t.jpg'), /^toplist\/[a-z0-9]{8,16}\.jpg$/);
  assert.match(getAlias('site-a', 'misc/other.webp'), /^banners\//);
});

test('alias ổn định: cùng (site, domain, key) luôn ra cùng alias', () => {
  assert.equal(getAlias('site-a', KEY, 'foo.com'), getAlias('site-a', KEY, 'foo.com'));
  assert.equal(getAlias('site-a', KEY), getAlias('site-a', KEY));
});

test('KHÁC domain → KHÁC alias, không lộ key gốc; slug ngẫu nhiên (độ dài đa dạng)', () => {
  const a = getAlias('site-a', KEY, 'one.com'), b = getAlias('site-a', KEY, 'two.com'), g = getAlias('site-a', KEY, '');
  assert.equal(new Set([a, b, g]).size, 3);
  assert.ok(!a.includes('a3f9c2e1') && !a.includes('1712345678'));
  const lens = new Set();
  for (let i = 0; i < 60; i++) lens.add(getAlias('site-b', `banners/rand-${i}.webp`, 'len.com').split('/')[1].split('.')[0].length);
  assert.ok(lens.size >= 5, `độ dài slug phải đa dạng, chỉ có ${[...lens]}`);
});

test('resolveAlias tra ngược đúng (site, domain, key); alias lạ trả null', () => {
  const a = getAlias('site-b', KEY, 'abc.com');
  const row = resolveAlias(a);
  assert.deepEqual([row.site_id, row.domain, row.image_key], ['site-b', 'abc.com', KEY]);
  assert.equal(resolveAlias('banners/khongtontai.webp'), null);
});

test('publicImageUrl: prefix, domain pool, URL ngoài, rỗng', () => {
  assert.match(publicImageUrl('site-a', KEY), /^\/wp-content\/uploads\/banners\/[a-z0-9]{8,16}\.webp$/);
  assert.match(publicImageUrl('site-a', KEY, 'https://abc.pool.com/'), /^https:\/\/abc\.pool\.com\/banners\/[a-z0-9]{8,16}\.webp$/);
  assert.equal(publicImageUrl('site-a', 'https://cdn.x/y.png'), 'https://cdn.x/y.png');
  assert.equal(publicImageUrl('site-a', ''), '');
});

// ─── Chuẩn hóa domain & công tắc ───
test('normalizeDomain: www/hoa-thường/cổng/đường dẫn/dấu chấm cuối; chuỗi bậy → rỗng', () => {
  assert.equal(normalizeDomain('HTTPS://WWW.Foo.com:8080/x?y#z'), 'foo.com');
  assert.equal(normalizeDomain('foo.com.'), 'foo.com');
  assert.equal(normalizeDomain('sub.foo-bar.co.uk'), 'sub.foo-bar.co.uk');
  for (const bad of ['', null, undefined, 'localhost', 'a b.com', '../etc/passwd', 'foo..com', '-x.com', 'x'.repeat(300) + '.com', '<script>.com'])
    assert.equal(normalizeDomain(bad), '', `phải từ chối: ${bad}`);
});

test('công tắc tắt → dùng alias chung; chỉ domain thử nghiệm (pilot) được alias riêng', () => {
  assert.equal(aliasDomainFor('random.com'), '');
  assert.equal(aliasDomainFor('www.PILOT.example.com'), 'pilot.example.com');
  assert.equal(aliasDomainFor(undefined), '');
});

// ─── Migration ───
test('migration: bảng cũ nâng cấp có cột domain, giữ alias đang dùng (domain ""), xóa dạng YYYY/MM', () => {
  const cols = db.prepare(`PRAGMA table_info(image_aliases)`).all().map(c => c.name);
  assert.ok(cols.includes('domain'));
  const kept = resolveAlias('banners/inuse12345.webp');
  assert.ok(kept && kept.domain === '' && kept.image_key === 'banners/inuse.webp');
  assert.equal(getAlias('site-a', 'banners/inuse.webp'), 'banners/inuse12345.webp', 'alias đang dùng không đổi');
  assert.equal(resolveAlias('2026/05/legacyslug1.webp'), null);
  assert.equal(resolveAlias('banners/orphan12345.webp'), null, 'alias mồ côi bị bỏ, không làm sập khởi động');
});

test('xóa nhóm site → alias xóa theo (cascade)', () => {
  db.prepare(`INSERT INTO sites (id, name, placements) VALUES ('site-tmp','t','{}')`).run();
  const a = getAlias('site-tmp', KEY, 'z.com');
  db.prepare(`DELETE FROM sites WHERE id = 'site-tmp'`).run();
  assert.equal(resolveAlias(a), null);
});

// ─── Biến thể byte (tùy chọn, IMAGE_VARIANTS=on) ───
async function makeImage(ext) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const key = `banners/__test-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const noise = crypto.randomBytes(120 * 60 * 3);
  const s = sharp(noise, { raw: { width: 120, height: 60, channels: 3 } });
  const buf = ext === '.webp' ? await s.webp({ quality: 80 }).toBuffer()
            : ext === '.png' ? await s.png().toBuffer()
            : await s.jpeg({ quality: 80 }).toBuffer();
  const file = path.join(__dirname, '../uploads', key);
  fs.writeFileSync(file, buf);
  createdFiles.push(file);
  return { key, buf };
}

for (const ext of ['.webp', '.png', '.jpg']) {
  test(`biến thể byte khác nhau giữa các domain (${ext}), cùng kích thước, ổn định khi gọi lại`, async () => {
    const { key, buf } = await makeImage(ext);
    const rows = ['a.com', 'b.com', 'c.com'].map(d => resolveAlias(getAlias('site-a', key, d)));
    const imgs = await Promise.all(rows.map(getAliasImage));
    const hashes = imgs.map(i => crypto.createHash('md5').update(i.buffer).digest('hex'));
    assert.equal(new Set(hashes).size, 3);
    assert.ok(!hashes.includes(crypto.createHash('md5').update(buf).digest('hex')));
    for (const i of imgs) { const m = await sharp(i.buffer).metadata(); assert.equal(m.width, 120); assert.equal(m.height, 60); }
    assert.ok((await getAliasImage(rows[0])).buffer.equals(imgs[0].buffer));
  });
}

test('ảnh gốc không tồn tại → null', async () => {
  assert.equal(await getAliasImage(resolveAlias(getAlias('site-a', 'banners/__khong-ton-tai.webp'))), null);
});
