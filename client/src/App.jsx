import { useState, useEffect, useRef, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { api } from './api.js';
import {
  Gem, Sparkles, CreditCard, Truck, Upload, Download, Trash2, Plus, X,
  Loader2, CheckCircle2, Clock, PackageCheck, AlertCircle, ChevronRight,
} from 'lucide-react';

/* ---------- brand tokens ---------- */
const C = {
  wine: '#3E0F1D',
  wineLight: '#5A1B2E',
  wineMist: '#F3E7E9',
  gold: '#B08A3E',
  goldDim: '#8C6F35',
  goldLight: '#D8BD82',
  cream: '#FBF6EC',
  paper: '#FFFFFF',
  ink: '#2A1418',
  sub: '#8A6B71',
  line: 'rgba(176,138,62,0.28)',
  paid: '#3F6B4F',
  paidBg: '#E9F1EA',
  pending: '#9C6B2E',
  pendingBg: '#F6EEDE',
  shipped: '#3E0F1D',
  shippedBg: '#F3E7E9',
  danger: '#8C2E2E',
  dangerBg: '#F6E7E7',
};

function formatRp(n) {
  const num = Number(n) || 0;
  return 'Rp' + num.toLocaleString('id-ID');
}

function slugify(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
}

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

/* ---------- excel field matching ---------- */
const FIELD_KEYWORDS = {
  nameEn: ['nama (en)', 'name (en)', 'english', '(en)'],
  nameId: ['nama (id)', 'name (id)', 'indonesia', '(id)'],
  color: ['warna', 'color'],
  price: ['harga', 'price'],
};

function findField(row, field) {
  const keys = Object.keys(row);
  for (const kw of FIELD_KEYWORDS[field]) {
    const match = keys.find((k) => k.toLowerCase().includes(kw));
    if (match) return row[match];
  }
  return '';
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseRows(rows, kind) {
  return rows.map((row, i) => {
    const nameEn = String(findField(row, 'nameEn') || '').trim();
    const nameId = String(findField(row, 'nameId') || '').trim();
    const priceRaw = findField(row, 'price');
    const priceNum = Number(String(priceRaw).replace(/[^0-9.]/g, ''));
    let color = kind === 'beads' ? String(findField(row, 'color') || '').trim() : undefined;

    const errors = [];
    if (!nameEn && !nameId) errors.push('Nama kosong');
    if (priceRaw === '' || isNaN(priceNum) || priceNum <= 0) errors.push('Harga tidak valid');
    if (kind === 'beads') {
      const hex = color.replace('#', '');
      if (color && !/^[0-9a-fA-F]{6}$/.test(hex)) {
        errors.push('Warna harus kode hex 6 digit, mis. B08A3E');
      } else {
        color = hex ? '#' + hex : '#B08A3E';
      }
    }

    return {
      rowNumber: i + 2,
      id: uid(kind === 'beads' ? 'bd' : 'cm'),
      nameEn: nameEn || nameId,
      nameId: nameId || nameEn,
      price: isNaN(priceNum) ? 0 : Math.round(priceNum),
      color: kind === 'beads' ? color : undefined,
      errors,
    };
  });
}

function downloadTemplate(kind) {
  const headers = kind === 'beads'
    ? ['Nama (EN)', 'Nama (ID)', 'Warna (Hex)', 'Harga (Rp)']
    : ['Nama (EN)', 'Nama (ID)', 'Harga (Rp)'];
  const sample = kind === 'beads'
    ? ['Deep Garnet', 'Garnet Merah Tua', 'B08A3E', 38000]
    : ['Heart', 'Hati', 120000];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `template-${kind === 'beads' ? 'manik' : 'charm'}.xlsx`);
}

/* ---------- small ui bits ---------- */
function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-sm px-4 py-3 text-sm shadow-lg"
      style={{
        background: isError ? C.dangerBg : C.paidBg,
        color: isError ? C.danger : C.paid,
        border: `1px solid ${isError ? C.danger : C.paid}33`,
      }}
    >
      {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      {toast.message}
    </div>
  );
}

function StatusBadge({ tone, children }) {
  const map = {
    pending: { bg: C.pendingBg, fg: C.pending },
    paid: { bg: C.paidBg, fg: C.paid },
    shipped: { bg: C.shippedBg, fg: C.shipped },
  };
  const s = map[tone] || map.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-sm border py-16 text-center" style={{ borderColor: C.line }}>
      <Icon size={26} style={{ color: C.goldDim }} />
      <div className="font-medium" style={{ color: C.ink }}>{title}</div>
      <div className="max-w-xs text-sm" style={{ color: C.sub }}>{body}</div>
    </div>
  );
}

/* ---------- catalog section (beads / charms) ---------- */
function CatalogSection({ kind, items, onImport, onDelete }) {
  const [preview, setPreview] = useState(null); // { rows, fileName }
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const title = kind === 'beads' ? 'Katalog Manik-Manik Kristal' : 'Katalog Charm 24K';
  const Icon = kind === 'beads' ? Gem : Sparkles;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const rows = await readExcelFile(file);
      const parsed = parseRows(rows, kind);
      setPreview({ rows: parsed, fileName: file.name });
    } catch (err) {
      setPreview({ rows: [], fileName: file.name, readError: true });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const validRows = preview ? preview.rows.filter((r) => r.errors.length === 0) : [];
  const invalidCount = preview ? preview.rows.length - validRows.length : 0;

  function commit(mode) {
    const clean = validRows.map(({ rowNumber, errors, ...rest }) => rest);
    onImport(mode, clean);
    setPreview(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: C.wine }}>{title}</h2>
          <p className="mt-1 text-sm" style={{ color: C.sub }}>{items.length} item tersimpan di katalog saat ini</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => downloadTemplate(kind)}
            className="flex items-center gap-1.5 rounded-sm border px-3 py-2 text-sm transition-colors"
            style={{ borderColor: C.line, color: C.wine }}
          >
            <Download size={15} /> Unduh Template
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: C.wine }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Unggah Excel
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {preview && (
        <div className="mb-8 rounded-sm border p-4" style={{ borderColor: C.gold, background: C.wineMist }}>
          {preview.readError ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: C.danger }}>
              <AlertCircle size={16} /> Tidak bisa membaca "{preview.fileName}". Pastikan file berformat .xlsx atau .xls.
              <button onClick={() => setPreview(null)} className="ml-auto underline">Tutup</button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm" style={{ color: C.ink }}>
                  Pratinjau <span className="font-medium">{preview.fileName}</span> — {validRows.length} item valid
                  {invalidCount > 0 && <span style={{ color: C.danger }}> · {invalidCount} baris dilewati (error)</span>}
                </div>
                <button onClick={() => setPreview(null)} className="text-sm" style={{ color: C.sub }}>
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-64 overflow-auto rounded-sm border bg-white" style={{ borderColor: C.line }}>
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0" style={{ background: C.cream }}>
                    <tr style={{ color: C.sub }}>
                      <th className="px-3 py-2 font-normal">Baris</th>
                      <th className="px-3 py-2 font-normal">Nama (EN)</th>
                      <th className="px-3 py-2 font-normal">Nama (ID)</th>
                      {kind === 'beads' && <th className="px-3 py-2 font-normal">Warna</th>}
                      <th className="px-3 py-2 font-normal">Harga</th>
                      <th className="px-3 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t" style={{ borderColor: C.line, opacity: r.errors.length ? 0.55 : 1 }}>
                        <td className="px-3 py-2" style={{ color: C.sub }}>{r.rowNumber}</td>
                        <td className="px-3 py-2">{r.nameEn || '—'}</td>
                        <td className="px-3 py-2">{r.nameId || '—'}</td>
                        {kind === 'beads' && (
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block h-3 w-3 rounded-full border" style={{ background: r.color, borderColor: C.line }} />
                              {r.color}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2">{formatRp(r.price)}</td>
                        <td className="px-3 py-2">
                          {r.errors.length ? (
                            <span style={{ color: C.danger }}>{r.errors.join(', ')}</span>
                          ) : (
                            <span style={{ color: C.paid }}>Siap diimpor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  disabled={!validRows.length}
                  onClick={() => commit('append')}
                  className="rounded-sm border px-3 py-2 text-sm disabled:opacity-40"
                  style={{ borderColor: C.wine, color: C.wine }}
                >
                  Tambahkan ke Katalog
                </button>
                <button
                  disabled={!validRows.length}
                  onClick={() => commit('replace')}
                  className="rounded-sm px-3 py-2 text-sm text-white disabled:opacity-40"
                  style={{ background: C.wine }}
                >
                  Ganti Semua Katalog
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Icon}
          title="Katalog masih kosong"
          body={`Unduh template, isi datanya, lalu unggah untuk mengisi katalog ${kind === 'beads' ? 'manik-manik' : 'charm'}.`}
        />
      ) : (
        <div className="overflow-hidden rounded-sm border" style={{ borderColor: C.line }}>
          <table className="w-full text-left text-sm">
            <thead style={{ background: C.cream }}>
              <tr style={{ color: C.sub }}>
                <th className="px-4 py-3 font-normal">Nama (EN)</th>
                <th className="px-4 py-3 font-normal">Nama (ID)</th>
                {kind === 'beads' && <th className="px-4 py-3 font-normal">Warna</th>}
                <th className="px-4 py-3 font-normal">Harga</th>
                <th className="px-4 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t" style={{ borderColor: C.line }}>
                  <td className="px-4 py-3">{it.nameEn}</td>
                  <td className="px-4 py-3">{it.nameId}</td>
                  {kind === 'beads' && (
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-full border" style={{ background: it.color, borderColor: C.line }} />
                        {it.color}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">{formatRp(it.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onDelete(it.id)} style={{ color: C.sub }} className="hover:opacity-70">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- add order form ---------- */
function AddOrderForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [total, setTotal] = useState('');

  function submit() {
    if (!name.trim() || !total) return;
    onAdd({
      customerName: name.trim(),
      phone: phone.trim(),
      itemSummary: summary.trim(),
      total: Math.round(Number(total)) || 0,
    });
  }

  return (
    <div className="mb-6 rounded-sm border p-4" style={{ borderColor: C.gold, background: C.wineMist }}>
      <div className="mb-3 text-sm font-medium" style={{ color: C.wine }}>Catat Pesanan Baru</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs" style={{ color: C.sub }}>Nama Pelanggan</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-sm border px-3 py-2 text-sm" style={{ borderColor: C.line }} />
        </div>
        <div>
          <label className="mb-1 block text-xs" style={{ color: C.sub }}>No. WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-sm border px-3 py-2 text-sm" style={{ borderColor: C.line }} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs" style={{ color: C.sub }}>Ringkasan Pesanan</label>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="mis. Manik Garnet + Charm Hati" className="w-full rounded-sm border px-3 py-2 text-sm" style={{ borderColor: C.line }} />
        </div>
        <div>
          <label className="mb-1 block text-xs" style={{ color: C.sub }}>Total (Rp)</label>
          <input value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-sm border px-3 py-2 text-sm" style={{ borderColor: C.line }} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-sm border px-3 py-2 text-sm" style={{ borderColor: C.line, color: C.sub }}>Batal</button>
        <button onClick={submit} disabled={!name.trim() || !total} className="rounded-sm px-3 py-2 text-sm text-white disabled:opacity-40" style={{ background: C.wine }}>
          Simpan Pesanan
        </button>
      </div>
    </div>
  );
}

/* ---------- payment confirmation ---------- */
function PaymentSection({ orders, onAddOrder, onConfirmPayment }) {
  const [showForm, setShowForm] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [method, setMethod] = useState('Transfer Bank');
  const [note, setNote] = useState('');

  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);

  function submitConfirm(id) {
    onConfirmPayment(id, { method, note });
    setConfirmingId(null);
    setMethod('Transfer Bank');
    setNote('');
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: C.wine }}>Konfirmasi Pembayaran</h2>
          <p className="mt-1 text-sm" style={{ color: C.sub }}>Catat pesanan yang masuk lewat WhatsApp, lalu konfirmasi setelah pembayaran diterima.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 text-sm text-white"
          style={{ background: C.wine }}
        >
          <Plus size={15} /> Tambah Pesanan
        </button>
      </div>

      {showForm && <AddOrderForm onAdd={(o) => { onAddOrder(o); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {sorted.length === 0 ? (
        <EmptyState icon={CreditCard} title="Belum ada pesanan" body="Pesanan yang kamu catat akan muncul di sini untuk dikonfirmasi pembayarannya." />
      ) : (
        <div className="overflow-hidden rounded-sm border" style={{ borderColor: C.line }}>
          <table className="w-full text-left text-sm">
            <thead style={{ background: C.cream }}>
              <tr style={{ color: C.sub }}>
                <th className="px-4 py-3 font-normal">Pelanggan</th>
                <th className="px-4 py-3 font-normal">Pesanan</th>
                <th className="px-4 py-3 font-normal">Total</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-t align-top" style={{ borderColor: C.line }}>
                    <td className="px-4 py-3">
                      <div>{o.customerName}</div>
                      <div className="text-xs" style={{ color: C.sub }}>{o.phone}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: C.sub }}>{o.itemSummary || '—'}</td>
                    <td className="px-4 py-3">{formatRp(o.total)}</td>
                    <td className="px-4 py-3">
                      {o.paymentStatus === 'paid' ? (
                        <StatusBadge tone="paid"><CheckCircle2 size={13} /> Lunas</StatusBadge>
                      ) : (
                        <StatusBadge tone="pending"><Clock size={13} /> Menunggu</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => setConfirmingId(confirmingId === o.id ? null : o.id)}
                          className="rounded-sm border px-2.5 py-1.5 text-xs"
                          style={{ borderColor: C.wine, color: C.wine }}
                        >
                          Konfirmasi Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                  {confirmingId === o.id && (
                    <tr style={{ background: C.wineMist }}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs" style={{ color: C.sub }}>Metode</label>
                            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-sm border px-2 py-1.5 text-sm" style={{ borderColor: C.line }}>
                              <option>Transfer Bank</option>
                              <option>QRIS</option>
                              <option>Tunai</option>
                              <option>Lainnya</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs" style={{ color: C.sub }}>Catatan (opsional)</label>
                            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-sm border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} />
                          </div>
                          <button onClick={() => submitConfirm(o.id)} className="rounded-sm px-3 py-1.5 text-sm text-white" style={{ background: C.paid }}>
                            Tandai Lunas
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- shipping confirmation ---------- */
function ShippingSection({ orders, onConfirmShipping }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [courier, setCourier] = useState('JNE');
  const [tracking, setTracking] = useState('');

  const paidOrders = [...orders].filter((o) => o.paymentStatus === 'paid').sort((a, b) => b.createdAt - a.createdAt);

  function submitShip(id) {
    if (!tracking.trim()) return;
    onConfirmShipping(id, { courier, tracking: tracking.trim() });
    setConfirmingId(null);
    setTracking('');
    setCourier('JNE');
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: C.wine }}>Konfirmasi Pengiriman</h2>
        <p className="mt-1 text-sm" style={{ color: C.sub }}>Pesanan yang sudah lunas, siap dikirim dan dicatat nomor resinya.</p>
      </div>

      {paidOrders.length === 0 ? (
        <EmptyState icon={Truck} title="Belum ada pesanan lunas" body="Pesanan akan muncul di sini setelah pembayarannya dikonfirmasi." />
      ) : (
        <div className="overflow-hidden rounded-sm border" style={{ borderColor: C.line }}>
          <table className="w-full text-left text-sm">
            <thead style={{ background: C.cream }}>
              <tr style={{ color: C.sub }}>
                <th className="px-4 py-3 font-normal">Pelanggan</th>
                <th className="px-4 py-3 font-normal">Pesanan</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Resi</th>
                <th className="px-4 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {paidOrders.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-t align-top" style={{ borderColor: C.line }}>
                    <td className="px-4 py-3">
                      <div>{o.customerName}</div>
                      <div className="text-xs" style={{ color: C.sub }}>{o.phone}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: C.sub }}>{o.itemSummary || '—'}</td>
                    <td className="px-4 py-3">
                      {o.shippingStatus === 'shipped' ? (
                        <StatusBadge tone="shipped"><PackageCheck size={13} /> Terkirim</StatusBadge>
                      ) : (
                        <StatusBadge tone="pending"><Clock size={13} /> Siap Kirim</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: C.sub }}>
                      {o.shippingStatus === 'shipped' ? `${o.courier} · ${o.tracking}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.shippingStatus !== 'shipped' && (
                        <button
                          onClick={() => setConfirmingId(confirmingId === o.id ? null : o.id)}
                          className="rounded-sm border px-2.5 py-1.5 text-xs"
                          style={{ borderColor: C.wine, color: C.wine }}
                        >
                          Konfirmasi Kirim
                        </button>
                      )}
                    </td>
                  </tr>
                  {confirmingId === o.id && (
                    <tr style={{ background: C.wineMist }}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs" style={{ color: C.sub }}>Kurir</label>
                            <select value={courier} onChange={(e) => setCourier(e.target.value)} className="rounded-sm border px-2 py-1.5 text-sm" style={{ borderColor: C.line }}>
                              <option>JNE</option>
                              <option>J&T</option>
                              <option>SiCepat</option>
                              <option>AnterAja</option>
                              <option>Lainnya</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs" style={{ color: C.sub }}>Nomor Resi</label>
                            <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-full rounded-sm border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} />
                          </div>
                          <button onClick={() => submitShip(o.id)} disabled={!tracking.trim()} className="rounded-sm px-3 py-1.5 text-sm text-white disabled:opacity-40" style={{ background: C.shipped }}>
                            Tandai Terkirim
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- app shell ---------- */
const NAV = [
  { key: 'beads', label: 'Manik-Manik', icon: Gem },
  { key: 'charms', label: 'Charm 24K', icon: Sparkles },
  { key: 'payments', label: 'Pembayaran', icon: CreditCard },
  { key: 'shipping', label: 'Pengiriman', icon: Truck },
];

export default function TokoPanel() {
  const [tab, setTab] = useState('beads');
  const [beads, setBeads] = useState([]);
  const [charms, setCharms] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [beadsRes, charmsRes, ordersRes] = await Promise.all([
          api.getBeads(),
          api.getCharms(),
          api.getOrders(),
        ]);
        setBeads(beadsRes);
        setCharms(charmsRes);
        setOrders(ordersRes);
      } catch (e) {
        showToast('Gagal memuat data dari server', 'error');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleImport(kind, mode, rows) {
    try {
      const updated = kind === 'beads'
        ? await api.bulkBeads(mode, rows)
        : await api.bulkCharms(mode, rows);
      if (kind === 'beads') setBeads(updated);
      else setCharms(updated);
      showToast(`${rows.length} item berhasil ${mode === 'replace' ? 'mengganti' : 'ditambahkan ke'} katalog`);
    } catch (e) {
      showToast('Gagal menyimpan katalog ke server', 'error');
    }
  }

  async function handleDelete(kind, id) {
    try {
      if (kind === 'beads') {
        await api.deleteBead(id);
        setBeads((prev) => prev.filter((b) => b.id !== id));
      } else {
        await api.deleteCharm(id);
        setCharms((prev) => prev.filter((c) => c.id !== id));
      }
      showToast('Item dihapus dari katalog');
    } catch (e) {
      showToast('Gagal menghapus item', 'error');
    }
  }

  async function handleAddOrder(order) {
    try {
      const saved = await api.addOrder(order);
      setOrders((prev) => [saved, ...prev]);
      showToast('Pesanan baru dicatat');
    } catch (e) {
      showToast('Gagal menyimpan pesanan', 'error');
    }
  }

  async function handleConfirmPayment(id, { method, note }) {
    try {
      const updated = await api.confirmPayment(id, { method, note });
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      showToast('Pembayaran dikonfirmasi');
    } catch (e) {
      showToast('Gagal mengonfirmasi pembayaran', 'error');
    }
  }

  async function handleConfirmShipping(id, { courier, tracking }) {
    try {
      const updated = await api.confirmShipping(id, { courier, tracking });
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      showToast('Pengiriman dikonfirmasi');
    } catch (e) {
      showToast('Gagal mengonfirmasi pengiriman', 'error');
    }
  }

  const pendingPayments = orders.filter((o) => o.paymentStatus !== 'paid').length;
  const readyToShip = orders.filter((o) => o.paymentStatus === 'paid' && o.shippingStatus !== 'shipped').length;

  return (
    <div className="flex h-full min-h-[640px] w-full" style={{ background: C.cream, fontFamily: "'Jost', sans-serif", color: C.ink }}>

      {/* sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r p-5" style={{ borderColor: C.line, background: C.paper }}>
        <div className="mb-8">
          <div className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: C.wine }}>Zupazupazuu</div>
          <div className="text-xs tracking-wide" style={{ color: C.sub }}>Toko Panel</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            const badge = item.key === 'payments' ? pendingPayments : item.key === 'shipping' ? readyToShip : 0;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className="flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-left text-sm transition-colors"
                style={{
                  background: active ? C.wine : 'transparent',
                  color: active ? C.cream : C.ink,
                }}
              >
                <Icon size={16} />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: active ? C.goldLight : C.pendingBg, color: active ? C.wine : C.pending }}
                  >
                    {badge}
                  </span>
                )}
                {active && <ChevronRight size={14} />}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto pt-6 text-xs" style={{ color: C.sub }}>
          Data disimpan otomatis dan dapat dilihat semua pengguna panel ini.
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 overflow-auto p-8">
        {!loaded ? (
          <div className="flex h-full items-center justify-center" style={{ color: C.sub }}>
            <Loader2 size={20} className="mr-2 animate-spin" /> Memuat data toko…
          </div>
        ) : (
          <>
            {tab === 'beads' && (
              <CatalogSection
                kind="beads"
                items={beads}
                onImport={(mode, rows) => handleImport('beads', mode, rows)}
                onDelete={(id) => handleDelete('beads', id)}
              />
            )}
            {tab === 'charms' && (
              <CatalogSection
                kind="charms"
                items={charms}
                onImport={(mode, rows) => handleImport('charms', mode, rows)}
                onDelete={(id) => handleDelete('charms', id)}
              />
            )}
            {tab === 'payments' && (
              <PaymentSection orders={orders} onAddOrder={handleAddOrder} onConfirmPayment={handleConfirmPayment} />
            )}
            {tab === 'shipping' && (
              <ShippingSection orders={orders} onConfirmShipping={handleConfirmShipping} />
            )}
          </>
        )}
      </main>

      <Toast toast={toast} />
    </div>
  );
}
