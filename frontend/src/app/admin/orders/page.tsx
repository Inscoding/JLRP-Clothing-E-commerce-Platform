'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

interface AdminOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  size?: string | null;
  image?: string | null;
}

interface AdminOrder {
  id: string; // <-- we'll use razorpay_order_id here
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail?: string;
  totalAmount: number;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  status: OrderStatus;
  items: AdminOrderItem[];
}

const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const POLL_INTERVAL_MS = 5000; // 5 seconds

const AdminOrdersPage: React.FC = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      if (!hasLoadedOnce) setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/admin/orders`);
      if (!res.ok) {
        const text = await res.text();
        setError(`Failed to load orders: ${res.status} ${text}`);
        return;
      }

      const data = await res.json();
      console.log('Admin orders raw:', data);

      const mapped: AdminOrder[] = (data || []).map((o: any) => {
        const rawStatus = (o.status || 'PENDING').toString().toUpperCase();
        const normalizedStatus: OrderStatus =
          rawStatus === 'PENDING_PAYMENT'
            ? 'PENDING'
            : (rawStatus as OrderStatus);

        const rawOrderNumber =
          o.orderNumber || o.order_number || o.razorpay_order_id || o._id || '';

        return {
          // 👇 use Razorpay order id as main id
          id: o.razorpay_order_id || o._id || o.id || '',
          orderNumber: rawOrderNumber,
          createdAt: o.createdAt || o.created_at || new Date().toISOString(),
          customerName:
            o.customerName || o.shipping_address?.fullName || 'Customer',
          customerEmail: o.email || o.customerEmail || o.customer_email || '',
          totalAmount: o.totalAmount ?? o.total_amount ?? o.amount ?? 0,
          paymentStatus:
            (o.paymentStatus?.toUpperCase() as AdminOrder['paymentStatus']) ||
            (o.payment_status?.toUpperCase() as AdminOrder['paymentStatus']) ||
            'PAID',
          status: normalizedStatus,
          items: (o.items || []).map((it: any) => ({
            id: it.id || it._id || '',
            name: it.name || it.title || 'Product',
            quantity: it.quantity ?? 1,
            price: it.price ?? 0,
            size: it.size ?? null,
            image: it.image || (it.images && it.images[0]) || null,
          })),
        };
      });

      setOrders(mapped);
      setHasLoadedOnce(true);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError('Network error — unable to fetch orders.');
    } finally {
      setLoading(false);
    }
  }, [hasLoadedOnce]);

  // initial load + polling
  useEffect(() => {
    fetchOrders();
    const intervalId = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        const matchesSearch =
          !search ||
          o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
          o.customerName.toLowerCase().includes(search.toLowerCase());

        const matchesStatus =
          statusFilter === 'ALL' ? true : o.status === statusFilter;

        return matchesSearch && matchesStatus;
      }),
    [orders, search, statusFilter]
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatTimeOnly = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadgeStyles = (status: OrderStatus) => {
    switch (status) {
      case 'DELIVERED':
        return { bg: '#dcfce7', border: '#16a34a', color: '#166534' };
      case 'SHIPPED':
      case 'PROCESSING':
        return { bg: '#dbeafe', border: '#2563eb', color: '#1d4ed8' };
      case 'CANCELLED':
        return { bg: '#fee2e2', border: '#dc2626', color: '#b91c1c' };
      default:
        return { bg: '#fef9c3', border: '#eab308', color: '#92400e' };
    }
  };

  const getPaymentColor = (status: AdminOrder['paymentStatus']) => {
    if (status === 'PAID') return '#16a34a';
    if (status === 'FAILED') return '#dc2626';
    return '#92400e';
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    try {
      setSavingOrderId(orderId);

      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('Status update failed', txt);
        alert('Failed to update status');
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      console.error(err);
      alert('Network error while updating status');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleViewClick = async (orderId: string) => {
    try {
      setViewingOrderId(orderId);

      const url = `${API_BASE}/admin/orders/${orderId}`;
      console.log('Fetching order details from:', url);

      const res = await fetch(url);
      const text = await res.text();

      if (!res.ok) {
        console.error('Order details error:', res.status, text);
        alert(`Failed to load order details (${res.status}): ${text}`);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON from server:', text);
        alert('Invalid response from server while loading order details');
        return;
      }

      setSelectedOrder(data);
    } catch (err) {
      console.error(err);
      alert('Network error while loading order details');
    } finally {
      setViewingOrderId(null);
    }
  };

  return (
    <div
      style={{
        padding: '24px',
        background: '#f3f4f6',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 600,
              marginBottom: '4px',
            }}
          >
            Orders
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>
            Live view of customer orders (auto-updates every 5 seconds)
          </p>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>
          {lastUpdated && (
            <p style={{ marginBottom: 4 }}>
              Last updated at <strong>{formatTimeOnly(lastUpdated)}</strong>
            </p>
          )}
          <button
            type="button"
            onClick={() => fetchOrders()}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {loading && !hasLoadedOnce ? 'Loading…' : 'Refresh now'}
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <input
          type="text"
          placeholder="Search by order ID or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 260px',
            padding: '8px 10px',
            borderRadius: '999px',
            border: '1px solid #d1d5db',
            fontSize: '13px',
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{
            flex: '0 0 180px',
            padding: '8px 10px',
            borderRadius: '999px',
            border: '1px solid #d1d5db',
            fontSize: '13px',
            background: '#fff',
          }}
        >
          <option value="ALL">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Table container */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          Showing {filteredOrders.length} of {orders.length} orders
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <th style={thStyle}>Order ID</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Items</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Payment</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '13px',
                      color: '#6b7280',
                    }}
                  >
                    {loading && !hasLoadedOnce
                      ? 'Loading orders...'
                      : 'No orders found for the selected filters.'}
                  </td>
                </tr>
              )}

              {filteredOrders.map((order) => {
                const statusStyles = getStatusBadgeStyles(order.status);

                const displayOrderId =
                  order.orderNumber &&
                  order.orderNumber.toLowerCase() !== 'none'
                    ? order.orderNumber
                    : (order.id || '').slice(-6).toUpperCase();

                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      >
                        {`#${displayOrderId}`}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>
                          {order.customerName}
                        </span>
                        {order.customerEmail && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#6b7280',
                            }}
                          >
                            {order.customerEmail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>{formatDate(order.createdAt)}</td>
                    <td style={tdStyle}>
                      {order.items.length} item
                      {order.items.length !== 1 ? 's' : ''}
                    </td>
                    <td style={tdStyle}>
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '12px',
                          color: getPaymentColor(order.paymentStatus),
                        }}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: statusStyles.bg,
                          border: `1px solid ${statusStyles.border}`,
                          color: statusStyles.color,
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(
                              order.id,
                              e.target.value as OrderStatus
                            )
                          }
                          disabled={savingOrderId === order.id}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '999px',
                            border: '1px solid #d1d5db',
                            fontSize: '12px',
                            background: '#fff',
                          }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleViewClick(order.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '999px',
                            border: '1px solid #111827',
                            background: '#fff',
                            fontSize: '12px',
                            cursor: 'pointer',
                            opacity: viewingOrderId === order.id ? 0.7 : 1,
                          }}
                        >
                          {viewingOrderId === order.id ? 'Loading…' : 'View'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order details modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '20px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(15,23,42,0.25)',
              fontSize: '13px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                Order #
                {selectedOrder.orderNumber ||
                  selectedOrder.order_number ||
                  selectedOrder.razorpay_order_id ||
                  selectedOrder._id}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p>
                <strong>Order ID:</strong>{' '}
                {selectedOrder.razorpay_order_id || selectedOrder._id}
              </p>
              <p>
                <strong>Date:</strong>{' '}
                {formatDate(
                  selectedOrder.createdAt ||
                    selectedOrder.created_at ||
                    new Date().toISOString()
                )}
              </p>
              <p>
                <strong>Customer:</strong>{' '}
                {selectedOrder.customerName ||
                  selectedOrder.customer_name ||
                  selectedOrder.shipping_address?.fullName ||
                  'Customer'}
              </p>
              {(selectedOrder.email ||
                selectedOrder.customerEmail ||
                selectedOrder.customer_email) && (
                <p>
                  <strong>Email:</strong>{' '}
                  {selectedOrder.email ||
                    selectedOrder.customerEmail ||
                    selectedOrder.customer_email}
                </p>
              )}
              <p>
                <strong>Amount:</strong> ₹
                {(
                  selectedOrder.totalAmount ||
                  selectedOrder.total_amount ||
                  selectedOrder.amount ||
                  0
                ).toLocaleString('en-IN')}
              </p>
              <p>
                <strong>Payment:</strong>{' '}
                {(
                  selectedOrder.paymentStatus ||
                  selectedOrder.payment_status ||
                  'PAID'
                )
                  .toString()
                  .toUpperCase()}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                {(selectedOrder.status || 'PENDING_PAYMENT')
                  .toString()
                  .toUpperCase()}
              </p>
            </div>

            {/* Shipping address */}
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>
                Shipping Address
              </h3>
              {(() => {
                const addr =
                  selectedOrder.shippingAddress ||
                  selectedOrder.shipping_address ||
                  {};
                const fullName = addr.fullName || addr.full_name;
                const line1 = addr.addressLine1 || addr.address_line1;
                const line2 = addr.addressLine2 || addr.address_line2;
                return (
                  <>
                    {fullName && <p>{fullName}</p>}
                    {addr.phone && <p>{addr.phone}</p>}
                    {line1 && <p>{line1}</p>}
                    {line2 && <p>{line2}</p>}
                    {(addr.city || addr.state || addr.pincode) && (
                      <p>
                        {addr.city}
                        {addr.city && addr.state ? ', ' : ''}
                        {addr.state} {addr.pincode ? `- ${addr.pincode}` : ''}
                      </p>
                    )}
                    {addr.country && <p>{addr.country}</p>}
                    {addr.landmark && <p>Landmark: {addr.landmark}</p>}
                  </>
                );
              })()}
            </div>

            {/* Items */}
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Items</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(selectedOrder.items || []).map((it: any, idx: number) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span>
                      {it.name || it.title || 'Product'}
                      {it.size ? ` (${it.size})` : ''} × {it.quantity || 1}
                    </span>
                    <span>₹{(it.price || 0).toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: '#111827',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

export default AdminOrdersPage;
