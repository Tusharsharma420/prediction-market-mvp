'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Market {
  id: number;
  title: string;
  category: string;
  status: string;
  expiresAt: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Create market form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('AI & Tech');
  const [expiresAt, setExpiresAt] = useState('');

  // Active markets state
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchActiveMarkets = async () => {
    try {
      const res = await fetch('/api/markets');
      if (!res.ok) throw new Error('Failed to load markets');
      const data = await res.json();
      // Only display ACTIVE markets for resolution
      setMarkets(data.filter((m: Market) => m.status === 'ACTIVE'));
    } catch (err: any) {
      setError(err.message || 'Error loading markets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin');
    } else if (status === 'authenticated') {
      fetchActiveMarkets();
    }
  }, [status]);

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !category || !expiresAt) return;
    setError('');

    try {
      const res = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          expiresAt
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create market');
      }

      alert('Market created successfully!');
      setTitle('');
      setDescription('');
      setExpiresAt('');
      fetchActiveMarkets();
    } catch (err: any) {
      setError(err.message || 'Error creating market');
    }
  };

  const handleResolveMarket = async (marketId: number, outcome: 'YES' | 'NO' | 'CANCELLED') => {
    if (actionLoading !== null) return;
    if (!confirm(`Are you sure you want to resolve Market #${marketId} to ${outcome}? This will distribute payouts and close the market permanently.`)) return;

    setActionLoading(marketId);
    try {
      const res = await fetch(`/api/markets/${marketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resolve market');
      }

      alert(`Market #${marketId} resolved successfully to ${outcome}!`);
      fetchActiveMarkets();
    } catch (err: any) {
      alert(err.message || 'Error resolving market');
    } finally {
      setActionLoading(null);
    }
  };

  if (status === 'loading' || loading) {
    return <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>Loading admin panel...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 0' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Admin & Resolution Center</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create new prediction contracts and resolve active books.</p>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(244,63,94,0.1)',
          border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '8px',
          color: 'var(--color-no)',
          padding: '16px',
          fontSize: '0.85rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px', alignItems: 'stretch' }}>
        
        {/* Left Column: Create Market */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>Create Prediction Contract</h3>
          
          <form onSubmit={handleCreateMarket} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Market Title</label>
              <input
                type="text"
                placeholder="e.g. Will SpaceX launch Starship Flight 6 in 2026?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                style={{ marginTop: '6px' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Description / Resolution Criteria</label>
              <textarea
                placeholder="Detail resolution source, terms, and conditions."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
                style={{ marginTop: '6px', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-input"
                  style={{ marginTop: '6px', background: 'rgba(17, 24, 39, 0.9)' }}
                >
                  <option value="AI & Tech">AI & Tech</option>
                  <option value="Space">Space</option>
                  <option value="Finance & Econ">Finance & Econ</option>
                  <option value="Politics">Politics</option>
                  <option value="Pop Culture">Pop Culture</option>
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Expiration Date</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="form-input"
                  style={{ marginTop: '6px' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: 'auto', padding: '14px' }}>
              Publish Market Contract
            </button>
          </form>
        </div>

        {/* Right Column: Resolve Markets */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>Resolve Active Contracts</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '550px' }}>
            {markets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dark)' }}>
                No active contracts awaiting resolution
              </div>
            ) : (
              markets.map((m) => (
                <div 
                  key={m.id} 
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-glass)',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>{m.category}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>Expires: {new Date(m.expiresAt).toLocaleDateString()}</span>
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      #{m.id}: {m.title}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleResolveMarket(m.id, 'YES')}
                      disabled={actionLoading === m.id}
                      className="badge-yes"
                      style={{
                        flex: 1,
                        padding: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      Resolve YES
                    </button>
                    <button
                      onClick={() => handleResolveMarket(m.id, 'NO')}
                      disabled={actionLoading === m.id}
                      className="badge-no"
                      style={{
                        flex: 1,
                        padding: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      Resolve NO
                    </button>
                    <button
                      onClick={() => handleResolveMarket(m.id, 'CANCELLED')}
                      disabled={actionLoading === m.id}
                      style={{
                        flex: 1,
                        padding: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        borderRadius: '6px',
                        border: '1px solid var(--border-glass)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      Cancel Split
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
