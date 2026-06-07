/* ============================================================
   LK.JS — Личный кабинет пользователя
   ============================================================ */

const API = '';
let authToken = null;
let currentUser = null;
let currentOrderId = null;
let chatPollInterval = null;

// ── Утилиты ─────────────────────────────────────────────────
function getToken() { return authToken || sessionStorage.getItem('lk_token'); }
function setToken(t) { authToken = t; sessionStorage.setItem('lk_token', t); }
function clearToken() { authToken = null; sessionStorage.removeItem('lk_token'); }

function authHeaders() {
  const t = getToken();
  return t ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }
           : { 'Content-Type': 'application/json' };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('lk-toast');
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#c0392b' : 'var(--color-primary)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusLabel(s) {
  const map = { new: 'Новая', inprogress: 'В работе', done: 'Выполнена', cancelled: 'Отменена' };
  return map[s] || s;
}

// ── Переключение вкладок auth modal ─────────────────────────
function switchTab(tab) {
  document.getElementById('login-form').style.display    = tab === 'login' ? 'flex' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-error').style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}

// ── Вход / Регистрация ───────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) return showAuthError(data.error);
    setToken(data.token);
    currentUser = data.user;
    initLK();
  } catch { showAuthError('Ошибка соединения'); }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  try {
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await r.json();
    if (!r.ok) return showAuthError(data.error);
    setToken(data.token);
    currentUser = data.user;
    initLK();
  } catch { showAuthError('Ошибка соединения'); }
});

// ── Навигация по панелям ─────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.lk-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.lk-nav-item button').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  const navBtns = { overview:'Обзор', orders:'Мои заявки', reviews:'Мои отзывы', 'new-order':'Новая заявка', 'new-review':'Оставить отзыв', chat:null };
  document.querySelectorAll('.lk-nav-item button').forEach(b => {
    if (b.getAttribute('onclick')?.includes(`'${name}'`)) b.classList.add('active');
  });
  if (name === 'orders') loadMyOrders();
  if (name === 'reviews') loadMyReviews();
  if (name === 'overview') loadOverview();
  if (name !== 'chat' && chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
}

// ── Инициализация ЛК ─────────────────────────────────────────
function initLK() {
  if (!currentUser) return;
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('lk-page').style.display = 'block';

  const initial = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('lk-avatar').textContent = initial;
  document.getElementById('lk-username').textContent = currentUser.name;
  document.getElementById('lk-email').textContent = currentUser.email;
  document.getElementById('overview-name').textContent = currentUser.name.split(' ')[0];

  // Предзаполнение форм
  document.getElementById('lk-order-name').value = currentUser.name;
  document.getElementById('lk-order-contact').value = currentUser.phone || currentUser.email;
  document.getElementById('lk-review-name').value = currentUser.name;

  loadOverview();
}

// ── Данные ───────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [ordersR, reviewsR] = await Promise.all([
      fetch(`${API}/api/orders/my`, { headers: authHeaders() }),
      fetch(`${API}/api/reviews/my`, { headers: authHeaders() })
    ]);
    const ordersData  = await ordersR.json();
    const reviewsData = await reviewsR.json();
    const orders  = ordersData.orders  || [];
    const reviews = reviewsData.reviews || [];
    document.getElementById('stat-orders-total').textContent = orders.length;
    document.getElementById('stat-orders-active').textContent = orders.filter(o => o.status === 'inprogress').length;
    document.getElementById('stat-reviews-total').textContent = reviews.length;
  } catch {}
}

async function loadMyOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '<p style="color:var(--color-text-faint);padding:var(--space-4)">Загрузка...</p>';
  try {
    const r = await fetch(`${API}/api/orders/my`, { headers: authHeaders() });
    const data = await r.json();
    const orders = data.orders || [];
    if (!orders.length) {
      list.innerHTML = `<div style="text-align:center;padding:var(--space-12);color:var(--color-text-faint)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto var(--space-3)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
        <p>Заявок пока нет. <a href="#" onclick="showPanel('new-order');return false" style="color:var(--color-primary)">Создайте первую</a></p></div>`;
      return;
    }
    list.innerHTML = orders.map(o => `
      <article class="lk-order-card">
        <div class="lk-order-header">
          <div>
            <div class="lk-order-id">Заявка #${o.id}</div>
            <div class="lk-order-meta">${formatDate(o.created_at)}</div>
          </div>
          <span class="status-badge status-${o.status}">${statusLabel(o.status)}</span>
        </div>
        ${o.service ? `<div class="lk-order-service">${escapeHtml(o.service)}</div>` : ''}
        ${o.message ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted)">${escapeHtml(o.message)}</p>` : ''}
        <div style="margin-top:var(--space-3)">
          <button class="lk-chat-btn" onclick="openChat(${o.id}, 'Заявка #${o.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Обсудить с мастером
          </button>
        </div>
      </article>
    `).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--color-error)">Ошибка загрузки заявок</p>';
  }
}

async function loadMyReviews() {
  const list = document.getElementById('reviews-list');
  list.innerHTML = '<p style="color:var(--color-text-faint);padding:var(--space-4)">Загрузка...</p>';
  try {
    const r = await fetch(`${API}/api/reviews/my`, { headers: authHeaders() });
    const data = await r.json();
    const reviews = data.reviews || [];
    if (!reviews.length) {
      list.innerHTML = `<div style="text-align:center;padding:var(--space-12);color:var(--color-text-faint)">
        <p>Отзывов пока нет. <a href="#" onclick="showPanel('new-review');return false" style="color:var(--color-primary)">Оставьте первый</a></p></div>`;
      return;
    }
    list.innerHTML = reviews.map(rv => `
      <div class="lk-review-card">
        <div style="flex:1">
          <div style="font-size:var(--text-xs);color:var(--color-text-faint)">${formatDate(rv.created_at)}</div>
          <div class="lk-review-body">${escapeHtml(rv.body)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="lk-review-stars">${'★'.repeat(rv.rating)}${'☆'.repeat(5-rv.rating)}</div>
          <div style="margin-top:var(--space-1)">
            ${rv.approved
              ? '<span style="font-size:var(--text-xs);color:var(--color-success,#2e7d32);font-weight:600">✓ Опубликован</span>'
              : '<span style="font-size:var(--text-xs);color:var(--color-text-faint)">⏳ На проверке</span>'}
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--color-error)">Ошибка загрузки отзывов</p>';
  }
}

// ── Формы ────────────────────────────────────────────────────
document.getElementById('lk-order-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name    = document.getElementById('lk-order-name').value.trim();
  const contact = document.getElementById('lk-order-contact').value.trim();
  const service = document.getElementById('lk-order-service').value;
  const message = document.getElementById('lk-order-message').value.trim();
  if (!name) return showToast('Укажите имя', 'error');
  if (!contact) return showToast('Укажите контакт', 'error');
  try {
    const r = await fetch(`${API}/api/orders`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ name, contact, service, message })
    });
    const data = await r.json();
    if (!r.ok) return showToast(data.error, 'error');
    showToast('Заявка отправлена!');
    e.target.reset();
    document.getElementById('lk-order-name').value = currentUser.name;
    document.getElementById('lk-order-contact').value = currentUser.phone || currentUser.email;
    showPanel('orders');
  } catch { showToast('Ошибка отправки', 'error'); }
});

// Звёздочки для отзыва
let lkSelectedRating = 0;
document.querySelectorAll('#lk-star-rating .star').forEach(star => {
  star.addEventListener('mouseenter', () => highlightLkStars(parseInt(star.dataset.value)));
  star.addEventListener('mouseleave', () => highlightLkStars(lkSelectedRating));
  star.addEventListener('click', () => {
    lkSelectedRating = parseInt(star.dataset.value);
    document.getElementById('lk-review-rating').value = lkSelectedRating;
    highlightLkStars(lkSelectedRating);
  });
  star.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); star.click(); } });
});

function highlightLkStars(count) {
  document.querySelectorAll('#lk-star-rating .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= count);
  });
}

document.getElementById('lk-review-form').addEventListener('submit', async e => {
  e.preventDefault();
  const author = document.getElementById('lk-review-name').value.trim();
  const body   = document.getElementById('lk-review-text').value.trim();
  const rating = parseInt(document.getElementById('lk-review-rating').value);
  if (!author) return showToast('Укажите имя', 'error');
  if (!body)   return showToast('Напишите текст отзыва', 'error');
  if (!rating || rating < 1) return showToast('Выберите оценку', 'error');
  try {
    const r = await fetch(`${API}/api/reviews`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ author, rating, body })
    });
    const data = await r.json();
    if (!r.ok) return showToast(data.error, 'error');
    showToast('Отзыв отправлен на проверку!');
    e.target.reset();
    lkSelectedRating = 0;
    highlightLkStars(0);
    showPanel('reviews');
  } catch { showToast('Ошибка отправки', 'error'); }
});

// ── Чат ──────────────────────────────────────────────────────
function openChat(orderId, title) {
  currentOrderId = orderId;
  document.getElementById('chat-title').textContent = `Чат: ${title}`;
  showPanel('chat');
  loadChatMessages();
  chatPollInterval = setInterval(loadChatMessages, 5000);
}

async function loadChatMessages() {
  if (!currentOrderId) return;
  try {
    const r = await fetch(`${API}/api/chat/${currentOrderId}`, { headers: authHeaders() });
    const data = await r.json();
    const msgs = data.messages || [];
    const container = document.getElementById('chat-messages');
    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;
    container.innerHTML = msgs.length ? msgs.map(m => renderBubble(m)).join('') :
      '<div style="text-align:center;color:var(--color-text-faint);padding:var(--space-8)">Нет сообщений. Напишите первым!</div>';
    if (wasAtBottom || msgs.length <= 1) container.scrollTop = container.scrollHeight;
  } catch {}
}

function renderBubble(m) {
  const mine = m.sender_role !== 'admin';
  const time = new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `<div class="chat-bubble ${mine ? 'mine' : 'theirs'}">
    ${!mine ? `<div class="chat-bubble-sender">Мастер</div>` : ''}
    ${escapeHtml(m.message)}
    <div class="chat-bubble-time">${time}</div>
  </div>`;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || !currentOrderId) return;
  input.value = '';
  try {
    const r = await fetch(`${API}/api/chat/${currentOrderId}`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ message })
    });
    if (r.ok) loadChatMessages();
    else showToast('Ошибка отправки', 'error');
  } catch { showToast('Ошибка соединения', 'error'); }
}

document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── Выход ─────────────────────────────────────────────────────
async function logout() {
  await fetch(`${API}/api/auth/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  clearToken();
  currentUser = null;
  document.getElementById('lk-page').style.display = 'none';
  document.getElementById('auth-overlay').style.display = 'flex';
}

// ── Старт ─────────────────────────────────────────────────────
async function initApp() {
  const token = getToken();
  if (!token) {
    document.getElementById('auth-overlay').style.display = 'flex';
    return;
  }
  try {
    const r = await fetch(`${API}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) throw new Error();
    const data = await r.json();
    currentUser = data.user;
    setToken(token);
    initLK();
  } catch {
    clearToken();
    document.getElementById('auth-overlay').style.display = 'flex';
  }
}

initApp();