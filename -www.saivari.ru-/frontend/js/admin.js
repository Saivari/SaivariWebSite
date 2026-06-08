/* ============================================================
   ADMIN.JS — Панель администратора
   ============================================================ */

const API = '';
let adminToken = null;
let adminUser = null;
let adminCurrentOrderId = null;
let adminChatTimer = null;
let adminChatLoading = false;
let adminToastTimer = null;
let allOrders = [];
let allReviews = [];
let currentOrderFilter = 'all';
let currentReviewFilter = 'pending';

function getAdminToken() {
  return adminToken || sessionStorage.getItem('admin_token');
}

function setAdminToken(t) {
  adminToken = t;
  sessionStorage.setItem('admin_token', t);
}

function clearAdminToken() {
  adminToken = null;
  sessionStorage.removeItem('admin_token');
}

function adminHeaders() {
  const t = getAdminToken();
  return t
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function showAdminToast(msg, type = 'success') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;

  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#c0392b' : 'var(--color-primary)';
  toast.classList.add('show');

  if (adminToastTimer) clearTimeout(adminToastTimer);
  adminToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    adminToastTimer = null;
  }, 4000);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function statusLabel(s) {
  const map = {
    new: 'Новая',
    inprogress: 'В работе',
    done: 'Выполнена',
    cancelled: 'Отменена'
  };
  return map[s] || s;
}

function stopAdminChatPolling() {
  if (adminChatTimer) {
    clearTimeout(adminChatTimer);
    adminChatTimer = null;
  }
}

function scheduleAdminChatPolling() {
  stopAdminChatPolling();
  adminChatTimer = setTimeout(async () => {
    await adminLoadChatMessages();
    if (adminCurrentOrderId) {
      scheduleAdminChatPolling();
    }
  }, 5000);
}

// ── Авторизация ───────────────────────────────────────────────
document.getElementById('admin-login-form')?.addEventListener('submit', async e => {
  e.preventDefault();

  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
      return showAdminAuthError(data.error || 'Ошибка авторизации');
    }

    if (data.user?.role !== 'admin') {
      return showAdminAuthError('Нет прав администратора');
    }

    setAdminToken(data.token);
    adminUser = data.user;
    initAdminPanel();
  } catch {
    showAdminAuthError('Ошибка соединения');
  }
});

function showAdminAuthError(msg) {
  const el = document.getElementById('admin-auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

// ── Навигация ─────────────────────────────────────────────────
function adminShowPanel(name) {
  document.querySelectorAll('.lk-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.lk-nav-item button').forEach(b => b.classList.remove('active'));

  document.getElementById(`admin-panel-${name}`)?.classList.add('active');

  document.querySelectorAll('.lk-nav-item button').forEach(b => {
    if (b.getAttribute('onclick')?.includes(`'${name}'`)) {
      b.classList.add('active');
    }
  });

  if (name === 'orders') loadAdminOrders();
  if (name === 'reviews') loadAdminReviews();
  if (name === 'dashboard') loadDashboard();
  if (name !== 'chat') stopAdminChatPolling();
}

// ── Инициализация ─────────────────────────────────────────────
function initAdminPanel() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('admin-page').style.display = 'block';
  document.getElementById('admin-avatar').textContent = adminUser.name.charAt(0).toUpperCase();
  document.getElementById('admin-username').textContent = adminUser.name;

  loadDashboard();
  loadAdminOrders();
  loadAdminReviews();
}

// ── Дашборд ───────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [ordersR, reviewsR] = await Promise.all([
      fetch(`${API}/api/orders`, { headers: adminHeaders() }),
      fetch(`${API}/api/reviews/all`, { headers: adminHeaders() })
    ]);

    const ordersData = await parseJsonSafe(ordersR);
    const reviewsData = await parseJsonSafe(reviewsR);

    if (!ordersR.ok || !reviewsR.ok) return;

    const orders = ordersData.orders || [];
    const reviews = reviewsData.reviews || [];

    document.getElementById('dash-orders-total').textContent = orders.length;
    document.getElementById('dash-orders-new').textContent = orders.filter(o => o.status === 'new').length;
    document.getElementById('dash-orders-active').textContent = orders.filter(o => o.status === 'inprogress').length;
    document.getElementById('dash-reviews-pending').textContent = reviews.filter(r => !r.approved).length;

    const newOrders = orders.filter(o => o.status === 'new').length;
    const pendReviews = reviews.filter(r => !r.approved).length;

    const badgeO = document.getElementById('badge-orders');
    const badgeR = document.getElementById('badge-reviews');

    badgeO.textContent = newOrders;
    badgeO.style.display = newOrders ? 'inline-flex' : 'none';

    badgeR.textContent = pendReviews;
    badgeR.style.display = pendReviews ? 'inline-flex' : 'none';
  } catch {}
}

// ── Заявки ────────────────────────────────────────────────────
async function loadAdminOrders() {
  try {
    const r = await fetch(`${API}/api/orders`, { headers: adminHeaders() });
    const data = await parseJsonSafe(r);

    if (!r.ok) {
      throw new Error(data.error || 'Ошибка загрузки');
    }

    allOrders = data.orders || [];
    renderOrdersTable();
  } catch {
    document.getElementById('orders-tbody').innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--color-error)">Ошибка загрузки</td></tr>';
  }
}

function filterOrders(filter, btn) {
  currentOrderFilter = filter;
  document.querySelectorAll('#orders-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrdersTable();
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-tbody');

  const filtered = currentOrderFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === currentOrderFilter);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-faint);padding:var(--space-8)">Нет заявок</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(o => `
    <tr>
      <td class="td-id">#${o.id}</td>
      <td class="td-name">
        ${escapeHtml(o.name)}
        ${o.user_email ? `<div style="font-size:var(--text-xs);color:var(--color-text-faint)">${escapeHtml(o.user_email)}</div>` : ''}
      </td>
      <td style="font-size:var(--text-sm)">${escapeHtml(o.contact)}</td>
      <td style="font-size:var(--text-sm)">${o.service ? escapeHtml(o.service) : '<span style="color:var(--color-text-faint)">—</span>'}</td>
      <td style="font-size:var(--text-xs);white-space:nowrap">${formatDate(o.created_at)}</td>
      <td>
        <select class="status-select" onchange="changeOrderStatus(${o.id}, this.value)">
          <option value="new" ${o.status === 'new' ? 'selected' : ''}>Новая</option>
          <option value="inprogress" ${o.status === 'inprogress' ? 'selected' : ''}>В работе</option>
          <option value="done" ${o.status === 'done' ? 'selected' : ''}>Выполнена</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Отменена</option>
        </select>
      </td>
      <td>
        <button class="lk-chat-btn" onclick="adminOpenChat(${o.id}, '#${o.id} — ${escapeHtml(o.name)}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Чат
        </button>
      </td>
    </tr>
  `).join('');
}

async function changeOrderStatus(id, status) {
  try {
    const r = await fetch(`${API}/api/orders/${id}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
      showAdminToast(data.error || 'Ошибка обновления статуса', 'error');
      return;
    }

    const order = allOrders.find(o => o.id === id);
    if (order) order.status = status;

    renderOrdersTable();
    loadDashboard();
    showAdminToast('Статус обновлён');
  } catch {
    showAdminToast('Ошибка соединения', 'error');
  }
}

// ── Отзывы ────────────────────────────────────────────────────
async function loadAdminReviews() {
  try {
    const r = await fetch(`${API}/api/reviews/all`, { headers: adminHeaders() });
    const data = await parseJsonSafe(r);

    if (!r.ok) {
      throw new Error(data.error || 'Ошибка загрузки');
    }

    allReviews = data.reviews || [];
    renderReviewsTable();
  } catch {
    const tbody = document.getElementById('reviews-tbody');
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:var(--color-error)">Ошибка загрузки</td></tr>';
    }
  }
}

function filterReviews(filter, btn) {
  currentReviewFilter = filter;
  document.querySelectorAll('#admin-panel-reviews .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReviewsTable();
}

function renderReviewsTable() {
  const tbody = document.getElementById('reviews-tbody');
  let filtered = allReviews;

  if (currentReviewFilter === 'pending') filtered = allReviews.filter(r => !r.approved);
  if (currentReviewFilter === 'approved') filtered = allReviews.filter(r => r.approved);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-faint);padding:var(--space-8)">Нет отзывов</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(rv => `
    <tr id="review-row-${rv.id}">
      <td class="td-id">#${rv.id}</td>
      <td class="td-name">${escapeHtml(rv.author)}</td>
      <td style="color:#e8a000;font-size:var(--text-base)">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</td>
      <td style="font-size:var(--text-sm);max-width:260px">${escapeHtml(rv.body)}</td>
      <td style="font-size:var(--text-xs);white-space:nowrap">${formatDate(rv.created_at)}</td>
      <td>
        ${rv.approved
          ? '<span style="font-size:var(--text-xs);color:#2e7d32;font-weight:600">✓ Одобрен</span>'
          : '<span style="font-size:var(--text-xs);color:var(--color-text-faint)">⏳ Ожидает</span>'}
      </td>
      <td style="white-space:nowrap">
        ${!rv.approved ? `<button class="approve-btn" onclick="approveReview(${rv.id})">Одобрить</button>` : ''}
        <button class="reject-btn" onclick="rejectReview(${rv.id})">Удалить</button>
      </td>
    </tr>
  `).join('');
}

async function approveReview(id) {
  try {
    const r = await fetch(`${API}/api/reviews/${id}/approve`, {
      method: 'PATCH',
      headers: adminHeaders()
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
      showAdminToast(data.error || 'Ошибка', 'error');
      return;
    }

    const rv = allReviews.find(r => r.id === id);
    if (rv) rv.approved = true;

    renderReviewsTable();
    loadDashboard();
    showAdminToast('Отзыв одобрен и опубликован');
  } catch {
    showAdminToast('Ошибка соединения', 'error');
  }
}

async function rejectReview(id) {
  if (!confirm('Удалить отзыв навсегда?')) return;

  try {
    const r = await fetch(`${API}/api/reviews/${id}/reject`, {
      method: 'PATCH',
      headers: adminHeaders()
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
      showAdminToast(data.error || 'Ошибка', 'error');
      return;
    }

    allReviews = allReviews.filter(r => r.id !== id);
    renderReviewsTable();
    loadDashboard();
    showAdminToast('Отзыв удалён');
  } catch {
    showAdminToast('Ошибка соединения', 'error');
  }
}

// ── Чат (admin) ───────────────────────────────────────────────
function adminOpenChat(orderId, title) {
  adminCurrentOrderId = orderId;
  document.getElementById('admin-chat-title').textContent = `Чат: ${title}`;
  adminShowPanel('chat');
  stopAdminChatPolling();

  adminLoadChatMessages().then(() => {
    if (adminCurrentOrderId) {
      scheduleAdminChatPolling();
    }
  });
}

async function adminLoadChatMessages() {
  if (!adminCurrentOrderId || adminChatLoading) return;

  adminChatLoading = true;

  try {
    const r = await fetch(`${API}/api/chat/${adminCurrentOrderId}`, {
      headers: adminHeaders()
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
      showAdminToast(data.error || 'Ошибка загрузки чата', 'error');
      return;
    }

    const msgs = data.messages || [];
    const container = document.getElementById('admin-chat-messages');
    const wasAtBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 40;

    container.innerHTML = msgs.length
      ? msgs.map(m => {
          const isAdmin = m.sender_role === 'admin';
          const time = new Date(m.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          });

          return `<div class="chat-bubble ${isAdmin ? 'mine' : 'theirs'}">
            ${!isAdmin ? `<div class="chat-bubble-sender">${escapeHtml(m.sender_name)}</div>` : ''}
            ${escapeHtml(m.message)}
            <div class="chat-bubble-time">${time}</div>
          </div>`;
        }).join('')
      : '<div style="text-align:center;color:var(--color-text-faint);padding:var(--space-8)">Нет сообщений</div>';

    if (wasAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  } catch {
    showAdminToast('Ошибка соединения', 'error');
  } finally {
    adminChatLoading = false;
  }
}

async function adminSendMessage() {
  const input = document.getElementById('admin-chat-input');
  const message = input.value.trim();

  if (!message || !adminCurrentOrderId) return;

  input.value = '';

  try {
    const r = await fetch(`${API}/api/chat/${adminCurrentOrderId}`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ message })
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
      showAdminToast(data.error || 'Ошибка отправки', 'error');
      return;
    }

    await adminLoadChatMessages();
  } catch {
    showAdminToast('Ошибка соединения', 'error');
  }
}

document.getElementById('admin-chat-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    adminSendMessage();
  }
});

// ── Выход ─────────────────────────────────────────────────────
async function adminLogout() {
  stopAdminChatPolling();
  adminCurrentOrderId = null;

  await fetch(`${API}/api/auth/logout`, {
    method: 'POST',
    headers: adminHeaders()
  }).catch(() => {});

  clearAdminToken();
  adminUser = null;
  document.getElementById('admin-page').style.display = 'none';
  document.getElementById('auth-overlay').style.display = 'flex';
}

// ── Старт ─────────────────────────────────────────────────────
async function initAdminApp() {
  const token = getAdminToken();

  if (!token) {
    document.getElementById('auth-overlay').style.display = 'flex';
    return;
  }

  try {
    const r = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await parseJsonSafe(r);

    if (!r.ok || data.user?.role !== 'admin') {
      throw new Error();
    }

    adminUser = data.user;
    setAdminToken(token);
    initAdminPanel();
  } catch {
    clearAdminToken();
    document.getElementById('auth-overlay').style.display = 'flex';
  }
}

initAdminApp();