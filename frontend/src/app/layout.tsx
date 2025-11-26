// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css'; // if you have it – keep your global styles here
import { Providers } from './Providers'; // 👈 new

export const metadata: Metadata = {
  title: 'JLRP Brand - Wear Confidence',
  description: 'Premium streetwear that blends comfort with confidence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* 👇 whole app now wrapped with CartProvider */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
