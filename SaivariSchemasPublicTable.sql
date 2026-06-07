CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  contact     TEXT        NOT NULL,
  service     TEXT,
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  author      TEXT        NOT NULL,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT        NOT NULL,
  approved    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);