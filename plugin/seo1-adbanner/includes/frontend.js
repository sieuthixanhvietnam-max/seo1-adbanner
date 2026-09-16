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

  /* ── Slider ─────────────────────────────────────────────────────────── */
  function initSlider(wrap) {
    var viewport = wrap.querySelector('.' + prefix + '_slider_viewport');
    var track    = wrap.querySelector('.' + prefix + '_slider_track');
    var btnPrev  = wrap.querySelector('.' + prefix + '_slider_prev');
    var btnNext  = wrap.querySelector('.' + prefix + '_slider_next');
    if (!viewport || !track) return;

    var isMobile    = window.innerWidth <= 767;
    var ITEM_W      = isMobile ? 52 : 80;
    var GAP         = 6;
    var STRIDE      = ITEM_W + GAP;       // 86px desktop, 58px mobile
    var VISIBLE     = isMobile ? 5 : 10;
    var ANIM_MS     = 350;                // phải khớp với CSS transition duration
    var AUTOPLAY_MS = 3000;

    var origItems = Array.from(track.querySelectorAll('.' + prefix + '_slider_item'));
    var total     = origItems.length;
    if (total === 0) return;

    // Set viewport = số logo hiển thị × stride - gap
    var shown = Math.min(total, VISIBLE);
    viewport.style.width = (shown * STRIDE - GAP) + 'px';

    var canLoop = total > VISIBLE;

    if (!canLoop) {
      // Không đủ logo để loop — ẩn nav, chỉ hiển thị tĩnh
      if (btnPrev) btnPrev.style.display = 'none';
      if (btnNext) btnNext.style.display = 'none';
      return;
    }

    // Clone VISIBLE logo đầu nối vào cuối track để seamless loop
    for (var c = 0; c < VISIBLE; c++) {
      track.appendChild(origItems[c % total].cloneNode(true));
    }

    var idx      = 0;
    var timer    = null;
    var jumping  = false; // đang snap không transition

    // Dịch track instant (không animation) sau khi loop
    function snapTo(newIdx) {
      jumping = true;
      track.style.transition = 'none';
      idx = newIdx;
      track.style.transform = 'translateX(-' + (idx * STRIDE) + 'px)';
      // force reflow để browser áp dụng ngay
      void track.offsetWidth;
      track.style.transition = '';
      jumping = false;
    }

    // Dịch có animation
    function slideTo(newIdx) {
      if (jumping) return;
      idx = newIdx;
      track.style.transform = 'translateX(-' + (idx * STRIDE) + 'px)';

      // Nếu đã qua clone zone → snap về đầu sau animation xong
      if (idx >= total) {
        setTimeout(function () { snapTo(idx - total); }, ANIM_MS);
      }
      // Nếu đã trước vị trí 0 → snap về cuối
      if (idx < 0) {
        setTimeout(function () { snapTo(idx + total); }, ANIM_MS);
      }
    }

    function startAuto() {
      stopAuto();
      timer = setInterval(function () { slideTo(idx + 1); }, AUTOPLAY_MS);
    }

    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    if (btnNext) btnNext.addEventListener('click', function () { slideTo(idx + 1); startAuto(); });
    if (btnPrev) btnPrev.addEventListener('click', function () { slideTo(idx - 1); startAuto(); });

    wrap.addEventListener('mouseenter', stopAuto);
    wrap.addEventListener('mouseleave', startAuto);

    snapTo(0);
    startAuto();
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

    function showPopup() {
      if (!shouldShow()) return;
      setTimeout(function () {
        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (frequency !== 'always') {
          localStorage.setItem(storageKey, String(Date.now()));
        }
      }, delay);
    }

    var closeBtn = popup.querySelector('.' + prefix + '_popup_close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        popup.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    popup.addEventListener('click', function (e) {
      if (e.target === popup) {
        popup.classList.remove('active');
        document.body.style.overflow = '';
      }
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
