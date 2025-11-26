// frontend/src/app/admin/tracking/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Order = {
  _id?: string;
  id?: string;
  razorpay_order_id?: string;
  email?: string;
  customer_email?: string;
  customer_name?: string;
  shipping_name?: string;
  name?: string;
  created_at?: string;
  status?: string;
  total_amount?: number;
  amount?: number;
  tracking_url?: string;
  tracking_id?: string;
  courier_name?: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const STATUS_OPTIONS = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export default function TrackingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // local editable state for each order row
  const [formState, setFormState] = useState<
    Record<
      string,
      {
        status: string;
        tracking_url: string;
        tracking_id: string;
        courier_name: string;
      }
    >
  >({});

  // helper to get key for map (we will use razorpay_order_id or _id)
  const getOrderKey = (order: Order): string => {
    return (
      order.razorpay_order_id ||
      order._id ||
      order.id ||
      Math.random().toString(36).slice(2)
    );
  };

  const getCustomerEmail = (o: Order) => o.email || o.customer_email || '';

  const getCustomerName = (o: Order) =>
    o.customer_name || o.shipping_name || o.name || 'Customer';

  const getTotalAmount = (o: Order) => o.total_amount ?? o.amount ?? 0;

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('adminToken')
          : null;

      const res = await fetch(`${API_BASE}/admin/orders`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load orders (${res.status})`);
      }

      const data: Order[] = await res.json();

      setOrders(data);

      // initialise form state
      const initial: typeof formState = {};
      data.forEach((o) => {
        const key = getOrderKey(o);
        initial[key] = {
          status: (o.status || 'PENDING').toUpperCase(),
          tracking_url: o.tracking_url || '',
          tracking_id: o.tracking_id || '',
          courier_name: o.courier_name || '',
        };
      });
      setFormState(initial);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleChangeField = (
    key: string,
    field: 'status' | 'tracking_url' | 'tracking_id' | 'courier_name',
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSave = async (order: Order) => {
    const orderId = order.razorpay_order_id || order._id || order.id;

    if (!orderId) {
      setError('Order is missing ID / razorpay_order_id');
      return;
    }

    const key = getOrderKey(order);
    const state = formState[key];
    if (!state) return;

    try {
      setSavingId(key);
      setError(null);
      setSuccess(null);

      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('adminToken')
          : null;

      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: state.status,
          tracking_url: state.tracking_url || null,
          tracking_id: state.tracking_id || null,
          courier_name: state.courier_name || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Update failed (${res.status}) - ${text}`);
      }

      const updated = await res.json();

      // refresh list with updated order
      setOrders((prev) =>
        prev.map((o) => {
          const k = getOrderKey(o);
          if (k === key) {
            return {
              ...o,
              status: updated.status || state.status,
              tracking_url: updated.tracking_url ?? state.tracking_url,
              tracking_id: updated.tracking_id ?? state.tracking_id,
              courier_name: updated.courier_name ?? state.courier_name,
            };
          }
          return o;
        })
      );

      setSuccess(`Order ${orderId} updated to ${state.status}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update order');
    } finally {
      setSavingId(null);
      // auto clear success after a bit
      setTimeout(() => setSuccess(null), 2500);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        Order Tracking & Status
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
        Update order status and courier tracking details. This information is
        used in customer emails and tracking page.
      </p>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '0.375rem',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#dcfce7',
            color: '#166534',
            borderRadius: '0.375rem',
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <div>Loading orders…</div>
      ) : orders.length === 0 ? (
        <div>No orders found.</div>
      ) : (
        <div
          style={{
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            background: 'white',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}
          >
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'left',
                  }}
                >
                  Order ID
                </th>
                <th
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'left',
                  }}
                >
                  Customer
                </th>
                <th
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'left',
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'left',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'left',
                    minWidth: '220px',
                  }}
                >
                  Courier / Tracking
                </th>
                <th
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const key = getOrderKey(o);
                const state = formState[key];
                if (!state) return null;
                const orderId = o.razorpay_order_id || o._id || o.id || '—';
                return (
                  <tr key={key}>
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        fontWeight: 500,
                      }}
                    >
                      {orderId}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <div>{getCustomerName(o)}</div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                        }}
                      >
                        {getCustomerEmail(o)}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      ₹{getTotalAmount(o)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <select
                        value={state.status}
                        onChange={(e) =>
                          handleChangeField(key, 'status', e.target.value)
                        }
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #d1d5db',
                          fontSize: '0.85rem',
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ marginBottom: '0.25rem' }}>
                        <input
                          placeholder="Courier name (e.g. Delhivery)"
                          value={state.courier_name}
                          onChange={(e) =>
                            handleChangeField(
                              key,
                              'courier_name',
                              e.target.value
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.25rem 0.4rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.8rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #d1d5db',
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <input
                          placeholder="Tracking ID"
                          value={state.tracking_id}
                          onChange={(e) =>
                            handleChangeField(
                              key,
                              'tracking_id',
                              e.target.value
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.25rem 0.4rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.8rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #d1d5db',
                          }}
                        />
                      </div>
                      <div>
                        <input
                          placeholder="Tracking URL (courier link)"
                          value={state.tracking_url}
                          onChange={(e) =>
                            handleChangeField(
                              key,
                              'tracking_url',
                              e.target.value
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.25rem 0.4rem',
                            fontSize: '0.8rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #d1d5db',
                          }}
                        />
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        onClick={() => handleSave(o)}
                        disabled={savingId === key}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: 'none',
                          background: '#3b82f6',
                          color: 'white',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          opacity: savingId === key ? 0.6 : 1,
                        }}
                      >
                        {savingId === key ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
