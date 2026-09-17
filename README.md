# Zupazupazuu — Toko Panel

Admin backend for the Zupazupazuu Gold Jewelery storefront. Lets store staff:

1. Bulk-upload the crystal beads catalog from an Excel file
2. Bulk-upload the 24K charm catalog from an Excel file
3. Log orders that come in over WhatsApp and confirm payment
4. Confirm shipping with courier + tracking number

It's a single Node.js service: an Express API backed by PostgreSQL, serving a
built React (Vite) frontend as static files. One service, one database —
which keeps it simple to run on Railway.

## Project layout

```
.
├── server/            Express API + Postgres access
│   ├── index.js       entry point (serves API + built client)
│   ├── db.js          Postgres pool + migration runner
│   ├── migrations/    SQL run automatically on boot
│   └── routes/        beads, charms, orders
├── client/            Vite + React frontend
│   └── src/App.jsx    the panel UI
├── railway.json       explicit build/start commands for Railway
└── package.json       root scripts (build client, start server)
```

## Local development

You'll need Node 18+ and a local Postgres.

```bash
# 1. install everything
npm install
npm run install:client

# 2. configure environment
cp .env.example .env
# edit .env if your local Postgres uses different credentials

# 3. run the API and the Vite dev server in two terminals
npm run dev:server     # http://localhost:3000  (API)
npm run dev:client     # http://localhost:5173  (UI, proxies /api to :3000)
```

Open http://localhost:5173 while developing — Vite proxies `/api/*` calls to
the Express server automatically (see `client/vite.config.js`).

To run it the same way it runs in production (one service, no proxy):

```bash
npm run build   # builds client into client/dist
npm start       # Express serves client/dist AND /api/*, on $PORT (default 3000)
```

## Deploying with GitHub + Railway

### 1. Push this project to GitHub

```bash
git init
git add .
git commit -m "Initial commit: toko panel"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first, under github.com/new — don't
initialize it with a README so the push above doesn't conflict.)

### 2. Create the Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project → Deploy from GitHub repo**, pick the repo you just pushed.
3. Railway detects Node automatically via `railway.json` / Nixpacks. You
   don't need to touch build settings — it will run `npm install && npm run
   build` to build, then `npm start` to run.

### 3. Add PostgreSQL

1. In the same Railway project, **New → Database → Add PostgreSQL**.
2. Railway automatically injects a `DATABASE_URL` variable into every other
   service in the project — including the one you just deployed. You don't
   need to copy/paste it manually.
3. Railway's own internal Postgres does not require SSL, so leave `PGSSL`
   unset (it defaults to `false` in `server/db.js`). If you ever point this
   at an external managed Postgres that requires SSL, set `PGSSL=true` in
   that service's Variables tab.

### 4. First boot

On first boot, `server/index.js` runs `server/migrations/001_init.sql`
automatically (it's just `CREATE TABLE IF NOT EXISTS`, so it's always safe to
re-run). You don't need a separate migration step — check the deploy logs
for `Toko Panel server listening on port ...` to confirm it's up.

Railway gives you a public URL under the service's **Settings → Networking**
tab (or attach your own domain there).

### 5. Redeploying after changes

Just push to `main` — Railway auto-deploys on every push once the GitHub
connection is set up. No manual redeploy step needed.

## Excel template format

Use **Unduh Template** in each catalog tab to get a starter file with the
exact headers expected. Column matching is a little flexible (it looks for
these substrings in your header row, case-insensitive), so close variations
still work:

**Beads:**
| Column | Matches headers containing | Required |
|---|---|---|
| Name (English) | `nama (en)`, `name (en)`, `english`, `(en)` | one of the two names |
| Name (Indonesian) | `nama (id)`, `name (id)`, `indonesia`, `(id)` | one of the two names |
| Color | `warna`, `color` — a 6-digit hex code, with or without `#` | optional (defaults to a neutral gold) |
| Price | `harga`, `price` — plain number, in Rupiah | yes |

**Charms:** same as above, minus the color column.

Rows that fail validation are skipped and listed in the preview before you
confirm the import — nothing bad gets written to the catalog silently.

## A note on the order workflow

The storefront itself doesn't submit orders anywhere — the "Reserve"
flow just opens WhatsApp. So this panel assumes staff log each order
manually as it comes in over chat (**Konfirmasi Pembayaran → Tambah
Pesanan**), then move it through payment confirmation and shipping
confirmation from there. If you later want the storefront to create orders
automatically, point its checkout at `POST /api/orders` with
`{ customerName, phone, itemSummary, total }`.
