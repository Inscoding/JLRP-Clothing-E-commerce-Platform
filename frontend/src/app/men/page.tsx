'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '../styles.css';

const API_BASE = 'http://localhost:8000';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  gender: 'men' | 'women';
  category: string;
  subcategory: string;
  description?: string;
}

const CATEGORIES = [
  'All',
  'T-Shirts',
  'Shirts',
  'Jeans',
  'Trousers',
  'Shorts',
  'Joggers / Trackpants',
  'Hoodies & Sweatshirts',
];

const MenCollectionPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) {
          setError(`Failed: ${res.status}`);
          return;
        }

        const data = await res.json();
        const mapped: Product[] = (data || []).map((p: any) => ({
          id: p.id || p._id || '',
          title: p.title,
          price: p.price,
          images: p.images || [],
          gender: p.gender,
          category: p.category,
          subcategory: p.subcategory,
          description: p.description,
        }));

        const menOnly = mapped.filter(
          (p) => p.gender && p.gender.toLowerCase() === 'men'
        );

        setProducts(menOnly);
        setFiltered(menOnly);
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filterCategory = (cat: string) => {
    setActiveCat(cat);
    if (cat === 'All') {
      setFiltered(products);
    } else {
      setFiltered(
        products.filter((p) => p.category?.toLowerCase() === cat.toLowerCase())
      );
    }
  };

  return (
    <div
      className="jlrp-page"
      style={{ background: '#f8f9fb', minHeight: '100vh' }}
    >
      <section className="section products-section">
        <div
          className="container"
          style={{ maxWidth: '1200px', marginLeft: '0' }}
        >
          {/* ---------- Updated Back Button (Option A) ---------- */}
          <button
            type="button"
            onClick={() =>
              window.history.length > 1 ? router.back() : router.push('/')
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '50px',
              border: '1.8px solid #111',
              fontSize: '14px',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              transition: '0.2s ease',
              marginBottom: '20px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#111';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = '#111';
            }}
          >
            ← Back
          </button>
          {/* ----------------------------------------------------- */}

          {/* Page Header */}
          <div className="section-title">
            <h2>Men&apos;s Collection</h2>
            <p>Trending styles curated for men</p>
          </div>

          {error && <div className="error-box">{error}</div>}
          {loading && <p style={{ textAlign: 'center' }}>Loading products…</p>}

          {/* Two Column Layout (Category + Products) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '250px 1fr',
              gap: '35px',
              alignItems: 'flex-start',
              marginTop: '20px',
              marginLeft: '60px', // adjusted side shift
            }}
          >
            {/* Sidebar Category */}
            <aside
              style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '18px',
                border: '1px solid #e5e7eb',
                height: 'fit-content',
                width: '250px',
              }}
            >
              <h3 style={{ marginBottom: '12px', fontWeight: 600 }}>
                Categories
              </h3>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => filterCategory(cat)}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderRadius: '6px',
                      border:
                        activeCat === cat
                          ? '2px solid black'
                          : '1px solid #d1d5db',
                      background: activeCat === cat ? '#111' : '#fff',
                      color: activeCat === cat ? '#fff' : '#111',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </aside>

            {/* Product Grid */}
            <div className="products-grid">
              {filtered.length === 0 && !loading && <p>No products found.</p>}

              {filtered.map((product) => {
                const image =
                  product.images?.[0] ||
                  'https://via.placeholder.com/600x600?text=JLRP+Product';

                return (
                  <div key={product.id} className="product-card">
                    <div className="product-image">
                      <img src={image} alt={product.title} />
                    </div>
                    <div className="product-info">
                      <h3>{product.title}</h3>
                      <div className="product-price">
                        ₹{product.price.toFixed(2)}
                      </div>

                      <Link
                        href={`/product/${product.id}`}
                        className="btn btn-secondary"
                      >
                        View Product
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MenCollectionPage;
