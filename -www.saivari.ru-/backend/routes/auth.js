const express = require('express');
const router = express.Router();
const { query } = require('../database');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = process.env.AUTH_SALT || 'saivari_salt_2024';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Укажите имя' });
  if (!email?.trim()) return res.status(400).json({ error: 'Укажите email' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

    const result = await query(
      'INSERT INTO users (name, email, password_hash, phone) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone, role',
      [name.trim(), email.toLowerCase().trim(), hashPassword(password), phone?.trim() || null]
    );
    const user = result.rows[0];
    const token = generateToken();
    await query('INSERT INTO sessions (user_id, token) VALUES ($1,$2)', [user.id, token]);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!result.rows.length) return res.status(401).json({ error: 'Неверный email или пароль' });

    const user = result.rows[0];
    if (user.password_hash !== hashPassword(password)) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = generateToken();
    await query('INSERT INTO sessions (user_id, token) VALUES ($1,$2)', [user.id, token]);
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await query('DELETE FROM sessions WHERE token = $1', [token]).catch(() => {});
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const result = await query(
      'SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1',
      [token]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Сессия недействительна' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;