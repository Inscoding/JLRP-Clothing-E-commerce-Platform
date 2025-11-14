// src/app/admin/layout.tsx
import '../globals.css';
import type { ReactNode } from 'react';
import styles from './admin.module.css';
import AdminHeader from './components/AdminHeader';

export const metadata = {
  title: 'JLRP Admin Dashboard',
  description:
    'Admin control panel for managing JLRP Brand products, orders, and tracking.',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={styles.adminShell}>
        <div className={styles.adminInner}>
          <AdminHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
