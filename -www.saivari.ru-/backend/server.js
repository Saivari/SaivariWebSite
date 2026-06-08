require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./database');
const ordersRouter = require('./routes/orders');
const reviewsRouter = require('./routes/reviews');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа или регистрации. Попробуйте позже.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
});

app.use(helmet());

app.use(cors({
  origin: ['http://localhost', 'http://127.0.0.1', 'http://localhost:5500', 'http://127.0.0.1:5500', 'https://saivari.ru'],
  methods: ['GET','POST','PATCH','DELETE'],
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/chat', chatRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер: http://localhost:${PORT}`);
    console.log(`ЛК пользователя: http://localhost:${PORT}/lk.html`);
    console.log(`ЛК администратора: http://localhost:${PORT}/admin.html`);
  });
});