'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Market {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  expiresAt: string;
  currentPriceYES: number;
  volume: number;
}

export default function Dashboard() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const fetchMarkets = async () => {
    try {
      const res = await fetch('/api/markets');
      if (!res.ok) throw new Error('Failed to load markets');
      const data = await res.json();
      setMarkets(data);
    } catch (err: any) {
      setError(err.message || 'Error loading markets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    // Poll for updates every 5 seconds on dashboard
    const interval = setInterval(fetchMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter categories
  const categories = ['All', ...Array.from(new Set(markets.map(m => m.category)))];
  
  const filteredMarkets = activeCategory === 'All' 
    ? markets 
    : markets.filter(m => m.category === activeCategory);

  return (
    <div className="animate-fade-in" style={{ padding: '20px 0' }}>
      
      {/* Intro Banner */}
      <div className="glass-panel" style={{
        padding: '40px',
        marginBottom: '32px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(21, 23, 37, 0.7) 0%, rgba(139, 92, 246, 0.05) 100%)',
        border: '1px solid var(--border-glass)'
      }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: '8px' }}>
          Predicting the future has never been <span className="text-gradient">this seamless.</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '600px', lineHeight: '1.5' }}>
          Place bids and asks on global events. Nebula Predict utilizes a production-grade custom order book matching engine to execute trades instantly.
        </p>
      </div>

      {/* Categories filter row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                backgroundColor: activeCategory === cat ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)',
                color: activeCategory === cat ? '#fff' : 'var(--text-muted)',
                transition: 'var(--transition-smooth)',
                whiteSpace: 'nowrap',
                border: '1px solid',
                borderColor: activeCategory === cat ? 'transparent' : 'var(--border-glass)'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Showing {filteredMarkets.length} active markets
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading markets feed...
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(244,63,94,0.1)',
          border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '8px',
          color: 'var(--color-no)',
          padding: '16px',
          textAlign: 'center',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Markets Grid */}
      {!loading && !error && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '24px'
        }}>
          {filteredMarkets.map((market) => {
            const yesPercent = Math.round(market.currentPriceYES * 100);
            const noPercent = 100 - yesPercent;
            const isResolved = market.status !== 'ACTIVE';

            return (
              <div 
                key={market.id} 
                className="glass-panel" 
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-primary)',
                    backgroundColor: 'var(--color-primary-glow)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(139,92,246,0.2)'
                  }}>
                    {market.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                    Exp: {new Date(market.expiresAt).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: '1.4', marginBottom: '8px' }}>
                    <Link href={`/markets/${market.id}`} style={{ transition: 'var(--transition-smooth)' }} className="market-link">
                      {market.title}
                    </Link>
                  </h3>
                  <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {market.description}
                  </p>
                </div>

                {/* Price probability bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-yes)' }}>YES: {yesPercent}%</span>
                    <span style={{ color: 'var(--color-no)' }}>NO: {noPercent}%</span>
                  </div>
                  <div style={{
                    height: '8px',
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    display: 'flex'
                  }}>
                    <div style={{ width: `${yesPercent}%`, backgroundColor: 'var(--color-yes)', transition: 'var(--transition-smooth)' }} />
                    <div style={{ width: `${noPercent}%`, backgroundColor: 'var(--color-no)', transition: 'var(--transition-smooth)' }} />
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-glass)'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                    Volume: <span style={{ color: 'var(--text-muted)' }}>{market.volume.toLocaleString()} shares</span>
                  </div>
                  
                  {isResolved ? (
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: market.status === 'RESOLVED_YES' 
                        ? 'var(--color-yes)' 
                        : market.status === 'RESOLVED_NO' 
                          ? 'var(--color-no)' 
                          : 'var(--text-muted)',
                      textTransform: 'uppercase'
                    }}>
                      {market.status.replace('RESOLVED_', '')}
                    </span>
                  ) : (
                    <Link 
                      href={`/markets/${market.id}`}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                    >
                      Trade
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
