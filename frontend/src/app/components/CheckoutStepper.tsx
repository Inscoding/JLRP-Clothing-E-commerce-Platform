// src/components/CheckoutStepper.tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface Step {
  label: string;
  path: string | null; // null = not clickable (Payment)
}

const STEPS: Step[] = [
  { label: 'Cart', labelPath: '/cart', path: '/cart' },
  { label: 'Address', labelPath: '/checkout', path: '/checkout' },
  // Payment is Razorpay popup, so no direct route now
  { label: 'Payment', labelPath: '/payment', path: null },
  { label: 'Done', labelPath: '/order-success', path: '/order-success' },
];

interface CheckoutStepperProps {
  className?: string;
}

export function CheckoutStepper({ className }: CheckoutStepperProps) {
  const pathname = usePathname();
  const router = useRouter();

  // decide current step based on current URL
  let currentStepIndex = 0;

  if (pathname.startsWith('/cart')) currentStepIndex = 0;
  else if (pathname.startsWith('/checkout')) currentStepIndex = 1;
  else if (pathname.startsWith('/payment')) currentStepIndex = 2;
  else if (pathname.startsWith('/order-success')) currentStepIndex = 3;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        marginTop: 4,
      }}
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isActive = index === currentStepIndex;

        const circleColor = isActive || isCompleted ? '#22c55e' : '#e5e7eb';
        const textColor = isActive ? '#111827' : '#6b7280';

        const canClick =
          step.path !== null && // payment step is not clickable
          index <= currentStepIndex && // you can only go backwards or current
          !pathname.startsWith(step.path);

        const handleClick = () => {
          if (canClick && step.path) {
            router.push(step.path);
          }
        };

        return (
          <React.Fragment key={step.label}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: canClick ? 'pointer' : 'default',
              }}
              onClick={handleClick}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: `2px solid ${circleColor}`,
                  backgroundColor: isCompleted ? '#22c55e' : '#ffffff',
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
                {step.label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div
                style={{
                  width: 44,
                  height: 2,
                  backgroundColor:
                    index < currentStepIndex ? '#22c55e' : '#e5e7eb',
                  margin: '0 4px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// optional default export so both styles work
export default CheckoutStepper;
