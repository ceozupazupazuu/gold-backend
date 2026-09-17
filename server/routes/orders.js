const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

function rowToOrder(r) {
  return {
    id: r.id,
    customerName: r.customer_name,
    phone: r.phone,
    itemSummary: r.item_summary,
    total: r.total,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method,
    paymentNote: r.payment_note,
    paidAt: r.paid_at ? new Date(r.paid_at).getTime() : null,
    shippingStatus: r.shipping_status,
    courier: r.courier,
    tracking: r.tracking,
    shippedAt: r.shipped_at ? new Date(r.shipped_at).getTime() : null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(rows.map(rowToOrder));
});

// body: { customerName, phone, itemSummary, total }
router.post('/', async (req, res) => {
  const { customerName, phone, itemSummary, total } = req.body;
  if (!customerName || !total) return res.status(400).json({ error: 'customerName and total are required' });

  const id = crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO orders (id, customer_name, phone, item_summary, total)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, customerName, phone || '', itemSummary || '', Math.round(Number(total) || 0)]
  );
  res.status(201).json(rowToOrder(rows[0]));
});

// body: { method, note }
router.patch('/:id/payment', async (req, res) => {
  const { method, note } = req.body;
  const { rows } = await pool.query(
    `UPDATE orders SET payment_status = 'paid', payment_method = $1, payment_note = $2, paid_at = now()
     WHERE id = $3 RETURNING *`,
    [method || null, note || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'order not found' });
  res.json(rowToOrder(rows[0]));
});

// body: { courier, tracking }
router.patch('/:id/shipping', async (req, res) => {
  const { courier, tracking } = req.body;
  if (!tracking) return res.status(400).json({ error: 'tracking is required' });
  const { rows } = await pool.query(
    `UPDATE orders SET shipping_status = 'shipped', courier = $1, tracking = $2, shipped_at = now()
     WHERE id = $3 RETURNING *`,
    [courier || null, tracking, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'order not found' });
  res.json(rowToOrder(rows[0]));
});

module.exports = router;
