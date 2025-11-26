// src/app/cart/page.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/cart-context';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem } = useCart();
  const isMobile = useIsMobile(768);

  const [toast, setToast] = useState<string | null>(null);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const discount = 0;
  const deliveryCharges = subtotal > 0 ? 0 : 0;
  const totalAmount = subtotal - discount + deliveryCharges;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRemove = (productId: string, size: string | null) => {
    const item = items.find(
      (i) => i.productId === productId && (i.size || null) === (size || null)
    );
    removeItem(productId, size);
    if (item) setToast(`Removed ${item.name} from your cart`);
  };

  const handlePlaceOrder = () => {
    if (items.length === 0) return;
    router.push('/checkout');
  };

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  // Core back button (style same as men page)
  const backButtonCore = (
    <button
      type="button"
      onClick={handleBack}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '50px',
        border: '1.8px solid #111',
        fontSize: '14px',
        background: '#fff',
        cursor: 'pointer',
        fontWeight: 500,
        transition: '0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#111';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#fff';
        e.currentTarget.style.color = '#111';
      }}
    >
      ← Back
    </button>
  );

  // ============ EMPTY CART ============

  if (items.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          padding: isMobile ? '72px 12px 40px' : '100px 20px 80px',
        }}
      >
        {/* Back button FULL-LEFT like men page */}
        <div
          style={{
            width: '100%',
            paddingLeft: isMobile ? '16px' : '40px',
            marginBottom: '25px',
          }}
        >
          {backButtonCore}
        </div>

        {/* Centered empty state content */}
        <div
          style={{
            maxWidth: isMobile ? '100%' : '900px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            Your Cart is Empty
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '20px',
            }}
          >
            Looks like you haven&apos;t added anything yet.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 24px',
              borderRadius: 9999,
              background: '#000',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Shop Now
          </Link>
        </div>
      </div>
    );
  }

  // ============ NORMAL CART ============

  return (
    <div
      style={{
        width: '100%',
        padding: isMobile ? '72px 12px 40px' : '100px 20px 80px',
      }}
    >
      {/* Back button FULL-LEFT like men page */}
      <div
        style={{
          width: '100%',
          paddingLeft: isMobile ? '16px' : '40px',
          marginBottom: '25px',
        }}
      >
        {backButtonCore}
      </div>

      {/* Main cart container centered */}
      <div
        style={{
          maxWidth: isMobile ? '100%' : '1100px',
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          Shopping Cart
        </h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(0, 1.6fr) 320px',
            gap: isMobile ? '14px' : '24px',
            alignItems: 'flex-start',
          }}
        >
          {/* LEFT: CART ITEMS */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {items.map((item) => {
              const key = `${item.productId}-${item.size ?? 'nosize'}`;
              const lineTotal = item.price * item.quantity;

              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '16px',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                  }}
                >
                  {/* IMAGE */}
                  <div
                    style={{
                      width: isMobile ? '90px' : '110px',
                      height: isMobile ? '90px' : '110px',
                      flexShrink: 0,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        No image
                      </span>
                    )}
                  </div>

                  {/* DETAILS */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            marginBottom: 4,
                          }}
                        >
                          {item.name}
                        </p>
                        {item.size && (
                          <p
                            style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: 2,
                            }}
                          >
                            Size:{' '}
                            <span style={{ fontWeight: 500 }}>{item.size}</span>
                          </p>
                        )}
                        <p
                          style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            marginBottom: 4,
                          }}
                        >
                          Seller: JLRP Official
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            marginBottom: 2,
                          }}
                        >
                          ₹{lineTotal.toLocaleString('en-IN')}
                        </p>
                        <p
                          style={{
                            fontSize: '11px',
                            color: '#6b7280',
                          }}
                        >
                          ₹{item.price.toLocaleString('en-IN')} / item
                        </p>
                      </div>
                    </div>

                    {/* QTY + ACTIONS */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '16px',
                        marginTop: '8px',
                      }}
                    >
                      {/* Quantity control */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 9999,
                          overflow: 'hidden',
                          border: '1px solid #d1d5db',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.size ?? null,
                              Math.max(1, item.quantity - 1)
                            )
                          }
                          style={{
                            border: 'none',
                            background: '#f3f4f6',
                            padding: '4px 10px',
                            fontSize: '16px',
                            cursor: 'pointer',
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            width: '36px',
                            textAlign: 'center',
                            fontSize: '14px',
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.size ?? null,
                              item.quantity + 1
                            )
                          }
                          style={{
                            border: 'none',
                            background: '#f3f4f6',
                            padding: '4px 10px',
                            fontSize: '16px',
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontWeight: 600,
                          color: '#4b5563',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        Save for later
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemove(item.productId, item.size ?? null)
                        }
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontWeight: 600,
                          color: '#dc2626',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: PRICE DETAILS */}
          <aside
            style={{
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
              padding: '16px 16px 12px',
              fontSize: '14px',
              marginTop: isMobile ? '4px' : 0,
            }}
          >
            <h2
              style={{
                fontSize: '13px',
                fontWeight: 600,
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '8px',
                marginBottom: '8px',
              }}
            >
              PRICE DETAILS ({totalItems} item{totalItems !== 1 ? 's' : ''})
            </h2>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Price</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                color: '#16a34a',
              }}
            >
              <span>Discount</span>
              <span>- ₹{discount.toLocaleString('en-IN')}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              <span>Delivery Charges</span>
              <span style={{ color: '#16a34a' }}>
                {deliveryCharges === 0
                  ? 'Free'
                  : `₹${deliveryCharges.toLocaleString('en-IN')}`}
              </span>
            </div>

            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                marginTop: 10,
                paddingTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 600,
              }}
            >
              <span>Total Amount</span>
              <span>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>

            <p
              style={{
                fontSize: 11,
                color: '#16a34a',
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              You will save ₹{discount.toLocaleString('en-IN')} on this order
            </p>

            <button
              type="button"
              onClick={handlePlaceOrder}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 9999,
                border: 'none',
                background: '#ff9f00',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              PLACE ORDER
            </button>
          </aside>
        </div>

        <div style={{ marginTop: '16px', fontSize: '13px' }}>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>
            Continue shopping
          </Link>
        </div>
      </div>

      {/* Toast popup */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            background: '#111827',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '6px',
            fontSize: '13px',
            boxShadow: '0 10px 20px rgba(0,0,0,0.25)',
            zIndex: 2000,
          }}
        >
          ✅ {toast}
        </div>
      )}
    </div>
  );
}
