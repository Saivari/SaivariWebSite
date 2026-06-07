const express    = require('express');
const router     = express.Router();
const { query }  = require('../database');
const nodemailer = require('nodemailer');

// -------------------------------------------------------
// POST /api/orders — принять новую заявку
// -------------------------------------------------------
router.post('/', async (req, res) => {
  const { name, contact, service, message } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите имя' });
  }
  if (!contact || !contact.trim()) {
    return res.status(400).json({ error: 'Укажите контакт' });
  }

  try {
    const result = await query(
      `INSERT INTO orders (name, contact, service, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [
        name.trim(),
        contact.trim(),
        (service || '').trim() || null,
        (message || '').trim() || null,
      ]
    );

    const order = result.rows[0];
    console.log(`✓ Новая заявка #${order.id} от ${name.trim()}`);

    // Email — отправляем асинхронно, не задерживаем ответ
     sendEmailNotification(order.id, name.trim(), contact.trim(), service, message)
      .catch(e => {
        console.error('Email ошибка:', e.message);
        console.error('Email детали:', e);
      });

    return res.status(201).json({
      success: true,
      message: 'Заявка принята',
      id: order.id,
    });

  } catch (err) {
    console.error('Ошибка БД (orders POST):', err.message);
    return res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже.' });
  }
});

// -------------------------------------------------------
// GET /api/orders — список заявок
// -------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// PATCH /api/orders/:id — сменить статус заявки
// -------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'in_progress', 'done', 'cancelled'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  try {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id',
      [status, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// Email уведомление
// -------------------------------------------------------
async function sendEmailNotification(id, name, contact, service, message) {
  if (!process.env.EMAIL_FROM || !process.env.EMAIL_PASS) {
    console.log('⚠ Email не настроен — пропускаю уведомление');
    return;
  }

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 2465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.EMAIL_PASS,
  },
});

  await transporter.sendMail({
    from:    `"СайВари" <${process.env.EMAIL_FROM}>`,
    to:      process.env.EMAIL_TO || process.env.EMAIL_FROM,
    subject: `[СайВари] Новая заявка #${id} от ${name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;padding:20px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#01696f;margin:0 0 16px">📋 Новая заявка #${id}</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="padding:10px 14px;background:#f5f5f5;border:1px solid #ddd;font-weight:bold;width:120px">Имя</td>
            <td style="padding:10px 14px;border:1px solid #ddd">${name}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f5f5f5;border:1px solid #ddd;font-weight:bold">Контакт</td>
            <td style="padding:10px 14px;border:1px solid #ddd">${contact}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f5f5f5;border:1px solid #ddd;font-weight:bold">Услуга</td>
            <td style="padding:10px 14px;border:1px solid #ddd">${service || '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f5f5f5;border:1px solid #ddd;font-weight:bold">Сообщение</td>
            <td style="padding:10px 14px;border:1px solid #ddd">${message || '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#f5f5f5;border:1px solid #ddd;font-weight:bold">Время</td>
            <td style="padding:10px 14px;border:1px solid #ddd">${new Date().toLocaleString('ru-RU')}</td>
          </tr>
        </table>
        <p style="margin-top:16px;color:#999;font-size:12px">Письмо отправлено автоматически с сайта saivari.ru</p>
      </div>
    `,
  });

  console.log(`✓ Email отправлен о заявке #${id}`);
}

module.exports = router;
