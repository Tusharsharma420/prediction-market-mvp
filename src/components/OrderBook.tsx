'use client';

import React, { useState } from 'react';

interface BookEntry {
  price: number;
  quantity: number;
}

interface OrderBookData {
  bids: BookEntry[];
  asks: BookEntry[];
}

interface OrderBookProps {
  orderBook: {
    YES: OrderBookData;
    NO: OrderBookData;
  };
}

export default function OrderBook({ orderBook }: OrderBookProps) {
  const [outcomeTab, setOutcomeTab] = useState<'YES' | 'NO'>('YES');

  const activeBook = orderBook[outcomeTab];
  const bids = activeBook.bids || [];
  const asks = [...(activeBook.asks || [])].reverse(); // Reverse asks to show lowest ask (best price) closest to the spread (bottom of ask section)

  // Calculate spread
  const bestBid = bids[0]?.price;
  const bestAsk = activeBook.asks[0]?.price;
  const spread = bestAsk && bestBid ? parseFloat((bestAsk - bestBid).toFixed(2)) : null;

  // Calculate cumulative size for visual bar depth
  const maxCumulative = Math.max(
    bids.reduce((sum, b) => sum + b.quantity, 0),
    asks.reduce((sum, a) => sum + a.quantity, 0),
    1
  );

  let cumulativeAsk = 0;
  const asksWithDepth = asks.map(a => {
    cumulativeAsk += a.quantity;
    return { ...a, cumulative: cumulativeAsk };
  });

  let cumulativeBid = 0;
  const bidsWithDepth = bids.map(b => {
    cumulativeBid += b.quantity;
    return { ...b, cumulative: cumulativeBid };
  });

  return (
    <div className="glass-panel" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
          Order Book
        </h3>
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255,255,255,0.03)', 
          padding: '2px', 
          borderRadius: '8px',
          border: '1px solid var(--border-glass)'
        }}>
          <button
            onClick={() => setOutcomeTab('YES')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: outcomeTab === 'YES' ? 'var(--color-yes-glow)' : 'transparent',
              color: outcomeTab === 'YES' ? 'var(--color-yes)' : 'var(--text-muted)',
              transition: 'var(--transition-smooth)'
            }}
          >
            YES Shares
          </button>
          <button
            onClick={() => setOutcomeTab('NO')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: outcomeTab === 'NO' ? 'var(--color-no-glow)' : 'transparent',
              color: outcomeTab === 'NO' ? 'var(--color-no)' : 'var(--text-muted)',
              transition: 'var(--transition-smooth)'
            }}
          >
            NO Shares
          </button>
        </div>
      </div>

      {/* Grid columns titles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '0 8px 8px 8px',
        fontSize: '0.75rem',
        color: 'var(--text-dark)',
        fontWeight: 700,
        textTransform: 'uppercase',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        <span>Price</span>
        <span style={{ textAlign: 'right' }}>Size</span>
        <span style={{ textAlign: 'right' }}>Total ($)</span>
      </div>

      {/* Book Container */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px', fontSize: '0.85rem' }}>
        
        {/* ASKS (SELLS) - Red */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', flex: 1, justifyContent: 'flex-end' }}>
          {asksWithDepth.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '16px 0', fontSize: '0.8rem' }}>
              No active offers to sell
            </div>
          ) : (
            asksWithDepth.map((ask, idx) => {
              const depthPct = (ask.cumulative / maxCumulative) * 100;
              return (
                <div 
                  key={idx} 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '6px 8px',
                    position: 'relative',
                    background: `linear-gradient(to left, rgba(244, 63, 94, 0.05) ${depthPct}%, transparent ${depthPct}%)`,
                    alignItems: 'center'
                  }}
                >
                  <span style={{ color: 'var(--color-no)', fontWeight: 700 }}>
                    ${ask.price.toFixed(2)}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-main)' }}>
                    {ask.quantity.toLocaleString()}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    ${(ask.price * ask.quantity).toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* SPREAD BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px',
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid var(--border-glass)',
          borderBottom: '1px solid var(--border-glass)',
          margin: '4px 0',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-muted)'
        }}>
          <span>Mid Price: ${bestBid && bestAsk ? ((bestBid + bestAsk) / 2).toFixed(2) : (bestBid || bestAsk || 0.50).toFixed(2)}</span>
          {spread !== null && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>
              Spread: ${(spread * 100).toFixed(0)}¢ (${spread.toFixed(2)})
            </span>
          )}
        </div>

        {/* BIDS (BUYS) - Green */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {bidsWithDepth.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '16px 0', fontSize: '0.8rem' }}>
              No active bids to buy
            </div>
          ) : (
            bidsWithDepth.map((bid, idx) => {
              const depthPct = (bid.cumulative / maxCumulative) * 100;
              return (
                <div 
                  key={idx} 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '6px 8px',
                    position: 'relative',
                    background: `linear-gradient(to left, rgba(16, 185, 129, 0.05) ${depthPct}%, transparent ${depthPct}%)`,
                    alignItems: 'center'
                  }}
                >
                  <span style={{ color: 'var(--color-yes)', fontWeight: 700 }}>
                    ${bid.price.toFixed(2)}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-main)' }}>
                    {bid.quantity.toLocaleString()}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    ${(bid.price * bid.quantity).toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
