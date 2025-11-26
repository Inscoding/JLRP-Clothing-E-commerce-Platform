'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import './styles.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

const JLRPClothingPage: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // header shadow on scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // fetch products
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

        setProducts(mapped);
      } catch (err) {
        console.error(err);
        setError('Network error — cannot load products.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Hide dummy "Test Shirt"
  const visibleProducts = products.filter(
    (p) => p.title?.trim().toLowerCase() !== 'test shirt'
  );

  // search filter
  const filteredProducts = visibleProducts.filter((p) =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // only 3 collections
  const categories = [
    {
      id: 1,
      name: "Men's Collection",
      image:
        'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1974&q=80',
      href: '/men',
    },
    {
      id: 2,
      name: "Women's Collection",
      image:
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=2073&q=80',
      href: '/women',
    },
    {
      id: 3,
      name: 'Unisex Collection',
      image:
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=2070&q=80',
      href: '/unisex', // main shop page
    },
  ];

  const footerLinks = [
    { id: 1, text: 'Home', href: '/' },
    { id: 2, text: 'Shop', href: '/unisex' },
    { id: 3, text: 'About Us', href: '#' },
    { id: 4, text: 'Collections', href: '#' },
    { id: 5, text: 'Contact', href: '#' },
  ];

  return (
    <div className="jlrp-page">
      {/* ------------ HEADER ------------ */}
      <header className="header" data-scrolled={isScrolled ? 'true' : 'false'}>
        <div className="container header-container">
          <div className="logo">
            JLRP<span>.</span>
          </div>

          {/* NAVIGATION */}
          <nav>
            <ul>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                {/* Shop goes to Unisex */}
                <Link href="/unisex">Shop</Link>
              </li>
              <li>
                <Link href="/men">Men</Link>
              </li>
              <li>
                <Link href="/women">Women</Link>
              </li>
              <li>
                <a href="#">Collections</a>
              </li>
            </ul>
          </nav>

          {/* RIGHT SIDE ACTIONS */}
          <div
            className="header-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {/* SEARCH INPUT IN HEADER */}
            <div
              style={{
                position: 'relative',
                width: '190px',
                maxWidth: '50vw',
              }}
            >
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 32px 7px 10px',
                  borderRadius: '999px',
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 15,
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}
              >
                🔍
              </span>
            </div>

            {/* CART ICON */}
            <Link
              href="/cart"
              className="icon-btn"
              aria-label="Cart"
              style={{ fontSize: 20 }}
            >
              🛒
            </Link>
          </div>
        </div>
      </header>

      {/* ------------ HERO ------------ */}
      <section className="hero">
        <div className="container hero-content">
          <h1>Wear Confidence.</h1>
          <p>Fresh tees, hoodies & merch — made to impress.</p>
        </div>
      </section>

      {/* ------------ FEATURED PRODUCTS ------------ */}
      <section className="section products-section">
        <div className="container">
          <div className="section-title">
            <h2>Featured Collection</h2>
            <p>Discover our premium selection of streetwear essentials</p>
          </div>

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

          {loading && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              Loading products…
            </div>
          )}

          {/* Products grid – only if there are filtered products */}
          {filteredProducts.length > 0 && (
            <div className="products-grid">
              {filteredProducts.map((product) => {
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
          )}
        </div>
      </section>

      {/* ------------ CATEGORY BANNERS ------------ */}
      <section className="section categories-section">
        <div className="container">
          {/* stacked vertically – one by one */}
          <div
            className="category-grid"
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            {categories.map((category) => (
              <div
                key={category.id}
                className="category-banner"
                style={{ backgroundImage: `url(${category.image})` }}
              >
                <div className="category-overlay" />
                <div className="category-content">
                  <h3>{category.name}</h3>

                  <Link href={category.href} className="btn btn-outline">
                    Shop Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------ NEWSLETTER ------------ */}
      <section className="section newsletter-section">
        <div className="container">
          <h2>Join the JLRP Tribe</h2>
          <p>Subscribe for exclusive updates, early drops & offers.</p>
          <div className="newsletter-form">
            <input type="email" placeholder="Enter your email address" />
            <button type="submit" className="btn btn-primary">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* ------------ FOOTER ------------ */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-about">
              <div className="footer-logo">
                JLRP<span>.</span>
              </div>
              <p>Premium streetwear that blends comfort with confidence.</p>
              <div className="social-icons">
                <a href="#">📱</a>
                <a href="#">🐦</a>
                <a href="#">📘</a>
                <a href="#">🎵</a>
              </div>
            </div>

            <div className="footer-links">
              <h4>Quick Links</h4>
              <ul>
                {footerLinks.map((link) => (
                  <li key={link.id}>
                    <Link href={link.href}>{link.text}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-contact">
              <h4>Contact Us</h4>
              <p>📍 123 Fashion Street, New York</p>
              <p>📞 +1 (555) 123-4567</p>
              <p>✉ hello@jlrpfashion.com</p>
            </div>
          </div>

          <div className="footer-bottom">
            <p>
              &copy; {new Date().getFullYear()} JLRP Brand. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default JLRPClothingPage;
