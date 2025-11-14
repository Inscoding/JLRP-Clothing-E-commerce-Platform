// src/app/admin/orders/page.tsx
import AdminHeader from '../components/AdminHeader';
import OrderList from '../components/OrderList';
import styles from '../admin.module.css';

export default function OrdersPage() {
  return (
    <div className={styles.adminShell}>
      <div className={styles.adminInner}>
        <AdminHeader />
        <section style={{ marginTop: 12 }}>
          <div className={styles.card}>
            <h2>Orders</h2>
            <p style={{ color: 'var(--muted)' }}>
              View orders. Quick status update included.
            </p>
          </div>

          <OrderList />
        </section>
      </div>
    </div>
  );
}
