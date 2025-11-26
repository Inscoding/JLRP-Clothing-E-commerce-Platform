// src/app/admin/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error('Failed');

      setMsg('If this email is registered, a reset link has been sent.');
    } catch (err) {
      setMsg('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label
        style={{ display: 'block', marginBottom: '0.5rem', color: 'white' }}
      >
        Email Address
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="owner email"
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          border: 'none',
          marginBottom: '1rem',
        }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          border: 'none',
          background: '#111827',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Sending…' : 'Send Reset Link'}
      </button>

      {msg && (
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'white' }}>
          {msg}
        </p>
      )}

      <p
        style={{
          marginTop: '1rem',
          fontSize: '0.875rem',
          textAlign: 'center',
          color: '#e5e7eb',
        }}
      >
        <Link href="/admin/login">Back to login</Link>
      </p>
    </form>
  );
}
