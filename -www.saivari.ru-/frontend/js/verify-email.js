/* ============================================================
   VERIFY-EMAIL.JS — страница подтверждения email
   Читает ?token= из URL, вызывает /api/auth/verify-email
   Если токена нет или он невалиден — показывает форму повторной отправки
   ============================================================ */

const token = new URLSearchParams(window.location.search).get('token');
const messageEl = document.getElementById('message');
const actionsEl = document.getElementById('main-actions');
const resendBox = document.getElementById('resend-box');
const resendBtn = document.getElementById('resend-btn');
const resendEmailInput = document.getElementById('resend-email');

function setMessage(type, text) {
  messageEl.className = `msg show ${type}`;
  messageEl.textContent = text;
}

async function verifyEmail() {
  if (!token) {
    setMessage('error', 'Ссылка подтверждения недействительна: токен отсутствует.');
    resendBox.classList.add('show');
    return;
  }

  try {
    const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (!res.ok) {
      setMessage('error', data.error || 'Не удалось подтвердить email.');
      resendBox.classList.add('show');
      return;
    }

    setMessage('success', data.message || 'Email успешно подтверждён. Теперь вы можете войти в аккаунт.');
    actionsEl.style.display = 'flex';
  } catch {
    setMessage('error', 'Ошибка сети. Попробуйте открыть ссылку позже.');
    resendBox.classList.add('show');
  }
}

async function resendVerification() {
  const email = resendEmailInput.value.trim().toLowerCase();

  if (!email) {
    setMessage('error', 'Введите email для повторной отправки письма.');
    return;
  }

  try {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Отправляем...';

    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage('error', data.error || 'Не удалось отправить письмо повторно.');
      return;
    }

    setMessage('success', data.message || 'Если аккаунт существует, письмо с подтверждением отправлено.');
  } catch {
    setMessage('error', 'Ошибка сети. Попробуйте позже.');
  } finally {
    resendBtn.disabled = false;
    resendBtn.textContent = 'Отправить письмо повторно';
  }
}

resendBtn.addEventListener('click', resendVerification);
verifyEmail();
