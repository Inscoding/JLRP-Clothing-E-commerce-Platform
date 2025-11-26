// src/app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface Stats {
  products: { total: number };
  orders: { total: number; today: number };
  sales: { total_revenue: number; today_revenue: number };
  returns: { pending: number };
  stock: { low_stock_count: number };
}

interface LowStockItem {
  _id?: string;
  name: string;
  stock: number;
}

interface OverviewResponse {
  stats: Stats;
  low_stock_items: LowStockItem[];
  last_updated: string;
}

interface RecentOrder {
  id: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export default function Dashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // later we can protect this with token; for now overview is open
      const res = await fetch('http://localhost:8000/admin/overview');

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.detail || 'Failed to load dashboard data');
        return;
      }

      const data: OverviewResponse = await res.json();
      setOverview(data);

      // TODO: when orders API exists, fill this properly
      setRecentOrders([]);
    } catch (err) {
      setError('Network error - check server connection');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      shipped: '#8b5cf6',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Loading…
          </div>
          <div>Fetching dashboard data...</div>
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
        }}
      >
        <div style={{ textAlign: 'center', color: '#ef4444' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Error</div>
          <div>{error || 'No data'}</div>
          <button
            onClick={fetchDashboardData}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = overview.stats;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ color: '#1f2937', margin: 0 }}>Dashboard Overview</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            Live overview of products, orders, returns and sales
          </p>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.75rem' }}>
            Last updated: {new Date(overview.last_updated).toLocaleString()}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          style={{
            padding: '0.5rem 1rem',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem',
        }}
      >
        <StatCard
          icon="👕"
          title="Total Products"
          value={stats.products.total}
          color="#3b82f6"
        />
        <StatCard
          icon="📦"
          title="Total Orders"
          value={stats.orders.total}
          color="#8b5cf6"
        />
        <StatCard
          icon="🕒"
          title="Today Orders"
          value={stats.orders.today}
          color="#f59e0b"
        />
        <StatCard
          icon="💰"
          title="Today Revenue"
          value={`₹${stats.sales.today_revenue}`}
          color="#10b981"
        />
        <StatCard
          icon="📈"
          title="Total Revenue"
          value={`₹${stats.sales.total_revenue}`}
          color="#059669"
        />
        <StatCard
          icon="⚠️"
          title="Pending Returns"
          value={stats.returns.pending}
          color="#ef4444"
        />
        <StatCard
          icon="📉"
          title="Low Stock Items"
          value={stats.stock.low_stock_count}
          color="#ef4444"
        />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}
      >
        {/* Recent Orders */}
        <div
          style={{
            background: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#1f2937' }}>
            Recent Orders
          </h3>
          {recentOrders.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}
            >
              No recent orders yet
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      Order #{order.id.slice(-8)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {order.customerName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600', color: '#059669' }}>
                      ₹{order.totalAmount}
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: getStatusColor(order.status),
                        fontWeight: '600',
                      }}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <a
              href="/admin/orders"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              View All Orders →
            </a>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            background: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#1f2937' }}>
            Quick Actions
          </h3>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <a
              href="/admin/upload"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                color: '#0369a1',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '1.5rem', marginRight: '0.75rem' }}>
                📤
              </span>
              <div>
                <div style={{ fontWeight: '600' }}>Add Product</div>
                <div style={{ fontSize: '0.875rem' }}>Upload new items</div>
              </div>
            </a>
            <a
              href="/admin/products"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                color: '#15803d',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '1.5rem', marginRight: '0.75rem' }}>
                👕
              </span>
              <div>
                <div style={{ fontWeight: '600' }}>Manage Products</div>
                <div style={{ fontSize: '0.875rem' }}>Edit inventory</div>
              </div>
            </a>
            <a
              href="/admin/orders"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                color: '#92400e',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '1.5rem', marginRight: '0.75rem' }}>
                📦
              </span>
              <div>
                <div style={{ fontWeight: '600' }}>Process Orders</div>
                <div style={{ fontSize: '0.875rem' }}>Update status</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  color,
}: {
  icon: string;
  title: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: '2rem' }}>{icon}</div>
      <div>
        <h3
          style={{
            margin: '0 0 0.25rem 0',
            fontSize: '1.5rem',
            color: '#1f2937',
          }}
        >
          {value}
        </h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          {title}
        </p>
      </div>
    </div>
  );
}
