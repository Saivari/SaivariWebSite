require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { initDB }     = require('./database');
const ordersRouter   = require('./routes/orders');
const reviewsRouter  = require('./routes/reviews');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:5500',
    'http://127.0.0.1:5500',   // ← Live Server
    'https://saivari.ru',
  ],
  methods: ['GET', 'POST', 'PATCH'],
}));

app.use(express.json());

// Статика — твой сайт
app.use(express.static(path.join(__dirname, '../frontend')));

// API маршруты
app.use('/api/orders',  ordersRouter);
app.use('/api/reviews', reviewsRouter);

// Проверка работоспособности
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Всё остальное → index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Сначала инициализируем БД, потом запускаем сервер
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Сервер: http://localhost:${PORT}`);
    console.log(`📋 Заявки: http://localhost:${PORT}/api/orders`);
    console.log(`⭐ Отзывы: http://localhost:${PORT}/api/reviews`);
    console.log(`❤️  Статус: http://localhost:${PORT}/api/health\n`);
  });
});