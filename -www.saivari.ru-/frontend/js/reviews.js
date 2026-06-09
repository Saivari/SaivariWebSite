/* ============================================================
   REVIEWS.JS — СайВари
   Страница /reviews.html
   - Загружает все отзывы с /api/reviews
   - Фильтрация по рейтингу
   - Пагинация (9 отзывов на страницу)
   - Форма отправки отзыва + звёздный рейтинг
   - Тема (светлая/тёмная)
   - Мобильное меню
   ============================================================ */

const PAGE_SIZE = 9; // отзывов на страницу

/* ── Состояние ── */
let allReviews   = [];   // все загруженные отзывы
let filtered     = [];   // после фильтра по рейтингу
let currentPage  = 1;
let activeRating = 0;    // 0 = все

/* ── DOM-ссылки ── */
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
  if (toggle) toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    setIcon(theme);
  });
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
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }));
})();

/* ============================================================
   ЗАГРУЗКА ОТЗЫВОВ
   ============================================================ */
function loadReviews() {
  fetch('/api/reviews')
    .then(r => r.json())
    .then(data => {
      allReviews = data.reviews || [];
      applyFilter(activeRating);
    })
    .catch(() => {
      // Если сервер недоступен — показываем заглушку
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">💬</div>
          <h3>Отзывы пока не загружены</h3>
          <p>Не удалось подключиться к серверу. Попробуйте обновить страницу.</p>
          <button class="btn btn--outline" onclick="location.reload()">Обновить</button>
        </div>`;
      paginationEl.innerHTML = '';
    });
}

/* ============================================================
   ФИЛЬТРАЦИЯ
   ============================================================ */
function applyFilter(rating) {
  activeRating = rating;
  currentPage  = 1;

  filtered = rating === 0
    ? allReviews
    : allReviews.filter(r => r.rating === rating);

  renderPage(currentPage);
  renderPagination();
}

if (filterEl) {
  filterEl.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter(parseInt(btn.dataset.rating));
  });
}

/* ============================================================
   РЕНДЕР СТРАНИЦЫ ОТЗЫВОВ
   ============================================================ */
function renderPage(page) {
  currentPage = page;
  const start = (page - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const slice = filtered.slice(start, end);

  if (!slice.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <h3>Отзывов не найдено</h3>
        <p>По выбранному фильтру отзывов нет. Попробуйте другую оценку.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = '';
  slice.forEach((review, i) => {
    const card = buildCard(review);
    card.style.cssText = 'opacity:0;transform:translateY(10px);transition:opacity 0.3s ease,transform 0.3s ease;transition-delay:' + (i * 40) + 'ms';
    listEl.appendChild(card);
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  });
}

/* ============================================================
   ПОСТРОИТЬ КАРТОЧКУ
   ============================================================ */
function buildCard(review) {
  const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const date = new Date(review.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const initial = review.author.charAt(0).toUpperCase();
  const card = document.createElement('article');
  card.className = 'review-card';
  card.innerHTML = `
    <div class="review-card__header">
      <div class="review-avatar">${initial}</div>
      <div>
        <div class="review-author">${escapeHtml(review.author)}</div>
        <div class="review-date">${date}</div>
      </div>
      <div class="review-stars">${starsHtml}</div>
    </div>
    <p class="review-text">${escapeHtml(review.body)}</p>
  `;
  return card;
}

/* ============================================================
   ПАГИНАЦИЯ
   ============================================================ */
function renderPagination() {
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  paginationEl.innerHTML = '';

  if (totalPages <= 1) return;

  // Кнопка «Назад»
  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.setAttribute('aria-label', 'Предыдущая страница');
  prev.innerHTML = '←';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => goToPage(currentPage - 1));
  paginationEl.appendChild(prev);

  // Номера страниц
  for (let i = 1; i <= totalPages; i++) {
    // Показываем: первую, последнюю, текущую ±1, остальные — «…»
    const isEdge    = i === 1 || i === totalPages;
    const isNear    = Math.abs(i - currentPage) <= 1;
    const isPrevDot = i === currentPage - 2 && currentPage > 3;
    const isNextDot = i === currentPage + 2 && currentPage < totalPages - 2;

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
    if (i === currentPage) btn.setAttribute('aria-current', 'page');
    btn.addEventListener('click', () => goToPage(i));
    paginationEl.appendChild(btn);
  }

  // Кнопка «Вперёд»
  const next = document.createElement('button');
  next.className = 'page-btn';
  next.setAttribute('aria-label', 'Следующая страница');
  next.innerHTML = '→';
  next.disabled = currentPage === totalPages;
  next.addEventListener('click', () => goToPage(currentPage + 1));
  paginationEl.appendChild(next);
}

function goToPage(page) {
  renderPage(page);
  renderPagination();
  listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   ФОРМА ОТЗЫВА + ЗВЁЗДНЫЙ РЕЙТИНГ
   ============================================================ */
(function initReviewForm() {
  const form        = document.getElementById('review-form');
  const ratingInput = document.getElementById('review-rating');
  const stars       = document.querySelectorAll('#star-rating .star');
  if (!form || !stars.length || !ratingInput) return;

  let selectedRating = 0;

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => highlightStars(parseInt(star.dataset.value)));
    star.addEventListener('mouseleave', () => highlightStars(selectedRating));
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value);
      ratingInput.value = selectedRating;
      highlightStars(selectedRating);
      stars.forEach(s => s.setAttribute('aria-checked', parseInt(s.dataset.value) === selectedRating ? 'true' : 'false'));
    });
    star.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); star.click(); }
    });
  });

  function highlightStars(count) {
    stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= count));
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name   = form.querySelector('#review-name').value.trim();
    const text   = form.querySelector('#review-text').value.trim();
    const rating = parseInt(ratingInput.value);

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
      const res  = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: name, rating, body: text }),
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
      err.style.cssText = 'color:#c0392b;font-size:12px;margin-top:4px;display:block;';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
    input.addEventListener('input', () => { input.classList.remove('input--error'); err.remove(); }, { once: true });
  }
})();

/* ============================================================
   TOAST
   ============================================================ */
function showToast(message, type = 'success') {
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 20px;border-radius:8px;font-size:14px;color:#fff;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.2);background:${type === 'error' ? '#c0392b' : '#01696f'};animation:slideIn 0.3s ease;`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ============================================================
   УТИЛИТЫ
   ============================================================ */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Запуск ── */
loadReviews();
