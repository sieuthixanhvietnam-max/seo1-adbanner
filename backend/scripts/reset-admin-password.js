#!/usr/bin/env node
/**
 * Đặt lại mật khẩu admin khi quên (chạy trực tiếp trên server, cần quyền truy cập DB).
 *   cd backend && node scripts/reset-admin-password.js            # nhập mật khẩu mới (ẩn khi gõ)
 *   NEW_PASSWORD='...' node scripts/reset-admin-password.js       # không tương tác
 * Thu hồi mọi phiên đăng nhập hiện có và xóa trạng thái khóa tạm.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const readline = require('readline');
const db = require('../src/db');
const adminAuth = require('../src/utils/adminAuth');

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(''); };
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

(async () => {
  let pw = process.env.NEW_PASSWORD;
  if (!pw) {
    pw = await askHidden('Mật khẩu mới: ');
    const again = await askHidden('Nhập lại: ');
    if (pw !== again) { console.error('Hai lần nhập không khớp.'); process.exit(1); }
  }
  const policy = adminAuth.checkPassword(pw);
  if (!policy.ok) {
    console.error('Mật khẩu chưa đạt yêu cầu:\n - ' + policy.errors.join('\n - '));
    process.exit(1);
  }
  adminAuth.getState(); // đảm bảo đã có dòng admin_auth
  await adminAuth.setPassword(pw);
  db.prepare(`DELETE FROM login_attempts`).run();
  console.log('Đã đặt lại mật khẩu admin. Mọi phiên đăng nhập cũ đã bị thu hồi.');
})();
