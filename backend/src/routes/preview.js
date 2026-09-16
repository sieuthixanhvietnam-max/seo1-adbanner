/**
 * Preview endpoints — render HTML thật cho iframe trong trang Appearance.
 * Không cần auth (iframe load trực tiếp).
 *   GET /api/preview/presets              → PRESETS JSON
 *   GET /api/preview/:site_id/:placement  → text/html preview
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildImageUrl } = require('../utils/storage');
const { mergeStyle, PRESETS } = require('../utils/defaultStyles');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pascalToKebab = (name) => String(name || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

// Icon Lucide tint theo màu bằng CSS mask (SVG tĩnh từ CDN)
const iconEl = (name, size, color) => {
  if (!name) return '';
  const url = `https://unpkg.com/lucide-static@latest/icons/${pascalToKebab(name)}.svg`;
  return `<span style="display:inline-block;width:${size}px;height:${size}px;background-color:${color};-webkit-mask:url('${url}') center/contain no-repeat;mask:url('${url}') center/contain no-repeat;flex-shrink:0"></span>`;
};

const placeholder = (w, h) => `https://placehold.co/${w}x${h}/e2e8f0/94a3b8?text=Banner`;

// Lấy ảnh banner thật của site+placement; thiếu thì bù placeholder
function sampleImages(siteId, placement, imageBase, req, count, w, h) {
  const rows = db.prepare(`
    SELECT b.image_key
    FROM slots sl
    JOIN slot_banners sb ON sb.slot_id = sl.id
    JOIN banners b ON b.id = sb.banner_id
    WHERE sl.site_id = ? AND sl.placement = ? AND b.is_deleted = 0
    ORDER BY sl.position ASC, sb.order_in_rotation ASC
  `).all(siteId, placement);
  const real = rows.map(r => buildImageUrl(r.image_key, imageBase, req)).filter(Boolean);
  const out = [];
  for (let i = 0; i < count; i++) out.push(real[i] || placeholder(w, h));
  return out;
}

// ─── Renderers per placement ────────────────────────────────────────────────
function renderCatfish(s, imgs) {
  const pos = s.position === 'top' ? 'top:0' : 'bottom:0';
  const ar = String(s.aspectRatio).replace('/', ' / ');
  const cover = s.imageFit === 'cover';
  const close = s.closable
    ? `<button style="position:absolute;top:6px;right:8px;width:24px;height:24px;border:none;border-radius:50%;background:${s.closeBg};color:${s.closeColor};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;z-index:3">×</button>`
    : '';
  // Grid nhiều ảnh cố định cùng lúc (2×2 desktop, columnsMobile khi hẹp)
  // cover  → cell tỉ lệ cố định, crop lấp đầy (không khoảng đen)
  // đầy đủ → height:auto, ảnh tự cao theo tỉ lệ gốc — KHÔNG letterbox, banner sát nhau
  const imgStyle = cover
    ? `width:100%;aspect-ratio:${ar};object-fit:cover;display:block;border-radius:${s.borderRadius}px`
    : `width:100%;height:auto;display:block;border-radius:${s.borderRadius}px`;
  const cells = imgs.map(src => `<img src="${esc(src)}" style="${imgStyle}"/>`).join('');
  return `
  <style>@media(max-width:768px){#cfgrid{grid-template-columns:repeat(${s.columnsMobile || 1},1fr)!important}}</style>
  <div style="position:fixed;left:0;right:0;${pos};padding:${s.padding}px;box-shadow:${s.shadow};overflow:hidden">
    <div style="position:absolute;inset:0;background:${s.bgColor};opacity:${s.bgOpacity};backdrop-filter:blur(${s.backdropBlur || 0}px);-webkit-backdrop-filter:blur(${s.backdropBlur || 0}px)"></div>
    <div id="cfgrid" style="position:relative;display:grid;grid-template-columns:repeat(${s.columns},1fr);gap:${s.gap}px">${cells}</div>
    ${close}
  </div>`;
}

function renderPopup(s, img) {
  const close = s.closable
    ? `<button style="position:absolute;top:8px;right:8px;width:26px;height:26px;border:none;border-radius:50%;background:${s.closeBg};color:${s.closeColor};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1">×</button>`
    : '';
  return `
  <div style="position:fixed;inset:0;background:${s.overlayColor};opacity:${s.overlayOpacity};backdrop-filter:blur(${s.overlayBlur}px);-webkit-backdrop-filter:blur(${s.overlayBlur}px)"></div>
  <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:20px">
    <div style="position:relative;width:${s.width}px;max-width:${esc(s.maxWidth)};border-radius:${s.borderRadius}px;overflow:hidden;box-shadow:${s.shadow};padding:${s.padding}px;background:#fff">
      <img src="${esc(img)}" style="width:100%;display:block;border-radius:${Math.max(0, s.borderRadius - s.padding)}px"/>
      ${close}
    </div>
  </div>`;
}

function renderSlider(s, imgs) {
  const n = imgs.length;
  const ar = String(s.aspectRatio).replace('/', ' / ');
  const cover = s.imageFit === 'cover';
  const [aw, ah] = String(s.aspectRatio).split('/').map(Number);
  const imgH = Math.round(s.imageWidth * (ah / aw || 0.56));

  // 1 logo (chip bo tròn nền xám nhạt, hover nâng nhẹ)
  const logo = (src) => `
    <a class="sl-logo" style="flex-shrink:0;width:${s.imageWidth}px;height:${imgH}px;display:flex;align-items:center;justify-content:center;border-radius:${s.borderRadius + 4}px;background:#F7F7F9;box-shadow:inset 0 0 0 1px rgba(24,24,27,0.05)">
      <img src="${esc(src)}" style="${cover ? `width:100%;height:100%;object-fit:cover` : `max-width:86%;max-height:86%`};border-radius:${s.borderRadius}px;display:block"/>
    </a>`;

  const titleLeft = s.titlePosition !== 'top';
  const icon = s.titleIcon ? iconEl(s.titleIcon, Math.round(s.titleSize * 1.3), s.titleColor) : '';
  // Panel gradient accent chứa H2 + icon
  const title = s.showTitle
    ? `<div style="flex-shrink:0;${titleLeft ? `width:${s.titleWidth}px` : 'width:100%'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:${s.boxPadding}px;background:linear-gradient(135deg, ${s.titleBgFrom}, ${s.titleBgTo})">
         ${icon}
         <h2 style="margin:0;color:${s.titleColor};font-size:${s.titleSize}px;font-weight:800;line-height:1.18;text-align:center;letter-spacing:-0.01em">${esc(s.title)}</h2>
       </div>`
    : '';
  const hoverCss = s.logoHover ? '.sl-logo{transition:transform .2s ease, box-shadow .2s ease}.sl-logo:hover{transform:translateY(-4px);box-shadow:0 8px 18px rgba(24,24,27,0.14)}' : '';

  // Vùng logo (viewport + track) theo animation
  let viewport;
  if (s.animation === 'fade') {
    const per = Math.min(4, Math.max(1, n));
    const groups = [];
    for (let i = 0; i < n; i += per) groups.push(imgs.slice(i, i + per));
    const slides = groups.map((g, i) =>
      `<div data-fs style="position:absolute;inset:0;display:flex;gap:${s.gap}px;justify-content:center;align-items:center;opacity:${i === 0 ? 1 : 0};transition:opacity ${s.fadeDuration}ms">${g.map(logo).join('')}</div>`
    ).join('');
    const script = groups.length > 1
      ? `<script>(function(){var e=document.querySelectorAll('[data-fs]'),i=0;setInterval(function(){e[i].style.opacity=0;i=(i+1)%e.length;e[i].style.opacity=1;},${s.fadeInterval});})();</script>`
      : '';
    viewport = `<div style="position:relative;flex:1;height:${imgH}px">${slides}</div>${script}`;
  } else if (s.animation === 'marquee') {
    const total = s.imageWidth * n + s.gap * Math.max(0, n - 1);
    const duration = Math.max(1, Math.round(total / Math.max(1, s.speed)));
    const kf = s.direction === 'right'
      ? 'from{transform:translateX(-50%)}to{transform:translateX(0)}'
      : 'from{transform:translateX(0)}to{transform:translateX(-50%)}';
    const items = imgs.map(logo).join('');
    const pause = s.pauseOnHover ? '.mq:hover{animation-play-state:paused}' : '';
    viewport = `
    <style>@keyframes mq{${kf}}.mq{display:flex;gap:${s.gap}px;width:max-content;animation:mq ${duration}s linear infinite}${pause}</style>
    <div style="flex:1;overflow:hidden"><div class="mq">${items}${items}</div></div>`;
  } else {
    // step — dịch ngang từng logo
    const items = imgs.concat(imgs).map(logo).join('');
    const script = n > 1 ? `<script>(function(){
      var t=document.getElementById('sstep'),i=0,n=${n},step=${s.imageWidth + s.gap},dur=${s.stepDuration};
      setInterval(function(){i++;t.style.transition='transform '+dur+'ms ease';t.style.transform='translateX(-'+(i*step)+'px)';
        if(i>=n){setTimeout(function(){t.style.transition='none';i=0;t.style.transform='translateX(0)';},dur);}
      },${s.stepInterval});
    })();</script>` : '';
    viewport = `<div style="flex:1;overflow:hidden"><div id="sstep" style="display:flex;gap:${s.gap}px;width:max-content">${items}</div></div>${script}`;
  }

  const cardDir = titleLeft ? 'row' : 'column';
  return `
  <style>${hoverCss}</style>
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px">
    <div style="width:100%;max-width:980px;display:flex;flex-direction:${cardDir};align-items:stretch;border:${s.boxBorder};border-radius:${s.boxRadius}px;box-shadow:${s.boxShadow};overflow:hidden;box-sizing:border-box">
      ${title}
      <div style="flex:1;display:flex;align-items:center;background:${s.boxColor};padding:${s.boxPadding}px;overflow:hidden">
        ${viewport}
      </div>
    </div>
  </div>`;
}

function renderButton(s, imgs, slotStyles) {
  const dir = s.layout === 'vertical' ? 'column' : 'row';
  // Mỗi slot có thể override style; preview dùng slotStyles[i] nếu có, else placement default
  const btn = (i) => {
    const st = { ...s, ...(slotStyles && slotStyles[i] ? slotStyles[i] : {}) };
    const icon = st.icon ? iconEl(st.icon, st.iconSize || 18, st.textColor) : '';
    const content = st.iconPosition === 'right' ? `<span>${esc(st.label)}</span>${icon}` : `${icon}<span>${esc(st.label)}</span>`;
    return `<button style="display:inline-flex;align-items:center;justify-content:center;gap:8px;height:${st.height}px;padding:0 20px;flex:1;border:${st.border === 'none' ? 'none' : `${st.border} ${st.borderColor}`};border-radius:${st.borderRadius}px;background:${st.bgColor};color:${st.textColor};font-size:${st.fontSize}px;font-weight:${st.fontWeight};box-shadow:${st.shadow};cursor:pointer;transition:all ${st.transition}ms;white-space:nowrap">${content}</button>`;
  };
  const items = imgs.map((_, i) => btn(i)).join('');
  return `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px">
    <div style="display:flex;flex-direction:${dir};gap:${s.gap}px;width:400px;max-width:90%">${items}</div>
  </div>`;
}

function renderBrandButton(s, imgs) {
  const cells = imgs.map((src, i) => `
    <div>
      <img src="${esc(src)}" style="width:100%;aspect-ratio:${String(s.aspectRatio).replace('/',' / ')};object-fit:cover;border-radius:${s.borderRadius}px;border:${s.border==='none'?'none':`${s.border} ${s.borderColor}`};box-shadow:${s.shadow};cursor:pointer;display:block"/>
      ${s.showLabel ? `<div style="text-align:center;margin-top:5px;font-size:${s.labelSize}px;color:${s.labelColor}">Brand ${i+1}</div>` : ''}
    </div>`).join('');
  return `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px">
    <div style="display:grid;grid-template-columns:repeat(${s.columns},1fr);gap:${s.gap}px;width:88%;max-width:680px">${cells}</div>
  </div>`;
}

function renderToplist(s, imgs) {
  const brands = ['Net88', '789Bet', 'Sunwin'];
  const cta = (r) => s.showCta
    ? `<a style="display:inline-flex;align-items:center;justify-content:center;height:${s.ctaHeight}px;padding:0 16px;background:${s.ctaBgColor};color:${s.ctaTextColor};border-radius:${s.ctaBorderRadius}px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap">${esc(s.ctaText)}</a>`
    : '';
  const badge = (r) => s.showRankBadge
    ? `<div style="width:${s.rankBadgeSize}px;height:${s.rankBadgeSize}px;border-radius:${s.rankBadgeRadius}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;background:${r<=3 ? (s.rankColors[r-1]||s.rankBadgeBg) : s.rankBadgeBg};color:${r<=3 ? '#000' : s.rankBadgeColor}">${r}</div>`
    : '';
  const item = (name, r, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:${s.itemPadding}px;background:${s.itemBg};border:${s.itemBorder};border-radius:${s.itemBorderRadius}px;box-shadow:${s.itemShadow}">
      ${badge(r)}
      <img src="${esc(imgs[i])}" style="width:88px;flex-shrink:0;aspect-ratio:${String(s.imageRatio).replace('/',' / ')};object-fit:cover;border-radius:${s.imageRadius}px"/>
      ${s.showName ? `<div style="flex:1;font-size:${s.nameFontSize}px;font-weight:${s.nameFontWeight};color:${s.nameColor}">${esc(name)}</div>` : '<div style="flex:1"></div>'}
      ${cta(r)}
    </div>
    ${s.showDividers && s.layout==='list' && r<3 ? `<div style="height:1px;background:${s.dividerColor};margin:2px 0"></div>` : ''}`;
  const wrap = s.layout === 'grid'
    ? `display:grid;grid-template-columns:repeat(${s.columns||2},1fr);gap:${s.gap}px`
    : `display:flex;flex-direction:column;gap:${s.gap}px`;
  return `
  <div style="min-height:100vh;padding:28px;background:#F1F1F4">
    <div style="max-width:720px;margin:0 auto;${wrap}">
      ${brands.map((b, i) => item(b, i + 1, i)).join('')}
    </div>
  </div>`;
}

const RENDERERS = {
  catfish:        (s, imgs) => renderCatfish(s, imgs),
  popup:          (s, imgs) => renderPopup(s, imgs[0]),
  slider:         (s, imgs) => renderSlider(s, imgs),
  button:         (s, imgs, extra) => renderButton(s, imgs, extra),
  'brand-button': (s, imgs) => renderBrandButton(s, imgs),
  toplist:        (s, imgs) => renderToplist(s, imgs),
};

// [ảnh mẫu W, H]. Số lượng lấy động theo limit của placement.
const DIMS = {
  catfish: [1200, 90], popup: [400, 500], slider: [1280, 400],
  button: [320, 48], 'brand-button': [200, 200], toplist: [176, 100],
};
// Số lượng banner hiển thị: đa số theo limit; brand-button/toplist/popup cố định.
function previewCount(placement, limit) {
  switch (placement) {
    case 'catfish': return Math.min(Math.max(limit || 1, 1), 8);
    case 'slider':  return Math.min(Math.max(limit || 3, 1), 12);
    case 'button':  return Math.min(Math.max(limit || 2, 1), 6);
    case 'brand-button': return 8;
    case 'popup':   return 1;
    case 'toplist': return 3;
    default:        return 1;
  }
}

function pageHtml(body, bg = '#F1F1F4') {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>* { font-family: Inter, sans-serif; box-sizing: border-box; } html,body{margin:0;padding:0;background:${bg};min-height:100vh;}</style>
</head><body>${body}</body></html>`;
}

// ─── GET /api/preview/presets ─────────────────────────────────────────────────
router.get('/presets', (req, res) => {
  res.json({ success: true, data: PRESETS });
});

// ─── GET /api/preview/:site_id/:placement ────────────────────────────────────
router.get('/:site_id/:placement', (req, res) => {
  try {
    const { site_id, placement } = req.params;
    const renderer = RENDERERS[placement];
    res.set('Content-Type', 'text/html; charset=utf-8');

    if (!renderer) return res.send(pageHtml(`<div style="padding:40px;color:#94a3b8;font-size:14px">Placement không hỗ trợ preview</div>`));

    const site = db.prepare(`
      SELECT s.*, d.base_url as image_base_url
      FROM sites s LEFT JOIN image_domains d ON d.id = s.image_domain_id
      WHERE s.id = ?
    `).get(site_id);
    if (!site) return res.send(pageHtml(`<div style="padding:40px;color:#94a3b8;font-size:14px">Site không tồn tại</div>`));

    let placements;
    try { placements = JSON.parse(site.placements || '{}'); } catch (_) { placements = {}; }

    // Ưu tiên style truyền qua query (preview thay đổi chưa lưu); fallback style trong DB
    let liveStyle = null;
    if (req.query.style) {
      try { liveStyle = JSON.parse(req.query.style); } catch (_) { liveStyle = null; }
    }
    const style = mergeStyle(placement, liveStyle || placements[placement]?.style);

    const limit = placements[placement]?.limit || 0;
    const count = previewCount(placement, limit);
    const [w, h] = DIMS[placement] || [400, 200];
    const imgs = sampleImages(site_id, placement, site.image_base_url || null, req, count, w, h);

    // Button: lấy slot_style theo position để preview đúng từng slot
    let extra = null;
    if (placement === 'button') {
      const slotRows = db.prepare(
        `SELECT position, slot_style FROM slots WHERE site_id = ? AND placement = 'button' ORDER BY position ASC`
      ).all(site_id);
      extra = slotRows.map(r => { try { return r.slot_style ? JSON.parse(r.slot_style) : null; } catch (_) { return null; } });
    }

    res.send(pageHtml(renderer(style, imgs, extra)));
  } catch (err) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(pageHtml(`<div style="padding:40px;color:#dc2626;font-size:13px;font-family:monospace">${esc(err.message)}</div>`));
  }
});

module.exports = router;
