// Trần số domain (chống nhồi domain giả) — file riêng để có process + DB + cấu hình riêng
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo1-cap-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.ADMIN_TOKEN = 'test-token';
process.env.IMAGE_ALIAS_PER_DOMAIN = 'on';
process.env.IMAGE_ALIAS_MAX_DOMAINS = '3';

const db = require('../src/db');
const { getAlias, aliasDomainFor, publicImageUrl } = require('../src/utils/imageAlias');

test.before(() => db.prepare(`INSERT INTO sites (id, name, placements) VALUES ('s','s','{}')`).run());
test.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

test('trần 3 domain: 3 domain đầu có alias riêng, domain thứ 4 → alias chung (không lỗi)', () => {
  const issued = ['d1.com', 'd2.com', 'd3.com'].map(d => {
    const dom = aliasDomainFor(d);
    assert.equal(dom, d);
    publicImageUrl('s', 'banners/x.webp', null, dom);
    return dom;
  });
  assert.equal(issued.length, 3);
  assert.equal(aliasDomainFor('d4.com'), '', 'vượt trần → alias chung');
  assert.equal(aliasDomainFor('www.D2.com'), 'd2.com', 'domain đã biết vẫn được giữ, không bị cắt');
  // bị cắt về '' thì vẫn ra URL hợp lệ, không ném lỗi
  assert.match(publicImageUrl('s', 'banners/x.webp', null, aliasDomainFor('d4.com')), /^\/wp-content\/uploads\/banners\/[a-z0-9]{8,16}\.webp$/);
});

test('công tắc on: domain không hợp lệ vẫn bị loại', () => {
  assert.equal(aliasDomainFor('<x>.com'), '');
  assert.equal(aliasDomainFor(''), '');
});
