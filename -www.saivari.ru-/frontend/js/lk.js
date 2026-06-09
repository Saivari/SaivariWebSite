/* ============================================================
   LK.JS — Личный кабинет пользователя
   Авторизация вынесена в /login.html
   ============================================================ */

const API = '';
let authToken = null;
let currentUser = null;
let currentOrderId = null;
let chatPollInterval = null;

// ── Утилиты токена ───────────────────────────────────────────

function getToken() { return authToken || localStorage.getItem('lk_token'); }
function setToken(t) { authToken = t; localStorage.setItem('lk_token', t); }
function clearToken() { authToken = null; localStorage.removeItem('lk_token'); }

function authHeaders() {
  const t = getToken();
  return t
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
}

// ── Утилиты ──────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('lk-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#c0392b' : 'var(--color-primary)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function statusLabel(s) {
  const map = {
    new: 'Новая',
    inprogress: 'В работе',
    done: 'Выполнена',
    cancelled: 'Отменена',
  };
  return map[s] || s;
}

function el(id) { return document.getElementById(id); }

// ── Маска телефона ───────────────────────────────────────────

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

function initPhoneMask(input, allowEmail = false) {
  if (!input) return;
  input.addEventListener('focus', () => {
    if (!input.value.trim()) input.value = '+7';
  });
  input.addEventListener('input', () => {
    if (allowEmail && input.value.includes('@')) return;
    input.value = formatPhoneMask(input.value);
  });
  input.addEventListener('blur', () => {
    if (input.value === '+7') input.value = '';
  });
}

function initPhoneMasks() {
  initPhoneMask(el('prof-phone'));
  initPhoneMask(el('lk-order-contact'), true);
}

// ── Навигация по панелям ──────────────────────────────────────

function showPanel(name) {
  document.querySelectorAll('.lk-panel').forEach(p => p.classList.remove('active'));
  const panel = el(`panel-${name}`);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.lk-nav-item button').forEach(b => {
    const onclick = b.getAttribute('onclick') || '';
    b.classList.toggle('active', onclick.includes(`'${name}'`));
  });
  if (name === 'orders') loadMyOrders();
  if (name === 'reviews') loadMyReviews();
  if (name === 'overview') loadOverview();
  if (name !== 'chat' && chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

// ── Инициализация ЛК ─────────────────────────────────────────

function initLK() {
  if (!currentUser) return;

  // Сайдбар
  el('lk-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  el('lk-username').textContent = currentUser.name;
  el('lk-email').textContent = currentUser.email;

  // Форма профиля
  el('prof-name').value = currentUser.name || '';
  el('prof-email').value = currentUser.email || '';
  el('prof-phone').value = currentUser.phone || '';

  // Предзаполнение модалок
  el('lk-order-name').value = currentUser.name;
  el('lk-order-contact').value = currentUser.phone || currentUser.email;
  el('lk-review-name').value = currentUser.name;

  showPanel('profile');
}

// ── Обзор (статистика) ────────────────────────────────────────

async function loadOverview() {
  const nameEl = el('overview-name');
  if (nameEl && currentUser) nameEl.textContent = currentUser.name.split(' ')[0];
  try {
    const [ordersR, reviewsR] = await Promise.all([
      fetch(`${API}/api/orders/my`, { headers: authHeaders() }),
      fetch(`${API}/api/reviews/my`, { headers: authHeaders() }),
    ]);
    const { orders = [] } = await ordersR.json();
    const { reviews = [] } = await reviewsR.json();
    el('stat-orders-total') && (el('stat-orders-total').textContent = orders.length);
    el('stat-orders-active') && (el('stat-orders-active').textContent =
      orders.filter(o => o.status === 'inprogress').length);
    el('stat-reviews-total') && (el('stat-reviews-total').textContent = reviews.length);
  } catch { /* не критично */ }
}

// ── Профиль — сохранение ─────────────────────────────────────

el('lk-profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = el('prof-name').value.trim();
  const phone = el('prof-phone').value.trim();
  const passNew = el('prof-pass-new').value;
  const passConf = el('prof-pass-confirm').value;

  if (!name) return showToast('Укажите имя', 'error');
  if (passNew && passNew.length < 6) return showToast('Пароль минимум 6 символов', 'error');
  if (passNew && passNew !== passConf) return showToast('Пароли не совпадают', 'error');

  try {
    const body = { name, phone };
    if (passNew) body.password = passNew;
    const r = await fetch(`${API}/api/auth/profile`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return showToast(data.error || 'Ошибка сохранения', 'error');
    currentUser.name = name;
    currentUser.phone = phone;
    el('lk-username').textContent = name;
    el('lk-avatar').textContent = name.charAt(0).toUpperCase();
    el('prof-pass-new').value = '';
    el('prof-pass-confirm').value = '';
    showSaveMsg();
  } catch {
    showToast('Ошибка сохранения', 'error');
  }
});

function showSaveMsg() {
  const msg = el('prof-save-msg');
  if (!msg) return;
  msg.style.display = 'inline';
  setTimeout(() => (msg.style.display = 'none'), 3000);
}

// ── Новая заявка ──────────────────────────────────────────────

function showNewOrderModal() {
  const modal = el('new-order-modal');
  if (modal) modal.style.display = 'flex';
}

function closeNewOrderModal() {
  const modal = el('new-order-modal');
  if (modal) modal.style.display = 'none';
}

const orderModal = el('new-order-modal');
if (orderModal) {
  orderModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewOrderModal();
  });
}

async function loadMyOrders() {
  const list = el('orders-list');
  if (!list) return;

  const emptyHtml = `
    <div style="text-align:center;padding:var(--space-12);color:var(--color-text-faint)">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" style="margin:0 auto var(--space-3)">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p style="margin-top:var(--space-2)">
        Заявок пока нет.
        <a href="#" onclick="showNewOrderModal();return false"
           style="color:var(--color-primary)">Создайте первую</a>
      </p>
    </div>`;

  list.innerHTML = '<p style="color:var(--color-text-faint);padding:var(--space-4)">Загрузка...</p>';

  try {
    const r = await fetch(`${API}/api/orders/my`, { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const { orders = [] } = await r.json();
    if (!orders.length) { list.innerHTML = emptyHtml; return; }
    list.innerHTML = orders.map(o => `
      <article class="lk-order-card">
        <div class="lk-order-header">
          <div>
            <div class="lk-order-id">Заявка #${o.id}</div>
            <div class="lk-order-meta">${formatDate(o.created_at)}</div>
          </div>
          <span class="status-badge status-${escapeHtml(o.status)}">${statusLabel(o.status)}</span>
        </div>
        ${o.service ? `<div class="lk-order-service">${escapeHtml(o.service)}</div>` : ''}
        ${o.message ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-top:var(--space-2)">${escapeHtml(o.message)}</p>` : ''}
        <div style="margin-top:var(--space-3)">
          <button class="lk-chat-btn" onclick="openChat(${o.id}, 'Заявка #${o.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Обсудить с мастером
          </button>
        </div>
      </article>
    `).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--color-error);padding:var(--space-4)">Ошибка загрузки заявок</p>';
  }
}

function validateName(val) {
  return /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(val.trim());
}

function validateContact(val) {
  const phone = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(val.trim());
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());
  return phone || email;
}

el('lk-order-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = el('lk-order-name').value.trim();
  const contact = el('lk-order-contact').value.trim();
  const service = el('lk-order-service').value;
  const message = el('lk-order-message').value.trim();

  if (!name || !validateName(name))
    return showToast('Имя должно содержать только буквы (минимум 2 символа)', 'error');
  if (!contact || !validateContact(contact))
    return showToast('Введите корректный телефон (+7 xxx xxx xx-xx) или email', 'error');

  try {
    const r = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, contact, service, message }),
    });
    const data = await r.json();
    if (!r.ok) return showToast(data.error || 'Ошибка отправки', 'error');
    showToast('Заявка успешно отправлена!');
    closeNewOrderModal();
    e.target.reset();
    el('lk-order-name').value = currentUser.name;
    el('lk-order-contact').value = currentUser.phone || currentUser.email;
    showPanel('orders');
  } catch {
    showToast('Ошибка отправки заявки', 'error');
  }
});

// ── Новый отзыв ───────────────────────────────────────────────

function showNewReviewModal() {
  const modal = el('new-review-modal');
  if (modal) modal.style.display = 'flex';
}

function closeNewReviewModal() {
  const modal = el('new-review-modal');
  if (modal) modal.style.display = 'none';
}

const reviewModal = el('new-review-modal');
if (reviewModal) {
  reviewModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewReviewModal();
  });
}

async function loadMyReviews() {
  const list = el('reviews-list');
  if (!list) return;

  const emptyHtml = `
    <div style="text-align:center;padding:var(--space-12);color:var(--color-text-faint)">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" style="margin:0 auto var(--space-3)">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <p style="margin-top:var(--space-2)">
        Отзывов пока нет.
        <a href="#" onclick="showNewReviewModal();return false"
           style="color:var(--color-primary)">Оставьте первый</a>
      </p>
    </div>`;

  list.innerHTML = '<p style="color:var(--color-text-faint);padding:var(--space-4)">Загрузка...</p>';

  try {
    const r = await fetch(`${API}/api/reviews/my`, { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const { reviews = [] } = await r.json();
    if (!reviews.length) { list.innerHTML = emptyHtml; return; }
    list.innerHTML = reviews.map(rv => `
      <div class="lk-review-card">
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--text-xs);color:var(--color-text-faint)">${formatDate(rv.created_at)}</div>
          <div class="lk-review-body" style="margin-top:var(--space-1)">${escapeHtml(rv.body)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:var(--space-4)">
          <div class="lk-review-stars">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</div>
          <div style="margin-top:var(--space-1)">
            ${rv.approved
        ? '<span style="font-size:var(--text-xs);color:#2e7d32;font-weight:600">✓ Опубликован</span>'
        : '<span style="font-size:var(--text-xs);color:var(--color-text-faint)">⏳ На проверке</span>'}
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--color-error);padding:var(--space-4)">Ошибка загрузки отзывов</p>';
  }
}

// ── Звёздочки ─────────────────────────────────────────────────

let lkSelectedRating = 0;

document.querySelectorAll('#lk-star-rating .star').forEach(star => {
  const val = parseInt(star.dataset.value);
  star.addEventListener('mouseenter', () => highlightLkStars(val));
  star.addEventListener('mouseleave', () => highlightLkStars(lkSelectedRating));
  star.addEventListener('click', () => {
    lkSelectedRating = val;
    el('lk-review-rating').value = val;
    highlightLkStars(val);
    star.setAttribute('aria-checked', 'true');
  });
  star.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); star.click(); }
  });
});

function highlightLkStars(count) {
  document.querySelectorAll('#lk-star-rating .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= count);
  });
}

function resetReviewForm() {
  el('lk-review-form').reset();
  lkSelectedRating = 0;
  el('lk-review-rating').value = 0;
  highlightLkStars(0);
  if (currentUser) el('lk-review-name').value = currentUser.name;
}

el('lk-review-form').addEventListener('submit', async e => {
  e.preventDefault();
  const author = el('lk-review-name').value.trim();
  const body = el('lk-review-text').value.trim();
  const rating = parseInt(el('lk-review-rating').value);

  if (!author || !validateName(author))
    return showToast('Имя должно содержать только буквы (минимум 2 символа)', 'error');
  if (!body || body.length < 10)
    return showToast('Напишите отзыв (минимум 10 символов)', 'error');
  if (!rating || rating < 1)
    return showToast('Выберите оценку', 'error');

  try {
    const r = await fetch(`${API}/api/reviews`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ author, rating, body }),
    });
    const data = await r.json();
    if (!r.ok) return showToast(data.error || 'Ошибка отправки', 'error');
    showToast('Отзыв отправлен на проверку!');
    closeNewReviewModal();
    resetReviewForm();
    showPanel('reviews');
  } catch {
    showToast('Ошибка отправки отзыва', 'error');
  }
});

// ── Чат ──────────────────────────────────────────────────────

function openChat(orderId, title) {
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
  currentOrderId = orderId;
  const titleEl = el('chat-title');
  if (titleEl) titleEl.textContent = `Чат: ${title}`;
  document.querySelectorAll('.lk-panel').forEach(p => p.classList.remove('active'));
  const chatPanel = el('panel-chat');
  if (chatPanel) chatPanel.classList.add('active');
  loadChatMessages();
  chatPollInterval = setInterval(loadChatMessages, 5000);
}

async function loadChatMessages() {
  if (!currentOrderId) return;
  const container = el('chat-messages');
  if (!container) return;
  try {
    const r = await fetch(`${API}/api/chat/${currentOrderId}`, { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const { messages = [] } = await r.json();
    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;
    container.innerHTML = messages.length
      ? messages.map(renderBubble).join('')
      : '<div style="text-align:center;color:var(--color-text-faint);padding:var(--space-8)">Нет сообщений. Напишите первым!</div>';
    if (wasAtBottom) container.scrollTop = container.scrollHeight;
  } catch { /* polling — молча пропустить */ }
}

function renderBubble(m) {
  const isMine = m.sender_role !== 'admin';
  const time = new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
      ${!isMine ? '<div class="chat-bubble-sender">Мастер</div>' : ''}
      ${escapeHtml(m.message)}
      <div class="chat-bubble-time">${time}</div>
    </div>`;
}

async function sendMessage() {
  const input = el('chat-input');
  const message = input?.value.trim();
  if (!message || !currentOrderId) return;
  input.value = '';
  try {
    const r = await fetch(`${API}/api/chat/${currentOrderId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    if (r.ok) loadChatMessages();
    else showToast('Ошибка отправки сообщения', 'error');
  } catch {
    showToast('Ошибка соединения', 'error');
  }
}

el('chat-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── Выход ─────────────────────────────────────────────────────

async function logout() {
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
  try {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', headers: authHeaders() });
  } catch { }
  clearToken();
  currentUser = null;
  currentOrderId = null;
  // Перенаправляем на страницу входа
  window.location.replace('/login');
}

// ── Старт: проверка токена, редирект если не авторизован ──────

async function initApp() {
  initPhoneMasks();

  const token = getToken();

  if (!token) {
    window.location.replace('/login');
    return;
  }

  try {
    const r = await fetch(`${API}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!r.ok) throw new Error('Сессия недействительна');

    const { user } = await r.json();
    currentUser = user;
    setToken(token);
    initLK();
  } catch {
    clearToken();
    window.location.replace('/login');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
