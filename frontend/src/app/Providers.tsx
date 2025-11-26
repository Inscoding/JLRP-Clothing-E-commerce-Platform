// src/app/Providers.tsx
'use client';

import React from 'react';
import { CartProvider } from '../context/cart-context'; // from src/context

export function Providers({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
