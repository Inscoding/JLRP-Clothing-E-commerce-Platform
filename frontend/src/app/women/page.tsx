'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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

const WomenCollectionPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) {
          const text = await res.text();
          setError(`Failed to load products: ${res.status} ${text}`);
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

        const womenOnly = mapped.filter(
          (p) => p.gender && p.gender.toLowerCase() === 'women'
        );

        setProducts(womenOnly);
      } catch (err) {
        console.error(err);
        setError('Network error — cannot load products.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="jlrp-page">
      <section className="section products-section">
        <div className="container">
          <div className="section-title">
            <h2>Women&apos;s Collection</h2>
            <p>All products uploaded for women</p>
          </div>

          {error && <div className="error-box">{error}</div>}

          {loading && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              Loading products…
            </div>
          )}

          <div className="products-grid">
            {products.length === 0 && !loading && !error && (
              <p style={{ textAlign: 'center', gridColumn: '1 / -1' }}>
                No women&apos;s products yet.
              </p>
            )}

            {products.map((product) => {
              const image =
                product.images?.length > 0
                  ? product.images[0]
                  : 'https://via.placeholder.com/600x600?text=JLRP+Product';

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
      </section>
    </div>
  );
};

export default WomenCollectionPage;
