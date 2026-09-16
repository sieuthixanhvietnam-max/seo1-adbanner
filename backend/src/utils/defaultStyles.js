/**
 * Style mặc định cho từng placement.
 * Cosmetic only — structural CSS (position:fixed, z-index...) nằm trong plugin.
 * Admin chỉnh các giá trị này, plugin render inline.
 */
const DEFAULT_STYLES = {
  catfish: {
    // Layout — grid nhiều ảnh cố định cùng lúc
    columns: 2,              // desktop: số cột (2 = grid 2×2)
    columnsMobile: 1,        // mobile: 1 cột (4 ảnh chồng dọc)
    gap: 0,                  // px — 4 ảnh sát nhau, không khoảng cách
    aspectRatio: '16/3',     // tỉ lệ mỗi ô (banner ngang)
    imageFit: 'cover',       // 'cover' = fill đầy ô (không khoảng đen) | 'contain'
    borderRadius: 0,         // bo góc mỗi ảnh
    padding: 0,              // padding container catfish (0 = ảnh sát mép)
    bgColor: '#000000',      // màu nền container
    bgOpacity: 1,
    position: 'bottom',      // 'bottom' | 'top'
    closable: true,
    closeColor: '#ffffff',
    closeBg: 'rgba(0,0,0,0.5)',
    animationIn: 'slide',    // 'slide' | 'fade' | 'none'
    animationDuration: 300,
    mobileOnly: false,
    shadow: 'none',
    backdropBlur: 0,
  },
  slider: {
    // 1 card chứa logo, tiêu đề bên trái/trên, logo dịch ngang
    animation: 'step',       // 'step' (dịch từng logo) | 'marquee' | 'fade'
    speed: 40,               // px/giây (marquee)
    stepInterval: 2000,      // ms mỗi lần dịch 1 logo (step)
    stepDuration: 500,       // ms hiệu ứng dịch (step)
    fadeInterval: 3000,      // ms mỗi nhóm (fade)
    fadeDuration: 600,       // ms cross-fade (fade)
    direction: 'left',       // 'left' | 'right' (marquee)
    gap: 16,                 // px khoảng cách giữa logo
    imageWidth: 150,         // px width mỗi logo
    aspectRatio: '16/9',     // tỉ lệ logo
    imageFit: 'contain',     // 'contain' | 'cover'
    borderRadius: 6,         // bo góc logo
    pauseOnHover: true,
    // Panel tiêu đề (gradient accent)
    showTitle: true,
    title: 'Nhà Cái Uy Tín',
    titlePosition: 'left',   // 'left' | 'top'
    titleWidth: 150,         // px chiều rộng panel tiêu đề (khi ở trái)
    titleColor: '#ffffff',
    titleSize: 22,
    titleBgFrom: '#6366F1',  // gradient panel — màu đầu
    titleBgTo: '#8B5CF6',    // gradient panel — màu cuối
    titleIcon: 'Shield',     // Lucide icon trên tiêu đề ('' = không)
    // Card bọc toàn bộ
    boxColor: '#ffffff',     // nền panel logo (phải)
    boxPadding: 18,
    boxRadius: 16,
    boxBorder: '1px solid #ECECEF',
    boxShadow: '0 10px 30px rgba(24,24,27,0.10)',
    logoHover: true,         // hover nâng logo
  },
  button: {
    // Layout chung (placement level)
    layout: 'horizontal',    // 'horizontal' | 'vertical'
    gap: 8,
    // Default style cho slot (slot có thể override qua slot_style)
    height: 48,
    bgColor: '#6366F1',
    bgColorHover: '#4F46E5',
    textColor: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    label: 'Đăng nhập',
    icon: 'LogIn',           // Lucide icon name, '' = không có icon
    iconPosition: 'left',    // 'left' | 'right'
    iconSize: 18,
    borderRadius: 8,
    border: 'none',
    borderColor: 'transparent',
    shadow: 'none',
    shadowHover: '0 4px 12px rgba(99,102,241,0.4)',
    hoverEffect: 'darken',   // 'darken' | 'brighten' | 'scale' | 'none'
    transition: 200,
  },
  popup: {
    width: 400,
    maxWidth: '90vw',
    overlayOpacity: 0.6,
    overlayColor: '#000000',
    animation: 'fade',             // fade | slide | zoom
    delay: 3000,                   // ms
    frequency: 'once-per-day',     // every-load | once-per-session | once-per-day
    borderRadius: 12,
    padding: 0,
    closable: true,
    closeColor: '#ffffff',
    overlayBlur: 2,
    animationDuration: 300,
    shadow: '0 20px 60px rgba(0,0,0,0.5)',
    closeBg: 'rgba(0,0,0,0.5)',
    closeOnOverlay: true,
  },
  'brand-button': {
    columns: 4,                    // desktop cols (auto-responsive)
    gap: 8,
    borderRadius: 8,
    aspectRatio: '1/1',
    columnsTablet: 3,
    columnsMobile: 2,
    showLabel: false,
    labelColor: '#18181B',
    labelSize: 12,
    border: 'none',
    borderColor: 'transparent',
    shadow: 'none',
    shadowHover: '0 4px 12px rgba(0,0,0,0.15)',
    hoverEffect: 'scale',
    hoverScale: 1.05,
    transition: 200,
  },
  toplist: {
    layout: 'list',                // list | grid
    columns: 1,                    // dùng khi grid
    showRankBadge: true,
    rankColors: ['#FFD700', '#C0C0C0', '#CD7F32'], // top1,2,3
    rankBadgeBg: '#EEF0FF',
    rankBadgeColor: '#6366F1',
    imageRatio: '16/9',
    gap: 8,
    borderRadius: 10,
    showName: true,
    showDividers: false,
    itemPadding: 12,
    itemBg: '#ffffff',
    itemBorder: '1px solid #ECECEF',
    itemShadow: 'none',
    itemShadowHover: '0 4px 12px rgba(0,0,0,0.08)',
    itemBorderRadius: 10,
    rankBadgeSize: 32,
    rankBadgeRadius: 8,
    imageRadius: 8,
    nameFontSize: 14,
    nameFontWeight: 600,
    nameColor: '#18181B',
    dividerColor: '#ECECEF',
    showCta: true,
    ctaText: 'Đăng nhập',
    ctaBgColor: '#6366F1',
    ctaTextColor: '#ffffff',
    ctaBorderRadius: 8,
    ctaHeight: 36,
  },
};

// Preset nhanh cho từng placement — merge đè lên style hiện tại
const PRESETS = {
  catfish: {
    'Dark Grid':    { bgColor: '#000', columns: 2, gap: 0, shadow: 'none' },
    'Colored':      { bgColor: '#6366F1', columns: 2, gap: 0, shadow: '0 -4px 20px rgba(99,102,241,0.4)' },
    'Glass':        { bgColor: 'rgba(0,0,0,0.7)', backdropBlur: 12, columns: 2 },
  },
  slider: {
    'Fast':         { speed: 60, gap: 8,  imageWidth: 240 },
    'Normal':       { speed: 40, gap: 12, imageWidth: 280 },
    'Slow':         { speed: 20, gap: 16, imageWidth: 320 },
  },
  button: {
    'Solid':        { bgColor: '#6366F1', textColor: '#fff', shadow: 'none', borderRadius: 8 },
    'Gradient':     { bgColor: '#6366F1', textColor: '#fff', shadow: '0 4px 15px rgba(99,102,241,0.4)', borderRadius: 10 },
    'Outline':      { bgColor: 'transparent', textColor: '#6366F1', border: '2px solid', borderColor: '#6366F1', borderRadius: 8 },
    'Dark':         { bgColor: '#18181B', textColor: '#fff', borderRadius: 8 },
  },
  popup: {
    'Classic':      { borderRadius: 12, overlayOpacity: 0.6, animation: 'fade' },
    'Modern':       { borderRadius: 20, overlayOpacity: 0.8, overlayBlur: 4, animation: 'zoom' },
    'Minimal':      { borderRadius: 4,  overlayOpacity: 0.3, animation: 'slide' },
  },
  'brand-button': {
    'Grid 4':       { columns: 4, gap: 8,  borderRadius: 8,  hoverEffect: 'scale' },
    'Grid 3 Card':  { columns: 3, gap: 12, borderRadius: 12, hoverEffect: 'shadow', showLabel: true },
    'Grid 5 Tight': { columns: 5, gap: 4,  borderRadius: 4,  hoverEffect: 'brighten' },
  },
  toplist: {
    'Clean List':   { layout: 'list', itemBorder: '1px solid #ECECEF', showCta: true },
    'Card Grid':    { layout: 'grid', columns: 2, itemShadow: '0 2px 8px rgba(0,0,0,0.08)', itemBorder: 'none' },
    'Minimal':      { layout: 'list', itemBorder: 'none', itemBg: 'transparent', showDividers: true, showCta: false },
  },
};

// Merge style user với default (đảm bảo không thiếu field)
function mergeStyle(placement, userStyle) {
  const def = DEFAULT_STYLES[placement] || {};
  return { ...def, ...(userStyle || {}) };
}

module.exports = { DEFAULT_STYLES, PRESETS, mergeStyle };
