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
process.env.IMAGE_ALIAS_SECRET = 'test-secret';

const sharp = require('sharp');
{
  const Database = require('better-sqlite3');
  const pre = new Database(process.env.DB_PATH);
  pre.pragma('foreign_keys = OFF');
  pre.exec(`CREATE TABLE image_aliases (alias TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, image_key TEXT NOT NULL, seed TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (site_id, image_key))`);
  pre.prepare(`INSERT INTO image_aliases (alias, site_id, image_key, seed) VALUES ('2026/05/legacyslug1.webp', 'site-a', 'banners/legacy.webp', 'x')`).run();
  pre.prepare(`INSERT INTO image_aliases (alias, site_id, image_key, seed) VALUES ('banners/okslug1234.webp', 'site-a', 'banners/ok.webp', 'x')`).run();
  pre.close();
}
const db = require('../src/db');
const { getAlias, publicImageUrl, resolveAlias } = require('../src/utils/imageAlias');
const { getAliasImage } = require('../src/utils/imageVariant');

const uploadsDir = path.join(__dirname, '../uploads/banners');
const createdFiles = [];

test.before(() => {
  const ins = db.prepare(`INSERT OR IGNORE INTO sites (id, name, placements) VALUES (?, ?, '{}')`);
  ['site-a', 'site-b', 'site-c'].forEach(id => ins.run(id, id));
});

test.after(() => {
  createdFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const KEY = 'banners/1712345678-a3f9c2e1.webp';

test('alias ổn định cho cùng (site, key)', () => {
  assert.equal(getAlias('site-a', KEY), getAlias('site-a', KEY));
});

test('alias có dạng <dir>/<slug>.<ext>, giữ thư mục gốc và đuôi file', () => {
  assert.match(getAlias('site-a', KEY), /^banners\/[0-9a-z]{10}\.webp$/);
  assert.match(getAlias('site-a', 'banners/x.png'), /^banners\/[0-9a-z]{10}\.png$/);
  assert.match(getAlias('site-a', 'brands/logo.webp'), /^brands\/[0-9a-z]{10}\.webp$/);
  assert.match(getAlias('site-a', 'toplist/t.jpg'), /^toplist\/[0-9a-z]{10}\.jpg$/);
  assert.match(getAlias('site-a', 'misc/other.webp'), /^banners\//); // dir lạ → banners
});

test('TƯƠNG THÍCH PLUGIN WP: URL alias khớp regex proxy trong seo1-adbanner.php', () => {
  const php = fs.readFileSync(path.join(__dirname, '../../plugin/seo1-adbanner/seo1-adbanner.php'), 'utf8');
  const m = php.match(/preg_match\('#(\^\/wp-content\/uploads\/[^']+?)#', \$uri/);
  assert.ok(m, 'không tìm thấy regex proxy trong plugin — cập nhật test này nếu plugin đổi');
  const re = new RegExp(m[1].replace(/\\\//g, '/').replace(/\//g, '\\/'));
  for (const key of [KEY, 'brands/logo.webp', 'toplist/t.jpg', 'banners/a.png', 'misc/other.webp']) {
    const url = publicImageUrl('site-a', key);
    assert.match(url, re, `plugin sẽ không chuyển tiếp ${url}`);
  }
});

test('migration: alias định dạng cũ (YYYY/MM/slug) bị xóa, alias hợp lệ giữ nguyên', () => {
  assert.equal(resolveAlias('2026/05/legacyslug1.webp'), null);
  assert.ok(resolveAlias('banners/okslug1234.webp'));
});

test('hai site cùng banner → path khác nhau, không lộ key gốc', () => {
  const a = getAlias('site-a', KEY), b = getAlias('site-b', KEY);
  assert.notEqual(a, b);
  assert.ok(!a.includes('a3f9c2e1') && !a.includes('1712345678'));
});

test('resolveAlias tra ngược đúng; alias lạ trả null', () => {
  const a = getAlias('site-b', KEY);
  const row = resolveAlias(a);
  assert.equal(row.site_id, 'site-b');
  assert.equal(row.image_key, KEY);
  assert.equal(resolveAlias('2020/01/nope000000.webp'), null);
});

test('publicImageUrl: prefix, domain pool, URL ngoài, rỗng', () => {
  assert.match(publicImageUrl('site-a', KEY), /^\/wp-content\/uploads\/banners\/[0-9a-z]{10}\.webp$/);
  assert.match(publicImageUrl('site-a', KEY, 'https://abc.pool.com/'), /^https:\/\/abc\.pool\.com\/banners\/[0-9a-z]{10}\.webp$/);
  assert.equal(publicImageUrl('site-a', 'https://cdn.x/y.png'), 'https://cdn.x/y.png');
  assert.equal(publicImageUrl('site-a', ''), '');
});

test('xóa site → alias bị xóa theo (cascade)', () => {
  db.prepare(`INSERT INTO sites (id, name, placements) VALUES ('site-tmp','t','{}')`).run();
  const a = getAlias('site-tmp', KEY);
  db.prepare(`DELETE FROM sites WHERE id = 'site-tmp'`).run();
  assert.equal(resolveAlias(a), null);
});

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
  test(`biến thể byte khác nhau giữa các site (${ext}), cùng kích thước, ổn định khi gọi lại`, async () => {
    const { key, buf } = await makeImage(ext);
    const rows = ['site-a', 'site-b', 'site-c'].map(s => resolveAlias(getAlias(s, key)));
    const imgs = await Promise.all(rows.map(getAliasImage));
    const hashes = imgs.map(i => crypto.createHash('md5').update(i.buffer).digest('hex'));

    assert.equal(new Set(hashes).size, 3, 'mỗi site phải có hash khác nhau');
    assert.ok(!hashes.includes(crypto.createHash('md5').update(buf).digest('hex')), 'khác ảnh gốc');
    for (const i of imgs) {
      const m = await sharp(i.buffer).metadata();
      assert.equal(m.width, 120); assert.equal(m.height, 60);
    }
    const again = await getAliasImage(rows[0]);
    assert.ok(again.buffer.equals(imgs[0].buffer), 'cache → byte giống hệt lần trước');
  });
}

test('ảnh gốc không tồn tại → null', async () => {
  const row = resolveAlias(getAlias('site-a', 'banners/__khong-ton-tai.webp'));
  assert.equal(await getAliasImage(row), null);
});
