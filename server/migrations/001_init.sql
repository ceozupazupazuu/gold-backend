CREATE TABLE IF NOT EXISTS beads (
  id          TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_id     TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#B08A3E',
  price       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charms (
  id          TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_id     TEXT NOT NULL,
  price       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL DEFAULT '',
  item_summary     TEXT NOT NULL DEFAULT '',
  total            INTEGER NOT NULL DEFAULT 0,
  payment_status   TEXT NOT NULL DEFAULT 'pending',
  payment_method   TEXT,
  payment_note     TEXT,
  paid_at          TIMESTAMPTZ,
  shipping_status  TEXT NOT NULL DEFAULT 'not_shipped',
  courier          TEXT,
  tracking         TEXT,
  shipped_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
