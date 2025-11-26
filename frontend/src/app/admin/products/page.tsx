'use client';

import { useEffect, useState } from 'react';
import ProductForm from './ProductForm';

const API_BASE = 'http://localhost:8000';

export interface Product {
  id: string;
  title: string;
  gender: 'men' | 'women';
  category: string;
  subcategory: string;
  price: number;
  description?: string;
  images: string[];
  available: boolean;
  created_at?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('adminToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/products`, { headers });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized — please login again.');
          localStorage.removeItem('adminToken');
          window.location.href = '/admin/login';
          return;
        }
        const text = await res.text();
        setError(`Failed to load products: ${res.status} ${text}`);
        return;
      }

      const data = await res.json();

      const mapped: Product[] = (data || []).map((p: any) => ({
        id: p.id || p._id || '',
        title: p.title,
        gender: p.gender,
        category: p.category,
        subcategory: p.subcategory,
        price: p.price,
        description: p.description,
        images: p.images || [],
        available: p.available ?? true,
        created_at: p.created_at,
      }));

      setProducts(mapped);
    } catch (err) {
      console.error(err);
      setError('Network error — cannot load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreate = () => {
    setEditingProduct(null);
    setShowForm(true);
    setError('');
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized — please login again.');
          localStorage.removeItem('adminToken');
          window.location.href = '/admin/login';
          return;
        }
        const text = await res.text();
        setError(`Failed to delete: ${res.status} ${text}`);
        return;
      }

      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      setError('Network error — unable to delete.');
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProduct(null);
    setError('');
    fetchProducts(); // reload list after create / update
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: 24, fontWeight: 600 }}>
        Products
      </h1>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.6rem 0.8rem',
            borderRadius: 6,
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={handleCreate}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          + Add Product
        </button>

        {loading && <span style={{ fontSize: 14 }}>Loading…</span>}
      </div>

      {/* List */}
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
          padding: '1rem',
          overflowX: 'auto',
        }}
      >
        {products.length === 0 && !loading ? (
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            No products found. Click &quot;Add Product&quot; to create one.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Gender</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>
                  Category
                </th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>
                  Subcategory
                </th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Price</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {p.title}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {p.gender}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {p.category}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {p.subcategory}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    ₹{p.price}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    <button
                      onClick={() => handleEdit(p)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 4,
                        border: '1px solid #e5e7eb',
                        background: '#f3f4f6',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 4,
                        border: '1px solid #fecaca',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form (Add / Edit) */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
        >
          <div style={{ maxHeight: '90vh', overflowY: 'auto', width: '90%' }}>
            <ProductForm
              product={editingProduct}
              onClose={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}
              onSuccess={handleFormSuccess}
              onError={setError} // pass setter as function
            />
          </div>
        </div>
      )}
    </div>
  );
}
