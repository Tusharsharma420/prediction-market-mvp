'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Position {
  id: number;
  marketId: number;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
}

interface OpenOrder {
  id: number;
  marketId: number;
  market: { title: string };
  type: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  price: number;
  quantity: number;
  remaining: number;
  status: string;
  createdAt: string;
}

interface Trade {
  id: number;
  marketId: number;
  marketTitle: string;
  type: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  price: number;
  quantity: number;
  totalValue: number;
  createdAt: string;
}

interface PortfolioData {
  cash: number;
  positions: Position[];
  openOrders: OpenOrder[];
  trades: Trade[];
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchPortfolioData = async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) throw new Error('Failed to load portfolio details');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading portfolio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/portfolio');
    } else if (status === 'authenticated') {
      fetchPortfolioData();
    }
  }, [status]);

  const handleCancelOrder = async (orderId: number) => {
    if (cancellingId !== null) return;
    setCancellingId(orderId);
    try {
      const res = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_order',
          orderId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel order');
      }

      fetchPortfolioData();
    } catch (err: any) {
      alert(err.message || 'Error cancelling order');
    } finally {
      setCancellingId(null);
    }
  };

  if (status === 'loading' || loading) {
    return <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>Loading portfolio status...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--color-no)', fontWeight: 600 }}>⚠️ {error || 'Error loading details'}</p>
        <button onClick={fetchPortfolioData} className="btn-secondary" style={{ marginTop: '20px' }}>Retry</button>
      </div>
    );
  }

  const { cash, positions, openOrders, trades } = data;

  // Valuation computations
  const positionsValuation = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalAccountValue = cash + positionsValuation;
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 0' }}>
      
      {/* Portfolio overview statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        
        <div className="glass-panel" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Net Worth</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>
            ${totalAccountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Cash + active positions valuation</span>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Available Cash</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: 'var(--color-yes)' }}>
            ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Instantly tradeable balance</span>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Positions Value</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>
            ${positionsValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span style={{ 
            fontSize: '0.8rem', 
            fontWeight: 700,
            color: totalPnL >= 0 ? 'var(--color-yes)' : 'var(--color-no)'
          }}>
            P&L: {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </span>
        </div>

      </div>

      {/* Grid columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'stretch' }}>
        
        {/* Left Column: Positions & Open Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Active Positions */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>Active Positions</h3>
            {positions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <p>No active positions held.</p>
                <Link href="/" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block', fontSize: '0.85rem' }}>Browse Markets</Link>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-dark)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '12px 8px' }}>Market</th>
                      <th style={{ padding: '12px 8px' }}>Outcome</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Shares</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Avg. Cost</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Current Price</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Value</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <tr key={pos.id} style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-main)' }}>
                          <Link href={`/markets/${pos.marketId}`} style={{ transition: 'var(--transition-smooth)' }} className="market-link">
                            {pos.marketTitle}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span className={pos.outcome === 'YES' ? 'badge-yes' : 'badge-no'}>{pos.outcome}</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                          {pos.quantity}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          ${pos.avgPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          ${pos.currentPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                          ${pos.currentValue.toFixed(2)}
                        </td>
                        <td style={{ 
                          padding: '12px 8px', 
                          textAlign: 'right', 
                          fontWeight: 700,
                          color: pos.pnl >= 0 ? 'var(--color-yes)' : 'var(--color-no)'
                        }}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Open Orders */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>Outstanding Limit Orders</h3>
            {openOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                No active limit orders
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-dark)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '12px 8px' }}>Market</th>
                      <th style={{ padding: '12px 8px' }}>Type</th>
                      <th style={{ padding: '12px 8px' }}>Outcome</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Remaining</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((order) => (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-main)' }}>
                          <Link href={`/markets/${order.marketId}`} className="market-link">
                            {order.market.title}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: order.type === 'BUY' ? 'var(--color-yes)' : 'var(--color-primary)' }}>
                          {order.type}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span className={order.outcome === 'YES' ? 'badge-yes' : 'badge-no'}>{order.outcome}</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                          ${order.price.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {order.remaining} / {order.quantity}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={cancellingId === order.id}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'rgba(244,63,94,0.15)',
                              border: '1px solid rgba(244,63,94,0.3)',
                              borderRadius: '6px',
                              color: 'var(--color-no)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'var(--transition-smooth)'
                            }}
                          >
                            {cancellingId === order.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Transaction logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>Trade History</h3>
            <div style={{ overflowY: 'auto', maxHeight: '500px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {trades.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '24px', fontSize: '0.85rem' }}>No transaction history found</div>
              ) : (
                trades.map((trade) => (
                  <div 
                    key={trade.id} 
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-glass)',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: trade.type === 'BUY' ? 'var(--color-yes)' : 'var(--color-primary)' 
                      }}>
                        {trade.type} {trade.outcome}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>
                        {new Date(trade.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <Link href={`/markets/${trade.marketId}`} className="market-link">
                        {trade.marketTitle}
                      </Link>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                      <span>{trade.quantity} shares @ ${trade.price.toFixed(2)}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        Total: ${trade.totalValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
