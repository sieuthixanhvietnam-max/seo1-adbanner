/* SEO1 Ad Banner — Admin JS */
(function () {
  'use strict';

  var SEO1_STYLE_COLORS = {
    1: { bg: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',    border: 'transparent' },
    2: { bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff',    border: 'transparent' },
    3: { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000',    border: 'transparent' },
    4: { bg: 'linear-gradient(135deg,#1f2937,#111827)', color: '#fff',    border: 'transparent' },
    5: { bg: 'transparent',                             color: '#2271b1', border: '#2271b1'      },
    6: { bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff',    border: 'transparent' },
    7: { bg: 'linear-gradient(135deg,#ea580c,#c2410c)', color: '#fff',    border: 'transparent' },
    8: { bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',    border: 'transparent' },
  };

  /* ── Section nav: smooth scroll ──────────────────────────────────────────── */
  function initSectionNav() {
    document.querySelectorAll('.seo1-section-nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight active for a moment
        document.querySelectorAll('.seo1-section-nav-link').forEach(function (l) {
          l.classList.remove('seo1-section-nav-link--active');
        });
        link.classList.add('seo1-section-nav-link--active');
        setTimeout(function () {
          link.classList.remove('seo1-section-nav-link--active');
        }, 1200);
      });
    });
  }

  /* ── CTA: style swatch change ─────────────────────────────────────────────── */
  function initStyleSwatches() {
    document.querySelectorAll('.seo1-style-radio').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        var slot  = radio.dataset.slot;
        var val   = parseInt(radio.value, 10);
        var c     = SEO1_STYLE_COLORS[val] || SEO1_STYLE_COLORS[1];
        var live  = document.getElementById('seo1-cta-live-' + slot);
        if (!live) return;
        var btn = live.querySelector('.seo1-preview-btn');
        if (!btn) return;
        btn.style.background   = c.bg;
        btn.style.color        = c.color;
        btn.style.borderColor  = c.border;
      });
    });
  }

  /* ── CTA: label input change ──────────────────────────────────────────────── */
  function initLabelInputs() {
    document.querySelectorAll('.seo1-cta-label-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var slot       = input.dataset.slot;
        var defaultLbl = input.dataset.default || '';
        var live       = document.getElementById('seo1-cta-live-' + slot);
        if (!live) return;
        var textEl = live.querySelector('.seo1-cta-preview-text');
        if (textEl) textEl.textContent = input.value.trim() || defaultLbl;
      });
    });
  }

  /* ── Tracking: live preview ───────────────────────────────────────────────── */
  function initTrackingPreviews() {
    document.querySelectorAll('[data-tracking-preview]').forEach(function (input) {
      input.addEventListener('input', function () {
        var bid     = input.dataset.trackingPreview;
        var baseUrl = input.dataset.baseUrl || '';
        var sep     = baseUrl.indexOf('?') !== -1 ? '&' : '?';
        var preview = input.value.trim() ? baseUrl + sep + input.value.trim() : baseUrl;
        var el      = document.getElementById('seo1-tracking-preview-' + bid);
        if (!el) return;
        el.textContent = preview || '—';
        el.className   = preview ? 'seo1-preview-url' : 'seo1-preview-empty';
      });
    });
  }

  /* ── CTA: icon radio picker ───────────────────────────────────────────────── */
  function initIconPickers() {
    document.querySelectorAll('.seo1-icon-radio').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        var slot   = radio.dataset.slot;
        var icon   = radio.value;
        var live   = document.getElementById('seo1-cta-live-' + slot);
        if (!live) return;
        var iconEl = live.querySelector('.seo1-preview-icon');
        if (!iconEl) return;
        iconEl.className = iconEl.className.replace(/dashicons-\S+/, 'dashicons-' + icon);
      });
    });
  }

  /* ── Copy shortcode buttons ───────────────────────────────────────────────── */
  function initCopyButtons() {
    document.querySelectorAll('.seo1-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.dataset.copy || '';
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(function () {
          var orig = btn.textContent;
          btn.textContent = 'Đã sao chép!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = orig;
            btn.classList.remove('copied');
          }, 1800);
        });
      });
    });
  }

  /* ── Reviews: accordion toggle ───────────────────────────────────────────── */
  function initReviewAccordion() {
    // Per-brand toggle
    document.querySelectorAll('.seo1-rv-trigger').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var bodyId   = btn.getAttribute('aria-controls');
        var body     = bodyId ? document.getElementById(bodyId) : null;
        if (!body) return;
        if (expanded) {
          btn.setAttribute('aria-expanded', 'false');
          body.hidden = true;
        } else {
          btn.setAttribute('aria-expanded', 'true');
          body.hidden = false;
        }
      });
    });

    // Expand / collapse all
    var expandAllBtn = document.querySelector('.seo1-rv-expand-all');
    if (expandAllBtn) {
      var allOpen = false;
      expandAllBtn.addEventListener('click', function () {
        allOpen = !allOpen;
        document.querySelectorAll('.seo1-rv-trigger').forEach(function (btn) {
          var bodyId = btn.getAttribute('aria-controls');
          var body   = bodyId ? document.getElementById(bodyId) : null;
          if (!body) return;
          btn.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
          body.hidden = !allOpen;
        });
        expandAllBtn.textContent = allOpen
          ? (expandAllBtn.dataset.labelOpen   || 'Thu gọn tất cả')
          : (expandAllBtn.dataset.labelClosed || 'Mở rộng tất cả');
      });
    }
  }

  /* ── Appearance: live preview ────────────────────────────────────────────── */
  function initAppearancePreviews() {
    // Slider controls
    document.querySelectorAll('.seo1-ap-input').forEach(function (el) {
      el.addEventListener('input', handleAppearanceInput);
      el.addEventListener('change', handleAppearanceInput);
    });
    document.querySelectorAll('.seo1-ap-check').forEach(function (el) {
      el.addEventListener('change', function () {
        var val = el.checked ? el.dataset.apOn : el.dataset.apOff;
        applyProp(el.dataset.apTarget, el.dataset.apProp, val);
      });
    });

    function handleAppearanceInput() {
      var el     = this;
      var target = el.dataset.apTarget;
      var prop   = el.dataset.apProp;
      var val    = el.value;

      // Sync color text box
      if (el.type === 'color') {
        var textEl = el.nextElementSibling;
        if (textEl && textEl.type === 'text') textEl.value = val;
      }

      // Update range display
      var valDisp = document.querySelector('[data-ap-for="' + el.name.replace('appearance[','').replace(']','') + '"]');
      if (valDisp) valDisp.textContent = val + 'px';

      if (!target || !prop) return;
      applyProp(target, prop, val);
    }

    function applyProp(target, prop, val) {
      if (target === 'slider-wrap') {
        var wrap = document.getElementById('seo1-slider-preview-wrap');
        if (!wrap) return;
        if (prop === 'background') wrap.style.background = val;
        if (prop === 'borderRadius') wrap.style.borderRadius = val + 'px';
        if (prop === 'boxShadow') wrap.style.boxShadow = val;
      }
      if (target === 'slider-track') {
        var track = document.getElementById('seo1-slider-preview-track');
        if (!track) return;
        if (prop === 'gap') track.style.gap = val + 'px';
      }
      if (target === 'slider-logo') {
        var logos = document.querySelectorAll('.seo1-slider-preview-item');
        logos.forEach(function (logo) {
          logo.style.width  = val + 'px';
          logo.style.height = val + 'px';
        });
      }
      if (target === 'catfish-bar') {
        var bar = document.getElementById('seo1-catfish-preview-bar');
        if (!bar) return;
        if (prop === 'background') bar.style.background = val === 'transparent' ? '#000' : val;
        if (prop === 'width') bar.style.width = val;
      }
      if (target === 'catfish-img') {
        var imgs = document.querySelectorAll('.seo1-catfish-preview-cell');
        imgs.forEach(function (img) {
          if (prop === 'height') img.style.height = val + 'px';
        });
      }
      if (target === 'catfish-close') {
        var closeBtn = document.getElementById('seo1-catfish-preview-close');
        if (!closeBtn) return;
        if (prop === 'background') closeBtn.style.background = val;
      }
      if (target === 'catfish-grid') {
        var grid = document.getElementById('seo1-catfish-preview-grid');
        if (!grid) return;
        if (prop === 'columns') {
          grid.style.gridTemplateColumns = 'repeat(' + val + ', 1fr)';
          // rebuild cells
          var cells = grid.querySelectorAll('.seo1-catfish-preview-cell');
          var count = parseInt(val, 10);
          // remove excess
          for (var i = count; i < cells.length; i++) cells[i].remove();
          // add missing
          var existing = grid.querySelectorAll('.seo1-catfish-preview-cell').length;
          for (var j = existing; j < count; j++) {
            var cell = document.createElement('div');
            cell.className = 'seo1-catfish-preview-cell';
            cell.style.cssText = cells[0] ? cells[0].style.cssText : 'height:50px;background:#374151;display:flex;align-items:center;justify-content:center';
            cell.innerHTML = '<span class="dashicons dashicons-format-image" style="font-size:20px;width:20px;height:20px;color:#6b7280"></span>';
            grid.appendChild(cell);
          }
        }
      }
    }
  }

  /* ── Tracking override collapsible ───────────────────────────────────────── */
  function initTrackingOverride() {
    var trigger = document.querySelector('.seo1-trk-override-trigger');
    var body    = document.getElementById('seo1-trk-override-body');
    if (!trigger || !body) return;

    trigger.addEventListener('click', function () {
      var expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (expanded) {
        body.setAttribute('hidden', '');
      } else {
        body.removeAttribute('hidden');
        // focus first input when opened
        var first = body.querySelector('input[type="text"]');
        if (first) first.focus();
      }
    });
  }

  /* ── Init ─────────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initSectionNav();
    initStyleSwatches();
    initLabelInputs();
    initTrackingPreviews();
    initIconPickers();
    initCopyButtons();
    initReviewAccordion();
    initAppearancePreviews();
    initTrackingOverride();
  });

})();
