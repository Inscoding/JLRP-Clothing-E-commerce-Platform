'use client';

import React from 'react';
import styles from '../admin.module.css';
import Link from 'next/link';

export default function AdminHeader() {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('jlrp_token') : null;

  function logout() {
    localStorage.removeItem('jlrp_token');
    location.href = '/admin';
  }

  return (
    <div className={`${styles.adminHeader} ${styles.card}`}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className={styles.brand}>JLRP Admin</div>
        <nav className={styles.adminNav}>
          <Link href="/admin/products">
            <a
              className={
                window.location.pathname.startsWith('/admin/products')
                  ? styles.tabActive
                  : styles.tab
              }
            >
              Products
            </a>
          </Link>
          <Link href="/admin/orders">
            <a
              className={
                window.location.pathname.startsWith('/admin/orders')
                  ? styles.tabActive
                  : styles.tab
              }
            >
              Orders
            </a>
          </Link>
          <Link href="/admin/tracking">
            <a
              className={
                window.location.pathname.startsWith('/admin/tracking')
                  ? styles.tabActive
                  : styles.tab
              }
            >
              Tracking
            </a>
          </Link>
        </nav>
      </div>

      <div className={styles.headerRight}>
        <button
          className={styles.btnGhost}
          onClick={() => (location.href = '/')}
        >
          Open Store 🏬
        </button>
        {token ? (
          <button className={styles.btnGhost} onClick={logout}>
            Logout ❌
          </button>
        ) : null}
      </div>
    </div>
  );
}
