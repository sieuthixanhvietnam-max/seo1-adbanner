(function () {
  'use strict';

  var cfg = window.seo1AdBanner || {};
  // Prefix lấy từ cấu hình; nếu plugin tối ưu JS (gộp/trì hoãn) làm mất biến cấu hình
  // thì đọc trực tiếp từ HTML (data-seo1-prefix) để không bao giờ chọn sai class.
  var prefixEl = document.querySelector('[data-seo1-prefix]');
  var prefix = cfg.prefix || (prefixEl && prefixEl.getAttribute('data-seo1-prefix')) || 'ab';

  /* ── Helpers ────────────────────────────────────────────────────────── */
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // localStorage/sessionStorage có thể bị chặn (chế độ riêng tư) → không để lỗi làm hỏng script
  function store(type) {
    try { var s = window[type]; var k = '__seo1'; s.setItem(k, '1'); s.removeItem(k); return s; }
    catch (e) { return null; }
  }

  /* ── Catfish close ──────────────────────────────────────────────────── */
  function initCatfish() {
    var catfish = document.querySelector('.' + prefix + '_catfish');
    if (!catfish) return;
    // (Banner xoay của catfish được chọn bằng script inline ngay sau HTML — xem renderer)

    var closeBtn = catfish.querySelector('.' + prefix + '_catfish_close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        catfish.style.display = 'none';
      });
    }
  }

  /* ── Slider (CSS marquee) ───────────────────────────────────────────── */
  function initSlider(wrap) {
    var viewport = wrap.querySelector('.' + prefix + '_slider_viewport') || wrap;
    var track    = wrap.querySelector('.' + prefix + '_slider_track');
    if (!track) return;

    var items = Array.from(track.querySelectorAll('.' + prefix + '_slider_item'));
    if (!items.length) return;

    // Giảm chuyển động: hiển thị tĩnh, không nhân bản, không chạy
    if (reduceMotion) return;

    // Đo width của 1 bộ logo gốc (trước khi clone)
    var oneSetW    = track.scrollWidth;
    var containerW = viewport.offsetWidth || wrap.offsetWidth || 600;

    // Cần mỗi "nửa" của track >= containerW để không bao giờ thấy khoảng trắng
    // Ví dụ 5 logo × 80px ≈ 448px trên container 900px → cần 2 bộ/nửa → 4 bộ tổng
    var setsPerHalf  = Math.max(1, Math.ceil(containerW / oneSetW));
    var totalSets    = setsPerHalf * 2; // luôn chẵn → -50% seamless

    // Clone: đã có 1 bộ, thêm (totalSets - 1) bộ nữa
    // Bản sao chỉ để hiệu ứng: ẩn khỏi trình đọc màn hình và phím Tab
    for (var i = 1; i < totalSets; i++) {
      items.forEach(function (item) {
        var clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('a').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
        track.appendChild(clone);
      });
    }

    // Tốc độ cố định 80px/s — mượt và nhất quán bất kể số logo
    var halfW    = oneSetW * setsPerHalf;
    var duration = Math.max(6, Math.round(halfW / 80));
    track.style.setProperty('--seo1-dur', duration + 's');
    track.style.animationPlayState = 'running';

    // Pause on hover
    track.addEventListener('mouseenter', function () { track.style.animationPlayState = 'paused'; });
    track.addEventListener('mouseleave', function () { track.style.animationPlayState = 'running'; });
  }

  function initAllSliders() {
    var wraps = document.querySelectorAll('.' + prefix + '_slider_wrap');
    wraps.forEach(function (wrap) { initSlider(wrap); });
  }

  /* ── Popup ──────────────────────────────────────────────────────────── */
  function initPopup() {
    var popup = document.querySelector('.' + prefix + '_popup');
    if (!popup) return;

    var delay     = parseInt(popup.dataset.delay || '3', 10) * 1000;
    var frequency = popup.dataset.frequency || 'daily';
    var storageKey = 'seo1_popup_' + prefix;
    // 'session' dùng sessionStorage (hiện lại ở phiên mới), 'daily' dùng localStorage
    var storage = store(frequency === 'session' ? 'sessionStorage' : 'localStorage');

    function shouldShow() {
      if (frequency === 'always' || !storage) return true;
      var last = storage.getItem(storageKey);
      if (!last) return true;
      if (frequency === 'session') return false;
      // daily: check if 24h passed
      return (Date.now() - parseInt(last, 10)) > 86400000;
    }

    // Hiện/ẩn bằng inline style (không phụ thuộc class .active — UCSS có thể xoá CSS của class do JS thêm)
    function openPopup() {
      popup.style.display = 'flex';
      popup.classList.add('active');
      popup.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closePopup() {
      popup.style.display = 'none';
      popup.classList.remove('active');
      popup.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function showPopup() {
      if (!shouldShow()) return;
      setTimeout(function () {
        openPopup();
        if (frequency !== 'always' && storage) {
          try { storage.setItem(storageKey, String(Date.now())); } catch (e) {}
        }
      }, delay);
    }

    var closeBtn = popup.querySelector('.' + prefix + '_popup_close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closePopup);
    }

    popup.addEventListener('click', function (e) {
      if (e.target === popup) closePopup();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('active')) closePopup();
    });

    showPopup();
  }

  /* ── Link rút gọn: "…/trackinglink?seo1sl=x" → href sạch + data-sl="x" ─ */
  function setLink(a, url) {
    var m = /[?&]seo1sl=([a-z0-9_-]+)$/.exec(url);
    if (m) {
      a.href = url.slice(0, m.index);
      a.setAttribute('data-sl', m[1]);
    } else {
      a.href = url;
      a.removeAttribute('data-sl');
    }
  }

  /* ── Banner rotation ────────────────────────────────────────────────── */
  function initRotation() {
    var interval = parseInt((cfg.rotateInterval || 5000), 10);
    document.querySelectorAll('[data-seo1-rotate]').forEach(function (wrap) {
      var banners;
      try { banners = JSON.parse(wrap.dataset.banners || '[]'); } catch (e) { return; }
      if (banners.length < 2 || reduceMotion) return;
      var img  = wrap.querySelector('img');
      var link = wrap.querySelector('a');
      if (!img) return;
      var cur = 0;
      setInterval(function () {
        cur = (cur + 1) % banners.length;
        img.src = banners[cur].image_url;
        img.alt = banners[cur].title || '';
        if (link) setLink(link, banners[cur].click_url || '#');
      }, interval);
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    initCatfish();
    initAllSliders();
    initPopup();
    initRotation();
  }
  // Script được tải defer: DOM có thể đã sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
