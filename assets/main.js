/* ==========================================================================
   MONOLITH — Interactive Application Logic (Pure Vanilla JS)
   Zero dependencies, zero build step — GitHub Pages Ready
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'monolith_order_list_v1';

  // --- Utility Helpers ---
  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  }

  function toPersianDigits(val) {
    const map = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(val).replace(/\d/g, function (d) {
      return map[Number(d)];
    });
  }

  function getProjects() {
    return Array.isArray(window.MONOLITH_PROJECTS) ? window.MONOLITH_PROJECTS : [];
  }

  function getProjectById(id) {
    return getProjects().find(function (item) {
      return item.id === id;
    });
  }

  // --- Toast Notification ---
  let toastTimer = null;
  function showToast(message) {
    let toast = qs('#global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'toast-notice';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C5A46D" stroke-width="1.8"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
      '<span>' + message + '</span>';
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3400);
  }

  // --- Order List State (LocalStorage) ---
  function getOrderList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveOrderList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // Ignore storage quota errors
    }
    updateCartBadge();
    renderOrderDrawer();
  }

  function addToOrderList(projectId, openDrawerAfter) {
    const project = getProjectById(projectId);
    if (!project) return;
    const list = getOrderList();
    const exists = list.some(function (entry) {
      return entry.id === projectId;
    });
    if (!exists) {
      list.push({
        id: project.id,
        option: 'درخواست پرونده کامل و بازدید خصوصی'
      });
      saveOrderList(list);
      showToast('«' + project.title + '» به فهرست سفارش تلگرام اضافه شد.');
    } else {
      showToast('این پروژه هم‌اکنون در فهرست سفارش شما قرار دارد.');
    }
    if (openDrawerAfter) {
      openOrderDrawer();
    }
  }

  function removeFromOrderList(projectId) {
    const list = getOrderList().filter(function (entry) {
      return entry.id !== projectId;
    });
    saveOrderList(list);
  }

  function updateOrderOption(projectId, optionValue) {
    const list = getOrderList().map(function (entry) {
      if (entry.id === projectId) {
        return { id: entry.id, option: optionValue };
      }
      return entry;
    });
    saveOrderList(list);
  }

  function updateCartBadge() {
    const count = getOrderList().length;
    qsa('[data-cart-count]').forEach(function (el) {
      el.textContent = toPersianDigits(count);
    });
  }

  // --- Telegram Deep-Link Generator ---
  function buildTelegramUrl(messageText) {
    const handle = (window.MONOLITH_CONFIG && window.MONOLITH_CONFIG.telegramUsername) || 'monolith_atelier';
    return 'https://t.me/' + encodeURIComponent(handle) + '?text=' + encodeURIComponent(messageText);
  }

  function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(successMsg || 'متن با موفقیت کپی شد.');
      }).catch(function () {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || 'متن با موفقیت کپی شد.');
    } catch (e) {
      showToast('امکان کپی خودکار در مرورگر فراهم نشد.');
    }
    document.body.removeChild(ta);
  }

  // --- Shared Order Drawer & Quick-View Modal Injection ---
  function ensureGlobalOverlays() {
    if (!qs('#order-drawer')) {
      const drawerHtml =
        '<div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true"></div>' +
        '<aside id="order-drawer" class="order-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">' +
          '<div class="modal-header">' +
            '<div>' +
              '<span class="section-eyebrow" style="margin-bottom:0.2rem;">TELEGRAM CONCIERGE</span>' +
              '<h2 id="drawer-title" style="margin:0;font-size:1.15rem;font-weight:500;">فهرست سفارش و رزرو اختصاصی</h2>' +
            '</div>' +
            '<button type="button" class="modal-close" id="close-drawer-btn" aria-label="بستن فهرست سفارش">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
            '</button>' +
          '</div>' +
          '<div class="drawer-body" id="drawer-items-container"></div>' +
          '<div class="drawer-footer">' +
            '<div class="field-group" style="margin-bottom:1rem;">' +
              '<label class="field-label" for="drawer-client-name">نام کامل متقاضی</label>' +
              '<input id="drawer-client-name" type="text" class="hairline-input" placeholder="مثال: آرش رادمهر" />' +
            '</div>' +
            '<div class="field-group" style="margin-bottom:1.25rem;">' +
              '<label class="field-label" for="drawer-client-phone">شماره تماس / تلگرام</label>' +
              '<input id="drawer-client-phone" type="tel" class="hairline-input tabular-nums" placeholder="۰۹۱۲۰۰۰۰۰۰۰" />' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:0.65rem;">' +
              '<a id="drawer-telegram-submit" href="#" target="_blank" rel="noopener noreferrer" class="btn-monument" style="width:100%;">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
                '<span>ارسال سفارش در تلگرام</span>' +
              '</a>' +
              '<button type="button" id="drawer-copy-btn" class="btn-ghost btn-sm" style="width:100%;">کپی متن کامل سفارش</button>' +
            '</div>' +
          '</div>' +
        '</aside>';
      document.body.insertAdjacentHTML('beforeend', drawerHtml);
    }

    if (!qs('#project-modal-backdrop')) {
      const modalHtml =
        '<div id="project-modal-backdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-project-title">' +
          '<div class="modal-panel">' +
            '<div class="modal-header">' +
              '<div>' +
                '<span id="modal-project-code" class="section-eyebrow" style="margin-bottom:0.2rem;"></span>' +
                '<h2 id="modal-project-title" style="margin:0;font-size:1.35rem;font-weight:500;"></h2>' +
              '</div>' +
              '<button type="button" class="modal-close" id="close-project-modal" aria-label="بستن جزئیات">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
              '</button>' +
            '</div>' +
            '<div id="modal-project-body" style="padding:2rem;"></div>' +
          '</div>' +
        '</div>';
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  }

  function openOrderDrawer() {
    ensureGlobalOverlays();
    renderOrderDrawer();
    qs('#drawer-backdrop').classList.add('is-open');
    qs('#order-drawer').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeOrderDrawer() {
    const bd = qs('#drawer-backdrop');
    const dr = qs('#order-drawer');
    if (bd) bd.classList.remove('is-open');
    if (dr) dr.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function renderOrderDrawer() {
    const container = qs('#drawer-items-container');
    if (!container) return;
    const list = getOrderList();

    if (list.length === 0) {
      container.innerHTML =
        '<div style="padding:3rem 1rem;text-align:center;border:1px dashed var(--hairline-graphite);">' +
          '<p style="margin:0 0 1rem 0;color:var(--text-muted);font-size:0.95rem;">فهرست سفارش شما در حال حاضر خالی است.</p>' +
          '<a href="products.html" class="btn-ghost btn-sm">مشاهده کلکسیون آثار</a>' +
        '</div>';
      return;
    }

    container.innerHTML = list.map(function (entry) {
      const proj = getProjectById(entry.id);
      if (!proj) return '';
      return (
        '<div class="drawer-item">' +
          '<img class="drawer-item-img" src="' + proj.image + '" alt="' + proj.title + '" />' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">' +
              '<strong style="font-size:0.95rem;font-weight:500;color:var(--text-pristine);">' + proj.title + '</strong>' +
              '<button type="button" data-remove-id="' + proj.id + '" style="color:var(--text-muted);font-size:0.78rem;" aria-label="حذف از فهرست">حذف</button>' +
            '</div>' +
            '<div style="font-size:0.8rem;color:var(--champagne-gold);margin-block:0.25rem 0.6rem;">' + proj.code + ' · ' + proj.priceLabel + '</div>' +
            '<select class="hairline-select" data-option-id="' + proj.id + '" style="font-size:0.8rem;min-height:36px;">' +
              '<option value="درخواست پرونده کامل و بازدید خصوصی"' + (entry.option === 'درخواست پرونده کامل و بازدید خصوصی' ? ' selected' : '') + '>پرونده کامل و بازدید خصوصی</option>' +
              '<option value="جلسه سرمایه‌گذاری و شرایط پرداخت"' + (entry.option === 'جلسه سرمایه‌گذاری و شرایط پرداخت' ? ' selected' : '') + '>جلسه سرمایه‌گذاری و شرایط پرداخت</option>' +
              '<option value="سفارش رزرو قطعی / پیش‌قرارداد"' + (entry.option === 'سفارش رزرو قطعی / پیش‌قرارداد' ? ' selected' : '') + '>سفارش رزرو قطعی / پیش‌قرارداد</option>' +
            '</select>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    syncDrawerTelegramHref();
  }

  function syncDrawerTelegramHref() {
    const link = qs('#drawer-telegram-submit');
    if (link) {
      link.setAttribute('href', buildTelegramUrl(buildOrderMessageFromDrawer()));
    }
  }

  function buildOrderMessageFromDrawer() {
    const list = getOrderList();
    const clientName = (qs('#drawer-client-name') && qs('#drawer-client-name').value.trim()) || 'متقاضی محترم';
    const clientPhone = (qs('#drawer-client-phone') && qs('#drawer-client-phone').value.trim()) || 'ثبت‌نشده';

    if (list.length === 0) {
      return 'سلام آتلیه مونولیت، مایل به دریافت مشاوره اختصاصی و کاتالوگ پروژه‌های آف‌مارکت هستم.\nنام: ' + clientName + '\nشماره تماس: ' + clientPhone;
    }

    const lines = [
      'سلام آتلیه معماری مونولیت؛',
      'درخواست ثبت سفارش و هماهنگی اختصاصی برای موارد زیر را دارم:',
      ''
    ];

    list.forEach(function (entry, idx) {
      const proj = getProjectById(entry.id);
      if (proj) {
        lines.push(
          toPersianDigits(idx + 1) + '. ' + proj.title + ' (' + proj.code + ')' +
          '\n   ارزش: ' + proj.priceLabel +
          '\n   نوع درخواست: ' + entry.option
        );
      }
    });

    lines.push('');
    lines.push('نام متقاضی: ' + clientName);
    lines.push('شماره تماس: ' + clientPhone);
    return lines.join('\n');
  }

  // --- Architectural Detail Quick-View Modal ---
  function openProjectModal(projectId) {
    ensureGlobalOverlays();
    const proj = getProjectById(projectId);
    if (!proj) return;

    qs('#modal-project-code').textContent = proj.code + ' · ' + proj.categoryLabel;
    qs('#modal-project-title').textContent = proj.title;

    const singleMessage =
      'سلام آتلیه مونولیت؛\nدرخواست سفارش / رزرو بازدید برای پروژه «' +
      proj.title + ' (' + proj.code + ')» به ارزش ' + proj.priceLabel + ' را دارم.';
    const tgHref = buildTelegramUrl(singleMessage);

    qs('#modal-project-body').innerHTML =
      '<div class="split-grid" style="gap:2rem;">' +
        '<div class="split-col-6">' +
          '<div style="border:1px solid var(--hairline-graphite);aspect-ratio:4/3;overflow:hidden;margin-bottom:1rem;">' +
            '<img src="' + proj.image + '" alt="' + proj.title + '" style="width:100%;height:100%;object-fit:cover;" />' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border:1px solid var(--hairline-graphite);background:var(--obsidian-base);">' +
            '<span style="font-size:0.82rem;color:var(--text-muted);">وضعیت واگذاری</span>' +
            '<span class="micro-badge">' + proj.statusBadge + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="split-col-6" style="display:flex;flex-direction:column;">' +
          '<p style="margin:0 0 1.5rem 0;color:var(--text-ivory);line-height:1.85;font-size:0.96rem;">' + proj.description + '</p>' +
          '<div style="border-top:1px solid var(--hairline-graphite);border-bottom:1px solid var(--hairline-graphite);padding-block:1rem;margin-bottom:1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
            '<div><span class="spec-label">موقعیت</span><span class="spec-value">' + proj.location + '</span></div>' +
            '<div><span class="spec-label">زیربنا</span><span class="spec-value tabular-nums">' + proj.areaLabel + '</span></div>' +
            '<div><span class="spec-label">چیدمان</span><span class="spec-value">' + proj.suites + '</span></div>' +
            '<div><span class="spec-label">متریال شاخص</span><span class="spec-value">' + proj.materials + '</span></div>' +
          '</div>' +
          '<div style="margin-bottom:1.75rem;">' +
            '<span class="spec-label">ارزش سرمایه‌گذاری</span>' +
            '<div style="font-size:1.35rem;font-weight:600;color:var(--champagne-gold);margin-bottom:0.3rem;">' + proj.priceLabel + '</div>' +
            '<div style="font-size:0.82rem;color:var(--text-muted);">' + proj.yieldNote + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:auto;">' +
            '<a href="' + tgHref + '" target="_blank" rel="noopener noreferrer" class="btn-monument" style="flex:1;">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
              '<span>سفارش مستقیم تلگرام</span>' +
            '</a>' +
            '<button type="button" class="btn-ghost" data-add-order="' + proj.id + '" style="flex:1;">افزودن به فهرست سفارش</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    qs('#project-modal-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeProjectModal() {
    const mb = qs('#project-modal-backdrop');
    if (mb) mb.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // --- Card Markup Renderer ---
  function createProjectCardHtml(proj) {
    return (
      '<article class="arch-card reveal-item is-revealed">' +
        '<div class="arch-card-media">' +
          '<img src="' + proj.image + '" alt="' + proj.title + '" loading="lazy" />' +
          '<div class="arch-card-badge-slot"><span class="micro-badge">' + proj.statusBadge + '</span></div>' +
          '<span class="arch-card-code">' + proj.code + '</span>' +
        '</div>' +
        '<div class="arch-card-body">' +
          '<div class="arch-card-meta">' +
            '<span>' + proj.categoryLabel + '</span>' +
            '<span aria-hidden="true">·</span>' +
            '<span>' + proj.location + '</span>' +
          '</div>' +
          '<h3 class="arch-card-title">' + proj.title + '</h3>' +
          '<p class="arch-card-summary">' + proj.summary + '</p>' +
          '<div class="arch-card-specs">' +
            '<div><span class="spec-label">مساحت زیربنا</span><span class="spec-value tabular-nums">' + proj.areaLabel + '</span></div>' +
            '<div><span class="spec-label">پیکربندی</span><span class="spec-value">' + proj.suites + '</span></div>' +
          '</div>' +
          '<div class="arch-card-footer">' +
            '<div class="price-block">' +
              '<span class="price-label">ارزش برآوردی</span>' +
              '<span class="price-value tabular-nums">' + proj.priceLabel + '</span>' +
            '</div>' +
            '<div class="card-btn-group">' +
              '<button type="button" class="btn-ghost btn-sm" data-view-project="' + proj.id + '">جزئیات</button>' +
              '<button type="button" class="btn-monument btn-sm" data-add-order="' + proj.id + '">سفارش</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  // --- Page Initializers ---
  function initFeaturedHome() {
    const grid = qs('#featured-projects-grid');
    if (!grid) return;
    const featured = getProjects().filter(function (p) { return p.featured; }).slice(0, 3);
    grid.innerHTML = featured.map(createProjectCardHtml).join('');
  }

  function initProductsCatalog() {
    const grid = qs('#catalog-projects-grid');
    if (!grid) return;

    const filterBtns = qsa('[data-filter-category]');
    const searchInput = qs('#catalog-search');
    const sortSelect = qs('#catalog-sort');
    const countLabel = qs('#catalog-result-count');
    let activeCategory = 'all';

    function renderCatalog() {
      const query = (searchInput ? searchInput.value.trim().toLowerCase() : '');
      const sortMode = sortSelect ? sortSelect.value : 'default';

      let items = getProjects().filter(function (p) {
        const matchesCat = activeCategory === 'all' || p.category === activeCategory;
        const matchesQuery =
          !query ||
          p.title.toLowerCase().indexOf(query) !== -1 ||
          p.location.toLowerCase().indexOf(query) !== -1 ||
          p.code.toLowerCase().indexOf(query) !== -1 ||
          p.materials.toLowerCase().indexOf(query) !== -1;
        return matchesCat && matchesQuery;
      });

      if (sortMode === 'price-desc') {
        items = items.slice().sort(function (a, b) { return b.priceValue - a.priceValue; });
      } else if (sortMode === 'price-asc') {
        items = items.slice().sort(function (a, b) { return a.priceValue - b.priceValue; });
      } else if (sortMode === 'area-desc') {
        items = items.slice().sort(function (a, b) { return b.area - a.area; });
      }

      if (countLabel) {
        countLabel.textContent = 'نمایش ' + toPersianDigits(items.length) + ' اثر معماری';
      }

      if (items.length === 0) {
        grid.innerHTML =
          '<div style="grid-column:1/-1;padding:4rem 2rem;text-align:center;border:1px solid var(--hairline-graphite);background:var(--surface-charcoal);">' +
            '<p style="margin:0 0 1.25rem 0;color:var(--text-muted);">موردی مطابق با جست‌وجو یا فیلتر انتخابی شما یافت نشد.</p>' +
            '<button type="button" id="reset-catalog-filters" class="btn-ghost btn-sm">بازنشانی فیلترها</button>' +
          '</div>';
        return;
      }

      grid.innerHTML = items.map(createProjectCardHtml).join('');
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-filter-category');
        filterBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        renderCatalog();
      });
    });

    if (searchInput) searchInput.addEventListener('input', renderCatalog);
    if (sortSelect) sortSelect.addEventListener('change', renderCatalog);

    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'reset-catalog-filters') {
        activeCategory = 'all';
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'default';
        filterBtns.forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-filter-category') === 'all');
        });
        renderCatalog();
      }
    });

    renderCatalog();
  }

  function initMaterialTabs() {
    const tabsWrap = qs('#material-tabs');
    const detailWrap = qs('#material-detail-display');
    if (!tabsWrap || !detailWrap || !Array.isArray(window.MONOLITH_MATERIALS)) return;

    const materials = window.MONOLITH_MATERIALS;
    let activeId = materials[0].id;

    function renderMaterial() {
      const mat = materials.find(function (m) { return m.id === activeId; }) || materials[0];
      detailWrap.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:1rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--hairline-graphite);">' +
          '<h3 style="margin:0;font-size:1.4rem;font-weight:500;color:var(--text-pristine);">' + mat.name + '</h3>' +
          '<span class="latin-sans" style="font-size:0.78rem;letter-spacing:0.15em;color:var(--champagne-gold);">' + mat.latinName + '</span>' +
        '</div>' +
        '<p style="margin:0 0 1.75rem 0;color:var(--text-muted);line-height:1.9;">' + mat.description + '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;padding-top:1.25rem;border-top:1px solid var(--hairline-graphite);">' +
          '<div><span class="spec-label">منشأ و استخراج</span><span class="spec-value">' + mat.origin + '</span></div>' +
          '<div><span class="spec-label">مشخصه فنی</span><span class="spec-value tabular-nums">' + mat.density + '</span></div>' +
          '<div><span class="spec-label">پرداخت نهایی</span><span class="spec-value">' + mat.finish + '</span></div>' +
        '</div>';
    }

    tabsWrap.innerHTML = materials.map(function (m, idx) {
      return '<button type="button" class="filter-tab' + (idx === 0 ? ' is-active' : '') + '" data-mat-id="' + m.id + '">' + m.name + '</button>';
    }).join('');

    tabsWrap.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-mat-id]');
      if (!btn) return;
      activeId = btn.getAttribute('data-mat-id');
      qsa('[data-mat-id]', tabsWrap).forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-mat-id') === activeId);
      });
      renderMaterial();
    });

    renderMaterial();
  }

  function initContactForm() {
    const form = qs('#private-contact-form');
    if (!form) return;

    const tgDirectBtn = qs('#contact-telegram-btn');
    const receiptBox = qs('#contact-receipt');

    function validateForm() {
      let valid = true;
      const nameEl = qs('#contact-name');
      const phoneEl = qs('#contact-phone');
      const emailEl = qs('#contact-email');
      const msgEl = qs('#contact-message');

      const nameErr = qs('#error-name');
      const phoneErr = qs('#error-phone');
      const emailErr = qs('#error-email');
      const msgErr = qs('#error-message');

      if (nameErr) nameErr.textContent = '';
      if (phoneErr) phoneErr.textContent = '';
      if (emailErr) emailErr.textContent = '';
      if (msgErr) msgErr.textContent = '';

      if (!nameEl.value.trim() || nameEl.value.trim().length < 2) {
        if (nameErr) nameErr.textContent = 'لطفاً نام و نام خانوادگی خود را وارد کنید.';
        valid = false;
      }

      const phoneDigits = phoneEl.value.replace(/[^\d۰-۹+]/g, '');
      if (phoneDigits.length < 8) {
        if (phoneErr) phoneErr.textContent = 'شماره تماس یا شناسه معتبر وارد نمایید.';
        valid = false;
      }

      if (emailEl.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
        if (emailErr) emailErr.textContent = 'نشانی ایمیل واردشده معتبر نیست.';
        valid = false;
      }

      if (!msgEl.value.trim() || msgEl.value.trim().length < 8) {
        if (msgErr) msgErr.textContent = 'لطفاً شرح کوتاهی از پروژه یا درخواست خود بنویسید.';
        valid = false;
      }

      return valid;
    }

    function collectFormData() {
      return {
        name: qs('#contact-name').value.trim(),
        phone: qs('#contact-phone').value.trim(),
        email: qs('#contact-email').value.trim() || 'ثبت‌نشده',
        interest: qs('#contact-interest').value,
        budget: qs('#contact-budget').value,
        message: qs('#contact-message').value.trim()
      };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm()) return;
      const data = collectFormData();
      const trackingCode = 'MON-' + toPersianDigits(Math.floor(100000 + Math.random() * 899999));

      if (receiptBox) {
        receiptBox.hidden = false;
        receiptBox.innerHTML =
          '<div style="padding:1.75rem;border:1px solid var(--champagne-gold);background:var(--surface-charcoal);margin-top:2rem;">' +
            '<span class="section-eyebrow" style="margin-bottom:0.4rem;">درخواست ثبت شد</span>' +
            '<h3 style="margin:0 0 0.75rem 0;font-size:1.2rem;color:var(--text-pristine);">پرونده مشاوره شما با کد ' + trackingCode + ' ثبت گردید</h3>' +
            '<p style="margin:0 0 1.25rem 0;color:var(--text-muted);font-size:0.92rem;">مشاور ارشد سرمایه‌گذاری آتلیه مونولیت در کمتر از ۲ ساعت کاری با شماره ' + data.phone + ' تماس خواهد گرفت.</p>' +
            '<a href="' + buildTelegramUrl(
              'سلام آتلیه مونولیت؛ کد پیگیری: ' + trackingCode +
              '\nنام: ' + data.name +
              '\nتماس: ' + data.phone +
              '\nموضوع: ' + data.interest +
              '\nبازه سرمایه‌گذاری: ' + data.budget +
              '\nتوضیحات: ' + data.message
            ) + '" target="_blank" rel="noopener noreferrer" class="btn-ghost btn-sm">ادامه گفت‌وگو در تلگرام</a>' +
          '</div>';
      }
      showToast('درخواست مشاوره اختصاصی با موفقیت ثبت شد.');
      form.reset();
    });

    if (tgDirectBtn) {
      tgDirectBtn.addEventListener('click', function () {
        if (!validateForm()) return;
        const data = collectFormData();
        const text =
          'سلام آتلیه معماری مونولیت؛\n' +
          'درخواست مشاوره و هماهنگی از فرم وب‌سایت:\n' +
          'نام: ' + data.name + '\n' +
          'شماره تماس: ' + data.phone + '\n' +
          'ایمیل: ' + data.email + '\n' +
          'پروژه / خدمات: ' + data.interest + '\n' +
          'بازه سرمایه‌گذاری: ' + data.budget + '\n' +
          'پیام: ' + data.message;
        const tgUrl = buildTelegramUrl(text);
        if (receiptBox) {
          receiptBox.hidden = false;
          receiptBox.innerHTML =
            '<div style="padding:1.75rem;border:1px solid var(--champagne-gold);background:var(--surface-charcoal);margin-top:2rem;">' +
              '<span class="section-eyebrow" style="margin-bottom:0.4rem;">آماده ارسال به تلگرام</span>' +
              '<h3 style="margin:0 0 0.75rem 0;font-size:1.15rem;color:var(--text-pristine);">پیام اختصاصی شما با موفقیت تنظیم شد</h3>' +
              '<p style="margin:0 0 1.25rem 0;color:var(--text-muted);font-size:0.9rem;">برای باز شدن مستقیم گفت‌وگو در تلگرام روی دکمه زیر کلیک کنید:</p>' +
              '<div style="display:flex;flex-wrap:wrap;gap:0.75rem;">' +
                '<a href="' + tgUrl + '" target="_blank" rel="noopener noreferrer" class="btn-monument btn-sm">باز کردن تلگرام آتلیه</a>' +
                '<button type="button" id="copy-contact-tg" class="btn-ghost btn-sm">کپی متن پیام</button>' +
              '</div>' +
            '</div>';
          const copyContactBtn = qs('#copy-contact-tg');
          if (copyContactBtn) {
            copyContactBtn.addEventListener('click', function () {
              copyTextToClipboard(text, 'متن پیام آماده ارسال کپی شد.');
            });
          }
        }
        showToast('پیام تلگرام شما آماده ارسال است.');
      });
    }
  }

  // --- Global Navigation, Scroll & Event Delegation ---
  function initGlobalInteractions() {
    ensureGlobalOverlays();
    updateCartBadge();

    // Header scroll elevation
    const header = qs('.site-header');
    if (header) {
      window.addEventListener('scroll', function () {
        header.classList.toggle('is-scrolled', window.scrollY > 24);
      }, { passive: true });
    }

    // Mobile drawer
    const mobileOpenBtn = qs('#mobile-menu-open');
    const mobileCloseBtn = qs('#mobile-menu-close');
    const mobileDrawer = qs('#mobile-drawer');

    if (mobileOpenBtn && mobileDrawer) {
      mobileOpenBtn.addEventListener('click', function () {
        mobileDrawer.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    }
    if (mobileCloseBtn && mobileDrawer) {
      mobileCloseBtn.addEventListener('click', function () {
        mobileDrawer.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    }

    // IntersectionObserver for reveal-item
    const reveals = qsa('.reveal-item');
    if ('IntersectionObserver' in window && reveals.length > 0) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-revealed'); });
    }

    // Delegated clicks across all pages
    document.addEventListener('click', function (e) {
      const viewBtn = e.target.closest('[data-view-project]');
      if (viewBtn) {
        openProjectModal(viewBtn.getAttribute('data-view-project'));
        return;
      }

      const addBtn = e.target.closest('[data-add-order]');
      if (addBtn) {
        addToOrderList(addBtn.getAttribute('data-add-order'), true);
        return;
      }

      const removeBtn = e.target.closest('[data-remove-id]');
      if (removeBtn) {
        removeFromOrderList(removeBtn.getAttribute('data-remove-id'));
        return;
      }

      const openCartBtn = e.target.closest('[data-open-drawer]');
      if (openCartBtn) {
        openOrderDrawer();
        return;
      }

      const copyBtn = e.target.closest('[data-copy-text]');
      if (copyBtn) {
        copyTextToClipboard(copyBtn.getAttribute('data-copy-text'), copyBtn.getAttribute('data-copy-msg'));
        return;
      }

      if (e.target.closest('#close-drawer-btn') || e.target.id === 'drawer-backdrop') {
        closeOrderDrawer();
        return;
      }

      if (e.target.closest('#close-project-modal') || e.target.id === 'project-modal-backdrop') {
        closeProjectModal();
        return;
      }

      if (e.target.closest('#drawer-telegram-submit')) {
        syncDrawerTelegramHref();
        showToast('در حال انتقال به تلگرام آتلیه مونولیت...');
        return;
      }

      if (e.target.closest('#drawer-copy-btn')) {
        copyTextToClipboard(buildOrderMessageFromDrawer(), 'متن سفارش آماده ارسال در حافظه کپی شد.');
        return;
      }
    });

    // Keep Telegram href synced when user types name/phone in drawer
    document.addEventListener('input', function (e) {
      if (e.target && (e.target.id === 'drawer-client-name' || e.target.id === 'drawer-client-phone')) {
        syncDrawerTelegramHref();
      }
    });

    // Order option dropdown change inside drawer
    document.addEventListener('change', function (e) {
      if (e.target && e.target.hasAttribute('data-option-id')) {
        updateOrderOption(e.target.getAttribute('data-option-id'), e.target.value);
      }
    });

    // Escape key closes modals/drawers
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeOrderDrawer();
        closeProjectModal();
        if (mobileDrawer) {
          mobileDrawer.classList.remove('is-open');
          document.body.style.overflow = '';
        }
      }
    });
  }

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', function () {
    initFeaturedHome();
    initProductsCatalog();
    initMaterialTabs();
    initContactForm();
    initGlobalInteractions();
  });
})();
