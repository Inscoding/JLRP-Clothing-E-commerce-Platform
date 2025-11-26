// src/lib/cart.ts
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
}

const CART_KEY = 'jlrp_cart';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getCart(): CartItem[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  const existingIndex = cart.findIndex(
    (c) => c.productId === item.productId && c.size === item.size
  );
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

export function removeFromCart(productId: string, size?: string) {
  const cart = getCart().filter(
    (c) => !(c.productId === productId && c.size === size)
  );
  saveCart(cart);
}

export function clearCart() {
  saveCart([]);
}

export function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
