'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/cart-context';
import { loadRazorpayScript } from '../../lib/loadRazorpay';
import { useIsMobile } from '../../hooks/useIsMobile';
// you’re not using CheckoutStepper here, but keeping import is fine
import { CheckoutStepper } from '@/components/CheckoutStepper';

const API_BASE = 'http://localhost:8000';

interface ShippingAddress {
  fullName: string;
  phone: string;
  pincode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  landmark: string;
}

const initialAddress: ShippingAddress = {
  fullName: '',
  phone: '',
  pincode: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  landmark: '',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items } = useCart();
  const isMobile = useIsMobile(768);

  const [email, setEmail] = useState('');
  const [address, setAddress] = useState<ShippingAddress>(initialAddress);
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const platformFee = items.length > 0 ? 7 : 0;
  const totalPayable = subtotal + platformFee;

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/cart');
  };

  const handleAddressChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (items.length === 0) {
      alert('Your cart is empty.');
      return false;
    }

    if (!email.trim()) {
      alert('Please enter your email ID');
      return false;
    }

    if (!address.fullName.trim()) {
      alert('Please enter full name');
      return false;
    }
    if (!address.phone.trim() || address.phone.trim().length !== 10) {
      alert('Please enter a valid 10-digit phone number');
      return false;
    }
    if (!address.pincode.trim() || address.pincode.trim().length !== 6) {
      alert('Please enter a valid 6-digit pincode');
      return false;
    }
    if (!address.addressLine1.trim()) {
      alert('Please enter Address Line 1');
      return false;
    }
    if (!address.city.trim()) {
      alert('Please enter city');
      return false;
    }
    if (!address.state.trim()) {
      alert('Please enter state');
      return false;
    }
    if (!address.country.trim()) {
      alert('Please enter country');
      return false;
    }

    return true;
  };

  // 🔥 UPDATED: now also calls /payment/verify after Razorpay success
  const handleContinue = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        alert(
          'Failed to load Razorpay. Please check your internet connection.'
        );
        return;
      }

      // 1) Create order on backend (Razorpay order + DB order with PENDING_PAYMENT)
      const res = await fetch(`${API_BASE}/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(totalPayable), // rupees
          email,
          items: items.map((item) => ({
            product_id: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            size: item.size ?? null,
            image: item.image ?? null,
          })),
          shipping_address: address,
        }),
      });

      if (!res.ok) {
        console.error(await res.text());
        alert('Unable to start payment. Please try again.');
        return;
      }

      const order = await res.json();
      console.log('Backend create-order response:', order);

      // 2) Configure Razorpay checkout
      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order?.raw?.amount ?? order.amount * 100, // in paise
        currency: order.currency || 'INR',
        name: 'JLRP Brand World',
        description: 'Order payment',
        order_id: order.order_id, // Razorpay order id
        prefill: {
          email,
          name: address.fullName,
          contact: address.phone,
        },
        theme: {
          color: '#ff9f00',
        },
        handler: async function (response: any) {
          // 3) On Razorpay success → verify with backend
          console.log('Razorpay success response:', response);
          try {
            const verifyRes = await fetch(`${API_BASE}/payment/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_meta: {
                  db_order_id: order.db_order_id,
                  email,
                  amount: order.amount,
                },
              }),
            });

            if (!verifyRes.ok) {
              console.error(await verifyRes.text());
              alert(
                'Payment captured, but verification failed. Please contact support.'
              );
              router.push('/');
              return;
            }

            const verifyData = await verifyRes.json();
            console.log('Payment verified on server:', verifyData);

            alert('Payment successful! Your order has been placed.');
            // later redirect to dedicated success page: /order-success?orderId=verifyData.order_id
            router.push('/');
          } catch (err) {
            console.error('Error verifying payment:', err);
            alert(
              'Payment succeeded but verification failed. Please contact support.'
            );
            router.push('/');
          }
        },
        modal: {
          ondismiss: function () {
            console.log('Razorpay checkout closed');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // stepper config
  const steps = ['Cart', 'Address', 'Payment', 'Done'];
  const currentStepIndex = 1; // Address step

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '100%' : '1180px',
          margin: '0 auto',
          padding: isMobile ? '72px 12px 40px' : '96px 20px 72px',
        }}
      >
        {/* Back + small label row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? 12 : 16,
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: '#4b5563',
              fontSize: '14px',
              padding: '4px 0',
            }}
          >
            <span style={{ fontSize: '18px' }}>←</span>
            <span>Back</span>
          </button>

          {!isMobile && (
            <span
              style={{
                fontSize: 12,
                color: '#6b7280',
              }}
            >
              Secure Checkout
            </span>
          )}
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            marginBottom: isMobile ? 8 : 10,
            letterSpacing: 0.2,
          }}
        >
          Order Summary
        </h1>

        {/* Stepper */}
        {isMobile ? (
          <p
            style={{
              fontSize: 12,
              color: '#6b7280',
              marginBottom: 16,
            }}
          >
            Step 2 of 4 • Enter delivery address
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24,
              marginTop: 4,
            }}
          >
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isActive = index === currentStepIndex;
              const circleColor =
                isActive || isCompleted ? '#22c55e' : '#e5e7eb';
              const textColor = isActive ? '#111827' : '#6b7280';

              return (
                <div
                  key={step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '999px',
                        border: `2px solid ${circleColor}`,
                        background: isCompleted ? '#22c55e' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: isCompleted ? '#ffffff' : '#111827',
                      }}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: textColor,
                      }}
                    >
                      {step}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      style={{
                        width: 44,
                        height: 2,
                        background:
                          index < currentStepIndex ? '#22c55e' : '#e5e7eb',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MAIN GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(0, 1.8fr) 320px',
            gap: isMobile ? 14 : 24,
            alignItems: 'flex-start',
          }}
        >
          {/* LEFT – ITEMS + ADDRESS + EMAIL */}
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* ITEMS HEADER */}
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 13,
                fontWeight: 600,
                background: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>ITEMS ({items.length})</span>
              {subtotal > 0 && (
                <span
                  style={{
                    fontWeight: 600,
                    color: '#111827',
                    fontSize: 13,
                  }}
                >
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* ITEMS LIST */}
            <div style={{ padding: '14px 18px 10px' }}>
              {items.length === 0 && (
                <p style={{ fontSize: 14, color: '#6b7280' }}>
                  Your cart is empty.
                </p>
              )}

              {items.map((item) => {
                const key = `${item.productId}-${item.size ?? 'nosize'}`;
                const lineTotal = item.price * item.quantity;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div
                      style={{
                        width: isMobile ? 60 : 68,
                        height: isMobile ? 60 : 68,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#f3f4f6',
                        flexShrink: 0,
                      }}
                    >
                      {item.image && (
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
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          marginBottom: 4,
                          color: '#111827',
                        }}
                      >
                        {item.name}
                      </p>
                      {item.size && (
                        <p
                          style={{
                            fontSize: 12,
                            color: '#6b7280',
                            marginBottom: 2,
                          }}
                        >
                          Size: {item.size}
                        </p>
                      )}
                      <p
                        style={{
                          fontSize: 12,
                          color: '#6b7280',
                        }}
                      >
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        color: '#111827',
                      }}
                    >
                      ₹{lineTotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DELIVERY ADDRESS */}
            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                padding: '14px 18px 16px',
                fontSize: 13,
                background: '#ffffff',
              }}
            >
              <p
                style={{
                  fontWeight: 600,
                  marginBottom: 10,
                  fontSize: 14,
                  color: '#111827',
                }}
              >
                Delivery Address
              </p>

              {/* Name + Phone */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={address.fullName}
                    onChange={handleAddressChange}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={address.phone}
                    onChange={handleAddressChange}
                    placeholder="10-digit mobile"
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Pincode + Landmark */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    Pincode *
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={address.pincode}
                    onChange={handleAddressChange}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    Landmark
                  </label>
                  <input
                    type="text"
                    name="landmark"
                    value={address.landmark}
                    onChange={handleAddressChange}
                    placeholder="Near..."
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Address lines */}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    marginBottom: 4,
                    color: '#4b5563',
                  }}
                >
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  value={address.addressLine1}
                  onChange={handleAddressChange}
                  placeholder="Flat / House No, Street"
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    marginBottom: 4,
                    color: '#4b5563',
                  }}
                >
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="addressLine2"
                  value={address.addressLine2}
                  onChange={handleAddressChange}
                  placeholder="Area / Locality"
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              {/* City / State / Country */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                  gap: 10,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={address.city}
                    onChange={handleAddressChange}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    State *
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={address.state}
                    onChange={handleAddressChange}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 4,
                      color: '#4b5563',
                    }}
                  >
                    Country *
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={address.country}
                    onChange={handleAddressChange}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* EMAIL BOX */}
            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                padding: '12px 18px 14px',
                background: '#f9fafb',
                fontSize: 13,
              }}
            >
              <p
                style={{
                  marginBottom: 6,
                  color: '#4b5563',
                  fontSize: 13,
                }}
              >
                Order confirmation email will be sent to
              </p>
              <input
                type="email"
                placeholder="Enter your email ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>
          </div>

          {/* RIGHT – PRICE DETAILS */}
          <aside
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              padding: '14px 18px 16px',
              marginTop: isMobile ? 4 : 0,
              boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
              position: isMobile ? 'static' : 'sticky',
              top: 90,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 8,
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: '#111827',
              }}
            >
              Price Details
            </h2>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 14,
                color: '#374151',
              }}
            >
              <span>
                Price ({items.length} item{items.length !== 1 ? 's' : ''})
              </span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 14,
                color: '#374151',
              }}
            >
              <span>Platform Fee</span>
              <span>₹{platformFee.toLocaleString('en-IN')}</span>
            </div>

            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                marginTop: 8,
                paddingTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 15,
                fontWeight: 700,
                color: '#111827',
              }}
            >
              <span>Total Payable</span>
              <span>₹{totalPayable.toLocaleString('en-IN')}</span>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={loading}
              style={{
                marginTop: 14,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#ff9f00',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                letterSpacing: 0.3,
              }}
            >
              {loading ? 'PROCESSING…' : 'CONTINUE'}
            </button>

            {!isMobile && (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#9ca3af',
                  textAlign: 'center',
                }}
              >
                You will be redirected to a secure Razorpay payment page.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
