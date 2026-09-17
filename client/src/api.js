const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getBeads: () => request('/beads'),
  bulkBeads: (mode, items) => request('/beads/bulk', { method: 'POST', body: JSON.stringify({ mode, items }) }),
  deleteBead: (id) => request(`/beads/${id}`, { method: 'DELETE' }),

  getCharms: () => request('/charms'),
  bulkCharms: (mode, items) => request('/charms/bulk', { method: 'POST', body: JSON.stringify({ mode, items }) }),
  deleteCharm: (id) => request(`/charms/${id}`, { method: 'DELETE' }),

  getOrders: () => request('/orders'),
  addOrder: (order) => request('/orders', { method: 'POST', body: JSON.stringify(order) }),
  confirmPayment: (id, payload) => request(`/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify(payload) }),
  confirmShipping: (id, payload) => request(`/orders/${id}/shipping`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
