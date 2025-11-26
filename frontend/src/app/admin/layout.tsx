// src/app/admin/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// 👇 include reset-password here
const AUTH_ROUTES = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');

    // set auth state for all routes
    setIsAuthenticated(!!token);

    // If no token and route is NOT in public auth routes → send to login
    if (!token && !AUTH_ROUTES.includes(pathname)) {
      router.push('/admin/login');
    }
  }, [router, pathname]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    router.push('/admin/login');
  };

  // Initial loading state
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: '1.2rem',
        }}
      >
        <div>Loading…</div>
      </div>
    );
  }

  // 👇 Login, Forgot Password & Reset Password use the same auth layout (no sidebar)
  if (AUTH_ROUTES.includes(pathname)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '2rem',
              color: 'white',
            }}
          >
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              JLRP Admin
            </h1>
            <p>Manage products, inventory & orders</p>
          </div>
          {children}
        </div>
      </div>
    );
  }

  // 🔐 Protected dashboard layout (needs token)
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '280px',
          background: '#1f2937',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '2rem 1.5rem 1rem',
            borderBottom: '1px solid #374151',
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
            JLRP Admin
          </h2>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
            Manage products, inventory & orders
          </p>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {[
            { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
            { path: '/admin/products', label: 'Products', icon: '👕' },
            { path: '/admin/upload', label: 'Upload Clothes', icon: '📤' },
            { path: '/admin/orders', label: 'Orders', icon: '📦' },
            { path: '/admin/tracking', label: 'Tracking', icon: '🚗' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem 1.5rem',
                color: pathname === item.path ? 'white' : '#d1d5db',
                textDecoration: 'none',
                background: pathname === item.path ? '#3b82f6' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ marginRight: '0.75rem', fontSize: '1.25rem' }}>
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid #374151' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              marginBottom: '1rem',
            }}
          >
            🚪 Logout
          </button>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Logged in as admin — secure area
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            background: 'white',
            borderBottom: '1px solid '#e5e7eb',
            padding: '1rem 2rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>
              Admin Dashboard
            </h1>
            <div style={{ color: '#6b7280' }}>
              <span>Welcome, Admin</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
