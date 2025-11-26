// src/context/cart-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  size?: string | null;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (
    productId: string,
    size: string | null | undefined,
    quantity: number
  ) => void;
  removeItem: (productId: string, size: string | null | undefined) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = 'jlrp_cart';

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (err) {
      console.error('Error reading cart from localStorage', err);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Error saving cart to localStorage', err);
    }
  }, [items]);

  const addItem: CartContextValue['addItem'] = (item, quantity = 1) => {
    setItems((prev) => {
      const index = prev.findIndex(
        (ci) =>
          ci.productId === item.productId &&
          (ci.size || null) === (item.size || null)
      );
      if (index !== -1) {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          quantity: copy[index].quantity + quantity,
        };
        return copy;
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const updateQuantity: CartContextValue['updateQuantity'] = (
    productId,
    size,
    quantity
  ) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.productId === productId && (item.size || null) === (size || null)
            ? { ...item, quantity }
            : item
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem: CartContextValue['removeItem'] = (productId, size) => {
    setItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.productId === productId &&
            (item.size || null) === (size || null)
          )
      )
    );
  };

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, removeItem, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return ctx;
};
