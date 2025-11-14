// src/components/Header.tsx
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          JLRP Brand
        </Link>
        <nav className="flex gap-6 text-gray-700">
          <Link href="/products">Products</Link>
          <Link href="/cart">Cart</Link>
          <Link
            href="/admin"
            className="border px-3 py-1 rounded hover:bg-black hover:text-white transition"
          >
            Owner
          </Link>
        </nav>
      </div>
    </header>
  );
}
