/* ============================================================
   LOGIN.JS — страница входа / регистрации
   Если уже авторизован — редирект на /lk.html
   ============================================================ */

const API = '';

// ── Утилиты ────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('lk_token'); }
function setToken(t) { localStorage.setItem('lk_token', t); }

function el(id) { return document.getElementById(id); }

function showCard(name) {
  ['login', 'register', 'confirm'].forEach(n => {
    const c = el(`card-${n}`);
    if (c) c.style.display = n === name ? 'block' : 'none';
  });
  // Сброс ошибок
  ['login-error', 'login-success', 'reg-error'].forEach(id => {
    const e = el(id);
    if (e) { e.style.display = 'none'; e.textContent = ''; }
  });
}

function showError(id, msg) {
  const e = el(id);
  if (!e) return;
  e.textContent = msg;
  e.style.display = 'block';
}

function showSuccess(id, msg) {
  const e = el(id);
  if (!e) return;
  e.textContent = msg;
  e.style.display = 'block';
}

function setLoading(btnId, loading) {
  const btn = el(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.7' : '1';
}

// ── Тоггл пароль ────────────────────────────────────────────

function togglePassword(inputId, btn) {
  const input = el(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.setAttribute('aria-label', isHidden ? 'Скрыть пароль' : 'Показать пароль');
  btn.innerHTML = isHidden
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
         <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>
       </svg>`;
}

// ── Маска телефона ─────────────────────────────────────────

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

(function initPhoneMask() {
  const input = el('reg-phone');
  if (!input) return;
  input.addEventListener('focus', () => {
    if (!input.value.trim()) input.value = '+7';
  });
  input.addEventListener('input', () => {
    input.value = formatPhoneMask(input.value);
  });
  input.addEventListener('blur', () => {
    if (input.value === '+7') input.value = '';
  });
})();

// ── Форма входа ───────────────────────────────────────────────

el('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = el('login-email').value.trim();
  const password = el('login-password').value;

  el('login-error').style.display = 'none';
  el('login-success').style.display = 'none';

  if (!email || !password) return showError('login-error', 'Заполните все поля');

  setLoading('login-btn', true);

  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();

    if (!r.ok) {
      // Специальный кейс: email не подтверждён
      if (r.status === 403 && data.code === 'EMAIL_NOT_CONFIRMED') {
        return showError('login-error', 'Подтвердите email перед входом. Проверьте почту.');
      }
      return showError('login-error', data.error || 'Неверный email или пароль');
    }

    setToken(data.token);
    window.location.replace('/lk');
  } catch {
    showError('login-error', 'Ошибка соединения с сервером');
  } finally {
    setLoading('login-btn', false);
  }
});

// ── Форма регистрации ─────────────────────────────────────────

el('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  el('reg-error').style.display = 'none';

  const name     = el('reg-name').value.trim();
  const email    = el('reg-email').value.trim();
  const phone    = el('reg-phone').value.trim();
  const password = el('reg-password').value;

  // Клиентская валидация
  if (!name || !/^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(name)) {
    return showError('reg-error', 'Имя — только буквы, минимум 2 символа');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return showError('reg-error', 'Введите корректный email');
  }
  if (password.length < 6) {
    return showError('reg-error', 'Пароль — минимум 6 символов');
  }
  if (phone && !/^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(phone)) {
    return showError('reg-error', 'Некорректный номер телефона');
  }

  setLoading('reg-btn', true);

  try {
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await r.json();

    if (!r.ok) return showError('reg-error', data.error || 'Ошибка регистрации');

    // Показать карточку подтверждения email
    const shown = el('confirm-email-shown');
    if (shown) shown.textContent = email;
    showCard('confirm');
  } catch {
    showError('reg-error', 'Ошибка соединения с сервером');
  } finally {
    setLoading('reg-btn', false);
  }
});

// ── Проверка URL-параметров (ссылка из письма) ─────────────
// Например: /login.html?token=xxx&action=confirm

(function checkUrlAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const token  = params.get('token');

  if (action === 'confirmed') {
    // Перешли по ссылке подтверждения — показать сообщение на странице входа
    showSuccess('login-success', '✓ Email подтверждён! Теперь вы можете войти.');
    // Почистить URL
    history.replaceState(null, '', '/login');
  }

  if (action === 'login' && token) {
    // Магическая ссылка входа — сразу перенаправить в ЛК
    setToken(token);
    window.location.replace('/lk');
  }
})();

// ── Если уже авторизован — сразу в ЛК ─────────────────────────

(function redirectIfLoggedIn() {
  const token = getToken();
  if (!token) return;
  // Проверяем токен через API
  fetch(`${API}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(r => { if (r.ok) window.location.replace('/lk'); })
    .catch(() => { /* игнорируем, остаёмся на странице входа */ });
})();
