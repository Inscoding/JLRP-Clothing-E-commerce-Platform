'use client';

import React, { useState, useEffect } from 'react';
import './styles.css';

const JLRPClothingPage: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    // Set initial state after component mounts
    handleScroll();

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const products = [
    {
      id: 1,
      name: 'Classic Tee',
      price: '$39.99',
      image:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1480&q=80',
      alt: 'Classic Tee',
    },
    {
      id: 2,
      name: 'Hoodie Deluxe',
      price: '$79.99',
      image:
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
      alt: 'Hoodie Deluxe',
    },
    {
      id: 3,
      name: 'Street Cap',
      price: '$29.99',
      image:
        'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1752&q=80',
      alt: 'Street Cap',
    },
  ];

  const categories = [
    {
      id: 1,
      name: "Men's Collection",
      image:
        'https://images.unsplash.com/photo-1617137968427-85924c800a22?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80',
    },
    {
      id: 2,
      name: "Women's Collection",
      image:
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2073&q=80',
    },
    {
      id: 3,
      name: 'Unisex Collection',
      image:
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    },
  ];

  const footerLinks = [
    { id: 1, text: 'Home', href: '#' },
    { id: 2, text: 'Shop', href: '#' },
    { id: 3, text: 'About Us', href: '#' },
    { id: 4, text: 'Collections', href: '#' },
    { id: 5, text: 'Contact', href: '#' },
  ];

  return (
    <div className="jlrp-page">
      {/* Header - Using data attribute instead of className for dynamic state */}
      <header className="header" data-scrolled={isScrolled ? 'true' : 'false'}>
        <div className="container header-container">
          <div className="logo">
            JLRP<span>.</span>
          </div>
          <nav>
            <ul>
              <li>
                <a href="#">Home</a>
              </li>
              <li>
                <a href="#">Shop</a>
              </li>
              <li>
                <a href="#">Men</a>
              </li>
              <li>
                <a href="#">Women</a>
              </li>
              <li>
                <a href="#">Collections</a>
              </li>
            </ul>
          </nav>
          <div className="header-actions">
            <button className="icon-btn">🔍</button>
            <button className="icon-btn">🛍️</button>
            <button className="icon-btn">👤</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-content">
          <h1>Wear Confidence.</h1>
          <p>Fresh tees, hoodies & merch — made to impress.</p>
          <button className="btn btn-primary">Shop Now</button>
        </div>
      </section>

      {/* Featured Products */}
      <section className="section products-section">
        <div className="container">
          <div className="section-title">
            <h2>Featured Collection</h2>
            <p>Discover our premium selection of streetwear essentials</p>
          </div>
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-image">
                  <img src={product.image} alt={product.alt} />
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <div className="product-price">{product.price}</div>
                  <button className="btn btn-secondary">View Product</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Banners */}
      <section className="section categories-section">
        <div className="container">
          {categories.map((category) => (
            <div
              key={category.id}
              className="category-banner"
              style={{ backgroundImage: `url(${category.image})` }}
            >
              <div className="category-overlay"></div>
              <div className="category-content">
                <h3>{category.name}</h3>
                <button className="btn btn-outline">Shop Now</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="section newsletter-section">
        <div className="container">
          <h2>Join the JLRP Tribe</h2>
          <p>
            Subscribe to our newsletter for exclusive updates, early access to
            new collections, and special offers.
          </p>
          <div className="newsletter-form">
            <input type="email" placeholder="Enter your email address" />
            <button type="submit" className="btn btn-primary">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-about">
              <div className="footer-logo">
                JLRP<span>.</span>
              </div>
              <p>
                Premium streetwear that blends comfort with confidence. Designed
                for those who make their own rules.
              </p>
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
                    <a href={link.href}>{link.text}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="footer-contact">
              <h4>Contact Us</h4>
              <p>📍 123 Fashion Street, New York, NY</p>
              <p>📞 +1 (555) 123-4567</p>
              <p>✉️ hello@jlrpfashion.com</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2023 JLRP Brand. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default JLRPClothingPage;
