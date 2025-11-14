// src/app/admin/page.tsx (server component)
import { redirect } from 'next/navigation';

export default function AdminIndex() {
  // redirect admin root to products list
  redirect('/admin/products');
}
