const express = require('express');
const router = express.Router();
const { query } = require('../database');

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  const result = await query(
    'SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1',
    [token]
  );
  if (!result.rows.length) return res.status(401).json({ error: 'Сессия недействительна' });
  req.user = result.rows[0];
  next();
}

// GET /api/chat/:orderId
router.get('/:orderId', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  try {
    if (req.user.role !== 'admin') {
      const check = await query('SELECT id FROM orders WHERE id=$1 AND user_id=$2', [orderId, req.user.id]);
      if (!check.rows.length) return res.status(403).json({ error: 'Нет доступа' });
    }
    const result = await query(
      `SELECT cm.id, cm.message, cm.created_at, u.name AS sender_name, u.role AS sender_role
       FROM chat_messages cm JOIN users u ON cm.user_id = u.id
       WHERE cm.order_id = $1 ORDER BY cm.created_at ASC`,
      [orderId]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/:orderId
router.post('/:orderId', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Пустое сообщение' });

  try {
    if (req.user.role !== 'admin') {
      const check = await query('SELECT id FROM orders WHERE id=$1 AND user_id=$2', [orderId, req.user.id]);
      if (!check.rows.length) return res.status(403).json({ error: 'Нет доступа' });
    }
    const result = await query(
      'INSERT INTO chat_messages (order_id, user_id, message) VALUES ($1,$2,$3) RETURNING id, message, created_at',
      [orderId, req.user.id, message.trim()]
    );
    res.status(201).json({ success: true, msg: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;