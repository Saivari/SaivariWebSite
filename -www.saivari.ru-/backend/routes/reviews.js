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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseReviewId(id) {
  const reviewId = parseInt(id, 10);
  return Number.isInteger(reviewId) && reviewId > 0 ? reviewId : null;
}

// GET /api/reviews — публичные одобренные отзывы
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, author, rating, body, created_at FROM reviews WHERE approved = true ORDER BY created_at DESC'
    );

    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — только авторизованным
router.post('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user) {
    return res.status(401).json({ error: 'Для оставления отзыва необходимо войти в аккаунт' });
  }

  const { author, rating, body } = req.body;

  const authorValue = String(author || '').trim();
  const bodyValue = String(body || '').trim();
  const ratingValue = parseInt(rating, 10);

  if (!validateName(authorValue)) {
    return res.status(400).json({ error: 'Имя должно содержать только буквы (минимум 2 символа)' });
  }

  if (!bodyValue) {
    return res.status(400).json({ error: 'Напишите текст отзыва' });
  }

  if (bodyValue.length < 10) {
    return res.status(400).json({ error: 'Отзыв слишком короткий (минимум 10 символов)' });
  }

  if (bodyValue.length > 1000) {
    return res.status(400).json({ error: 'Отзыв слишком длинный (максимум 1000 символов)' });
  }

  if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
    return res.status(400).json({ error: 'Оценка от 1 до 5' });
  }

  try {
    const result = await query(
      'INSERT INTO reviews (author, rating, body, user_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [authorValue, ratingValue, bodyValue, user.id]
    );

    const id = result.rows[0].id;

    console.log(`Отзыв #${id} от ${authorValue} — ожидает модерации`);

    sendReviewEmail(id, authorValue, ratingValue, bodyValue)
      .catch(e => console.error('Email отзыв:', e.message));

    res.status(201).json({
      success: true,
      message: 'Отзыв отправлен и ожидает проверки администратором.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reviews/:id/approve — только admin
router.patch('/:id/approve', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  const reviewId = parseReviewId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ error: 'Некорректный ID отзыва' });
  }

  try {
    const result = await query(
      'UPDATE reviews SET approved = true WHERE id = $1 RETURNING id',
      [reviewId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reviews/:id/reject — только admin
router.patch('/:id/reject', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  const reviewId = parseReviewId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ error: 'Некорректный ID отзыва' });
  }

  try {
    const result = await query(
      'DELETE FROM reviews WHERE id = $1 RETURNING id',
      [reviewId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/all — все отзывы для admin
router.get('/all', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    const result = await query(
      'SELECT * FROM reviews ORDER BY created_at DESC'
    );

    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/my — мои отзывы
router.get('/my', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await getUser(token).catch(() => null);

  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const result = await query(
      'SELECT id, author, rating, body, approved, created_at FROM reviews WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );

    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function sendReviewEmail(id, author, rating, body) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return;

  const safeAuthor = escapeHtml(author);
  const safeBody = escapeHtml(body);
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"СайВари сайт" <${process.env.GMAIL_USER}>`,
    to: 'saivari.electronics@gmail.com',
    replyTo: process.env.GMAIL_USER,
    subject: `Новый отзыв #${id} — ${author} (${stars})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;padding:20px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#01696f">Новый отзыв #${id}</h2>
        <p><b>Автор:</b> ${safeAuthor}</p>
        <p><b>Оценка:</b> ${stars}</p>
        <p><b>Текст:</b> ${safeBody}</p>
        <p style="color:#999;font-size:12px">Отзыв ожидает модерации в админ-панели.</p>
      </div>
    `,
  });
}

module.exports = router;