const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

function rowToCharm(r) {
  return { id: r.id, nameEn: r.name_en, nameId: r.name_id, price: r.price };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM charms ORDER BY created_at ASC');
  res.json(rows.map(rowToCharm));
});

// body: { mode: 'append' | 'replace', items: [{ nameEn, nameId, price }] }
router.post('/bulk', async (req, res) => {
  const { mode, items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (mode === 'replace') {
      await client.query('DELETE FROM charms');
    }
    for (const it of items) {
      const id = crypto.randomUUID();
      await client.query(
        'INSERT INTO charms (id, name_en, name_id, price) VALUES ($1,$2,$3,$4)',
        [id, it.nameEn, it.nameId, Math.round(Number(it.price) || 0)]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM charms ORDER BY created_at ASC');
    res.json(rows.map(rowToCharm));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM charms WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
