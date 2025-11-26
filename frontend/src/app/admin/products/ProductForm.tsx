'use client';

import React, { useEffect, useState } from 'react';
import type { Product } from './page';

const API_BASE = 'http://localhost:8000';

interface Props {
  product?: Product | null; // if present -> edit mode
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export default function ProductForm({
  product,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [form, setForm] = useState({
    title: '',
    gender: 'men',
    category: 'clothing',
    subcategory: '',
    price: '',
    description: '',
    images: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        title: product.title || '',
        gender: product.gender || 'men',
        category: product.category || 'clothing',
        subcategory: product.subcategory || '',
        price: product.price?.toString() || '',
        description: product.description || '',
        images: (product.images || []).join(', '),
      });
    } else {
      setForm({
        title: '',
        gender: 'men',
        category: 'clothing',
        subcategory: '',
        price: '',
        description: '',
        images: '',
      });
    }
  }, [product]);

  const updateField = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const parseArray = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const validate = () => {
    if (!form.title.trim()) {
      onError('Title is required');
      return false;
    }
    if (!form.gender.trim()) {
      onError('Gender is required');
      return false;
    }
    if (!form.category.trim()) {
      onError('Category is required');
      return false;
    }
    if (!form.subcategory.trim()) {
      onError('Subcategory is required');
      return false;
    }
    if (!form.price || Number.isNaN(Number(form.price))) {
      onError('Valid price is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    onError(''); // clear old error

    const payload = {
      title: form.title.trim(),
      gender: form.gender.trim().toLowerCase() as 'men' | 'women',
      category: form.category.trim().toLowerCase(),
      subcategory: form.subcategory.trim().toLowerCase(),
      price: Number(form.price),
      description: form.description.trim() || undefined,
      images: parseArray(form.images),
      available: true,
    };

    try {
      const token = localStorage.getItem('adminToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res: Response;
      if (product && product.id) {
        // update
        res = await fetch(`${API_BASE}/products/${product.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        // create
        res = await fetch(`${API_BASE}/products`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        onSuccess();
      } else if (res.status === 401) {
        onError('Unauthorized — please login again.');
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
      } else {
        const text = await res.text();
        onError(`Server error: ${res.status} ${text}`);
      }
    } catch (err) {
      console.error(err);
      onError('Network error — cannot reach server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 8,
        padding: 20,
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        maxWidth: 800,
        margin: '0 auto 2rem',
      }}
    >
      <h2 style={{ margin: '0 0 1rem 0' }}>
        {product ? 'Edit Product' : 'Add Product'}
      </h2>

      <form onSubmit={handleSubmit}>
        <div
          style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}
        >
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            style={{
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          />

          <select
            value={form.gender}
            onChange={(e) => updateField('gender', e.target.value)}
            style={{
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          >
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>

          <input
            placeholder="Category (e.g. clothing)"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            style={{
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          />

          <input
            placeholder="Subcategory (e.g. tshirt, jeans)"
            value={form.subcategory}
            onChange={(e) => updateField('subcategory', e.target.value)}
            style={{
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          />

          <input
            placeholder="Price (number)"
            value={form.price}
            onChange={(e) => updateField('price', e.target.value)}
            style={{
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Image URLs (comma separated)"
            value={form.images}
            onChange={(e) => updateField('images', e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1rem',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Saving…' : product ? 'Save Changes' : 'Create Product'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              padding: '0.6rem 1rem',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
