// src/app/admin/reset-password/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  useEffect(() => {
    if (!token) {
      setMsg('Invalid or missing reset token.');
      setStatus('error');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setMsg('Password must be at least 6 characters.');
      setStatus('error');
      return;
    }
    if (password !== confirm) {
      setMsg('Passwords do not match.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Failed to reset password');
      }

      setStatus('success');
      setMsg('Password updated successfully. Redirecting to login...');

      setTimeout(() => {
        router.push('/admin/login');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setMsg(err.message || 'Something went wrong. Try again.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px', color: 'white' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
            Reset Password
          </h1>
          <p>Set a new password for your admin account</p>
        </div>

        {!token ? (
          <p
            style={{
              background: '#111827',
              padding: '1rem',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}
          >
            Invalid reset link.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              New Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                marginBottom: '1rem',
              }}
            />

            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: '#111827',
                color: 'white',
                cursor: 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {status === 'loading' ? 'Updating...' : 'Update Password'}
            </button>

            {msg && (
              <p
                style={{
                  marginTop: '1rem',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  color: status === 'success' ? '#bbf7d0' : '#fee2e2',
                }}
              >
                {msg}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
