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

test('alias có dạng WordPress YYYY/MM/slug.ext và giữ đuôi file', () => {
  assert.match(getAlias('site-a', KEY), /^\d{4}\/(0[1-9]|1[0-2])\/[0-9a-z]{10}\.webp$/);
  assert.match(getAlias('site-a', 'banners/x.png'), /\.png$/);
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
  assert.match(publicImageUrl('site-a', KEY), /^\/wp-content\/uploads\/\d{4}\/\d{2}\/[0-9a-z]{10}\.webp$/);
  assert.match(publicImageUrl('site-a', KEY, 'https://abc.pool.com/'), /^https:\/\/abc\.pool\.com\/\d{4}\/\d{2}\/[0-9a-z]{10}\.webp$/);
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
