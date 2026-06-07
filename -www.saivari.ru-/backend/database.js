const { Pool } = require('pg');

// Пул соединений с PostgreSQL
// Pool — это набор готовых соединений, не создаём новое на каждый запрос
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'saivari',
  user:     process.env.DB_USER     || 'saivari_user',
  password: process.env.DB_PASS,

  // Настройки пула
  max:              10,   // максимум 10 одновременных соединений
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Проверяем соединение при старте
pool.connect((err, client, release) => {
  if (err) {
    console.error('✗ Ошибка подключения к PostgreSQL:', err.message);
    console.error('  Проверь настройки в .env (DB_HOST, DB_USER, DB_PASS)');
  } else {
    console.log('✓ PostgreSQL подключён успешно');
    release(); // возвращаем соединение в пул
  }
});

// Инициализация таблиц
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id          SERIAL PRIMARY KEY,
        name        TEXT        NOT NULL,
        contact     TEXT        NOT NULL,
        service     TEXT,
        message     TEXT,
        status      TEXT        NOT NULL DEFAULT 'new',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          SERIAL PRIMARY KEY,
        author      TEXT        NOT NULL,
        rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
        body        TEXT        NOT NULL,
        approved    BOOLEAN     NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log('✓ Таблицы orders и reviews готовы');
  } catch (err) {
    console.error('✗ Ошибка создания таблиц:', err.message);
  } finally {
    client.release();
  }
}

// Удобная функция для запросов
// Вместо pool.query везде — просто query(sql, params)
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

module.exports = { pool, query, initDB };