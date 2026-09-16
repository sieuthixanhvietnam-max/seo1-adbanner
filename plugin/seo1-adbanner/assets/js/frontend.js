(function () {
  'use strict';

  var cfg = window.seo1AdBanner || {};
  var prefix = cfg.prefix || 'ab';

  /* ── Helpers ────────────────────────────────────────────────────────── */
  function sel(ctx, cls) { return ctx.querySelector('.' + prefix + '_' + cls); }
  function selAll(ctx, cls) { return ctx.querySelectorAll('.' + prefix + '_' + cls); }

  /* ── Catfish close ──────────────────────────────────────────────────── */
  function initCatfish() {
    var catfish = document.querySelector('.' + prefix + '_catfish');
    if (!catfish) return;
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

    // Đo width của 1 bộ logo gốc (trước khi clone)
    var oneSetW    = track.scrollWidth;
    var containerW = viewport.offsetWidth || wrap.offsetWidth || 600;

    // Cần mỗi "nửa" của track >= containerW để không bao giờ thấy khoảng trắng
    // Ví dụ 5 logo × 80px ≈ 448px trên container 900px → cần 2 bộ/nửa → 4 bộ tổng
    var setsPerHalf  = Math.max(1, Math.ceil(containerW / oneSetW));
    var totalSets    = setsPerHalf * 2; // luôn chẵn → -50% seamless

    // Clone: đã có 1 bộ, thêm (totalSets - 1) bộ nữa
    for (var i = 1; i < totalSets; i++) {
      items.forEach(function (item) { track.appendChild(item.cloneNode(true)); });
    }

    // Tốc độ cố định 80px/s — mượt và nhất quán bất kể số logo
    var halfW    = oneSetW * setsPerHalf;
    var duration = Math.max(6, Math.round(halfW / 80));
    track.style.animation = prefix + '_marquee ' + duration + 's linear infinite';

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

    function shouldShow() {
      if (frequency === 'always') return true;
      var last = localStorage.getItem(storageKey);
      if (!last) return true;
      if (frequency === 'session') return false;
      // daily: check if 24h passed
      return (Date.now() - parseInt(last, 10)) > 86400000;
    }

    function openPopup() {
      popup.classList.add('active');
      popup.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closePopup() {
      popup.classList.remove('active');
      popup.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function showPopup() {
      if (!shouldShow()) return;
      setTimeout(function () {
        openPopup();
        if (frequency !== 'always') {
          localStorage.setItem(storageKey, String(Date.now()));
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

  /* ── Banner rotation ────────────────────────────────────────────────── */
  function initRotation() {
    var interval = parseInt((cfg.rotateInterval || 5000), 10);
    document.querySelectorAll('[data-seo1-rotate]').forEach(function (wrap) {
      var banners = JSON.parse(wrap.dataset.banners || '[]');
      if (banners.length < 2) return;
      var img  = wrap.querySelector('img');
      var link = wrap.querySelector('a');
      if (!img) return;
      var cur = 0;
      setInterval(function () {
        cur = (cur + 1) % banners.length;
        img.src = banners[cur].image_url;
        img.alt = banners[cur].title || '';
        if (link) link.href = banners[cur].click_url || '#';
      }, interval);
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initCatfish();
    initAllSliders();
    initPopup();
    initRotation();
  });

})();
