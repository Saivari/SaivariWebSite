const express   = require('express');
const router    = express.Router();
const { query } = require('../database');

// GET /api/reviews — одобренные отзывы (для сайта)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, author, rating, body, created_at
       FROM reviews
       WHERE approved = true
       ORDER BY created_at DESC`
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — добавить отзыв (ждёт одобрения)
router.post('/', async (req, res) => {
  const { author, rating, body } = req.body;

  if (!author || !author.trim()) {
    return res.status(400).json({ error: 'Укажите имя' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Напишите текст отзыва' });
  }
  const r = parseInt(rating);
  if (!r || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
  }

  try {
    const result = await query(
      `INSERT INTO reviews (author, rating, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [author.trim(), r, body.trim()]
    );

    console.log(`✓ Новый отзыв #${result.rows[0].id} от ${author.trim()} (ожидает одобрения)`);

    res.status(201).json({
      success: true,
      message: 'Отзыв отправлен на модерацию',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reviews/:id/approve — одобрить отзыв (ты сам)
router.patch('/:id/approve', async (req, res) => {
  try {
    const result = await query(
      'UPDATE reviews SET approved = true WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/all — все отзывы включая неодобренные
router.get('/all', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM reviews ORDER BY created_at DESC'
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;