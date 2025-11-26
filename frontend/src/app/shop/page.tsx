'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToCart } from '../../lib/cart';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categories: string[];
  sizes: string[];
  images: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const router = useRouter();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // 👇 change this route if your backend is different
        const res = await fetch(`${API_BASE_URL}/products`);
        if (!res.ok) throw new Error('Failed to load products');
        const data = await res.json();
        setProducts(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const categories = Array.from(
    new Set(products.flatMap((p) => p.categories || []))
  );

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((p) => p.categories?.includes(selectedCategory));

  const handleAddToCart = (product: Product) => {
    const size = product.sizes?.[0]; // simple: first size
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0] || '',
      quantity: 1,
      size,
    });
    alert('Added to cart');
  };

  const openProduct = (productId: string) => {
    // we already have src/app/product/[id]/page.tsx
    router.push(`/product/${productId}`);
  };

  if (loading) return <div className="p-6">Loading products…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto py-6 px-4">
        <h1 className="text-2xl font-semibold mb-4">Clothing</h1>

        <div className="flex gap-6">
          {/* Left filters */}
          <aside className="w-64 bg-white rounded-lg shadow p-4 h-fit">
            <h2 className="font-semibold mb-3 text-sm">Filters</h2>

            <div className="mb-4">
              <h3 className="font-medium mb-2 text-xs text-gray-700">
                Category
              </h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <button
                    className={
                      selectedCategory === 'all'
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-800'
                    }
                    onClick={() => setSelectedCategory('all')}
                  >
                    All
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c}>
                    <button
                      className={
                        selectedCategory === c
                          ? 'text-blue-600 font-semibold'
                          : 'text-gray-800'
                      }
                      onClick={() => setSelectedCategory(c)}
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Right grid */}
          <main className="flex-1">
            <div className="flex items-center justify-between mb-3 text-xs text-gray-600">
              <span>Showing {filteredProducts.length} products</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition p-2 cursor-pointer"
                  onClick={() => openProduct(product.id)}
                >
                  {/* Image */}
                  <div className="w-full h-48 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center mb-2">
                    {product.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">No image</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-sm">
                    <div className="font-semibold line-clamp-2 mb-1">
                      {product.name}
                    </div>
                    <div className="text-lg font-bold mb-1">
                      ₹{product.price}
                    </div>
                    <div className="text-[11px] text-green-600 mb-2">
                      In stock: {product.stock}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // don’t open detail page
                        handleAddToCart(product);
                      }}
                      className="w-full text-center text-sm font-semibold py-1.5 rounded bg-yellow-400 hover:bg-yellow-500"
                    >
                      ADD TO CART
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
