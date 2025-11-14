// src/app/shop/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  material: string;
  price: number; // price in rupees (e.g. 2499 -> ₹2,499.00)
  image: string;
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');

  // Mock data - replace with API call later
  useEffect(() => {
    const mockProducts: Product[] = [
      {
        id: 1,
        name: 'Essential Oversized Tee',
        category: 'T-Shirts',
        description: 'Premium heavyweight tee',
        material: '100% Cotton • Oversized Fit',
        price: 2499,
        image: 'https://picsum.photos/800/1066?random=1',
      },
      {
        id: 2,
        name: 'Classic Hoodie',
        category: 'Hoodies',
        description: 'Comfort-focused hoodie',
        material: 'Brushed Cotton • Regular Fit',
        price: 4499,
        image: 'https://picsum.photos/800/1066?random=2',
      },
      {
        id: 3,
        name: 'JLRP Cap',
        category: 'Accessories',
        description: 'Structured baseball cap',
        material: 'Cotton Twill • Adjustable',
        price: 1799,
        image: 'https://picsum.photos/800/1066?random=3',
      },
      {
        id: 4,
        name: 'Premium Crewneck',
        category: 'Hoodies',
        description: 'Soft French terry',
        material: '100% Cotton • Relaxed Fit',
        price: 3999,
        image: 'https://picsum.photos/800/1066?random=4',
      },
      {
        id: 5,
        name: 'Signature Tee',
        category: 'T-Shirts',
        description: 'Minimalist design',
        material: '100% Cotton • Classic Fit',
        price: 2199,
        image: 'https://picsum.photos/800/1066?random=5',
      },
      {
        id: 6,
        name: 'Canvas Tote',
        category: 'Accessories',
        description: 'Everyday carryall',
        material: 'Heavy Canvas • Natural',
        price: 1299,
        image: 'https://picsum.photos/800/1066?random=6',
      },
    ];

    // simulate load
    setTimeout(() => {
      setProducts(mockProducts);
      setLoading(false);
    }, 250);
  }, []);

  // formatter for INR (treating price as rupees)
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(price);

  // derive categories dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ['All', ...Array.from(set)];
  }, [products]);

  // filtered + searched results
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (filter !== 'All' && product.category !== filter) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.material.toLowerCase().includes(q)
      );
    });
  }, [products, filter, query]);

  // simple add-to-cart that persists in localStorage
  const addToCart = (product: Product) => {
    try {
      const raw = localStorage.getItem('jlrp_cart');
      const cart: CartItem[] = raw ? (JSON.parse(raw) as CartItem[]) : [];
      const idx = cart.findIndex((i) => i.id === product.id);
      if (idx >= 0) {
        cart[idx].qty = (cart[idx].qty || 1) + 1;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
        });
      }
      localStorage.setItem('jlrp_cart', JSON.stringify(cart));
      // minimal feedback — replace with toast in future
      alert(`${product.name} added to cart`);
    } catch (err) {
      // eslint-friendly error handling
      // console.error is fine in client code
      console.error('addToCart error', err);
      alert('Could not add to cart — try again.');
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-black text-white py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 font-montserrat tracking-tight">
            Wear Confidence. Be JLRP.
          </h1>
          <p className="text-xl lg:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Premium tees, hoodies & accessories crafted for comfort and bold
            living.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#products"
              className="bg-white text-black px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-300 hover:shadow-lg"
            >
              Shop Now
            </a>
            <Link
              href="/products"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-black transition-all duration-300"
            >
              Explore Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Category Filter Bar */}
      <section
        id="products"
        className="sticky top-0 bg-white z-10 border-b border-gray-200"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="product categories"
            >
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  aria-pressed={filter === category}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    filter === category
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-auto">
              <label className="sr-only" htmlFor="product-search">
                Search products
              </label>
              <input
                id="product-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search products..."
                className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 aspect-3/4 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              No products match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="group cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-xl rounded-lg overflow-hidden"
                >
                  <div className="aspect-3/4 bg-gray-100 overflow-hidden relative">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={false}
                    />
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-1">
                      {product.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">
                      {product.material}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">
                        {formatPrice(product.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors duration-200"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Brand Story Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-8 font-montserrat">
              Built for Everyday Creators
            </h2>
            <p className="text-lg text-gray-700 mb-8 leading-relaxed">
              JLRP Brand is built for everyday creators — combining comfort,
              style, and authenticity. Each piece is crafted in India with
              precision and care.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="text-center p-6">
                <div className="text-2xl mb-2">🇮🇳</div>
                <h3 className="font-semibold mb-2">Made in India</h3>
                <p className="text-gray-600 text-sm">
                  Proudly crafted with local expertise
                </p>
              </div>
              <div className="text-center p-6">
                <div className="text-2xl mb-2">👕</div>
                <h3 className="font-semibold mb-2">Streetwear Inspired</h3>
                <p className="text-gray-600 text-sm">
                  Urban aesthetics meet premium quality
                </p>
              </div>
              <div className="text-center p-6">
                <div className="text-2xl mb-2">🌱</div>
                <h3 className="font-semibold mb-2">Ethical Production</h3>
                <p className="text-gray-600 text-sm">
                  Sustainable and responsible manufacturing
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="bg-black text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold mb-6 font-montserrat">
            Join the JLRP movement — new drops every month.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://instagram.com/jlrpbrand"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#ff4500] text-white px-8 py-4 rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 hover:shadow-lg"
            >
              Follow on Instagram
            </a>
            <Link
              href="/products"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-black transition-all duration-300"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
