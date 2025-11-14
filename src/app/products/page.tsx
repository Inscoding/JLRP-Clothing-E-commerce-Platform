// src/app/admin/products/page.tsx
import AdminHeader from '../components/AdminHeader';
import ProductsList from '../components/ProductList';
import styles from '../admin.module.css';

export default function ProductsPage() {
  return (
    <div className={styles.adminShell}>
      <div className={styles.adminInner}>
        <AdminHeader />
        <section style={{ marginTop: 12 }}>
          <div className={styles.card}>
            <h2>Products</h2>
            <p style={{ color: 'var(--muted)' }}>
              Add, edit or remove products shown on the store.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <a href="#add" className="btn">
              Add Product ➕
            </a>
          </div>

          <ProductsList />
        </section>
      </div>
    </div>
  );
}
