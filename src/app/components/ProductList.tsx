'use client';

import React, { useEffect, useState } from 'react';
import styles from '../admin.module.css';
import ProductForm from './ProductForm';
import { apiGet, apiDelete } from '../../../lib/api';

type Product = {
  _id: string;
  name: string;
  price?: number;
  images?: string[];
  stock?: number;
  description?: string;
};

export default function ProductsList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('jlrp_token') : null;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await apiGet('/products', token || undefined);
      const list = Array.isArray(res) ? res : res.products || res.list || [];
      setProducts(list);
    } catch (err) {
      console.error(err);
      alert('Failed to load products.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    try {
      await apiDelete(`/products/${id}`, token || undefined);
      setProducts((p) => p.filter((x) => x._id !== id));
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }
  }

  return (
    <div>
      <div id="add" style={{ marginBottom: 14 }}>
        <ProductForm
          token={token || undefined}
          onSaved={(p) => {
            setProducts((prev) => [p, ...prev]);
          }}
        />
      </div>

      {loading ? <p>Loading…</p> : null}
      <div className={styles.productsGrid}>
        {products.map((p) => (
          <div className={styles.productCard} key={p._id}>
            <div className={styles.productImage}>
              {p.images && p.images.length ? (
                <img
                  src={
                    p.images[0].startsWith('http')
                      ? p.images[0]
                      : `${API_BASE}${p.images[0]}`
                  }
                  alt={p.name}
                />
              ) : (
                <div style={{ padding: 10 }}>📦</div>
              )}
            </div>
            <div className={styles.productBody}>
              <div>
                <strong>{p.name}</strong>
              </div>
              <div style={{ color: 'var(--muted)' }}>
                {p.description?.slice(0, 80)}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--orange)' }}>
                {p.price ? `₹${p.price}` : '—'}
              </div>
              <div className={styles.productActions}>
                <button className="smallBtn" onClick={() => setEditing(p)}>
                  Edit ✏️
                </button>
                <button
                  className="smallBtn"
                  onClick={() => handleDelete(p._id)}
                >
                  Delete 🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div style={{ marginTop: 18 }}>
          <ProductForm
            token={token || undefined}
            product={editing}
            onSaved={(updated) => {
              setProducts((prev) =>
                prev.map((x) => (x._id === updated._id ? updated : x))
              );
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
