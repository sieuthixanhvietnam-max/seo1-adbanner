/**
 * Xác thực admin: mật khẩu bcrypt trong DB, chính sách mật khẩu mạnh,
 * khóa tạm khi đăng nhập sai nhiều lần, token phiên có version (đổi mật khẩu = thu hồi mọi phiên).
 * dotenv đã nạp ở index.js.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

const BCRYPT_COST = 12;
const SESSION_TTL_MS = (parseFloat(process.env.SESSION_TTL_HOURS) || 12) * 60 * 60 * 1000;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;

// ─── Chính sách mật khẩu (giữ đồng bộ với admin/lib/passwordPolicy.ts) ────────
const COMMON = ['password', 'passw0rd', 'admin', 'administrator', 'qwerty', 'letmein', 'welcome', 'iloveyou',
  '123456', '12345678', '111111', '000000', 'abc123', 'seo1', 'banner', 'aeseo1', 'changeme', 'default'];

function checkPassword(pw, { current } = {}) {
  const errors = [];
  const p = typeof pw === 'string' ? pw : '';
  if (p.length < 12) errors.push('Tối thiểu 12 ký tự');
  if (p.length > 128) errors.push('Tối đa 128 ký tự');
  if (!/[a-z]/.test(p)) errors.push('Có chữ thường');
  if (!/[A-Z]/.test(p)) errors.push('Có chữ hoa');
  if (!/[0-9]/.test(p)) errors.push('Có chữ số');
  if (!/[^A-Za-z0-9]/.test(p)) errors.push('Có ký tự đặc biệt');
  const low = p.toLowerCase();
  if (COMMON.some(w => low.includes(w))) errors.push('Không chứa từ thông dụng (password, admin, 123456, seo1…)');
  if (/(.)\1{3,}/.test(p)) errors.push('Không lặp một ký tự quá 3 lần liên tiếp');
  if (current && p === current) errors.push('Phải khác mật khẩu hiện tại');
  return { ok: errors.length === 0, errors };
}

// ─── Trạng thái tài khoản ─────────────────────────────────────────────────────
function ensureAdmin() {
  const row = db.prepare(`SELECT * FROM admin_auth WHERE id = 1`).get();
  if (row) return row;
  // Lần đầu: lấy mật khẩu từ .env (plaintext hoặc bcrypt), băm rồi lưu DB. Yếu thì buộc đổi ở lần đăng nhập đầu.
  const env = process.env.ADMIN_PASSWORD || '';
  const isHash = env.startsWith('$2');
  const hash = isHash ? env : bcrypt.hashSync(env, BCRYPT_COST);
  const mustChange = isHash ? 0 : (checkPassword(env).ok ? 0 : 1);
  db.prepare(`INSERT INTO admin_auth (id, password_hash, token_version, must_change) VALUES (1, ?, 1, ?)`).run(hash, mustChange);
  return db.prepare(`SELECT * FROM admin_auth WHERE id = 1`).get();
}
const getState = () => ensureAdmin();

const verifyPassword = (pw) => bcrypt.compare(String(pw || ''), getState().password_hash);

async function setPassword(newPw) {
  const hash = await bcrypt.hash(newPw, BCRYPT_COST);
  db.prepare(`UPDATE admin_auth SET password_hash = ?, token_version = token_version + 1, must_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(hash);
}

// ─── Token phiên ──────────────────────────────────────────────────────────────
const secret = () => process.env.ADMIN_TOKEN || '';

function signToken() {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + SESSION_TTL_MS, v: getState().token_version })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return { token: `${payload}.${sig}`, expiresAt: now + SESSION_TTL_MS };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  const a = Buffer.from(sig, 'hex'), b = Buffer.from(expected, 'hex');
  if (a.length === 0 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!(Date.now() < exp)) return null;
    // Token cũ (trước khi có version) coi như v1: hết hiệu lực ngay khi đổi mật khẩu lần đầu
    if ((v || 1) !== getState().token_version) return null;
    return { exp };
  } catch { return null; }
}

// ─── Khóa tạm & nhật ký ───────────────────────────────────────────────────────
const sqlTime = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19)

function record(ip, success, kind = 'login') {
  db.prepare(`INSERT INTO login_attempts (ip, success, kind) VALUES (?, ?, ?)`).run(ip, success ? 1 : 0, kind);
  // Dọn nhật ký cũ hơn 30 ngày (mỗi lần ghi, rất rẻ nhờ index)
  db.prepare(`DELETE FROM login_attempts WHERE created_at < ?`).run(sqlTime(Date.now() - 30 * 24 * 3600 * 1000));
}

/** Trả số giây phải chờ nếu IP đang bị khóa, 0 nếu được phép. */
function lockedSeconds(ip, kind = 'login') {
  const rows = db.prepare(
    `SELECT created_at FROM login_attempts WHERE ip = ? AND success = 0 AND kind = ? AND created_at > ? ORDER BY id DESC LIMIT ?`
  ).all(ip, kind, sqlTime(Date.now() - LOCK_WINDOW_MS), MAX_FAILS_PER_IP);
  if (rows.length < MAX_FAILS_PER_IP) return 0;
  const oldest = new Date(rows[rows.length - 1].created_at.replace(' ', 'T') + 'Z').getTime();
  return Math.max(1, Math.ceil((oldest + LOCK_WINDOW_MS - Date.now()) / 1000));
}

/** Số lần sai gần đây của IP trong cửa sổ khóa. */
function failCount(ip, kind = 'login') {
  return db.prepare(`SELECT COUNT(*) c FROM login_attempts WHERE ip = ? AND success = 0 AND kind = ? AND created_at > ?`)
    .get(ip, kind, sqlTime(Date.now() - LOCK_WINDOW_MS)).c;
}

/** Làm chậm dần khi cả hệ thống đang bị dò mật khẩu từ nhiều IP (không khóa hẳn, tránh bị lợi dụng để chặn admin). */
function globalDelayMs() {
  const n = db.prepare(`SELECT COUNT(*) c FROM login_attempts WHERE success = 0 AND kind = 'login' AND created_at > ?`)
    .get(sqlTime(Date.now() - 10 * 60 * 1000)).c;
  return Math.min(3000, n * 100);
}

const recentLogins = (limit = 10) =>
  db.prepare(`SELECT ip, success, kind, created_at FROM login_attempts ORDER BY id DESC LIMIT ?`).all(limit);

module.exports = {
  checkPassword, getState, verifyPassword, setPassword,
  signToken, verifyToken, record, lockedSeconds, failCount, globalDelayMs, recentLogins,
  SESSION_TTL_MS, MAX_FAILS_PER_IP,
};
