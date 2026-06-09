const express = require('express');
const router = express.Router();
const { query } = require('../database');
const nodemailer = require('nodemailer');

async function getUser(token) {
  if (!token) return null;
  const r = await query(
    'SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1 AND s.expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}

function validateName(val) {
  return /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s\-]{1,49}$/.test(String(val || '').trim());
}

function validateContact(val) {
  const v = String(val || '').trim();
  const phone = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/.test(v);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  return phone || email;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// POST /api/orders
router.post('/', async (req, res) => {
  const { name, contact, service, message } = req.body;

  const nameValue = String(name || '').trim();
  const contactValue = String(contact || '').trim();
  const serviceValue = String(service || '').trim();
  const messageValue = String(message || '').trim();

  if (!validateName(nameValue)) {
    return res.status(400).json({ error: 'Введите корректное имя' });
  }

  if (!validateContact(contactValue)) {
    return res.status(400).json({ error: 'Введите корректный телефон или email' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  try {
    const result = await query(
      'INSERT INTO orders (name, contact, service, message, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [
        nameValue,
        contactValue,
        serviceValue || null,
        messageValue || null,
        user?.id || null
      ]
    );

    const order = result.rows[0];

    sendEmailNotification(
      order.id,
      nameValue,
      contactValue,
      serviceValue,
      messageValue
    ).catch(e => console.error('Email:', e.message));

    res.status(201).json({
      success: true,
      message: 'Заявка принята! Мы свяжемся с вами.',
      id: order.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера.' });
  }
});

// GET /api/orders — только admin
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    const result = await query(`
      SELECT o.*, u.name AS user_name, u.email AS user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/my — заявки текущего пользователя
router.get('/my', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const result = await query(
      'SELECT id, name, contact, service, message, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );

    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id — только admin
router.patch('/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  const { status } = req.body;

  if (!['new', 'inprogress', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  try {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function sendEmailNotification(id, name, contact, service, message) {
  if (!process.env.EMAIL_PASS || !process.env.EMAIL_FROM) return;

  const safeName    = escapeHtml(name);
  const safeContact = escapeHtml(contact);
  const safeService = escapeHtml(service || '—');
  const safeMessage = escapeHtml(message || '—');

  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"СайВари сайт" <${process.env.EMAIL_FROM}>`,
    to: process.env.EMAIL_TO || process.env.EMAIL_FROM,
    replyTo: contact.includes('@') ? contact : process.env.EMAIL_FROM,
    subject: `Заявка #${id} от ${name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;padding:20px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#01696f">Заявка #${id}</h2>
        <p><b>Имя:</b> ${safeName}</p>
        <p><b>Контакт:</b> ${safeContact}</p>
        <p><b>Услуга:</b> ${safeService}</p>
        <p><b>Сообщение:</b> ${safeMessage}</p>
      </div>
    `,
  });
}

module.exports = router;