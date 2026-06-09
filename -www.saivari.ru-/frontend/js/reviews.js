/* ============================================================
   REVIEWS.JS — СайВари
   ============================================================ */

const PAGE_SIZE = 9;

/* ── Состояние ── */
let allReviews   = [];
let filtered     = [];
let currentPage  = 1;
let activeRating = 0;
let sortMode     = 'date-desc';

/* ── DOM ── */
const listEl       = document.getElementById('reviews-list');
const paginationEl = document.getElementById('pagination');
const filterEl     = document.getElementById('reviews-filter');

/* ============================================================
   ТЕМА
   ============================================================ */
(function initTheme() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root   = document.documentElement;
  let theme    = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  setIcon(theme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      setIcon(theme);
    });
  }

  function setIcon(t) {
    if (!toggle) return;
    toggle.setAttribute('aria-label', 'Переключить на ' + (t === 'dark' ? 'светлую' : 'тёмную') + ' тему');
    toggle.innerHTML = t === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
})();

/* ============================================================
   МОБИЛЬНОЕ МЕНЮ
   ============================================================ */
(function initMobileMenu() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
  });

  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* ============================================================
   ЗАГРУЗКА
   ============================================================ */
function loadReviews() {
  fetch('/api/reviews')
    .then(r => r.json())
    .then(data => {
      allReviews = data.reviews || [];
      applyFilterAndSort();
    })
    .catch(() => {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3>Отзывы пока не загружены</h3>
          <p>Не удалось подключиться к серверу. Попробуйте обновить страницу.</p>
          <button class="btn btn--outline" onclick="location.reload()">Обновить</button>
        </div>
      `;
      paginationEl.innerHTML = '';
    });
}

/* ============================================================
   СОРТИРОВКА
   ============================================================ */
function sortReviews(arr) {
  const copy = [...arr];

  switch (sortMode) {
    case 'date-desc':
      return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    case 'date-asc':
      return copy.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    case 'rating-desc':
      return copy.sort((a, b) => b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at));

    case 'rating-asc':
      return copy.sort((a, b) => a.rating - b.rating || new Date(b.created_at) - new Date(a.created_at));

    default:
      return copy;
  }
}

/* ============================================================
   ФИЛЬТР + СОРТИРОВКА
   ============================================================ */
function applyFilterAndSort() {
  currentPage = 1;
  const base = activeRating === 0
    ? allReviews
    : allReviews.filter(r => r.rating === activeRating);

  filtered = sortReviews(base);
  renderPage(currentPage);
  renderPagination();
  updateSortButtons();
}

/* Фильтр по рейтингу */
if (filterEl) {
  filterEl.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRating = parseInt(btn.dataset.rating, 10);
    applyFilterAndSort();
  });
}

/* Сортировка */
const sortEl = document.getElementById('reviews-sort');
if (sortEl) {
  sortEl.addEventListener('click', e => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;

    sortMode = btn.dataset.sort;
    applyFilterAndSort();
  });
}

function updateSortButtons() {
  if (!sortEl) return;
  sortEl.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === sortMode);
  });
}

/* ============================================================
   РЕНДЕР
   ============================================================ */
function renderPage(page) {
  currentPage = page;
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3>Отзывов не найдено</h3>
        <p>По выбранному фильтру ничего нет. Попробуйте другую оценку.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';

  slice.forEach((review, i) => {
    const card = buildCard(review);
    card.style.cssText = `opacity:0;transform:translateY(8px);transition:opacity 0.25s ease,transform 0.25s ease;transition-delay:${i * 30}ms`;
    listEl.appendChild(card);

    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  });
}

/* ============================================================
   КАРТОЧКА (полоса)
   ============================================================ */
function buildCard(review) {
  const date = new Date(review.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const initial = review.author.charAt(0).toUpperCase();
  const r = review.rating;

  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    starsHtml += `<span class="rc-star${i <= r ? ' rc-star--on' : ''}" aria-hidden="true">★</span>`;
  }

  const badgeLabel =
    r === 5 ? 'Отлично' :
    r === 4 ? 'Хорошо' :
    r === 3 ? 'Нормально' :
    r === 2 ? 'Плохо' : 'Ужасно';

  const avatarColors = ['#8b1a1a', '#1a5c8b', '#1a8b3f', '#7b1a8b', '#8b6b1a'];
  const colorIdx = initial.charCodeAt(0) % avatarColors.length;

  const card = document.createElement('article');
  card.className = 'rc';
  card.innerHTML = `
    <div class="rc__avatar" style="background:${avatarColors[colorIdx]}" aria-hidden="true">${initial}</div>

    <div class="rc__meta">
      <span class="rc__name">${escapeHtml(review.author)}</span>
      <span class="rc__date">${date}</span>
    </div>

    <div class="rc__stars" aria-label="Оценка: ${r} из 5">
      ${starsHtml}
      <span class="rc__badge rc__badge--${r}">${badgeLabel}</span>
    </div>

    <p class="rc__body">${escapeHtml(review.body)}</p>
  `;

  return card;
}

/* ============================================================
   ПАГИНАЦИЯ
   ============================================================ */
function renderPagination() {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  paginationEl.innerHTML = '';

  if (total <= 1) return;

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.setAttribute('aria-label', 'Предыдущая страница');
  prev.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => goToPage(currentPage - 1));
  paginationEl.appendChild(prev);

  for (let i = 1; i <= total; i++) {
    const isEdge = i === 1 || i === total;
    const isNear = Math.abs(i - currentPage) <= 1;
    const isPrevDot = i === currentPage - 2 && currentPage > 3;
    const isNextDot = i === currentPage + 2 && currentPage < total - 2;

    if (!isEdge && !isNear) {
      if (isPrevDot || isNextDot) {
        const dot = document.createElement('span');
        dot.className = 'page-dots';
        dot.textContent = '…';
        paginationEl.appendChild(dot);
      }
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.setAttribute('aria-label', 'Страница ' + i);

    if (i === currentPage) {
      btn.setAttribute('aria-current', 'page');
    }

    btn.addEventListener('click', () => goToPage(i));
    paginationEl.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.setAttribute('aria-label', 'Следующая страница');
  next.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  next.disabled = currentPage === total;
  next.addEventListener('click', () => goToPage(currentPage + 1));
  paginationEl.appendChild(next);
}

function goToPage(page) {
  renderPage(page);
  renderPagination();
  listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   ФОРМА ОТЗЫВА
   ============================================================ */
(function initReviewForm() {
  const form        = document.getElementById('review-form');
  const ratingInput = document.getElementById('review-rating');
  const stars       = document.querySelectorAll('#star-rating .star');

  if (!form || !stars.length || !ratingInput) return;

  let selectedRating = 0;

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      highlightStars(parseInt(star.dataset.value, 10));
    });

    star.addEventListener('mouseleave', () => {
      highlightStars(selectedRating);
    });

    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value, 10);
      ratingInput.value = selectedRating;
      highlightStars(selectedRating);

      stars.forEach(s => {
        s.setAttribute('aria-checked', parseInt(s.dataset.value, 10) === selectedRating ? 'true' : 'false');
      });
    });

    star.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        star.click();
      }
    });
  });

  function highlightStars(count) {
    stars.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.value, 10) <= count);
    });
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name   = form.querySelector('#review-name').value.trim();
    const text   = form.querySelector('#review-text').value.trim();
    const rating = parseInt(ratingInput.value, 10);

    if (!name || !/^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(name)) {
      setFieldError(form.querySelector('#review-name'), 'Введите корректное имя (только буквы, минимум 2 символа).');
      return;
    }

    if (!text || text.length < 10) {
      setFieldError(form.querySelector('#review-text'), 'Напишите отзыв (минимум 10 символов).');
      return;
    }

    if (!rating || rating < 1) {
      showToast('Поставьте оценку (звёзды).', 'error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Отправляю...';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: name, rating, body: text })
      });

      const data = await res.json();

      if (res.ok) {
        form.reset();
        selectedRating = 0;
        ratingInput.value = 0;
        highlightStars(0);
        stars.forEach(s => s.setAttribute('aria-checked', 'false'));
        showToast('✓ Спасибо! Отзыв отправлен на модерацию.');
      } else {
        showToast(data.error || 'Ошибка отправки. Попробуйте позже.', 'error');
      }
    } catch {
      showToast('Нет связи с сервером. Попробуйте позже.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  function setFieldError(input, msg) {
    input.classList.add('input--error');

    let err = input.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.style.cssText = 'color:var(--color-primary);font-size:var(--text-xs);margin-top:4px;display:block;';
      input.parentElement.appendChild(err);
    }

    err.textContent = msg;

    input.addEventListener('input', () => {
      input.classList.remove('input--error');
      err.remove();
    }, { once: true });
  }
})();

/* ============================================================
   TOAST
   ============================================================ */
function showToast(message, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;

  t.textContent = message;
  t.style.background = type === 'error' ? 'var(--color-primary)' : '#1a6b3f';
  t.classList.add('show');

  setTimeout(() => t.classList.remove('show'), 4000);
}

/* ============================================================
   УТИЛИТЫ
   ============================================================ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Запуск ── */
loadReviews();