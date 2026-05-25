'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getSocket } from '@/lib/socket';
import PriceChart from '@/components/PriceChart';
import OrderBook from '@/components/OrderBook';
import TradeForm from '@/components/TradeForm';

interface Trade {
  id: number;
  outcome: string;
  price: number;
  quantity: number;
  createdAt: string;
  buyer: string;
  seller: string;
}

interface Order {
  id: number;
  type: string;
  outcome: string;
  price: number;
  quantity: number;
  remaining: number;
  status: string;
  createdAt: string;
}

interface MarketData {
  market: {
    id: number;
    title: string;
    description: string;
    category: string;
    status: string;
    expiresAt: string;
    currentPriceYES: number;
    volume: number;
  };
  userPositions: {
    YES: number;
    NO: number;
    avgPriceYES: number;
    avgPriceNO: number;
  };
  orderBook: {
    YES: { bids: any[]; asks: any[] };
    NO: { bids: any[]; asks: any[] };
  };
  trades: Trade[];
  openOrders: Order[];
}

export default function MarketDetailPage({ params }: { params: { id: string } }) {
  const marketId = parseInt(params.id, 10);
  const { data: session, update: updateSession } = useSession();
  
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchMarketDetails = async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}`);
      if (!res.ok) throw new Error('Failed to load market details');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketDetails();

    // Set up WebSocket connection for real-time order book and trade logs
    const socket = getSocket();
    if (socket) {
      socket.emit('join_market', marketId.toString());

      socket.on('market_update', (update: any) => {
        if (update.marketId === marketId) {
          setData((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              orderBook: update.orderBook,
              trades: update.trades
            };
          });
        }
      });

      socket.on('market_resolved', (resolution: any) => {
        if (resolution.marketId === marketId) {
          alert(`This market has been resolved to ${resolution.outcome}! Payouts have been distributed.`);
          fetchMarketDetails();
          updateSession();
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave_market', marketId.toString());
        socket.off('market_update');
        socket.off('market_resolved');
      }
    };
  }, [marketId]);

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

      await updateSession();
      fetchMarketDetails();
    } catch (err: any) {
      alert(err.message || 'Error cancelling order');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>Loading market profile...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--color-no)', fontWeight: 600 }}>⚠️ {error || 'Market details not found'}</p>
        <Link href="/" className="btn-secondary" style={{ marginTop: '20px', display: 'inline-block' }}>Back to Markets</Link>
      </div>
    );
  }

  const { market, userPositions, orderBook, trades, openOrders } = data;
  const isResolved = market.status !== 'ACTIVE';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 0' }}>
      
      {/* Back navigation */}
      <div>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* Title block */}
      <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Market ID: #{market.id}
          </span>
          {isResolved && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: market.status === 'RESOLVED_YES' ? 'var(--color-yes)' : market.status === 'RESOLVED_NO' ? 'var(--color-no)' : 'var(--text-muted)',
              backgroundColor: market.status === 'RESOLVED_YES' ? 'var(--color-yes-glow)' : market.status === 'RESOLVED_NO' ? 'var(--color-no-glow)' : 'rgba(255,255,255,0.05)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid'
            }}>
              Resolved: {market.status.replace('RESOLVED_', '')}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, lineHeight: '1.3' }}>{market.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>{market.description}</p>
        
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          fontSize: '0.85rem', 
          color: 'var(--text-dark)', 
          marginTop: '8px', 
          paddingTop: '16px', 
          borderTop: '1px solid var(--border-glass)' 
        }}>
          <span>Volume: <strong style={{ color: 'var(--text-muted)' }}>{market.volume.toLocaleString()} shares</strong></span>
          <span>Resolution Source: <strong style={{ color: 'var(--text-muted)' }}>Public Telemetry</strong></span>
          <span>Expires: <strong style={{ color: 'var(--text-muted)' }}>{new Date(market.expiresAt).toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Grid columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', alignItems: 'stretch' }}>
        
        {/* Left column: Chart and Trade logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <PriceChart trades={trades} />

          {/* User Active Positions in this market */}
          {session?.user && (userPositions.YES > 0 || userPositions.NO > 0) && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Your Portfolio Position</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {userPositions.YES > 0 && (
                  <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)', backgroundColor: 'rgba(16,185,129,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="badge-yes">YES SHARES</span>
                      <strong style={{ fontSize: '1.1rem' }}>{userPositions.YES}</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Avg. Buy Price: ${userPositions.avgPriceYES.toFixed(2)}</span>
                  </div>
                )}
                {userPositions.NO > 0 && (
                  <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(244,63,94,0.15)', backgroundColor: 'rgba(244,63,94,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="badge-no">NO SHARES</span>
                      <strong style={{ fontSize: '1.1rem' }}>{userPositions.NO}</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Avg. Buy Price: ${userPositions.avgPriceNO.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Open Orders */}
          {session?.user && openOrders.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Your Active Orders</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-dark)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '8px' }}>Type</th>
                      <th style={{ padding: '8px' }}>Outcome</th>
                      <th style={{ padding: '8px' }}>Price</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Filled / Size</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((order) => (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: order.type === 'BUY' ? 'var(--color-yes)' : 'var(--color-primary)' }}>
                          {order.type}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className={order.outcome === 'YES' ? 'badge-yes' : 'badge-no'}>{order.outcome}</span>
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                          ${order.price.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-main)' }}>
                          {order.quantity - order.remaining} / {order.quantity}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
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
            </div>
          )}

          {/* Recent Trades Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Recent Trades</h3>
            <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
              {trades.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '24px' }}>No trades executed yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-dark)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '8px' }}>Outcome</th>
                      <th style={{ padding: '8px' }}>Price</th>
                      <th style={{ padding: '8px' }}>Qty</th>
                      <th style={{ padding: '8px' }}>Parties</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        <td style={{ padding: '8px' }}>
                          <span className={trade.outcome === 'YES' ? 'badge-yes' : 'badge-no'}>{trade.outcome}</span>
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
                          ${trade.price.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px' }}>
                          {trade.quantity}
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                          @{trade.buyer} buy from @{trade.seller}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.75rem' }}>
                          {new Date(trade.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Right column: Order Book and Trade form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {session?.user ? (
            !isResolved ? (
              <TradeForm
                marketId={marketId}
                userCash={(session.user as any).cash}
                userPositions={userPositions}
                onTransactionSuccess={fetchMarketDetails}
              />
            ) : (
              <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                🔒 Trading closed. This market is resolved.
              </div>
            )
          ) : (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Sign in to place trades, mint, and merge shares.</p>
              <Link href={`/login?callbackUrl=/markets/${marketId}`} className="btn-primary" style={{ display: 'block' }}>
                Sign In to Trade
              </Link>
            </div>
          )}

          <OrderBook orderBook={orderBook} />
        </div>

      </div>

    </div>
  );
}
