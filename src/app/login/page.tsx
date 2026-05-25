'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      router.push(callbackUrl);
    }
  }, [session, callbackUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        username,
        password,
        callbackUrl
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '40px',
        borderRadius: '24px',
        border: '1px solid var(--border-glass)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '3rem' }}>🔮</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '12px' }}>
            Welcome to Nebula
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
            Predict markets. Trade order books. Win rewards.
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(244,63,94,0.1)',
            border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: '8px',
            color: 'var(--color-no)',
            padding: '12px',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '20px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. tushar"
              className="form-input"
              style={{ marginTop: '6px' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              style={{ marginTop: '6px' }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '10px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In / Register'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: 'rgba(139,92,246,0.05)',
          border: '1px dashed rgba(139,92,246,0.15)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          💡 <strong>Tip:</strong> Entering a username that doesn't exist will <strong>automatically create</strong> a new account with a starting balance of <strong>$1,000.00</strong>.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading authentication interface...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
