// src/app/product/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '../../../context/cart-context';

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
  detailedDescription?: string;
  rating?: number;
  ratingCount?: number;
}

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id || '') as string;

  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`${API_BASE}/products/${id}`);

        if (res.status === 404) {
          setError('Product not found');
          setProduct(null);
          return;
        }

        if (!res.ok) {
          const text = await res.text();
          setError(`Failed to load product: ${res.status} ${text}`);
          return;
        }

        const p = await res.json();

        const mapped: Product = {
          id: p.id || p._id || '',
          title: p.title,
          price: p.price,
          images: p.images || [],
          gender: p.gender,
          category: p.category,
          subcategory: p.subcategory,
          description: p.description,
          detailedDescription: p.detailedDescription,
          rating: p.rating,
          ratingCount: p.ratingCount,
        };

        setProduct(mapped);
      } catch (err) {
        console.error(err);
        setError('Network error — cannot load product.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const image =
    product && product.images?.length > 0
      ? product.images[0]
      : 'https://via.placeholder.com/800x800?text=JLRP+Product';

  const ratingValue = product?.rating ?? 3.6;
  const ratingCount = product?.ratingCount ?? 12488;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    if (product?.gender === 'men') router.push('/men');
    else if (product?.gender === 'women') router.push('/women');
    else router.push('/');
  };

  const handleAddToCart = () => {
    if (!product) return;

    setAdding(true);
    try {
      addItem(
        {
          productId: product.id,
          name: product.title,
          price: product.price,
          image,
          size: null,
        },
        1
      );
      setMessage('Added to cart ✅');
    } catch (err) {
      console.error(err);
      setMessage('Failed to add to cart. Try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;

    try {
      addItem(
        {
          productId: product.id,
          name: product.title,
          price: product.price,
          image,
          size: null,
        },
        1
      );
      router.push('/cart');
    } catch (err) {
      console.error(err);
      setMessage('Failed to start checkout. Try again.');
    }
  };

  return (
    <div style={{ paddingTop: '100px', paddingBottom: '80px' }}>
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 20px',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: '#4b5563',
            fontSize: '14px',
          }}
        >
          <span style={{ fontSize: '18px' }}>←</span>
          <span>Back</span>
        </button>

        {loading && <p>Loading product…</p>}

        {error && !loading && (
          <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>
        )}

        {!loading && !error && product && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                gap: '40px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: '#f5f5f5',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                }}
              >
                <img
                  src={image}
                  alt={product.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>

              <div>
                <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
                  {product.title}
                </h1>

                <p
                  style={{
                    textTransform: 'capitalize',
                    color: '#6b7280',
                    marginBottom: '8px',
                  }}
                >
                  {product.gender} • {product.category} • {product.subcategory}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span>{ratingValue.toFixed(1)}</span>
                    <span>★</span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    {ratingCount.toLocaleString('en-IN')} ratings
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 600,
                    color: '#ef4444',
                    margin: '16px 0 20px',
                  }}
                >
                  ₹{product.price.toFixed(2)}
                </div>

                {product.description && (
                  <p
                    style={{
                      color: '#4b5563',
                      marginBottom: '20px',
                      lineHeight: 1.6,
                    }}
                  >
                    {product.description}
                  </p>
                )}

                {/* 🔥 Updated vertical button layout */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxWidth: '260px',
                  }}
                >
                  <button
                    onClick={handleAddToCart}
                    disabled={adding}
                    style={{
                      width: '100%',
                      background: '#ff7e28',
                      color: '#fff',
                      border: 'none',
                      padding: '0.9rem 1.8rem',
                      borderRadius: 9999,
                      cursor: 'pointer',
                      fontWeight: 600,
                      opacity: adding ? 0.7 : 1,
                    }}
                  >
                    {adding ? 'Adding…' : 'Add to Cart'}
                  </button>

                  <button
                    onClick={handleBuyNow}
                    style={{
                      width: '100%',
                      background: '#fff',
                      color: '#ff7e28',
                      border: '1px solid #ff7e28',
                      padding: '0.9rem 1.8rem',
                      borderRadius: 9999,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Buy Now
                  </button>
                </div>

                {message && (
                  <p
                    style={{
                      fontSize: 12,
                      color: '#4b5563',
                      marginTop: 8,
                    }}
                  >
                    {message}
                  </p>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: '40px',
                paddingTop: '24px',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <h2
                style={{
                  fontSize: '22px',
                  marginBottom: '16px',
                  fontWeight: 600,
                }}
              >
                Product Description
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 0.7fr) minmax(0, 1.3fr)',
                  gap: '24px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '260px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                  }}
                >
                  <img
                    src={image}
                    alt={product.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ fontSize: 14, color: '#4b5563' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 4,
                        color: '#111827',
                      }}
                    >
                      Classic Pattern
                    </h3>
                    <p>
                      {product.detailedDescription ||
                        'Designed with a timeless look, this piece pairs effortlessly with a range of T-shirts and shirts, making it suitable for both casual and semi-formal occasions.'}
                    </p>
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 4,
                        color: '#111827',
                      }}
                    >
                      Comfortable Design
                    </h3>
                    <p>
                      The fit and fabric are chosen to keep you comfortable all
                      day while maintaining a sharp appearance — ideal for
                      college, office, or casual outings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
