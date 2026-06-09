/* ============================================================
   MAIN.JS — СайВари
   1. Тема (светлая/тёмная)
   2. Мобильное меню
   3. Скролл-шпион (активный пункт nav)
   4. Форма заявки
   5. Форма отзыва + звёздный рейтинг
   6. Toast
   ============================================================ */

/* ============================================================
   1. ТЕМА
   ============================================================ */

(function initTheme() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;

  let currentTheme = matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';

  root.setAttribute('data-theme', currentTheme);
  updateToggleIcon(currentTheme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', currentTheme);
      updateToggleIcon(currentTheme);
    });
  }

  function updateToggleIcon(theme) {
    if (!toggle) return;
    toggle.setAttribute('aria-label',
      'Переключить на ' + (theme === 'dark' ? 'светлую' : 'тёмную') + ' тему'
    );
    toggle.innerHTML = theme === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
           <circle cx="12" cy="12" r="5"/>
           <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
         </svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
           <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
         </svg>`;
  }
})();


/* ============================================================
   2. МОБИЛЬНОЕ МЕНЮ
   ============================================================ */

(function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', close);
  });

  function close() {
    mobileMenu.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
})();


/* ============================================================
   3. СКРОЛЛ-ШПИОН
   ============================================================ */

(function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.remove('active'));
      const active = document.querySelector(
        `.nav__links a[href="#${entry.target.id}"]`
      );
      if (active) active.classList.add('active');
    });
  }, { threshold: 0.35 });

  sections.forEach(s => observer.observe(s));
})();

/* ============================================================
   МАСКА ТЕЛЕФОНА
   ============================================================ */

function formatPhoneMask(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (!digits) return '';
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  else if (digits.startsWith('9')) digits = '7' + digits;
  else if (!digits.startsWith('7')) digits = '7' + digits;

  digits = digits.slice(0, 11);

  let result = '+7';
  if (digits.length > 1) result += ' (' + digits.slice(1, 4);
  if (digits.length >= 5) result += ') ' + digits.slice(4, 7);
  if (digits.length >= 8) result += '-' + digits.slice(7, 9);
  if (digits.length >= 10) result += '-' + digits.slice(9, 11);

  return result;
}

function initPhoneMask(input) {
  if (!input) return;

  input.addEventListener('focus', () => {
    if (!input.value.trim()) input.value = '+7';
  });

  input.addEventListener('input', () => {
    const raw = input.value;
    const hasAt = raw.includes('@');

    if (hasAt) return; // если человек вводит email, маску не применяем

    input.value = formatPhoneMask(raw);
  });

  input.addEventListener('blur', () => {
    if (input.value === '+7') input.value = '';
  });
}

/* ============================================================
   4. ФОРМА ЗАЯВКИ
   ============================================================ */

(function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const nameInput    = form.querySelector('#name');
  const contactInput = form.querySelector('#phone');

  initPhoneMask(contactInput);

  function validateName(val) {
    return /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(val.trim());
  }

  function validateContact(val) {
    const phone = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(val.trim());
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());
    return phone || email;
  }

  function setError(input, msg) {
    input.classList.add('input--error');
    let err = input.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.style.cssText = 'color:#c0392b;font-size:12px;margin-top:4px;display:block;';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
  }

  function clearError(input) {
    input.classList.remove('input--error');
    const err = input.parentElement.querySelector('.field-error');
    if (err) err.remove();
  }

  nameInput.addEventListener('input', () => clearError(nameInput));
  contactInput.addEventListener('input', () => clearError(contactInput));

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name    = nameInput.value.trim();
    const contact = contactInput.value.trim();
    const service = form.querySelector('#service').value;
    const message = form.querySelector('#message').value.trim();

    let hasError = false;

    if (!name) {
      setError(nameInput, 'Введите ваше имя.');
      hasError = true;
    } else if (!validateName(name)) {
      setError(nameInput, 'Имя должно содержать только буквы (минимум 2 символа).');
      hasError = true;
    } else {
      clearError(nameInput);
    }

    if (!contact) {
      setError(contactInput, 'Укажите телефон или email.');
      hasError = true;
    } else if (!validateContact(contact)) {
      setError(contactInput, 'Введите корректный телефон (+7 xxx xxx xx-xx) или email.');
      hasError = true;
    } else {
      clearError(contactInput);
    }

    if (hasError) return;

    const btn = form.querySelector('.form-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Отправляю...';

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, service, message }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('✓ Заявка принята! Отвечу в течение нескольких часов.');
        form.reset();
      } else {
        showToast(data.error || 'Ошибка отправки. Попробуйте позже.', 'error');
      }
    } catch (err) {
      showToast('Нет связи с сервером. Попробуйте позже.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
})();

/* ============================================================
   5. ОТЗЫВЫ — звёздный рейтинг + добавление карточки
   На главной странице показываем только 3 последних отзыва.
   Остальные отзывы доступны на странице /reviews.html
   ============================================================ */

/* Количество отзывов на главной странице */
const REVIEWS_PREVIEW_COUNT = 3;

(function initReviews() {
  const form        = document.getElementById('review-form');
  const ratingInput = document.getElementById('review-rating');
  const stars       = document.querySelectorAll('#star-rating .star');
  const list        = document.getElementById('reviews-list');

  if (!list) return;

  // --- Загрузка отзывов с сервера (только 3 последних на главной) ---
  fetch('/api/reviews')
    .then(r => r.json())
    .then(data => {
      if (!data.reviews || !data.reviews.length) return;

      // Берём только первые REVIEWS_PREVIEW_COUNT отзывов
      const preview = data.reviews.slice(0, REVIEWS_PREVIEW_COUNT);

      list.innerHTML = '';
      preview.forEach(review => {
        list.appendChild(buildReviewCard(review));
      });

      // Добавляем кнопку «Все отзывы» если их больше чем REVIEWS_PREVIEW_COUNT
      if (data.reviews.length > REVIEWS_PREVIEW_COUNT) {
        appendShowAllButton(list, data.reviews.length);
      }
    })
    .catch(() => {
      // Если сервер не отвечает — остаются статичные отзывы из HTML.
      // Всё равно показываем кнопку «Все отзывы»
      appendShowAllButton(list, null);
    });

  // --- Построить карточку отзыва ---
  function buildReviewCard(review) {
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

  // --- Кнопка «Все отзывы» ---
  function appendShowAllButton(container, total) {
    // Не добавлять повторно
    if (document.getElementById('reviews-show-all')) return;

    const wrap = document.createElement('div');
    wrap.id = 'reviews-show-all';
    wrap.style.cssText = 'text-align:center; margin-top: 2rem;';

    const label = total ? `Все отзывы (${total})` : 'Все отзывы →';

    wrap.innerHTML = `
      <a href="/reviews.html" class="btn btn--outline" style="display:inline-flex;align-items:center;gap:0.4em;">
        ${label}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    `;
    container.parentElement.insertBefore(wrap, container.nextSibling);
  }

  // --- Звёздный рейтинг ---
  if (!form || !stars.length || !ratingInput) return;

  let selectedRating = 0;

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      highlightStars(parseInt(star.dataset.value));
    });

    star.addEventListener('mouseleave', () => {
      highlightStars(selectedRating);
    });

    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value);
      ratingInput.value = selectedRating;
      highlightStars(selectedRating);
      stars.forEach(s => s.setAttribute('aria-checked',
        parseInt(s.dataset.value) === selectedRating ? 'true' : 'false'
      ));
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
      s.classList.toggle('active', parseInt(s.dataset.value) <= count);
    });
  }

  // --- Отправка отзыва ---
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name   = form.querySelector('#review-name').value.trim();
    const text   = form.querySelector('#review-text').value.trim();
    const rating = parseInt(ratingInput.value);

    if (!name) {
      setFieldError(form.querySelector('#review-name'), 'Введите ваше имя.');
      return;
    } else if (!/^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(name)) {
      setFieldError(form.querySelector('#review-name'), 'Имя должно содержать только буквы.');
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
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Отправляю...';

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: name, rating, body: text }),
      });

      const data = await response.json();

      if (response.ok) {
        const today = new Date().toLocaleDateString('ru-RU', {
          day: 'numeric', month: 'long', year: 'numeric'
        });

        const card = document.createElement('article');
        card.className = 'review-card';
        card.style.cssText = 'opacity:0;transform:translateY(12px);transition:opacity 0.4s ease,transform 0.4s ease;';
        card.innerHTML = `
          <div class="review-card__header">
            <div class="review-avatar">${name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="review-author">${escapeHtml(name)}</div>
              <div class="review-date">${today} · на модерации</div>
            </div>
            <div class="review-stars">${'★'.repeat(rating) + '☆'.repeat(5 - rating)}</div>
          </div>
          <p class="review-text">${escapeHtml(text)}</p>
        `;
        list.appendChild(card);

        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });

        form.reset();
        selectedRating = 0;
        ratingInput.value = 0;
        highlightStars(0);
        stars.forEach(s => s.setAttribute('aria-checked', 'false'));

        showToast('✓ Спасибо! Отзыв отправлен на модерацию.');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      } else {
        showToast(data.error || 'Ошибка отправки. Попробуйте позже.', 'error');
      }

    } catch (err) {
      showToast('Нет связи с сервером. Попробуйте позже.', 'error');
      console.error('Reviews fetch error:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
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
    input.addEventListener('input', () => {
      input.classList.remove('input--error');
      err.remove();
    }, { once: true });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();


/* ============================================================
   6. TOAST
   ============================================================ */

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    padding: 14px 20px; border-radius: 8px; font-size: 14px;
    color: #fff; max-width: 320px; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    background: ${type === 'error' ? '#c0392b' : '#01696f'};
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
