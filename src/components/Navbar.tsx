'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const [faucetLoading, setFaucetLoading] = useState(false);

  const handleFaucet = async () => {
    if (faucetLoading) return;
    setFaucetLoading(true);
    try {
      const res = await fetch('/api/wallet', { method: 'POST' });
      if (res.ok) {
        // Trigger NextAuth session update to pull fresh cash balance
        await update();
      } else {
        const err = await res.json();
        alert(err.error || 'Faucet request failed');
      }
    } catch (e) {
      console.error(e);
      alert('Network error claiming faucet');
    } finally {
      setFaucetLoading(false);
    }
  };

  const cash = (session?.user as any)?.cash ?? 0;

  return (
    <nav className="glass-panel" style={{
      margin: '20px',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: '20px',
      zIndex: 100,
      borderRadius: '16px',
      border: '1px solid var(--border-glass)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link href="/" style={{
          fontSize: '1.4rem',
          fontWeight: 800,
          letterSpacing: '-0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #a78bfa 0%, #34d399 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          <span>🔮</span>
          <span>NEBULA PREDICT</span>
        </Link>

        {session && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/" style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.95rem',
              backgroundColor: pathname === '/' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: pathname === '/' ? 'var(--color-primary)' : 'var(--text-muted)',
              transition: 'var(--transition-smooth)'
            }}>
              Markets
            </Link>
            <Link href="/portfolio" style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.95rem',
              backgroundColor: pathname === '/portfolio' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: pathname === '/portfolio' ? 'var(--color-primary)' : 'var(--text-muted)',
              transition: 'var(--transition-smooth)'
            }}>
              Portfolio
            </Link>
            <Link href="/admin" style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.95rem',
              backgroundColor: pathname === '/admin' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: pathname === '/admin' ? 'var(--color-primary)' : 'var(--text-muted)',
              transition: 'var(--transition-smooth)'
            }}>
              Admin
            </Link>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {session ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255,255,255,0.03)',
              padding: '6px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-glass)'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Balance:
              </span>
              <span style={{ fontWeight: 700, color: 'var(--color-yes)' }}>
                ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button 
                onClick={handleFaucet}
                disabled={faucetLoading}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '6px',
                  color: 'var(--color-yes)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {faucetLoading ? 'Claiming...' : 'Faucet +$1k'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                @{session.user?.name}
              </span>
              <button
                onClick={() => signOut()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-no)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <Link href="/login" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
