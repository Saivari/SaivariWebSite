const express = require('express');
const router = express.Router();
const { query } = require('../database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateName(val) {
  return /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(String(val || '').trim());
}

function validateEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val || '').trim().toLowerCase());
}

function validatePhone(val) {
  if (!val || !String(val).trim()) return true;
  return /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(String(val).trim());
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  const nameValue = String(name || '').trim();
  const emailValue = String(email || '').trim().toLowerCase();
  const phoneValue = String(phone || '').trim();

  if (!validateName(nameValue)) {
    return res.status(400).json({ error: 'Введите корректное имя' });
  }

  if (!validateEmail(emailValue)) {
    return res.status(400).json({ error: 'Введите корректный email' });
  }

  if (!validatePhone(phoneValue)) {
    return res.status(400).json({ error: 'Введите корректный номер телефона' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  }

  try {
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [emailValue]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      'INSERT INTO users (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, role',
      [nameValue, emailValue, passwordHash, phoneValue || null]
    );

    const user = result.rows[0];
    const token = generateToken();

    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, token]
    );

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const emailValue = String(email || '').trim().toLowerCase();

  if (!validateEmail(emailValue) || !password) {
    return res.status(400).json({ error: 'Введите корректный email и пароль' });
  }

  try {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [emailValue]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const valid = await checkPassword(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = generateToken();

    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, token]
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    await query('DELETE FROM sessions WHERE token = $1', [token]).catch(() => {});
  }

  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Сессия недействительна или истекла' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('me:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { name, phone, password } = req.body;

  const nameValue = String(name || '').trim();
  const phoneValue = String(phone || '').trim();

  if (!validateName(nameValue)) {
    return res.status(400).json({ error: 'Введите корректное имя' });
  }

  if (!validatePhone(phoneValue)) {
    return res.status(400).json({ error: 'Введите корректный номер телефона' });
  }

  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
  }

  try {
    const session = await query(
      'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!session.rows.length) {
      return res.status(401).json({ error: 'Сессия недействительна или истекла' });
    }

    const userId = session.rows[0].user_id;
    const updates = ['name = $1', 'phone = $2'];
    const values = [nameValue, phoneValue || null];

    if (password) {
      updates.push(`password_hash = $${updates.length + 1}`);
      values.push(await hashPassword(password));
    }

    values.push(userId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`,
      values
    );

    res.json({ success: true });
  } catch (err) {
    console.error('profile:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Введите корректный email' });
  }

  try {
    const result = await query('SELECT id FROM users WHERE email = $1', [email]);

    // Всегда отвечаем одинаково — чтобы нельзя было проверить существование email
    if (!result.rows.length) {
      return res.json({ success: true, message: 'Если email зарегистрирован, письмо отправлено.' });
    }

    const userId = result.rows[0].id;
    const token = generateToken();

    // Удаляем старые токены этого пользователя
    await query('DELETE FROM password_resets WHERE user_id = $1', [userId]);

    // Сохраняем новый токен
    await query(
      'INSERT INTO password_resets (user_id, token) VALUES ($1, $2)',
      [userId, token]
    );

    const resetLink = `https://saivari.ru/reset-password.html?token=${token}`;

    // Отправляем письмо через Resend SMTP
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 2465,
      secure: true,
      auth: { user: 'resend', pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"СайВари" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Сброс пароля — СайВари',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;border:1px solid #eee;border-radius:8px">
          <h2 style="color:#01696f">Сброс пароля</h2>
          <p>Вы запросили сброс пароля на сайте saivari.ru.</p>
          <p>Нажмите кнопку ниже — ссылка действует <b>1 час</b>:</p>
          <a href="${resetLink}"
             style="display:inline-block;margin:16px 0;padding:12px 24px;background:#01696f;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
            Сбросить пароль
          </a>
          <p style="color:#999;font-size:13px">Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>
        </div>
      `,
    });

    res.json({ success: true, message: 'Если email зарегистрирован, письмо отправлено.' });
  } catch (err) {
    console.error('forgot-password:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token) return res.status(400).json({ error: 'Токен отсутствует' });
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  }

  try {
    const result = await query(
      'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Ссылка недействительна или истекла' });
    }

    const userId = result.rows[0].user_id;
    const passwordHash = await hashPassword(password);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
    // Инвалидируем все сессии — заставляем перелогиниться
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    res.json({ success: true, message: 'Пароль успешно изменён. Войдите с новым паролем.' });
  } catch (err) {
    console.error('reset-password:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;