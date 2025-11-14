'use client';

import React, { useEffect, useState } from 'react';
import styles from '../admin.module.css';
import { apiGet, apiPost } from '../../../lib/api';

type Order = {
  id: string;
  customer?: any;
  total?: number;
  status?: string;
  created_at?: string;
};

export default function OrderList() {
  const [list, setList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('jlrp_token') : null;

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await apiGet('/orders', token || undefined);
      const arr = Array.isArray(res) ? res : res.orders || res.list || [];
      setList(arr);
    } catch (err) {
      console.error(err);
      alert('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      // assuming endpoint exists
      await apiPost(`/orders/${id}/status`, { status }, token || undefined);
      setList((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err) {
      console.error(err);
      alert('Update failed');
    }
  }

  return (
    <div>
      {loading ? <p>Loading…</p> : null}
      {list.map((o) => (
        <div key={o.id || Math.random()} className={styles.orderRow}>
          <div>
            <div>
              <strong>{o.customer?.name || 'Unknown'}</strong>
            </div>
            <div style={{ color: 'var(--muted)' }}>{o.created_at}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--orange)' }}>
              {o.status || '—'}
            </div>
            <select
              defaultValue={o.status || ''}
              onChange={(e) => updateStatus(o.id, e.target.value)}
            >
              <option value="">Set status</option>
              <option>Packed</option>
              <option>Shipped</option>
              <option>Out for Delivery</option>
              <option>Delivered</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
