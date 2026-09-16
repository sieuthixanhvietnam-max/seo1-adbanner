(function() {
  'use strict';

  const AdBanner = {
    config: window.AdBannerConfig || {},
    data: null,

    init() {
      if (!this.config.apiUrl) return;
      this.fetchData();
    },

    fetchData() {
      const apiUrl = this.config.apiUrl.replace(/\/$/, '');
      fetch(apiUrl + '/api/banners/all')
        .then(r => r.json())
        .then(res => {
          if (!res.success) return;
          this.data = res.data;
          this.render();
        })
        .catch(err => {
          console.warn('[AdBanner] Không thể fetch API:', err);
        });
    },

    render() {
      document.querySelectorAll('.ab-zone').forEach(el => {
        const type  = el.dataset.type;
        const count = parseInt(el.dataset.count) || 2;
        switch (type) {
          case 'homepage': this.renderHomepage(el, this.data.banners_homepage || [], count); break;
          case 'catfish':  this.renderCatfish(el,  this.data.banners_catfish  || [], count); break;
          case 'sidebar':  this.renderSidebar(el,  this.data.banners_sidebar  || [], count); break;
        }
      });
    },

    shuffle(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    getRandom(banners, count) {
      const enabled = this.config.bannerEnabled || [];
      const pool = enabled.length > 0
        ? banners.filter(b => enabled.includes(b.id))
        : banners;
      return this.shuffle(pool).slice(0, count);
    },

    // Lấy URL cuối cùng: override → server URL, sau đó ghép tracking
    buildUrl(banner) {
      const overrides = this.config.urlOverrides || {};
      const params    = this.config.trackingParams || {};
      const baseUrl   = overrides[banner.id] || banner.click_url || '#';
      const tracking  = banner.brand_id ? (params[banner.brand_id] || '') : '';
      if (!tracking) return baseUrl;
      const sep = baseUrl.includes('?') ? '&' : '?';
      return baseUrl + sep + tracking;
    },

   // ── HOMEPAGE ──
renderHomepage(el, banners, count) {
  const selected = this.getRandom(banners, count);
  if (!selected.length) { el.style.display = 'none'; return; }

  const gridItems = selected.map(b => `
    <a href="${this.buildUrl(b)}" target="_blank" rel="nofollow noopener">
      <img src="${b.image_url}" alt="${b.title || b.brand_id || ''}" loading="lazy">
    </a>
  `).join('');

  const slideItems = selected.map((b, i) => `
    <div class="ab-slide${i === 0 ? ' active' : ''}">
      <a href="${this.buildUrl(b)}" target="_blank" rel="nofollow noopener">
        <img src="${b.image_url}" alt="${b.title || b.brand_id || ''}" loading="lazy">
      </a>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="ab-homepage-wrap">
      <div class="ab-homepage-grid">${gridItems}</div>
      <div class="ab-homepage-slider">
        <div class="ab-slides">${slideItems}</div>
      </div>
    </div>
  `;

  if (selected.length > 1) {
    this.initSlider(el.querySelector('.ab-homepage-slider'), selected.length);
  }
},

    initSlider(sliderEl, total) {
      if (!sliderEl || total <= 1) return;
      let current = 0;
      let timer   = null;

      const slides = sliderEl.querySelectorAll('.ab-slide');
      const dots   = sliderEl.querySelectorAll('.ab-dot');

      const goTo = (index) => {
        slides[current].classList.remove('active');
        dots[current] && dots[current].classList.remove('active');
        current = (index + total) % total;
        slides[current].classList.add('active');
        dots[current] && dots[current].classList.add('active');
      };

      const next = () => goTo(current + 1);
      const startTimer = () => { timer = setInterval(next, 4000); };
      const stopTimer  = () => clearInterval(timer);
      startTimer();

      dots.forEach(dot => {
        dot.addEventListener('click', () => {
          stopTimer();
          goTo(parseInt(dot.dataset.index));
          startTimer();
        });
      });

      // Touch/Swipe
      let touchStartX = 0;
      const slidesWrap = sliderEl.querySelector('.ab-slides');
      if (slidesWrap) {
        slidesWrap.addEventListener('touchstart', e => {
          touchStartX = e.touches[0].clientX;
        }, { passive: true });
        slidesWrap.addEventListener('touchend', e => {
          const diff = touchStartX - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) {
            stopTimer();
            diff > 0 ? next() : goTo(current - 1);
            startTimer();
          }
        }, { passive: true });
      }
    },

    // ── CATFISH ──
    renderCatfish(el, banners, count) {
      const selected = this.getRandom(banners, count);
      if (!selected.length) { el.style.display = 'none'; return; }

      el.innerHTML = `
        <div class="ab-catfish-wrap">
          <button class="ab-catfish-close" aria-label="Dong">&#10005; [ĐÓNG]</button>
          <div class="ab-catfish-inner">
            ${selected.map(b => `
              <a href="${this.buildUrl(b)}" target="_blank" rel="nofollow noopener">
                <img src="${b.image_url}" alt="${b.title || b.brand_id || ''}" loading="lazy">
              </a>
            `).join('')}
          </div>
        </div>
      `;

      const closeBtn = el.querySelector('.ab-catfish-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          el.style.display = 'none';
        });
      }
    },

    // ── SIDEBAR ──
renderSidebar(el, banners, count) {
  // Ẩn hoàn toàn trên mobile — không render, không tải ảnh
  if (window.innerWidth <= 768) {
    el.style.display = 'none';
    return;
  }

  const selected = this.getRandom(banners, count);
  if (!selected.length) { el.style.display = 'none'; return; }

  el.innerHTML = `
    <div class="ab-sidebar-wrap">
      ${selected.map(b => `
        <a href="${this.buildUrl(b)}" target="_blank" rel="nofollow noopener">
          <img src="${b.image_url}" alt="${b.title || b.brand_id || ''}" loading="lazy">
        </a>
      `).join('')}
    </div>
  `;
},
};

  document.addEventListener('DOMContentLoaded', () => AdBanner.init());

})();