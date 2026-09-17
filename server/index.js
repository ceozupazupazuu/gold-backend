require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { runMigrations } = require('./db');

const beadsRoutes = require('./routes/beads');
const charmsRoutes = require('./routes/charms');
const ordersRoutes = require('./routes/orders');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/beads', beadsRoutes);
app.use('/api/charms', charmsRoutes);
app.use('/api/orders', ordersRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the built React app in production (client/dist, produced by `npm run build`).
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`Toko Panel server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to run migrations:', err);
    process.exit(1);
  });
