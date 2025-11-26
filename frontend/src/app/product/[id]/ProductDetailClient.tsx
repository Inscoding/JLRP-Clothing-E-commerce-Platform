// src/app/product/[id]/ProductDetailClient.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from './page';
import { useCart } from '../../../context/cart-context';

interface Props {
  product: Product;
}

export default function ProductDetailClient({ product }: Props) {
  const router = useRouter();
  const { addItem } = useCart();

  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mainImage =
    product.images?.[0] ||
    'https://via.placeholder.com/800x800?text=JLRP+Product';

  const ratingValue = product.rating ?? 3.6;
  const ratingCount = product.ratingCount ?? 12488;

  const handleAddToCart = () => {
    setAdding(true);
    try {
      addItem(
        {
          productId: product.id,
          name: product.title,
          price: product.price,
          image: mainImage,
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

  const handleBack = () => {
    // Prefer going back in history
    if (window.history.length > 1) {
      router.back();
      return;
    }
    // Fallback based on gender
    if (product.gender === 'men') router.push('/men');
    else if (product.gender === 'women') router.push('/women');
    else router.push('/');
  };

  return (
    <>
      {/* Top back arrow */}
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black"
      >
        <span className="text-lg">←</span>
        <span>Back</span>
      </button>

      {/* Main layout */}
      <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
        {/* Left: big image + thumbnails (simple for now) */}
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* If you add more images later, show thumbnails here */}
        </div>

        {/* Right: product info + Add to cart */}
        <div className="space-y-4">
          <h1 className="text-2xl md:text-3xl font-semibold">
            {product.title}
          </h1>

          {/* Category breadcrumb line */}
          <p className="text-sm text-gray-500">
            {product.gender ? `${capitalize(product.gender)} • ` : ''}
            {product.category ? `${product.category} • ` : ''}
            {product.subcategory || ''}
          </p>

          {/* Ratings row like Flipkart */}
          <div className="flex items-center gap-3 mt-1">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 text-white text-xs font-medium">
              <span>{ratingValue.toFixed(1)}</span>
              <span>★</span>
            </div>
            <span className="text-xs text-gray-500">
              {ratingCount.toLocaleString('en-IN')} ratings
            </span>
          </div>

          {/* Price */}
          <div className="mt-4">
            <p className="text-2xl font-semibold">
              ₹{product.price.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Short line under price */}
          {product.description && (
            <p className="text-sm text-gray-600 mt-2">{product.description}</p>
          )}

          {/* Add to Cart button */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={adding}
              className="px-8 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60"
            >
              {adding ? 'Adding...' : 'Add to Cart'}
            </button>

            <button
              type="button"
              className="px-8 py-2 rounded-full border border-orange-500 text-orange-500 text-sm font-semibold"
            >
              Buy Now
            </button>
          </div>

          {message && <p className="text-xs text-gray-700 mt-2">{message}</p>}
        </div>
      </div>

      {/* Product Description section like Flipkart */}
      <section className="mt-10 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Product Description</h2>

        <div className="grid gap-6 md:grid-cols-[minmax(0,0.7fr),minmax(0,1.3fr)]">
          {/* Small image card */}
          <div className="rounded-xl overflow-hidden border bg-white max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Description text blocks */}
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <div>
              <h3 className="font-semibold mb-1">Classic Pattern</h3>
              <p>
                {product.detailedDescription ||
                  'This product is designed for everyday comfort with a clean, classic look. Pair it with your favourite tees, shirts or hoodies for both casual and semi-formal occasions.'}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Comfortable Design</h3>
              <p>
                The fabric and fit are chosen to give you all-day comfort while
                still keeping a sharp silhouette. Ideal for college, office, or
                casual outings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// small helper
function capitalize(str?: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
