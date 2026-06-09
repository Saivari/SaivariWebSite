/* ============================================================
   RESET-PASSWORD.JS — страница сброса пароля
   Читает ?token= из URL, отправляет новый пароль на /api/auth/reset-password
   После успеха — редирект на /login.html (не /lk.html)
   ============================================================ */

const token = new URLSearchParams(window.location.search).get('token');

const formSection = document.getElementById('form-section');
const form = document.getElementById('reset-password-form');
const passwordInput = document.getElementById('password');
const password2Input = document.getElementById('password2');
const passwordError = document.getElementById('password-error');
const password2Error = document.getElementById('password2-error');

const msg = document.getElementById('msg');
const successBox = document.getElementById('success-box');
const successMsg = document.getElementById('success-msg');
const countdownEl = document.getElementById('countdown');
const resetButton = document.getElementById('reset-password-btn');
const resetButtonText = resetButton ? resetButton.querySelector('.btn-text') : null;

let isSubmitting = false;

if (!token) {
  if (formSection) formSection.style.display = 'none';
  showMessage('error', 'Ссылка недействительна. Запросите сброс пароля повторно.');
}

if (form) form.addEventListener('submit', handleSubmit);

passwordInput?.addEventListener('input', () => clearFieldError(passwordInput, passwordError));
password2Input?.addEventListener('input', () => clearFieldError(password2Input, password2Error));

function showMessage(type, text) {
  msg.className = `msg ${type} show`;
  msg.textContent = text;
}

function clearMessage() {
  msg.className = 'msg';
  msg.textContent = '';
}

function showFieldError(input, errorElement, text) {
  if (!input || !errorElement) return;
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  errorElement.textContent = text;
}

function clearFieldError(input, errorElement) {
  if (!input || !errorElement) return;
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
  errorElement.textContent = '';
}

function clearAllFieldErrors() {
  clearFieldError(passwordInput, passwordError);
  clearFieldError(password2Input, password2Error);
}

function setSubmittingState(state) {
  isSubmitting = state;
  if (!resetButton) return;
  resetButton.disabled = state;
  resetButton.classList.toggle('is-loading', state);
  if (resetButtonText) {
    resetButtonText.textContent = state ? 'Сохраняем...' : 'Сохранить пароль';
  }
}

function validateForm() {
  clearAllFieldErrors();
  clearMessage();

  const password = passwordInput.value.trim();
  const password2 = password2Input.value.trim();
  let isValid = true;

  if (password.length < 6) {
    showFieldError(passwordInput, passwordError, 'Пароль должен быть минимум 6 символов.');
    isValid = false;
  }

  if (!password2) {
    showFieldError(password2Input, password2Error, 'Повторите новый пароль.');
    isValid = false;
  } else if (password !== password2) {
    showFieldError(password2Input, password2Error, 'Пароли не совпадают.');
    isValid = false;
  }

  if (!isValid) {
    const firstInvalid = document.querySelector('.form-input.is-invalid');
    firstInvalid?.focus();
  }

  return isValid;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting || !token) return;
  if (!validateForm()) return;

  setSubmittingState(true);

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: passwordInput.value.trim()
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage('error', data.error || 'Ошибка. Попробуйте снова.');
      setSubmittingState(false);
      return;
    }

    formSection.style.display = 'none';
    clearMessage();
    successBox.classList.add('show');
    successMsg.textContent = data.message || 'Пароль успешно изменён.';

    // Редирект на страницу ВХОДА (не в ЛК — пользователь ещё не авторизован)
    let seconds = 3;
    countdownEl.textContent = seconds;

    const timer = setInterval(() => {
      seconds -= 1;
      countdownEl.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(timer);
        window.location.href = '/login.html';
      }
    }, 1000);
  } catch {
    showMessage('error', 'Ошибка сети. Попробуйте позже.');
    setSubmittingState(false);
  }
}
