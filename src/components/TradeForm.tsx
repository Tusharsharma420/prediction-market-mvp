'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

interface TradeFormProps {
  marketId: number;
  userCash: number;
  userPositions: {
    YES: number;
    NO: number;
    avgPriceYES: number;
    avgPriceNO: number;
  };
  onTransactionSuccess: () => void;
}

export default function TradeForm({ marketId, userCash, userPositions, onTransactionSuccess }: TradeFormProps) {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<'trade' | 'mint-merge'>('trade');
  
  // Trade state
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES');
  const [price, setPrice] = useState<string>('0.50');
  const [quantity, setQuantity] = useState<string>('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mint/Merge state
  const [mintMergeAction, setMintMergeAction] = useState<'MINT' | 'MERGE'>('MINT');
  const [mintMergeQty, setMintMergeQty] = useState<string>('10');

  // Calculations for Trade
  const numPrice = parseFloat(price) || 0;
  const numQty = parseInt(quantity, 10) || 0;
  const cost = numPrice * numQty;
  const potentialPayout = numQty;
  const potentialProfit = potentialPayout - cost;
  const roi = numPrice > 0 ? ((1 - numPrice) / numPrice) * 100 : 0;

  // Calculations for Mint/Merge
  const numMintMergeQty = parseInt(mintMergeQty, 10) || 0;

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_order',
          marketId,
          type: tradeType,
          outcome,
          price: numPrice,
          quantity: numQty
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      // Success
      await update(); // Refresh session cash balance
      onTransactionSuccess();
      setQuantity('10');
    } catch (err: any) {
      setError(err.message || 'Error processing trade');
    } finally {
      setLoading(false);
    }
  };

  const handleMintMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mintMergeAction.toLowerCase(),
          marketId,
          quantity: numMintMergeQty
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${mintMergeAction.toLowerCase()}`);
      }

      await update(); // Refresh session cash balance
      onTransactionSuccess();
      setMintMergeQty('10');
    } catch (err: any) {
      setError(err.message || 'Error performing action');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Toggle Tab */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '20px' }}>
        <button
          onClick={() => { setActiveTab('trade'); setError(''); }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'none',
            border: 'none',
            color: activeTab === 'trade' ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'trade' ? '2px solid var(--color-primary)' : 'none',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          Limit Order
        </button>
        <button
          onClick={() => { setActiveTab('mint-merge'); setError(''); }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'none',
            border: 'none',
            color: activeTab === 'mint-merge' ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'mint-merge' ? '2px solid var(--color-primary)' : 'none',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          Mint / Merge
        </button>
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
          marginBottom: '16px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 1. LIMIT ORDER FORM */}
      {activeTab === 'trade' && (
        <form onSubmit={handleTradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* BUY / SELL Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            padding: '4px',
            border: '1px solid var(--border-glass)'
          }}>
            <button
              type="button"
              onClick={() => setTradeType('BUY')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: tradeType === 'BUY' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tradeType === 'BUY' ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'var(--transition-smooth)'
              }}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setTradeType('SELL')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: tradeType === 'SELL' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tradeType === 'SELL' ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'var(--transition-smooth)'
              }}
            >
              SELL
            </button>
          </div>

          {/* YES / NO Outcome Select */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Outcome
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setOutcome('YES')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: '1px solid',
                  backgroundColor: outcome === 'YES' ? 'var(--color-yes-glow)' : 'transparent',
                  borderColor: outcome === 'YES' ? 'var(--color-yes)' : 'var(--border-glass)',
                  color: outcome === 'YES' ? 'var(--color-yes)' : 'var(--text-muted)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setOutcome('NO')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: '1px solid',
                  backgroundColor: outcome === 'NO' ? 'var(--color-no-glow)' : 'transparent',
                  borderColor: outcome === 'NO' ? 'var(--color-no)' : 'var(--border-glass)',
                  color: outcome === 'NO' ? 'var(--color-no)' : 'var(--text-muted)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                NO
              </button>
            </div>
          </div>

          {/* Price & Quantity Fields */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Limit Price (¢)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="0.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="form-input"
                style={{ marginTop: '6px' }}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Shares Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="form-input"
                style={{ marginTop: '6px' }}
                required
              />
            </div>
          </div>

          {/* Balance indicators */}
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 10px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '6px'
          }}>
            <span>Available Cash: ${userCash.toFixed(2)}</span>
            <span>
              Owned: {outcome === 'YES' ? userPositions.YES : userPositions.NO} {outcome}
            </span>
          </div>

          {/* Financial calculations info box */}
          {tradeType === 'BUY' && numPrice > 0 && numQty > 0 && (
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px',
              backgroundColor: 'rgba(139, 92, 246, 0.05)',
              borderRadius: '8px',
              border: '1px dashed rgba(139, 92, 246, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Cost:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>${cost.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Payout (if {outcome} Resolves):</span>
                <span style={{ color: 'var(--color-yes)', fontWeight: 700 }}>${potentialPayout.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Potential Profit:</span>
                <span style={{ color: 'var(--color-yes)', fontWeight: 700 }}>+${potentialProfit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Estimated ROI:</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{roi.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {tradeType === 'SELL' && numQty > 0 && (
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px',
              backgroundColor: 'rgba(244, 63, 94, 0.05)',
              borderRadius: '8px',
              border: '1px dashed rgba(244, 63, 94, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Estimated Return:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>${cost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              marginTop: 'auto',
              backgroundColor: tradeType === 'BUY' 
                ? (outcome === 'YES' ? 'var(--color-yes)' : 'var(--color-no)') 
                : 'var(--color-primary)',
              boxShadow: tradeType === 'BUY'
                ? (outcome === 'YES' ? '0 4px 14px 0 var(--color-yes-glow)' : '0 4px 14px 0 var(--color-no-glow)')
                : '0 4px 14px 0 var(--color-primary-glow)'
            }}
          >
            {loading 
              ? 'Processing...' 
              : `${tradeType} ${quantity} ${outcome} Shares @ $${numPrice.toFixed(2)}`}
          </button>
        </form>
      )}

      {/* 2. MINT / MERGE FORM */}
      {activeTab === 'mint-merge' && (
        <form onSubmit={handleMintMergeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* MINT / MERGE Toggles */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            padding: '4px',
            border: '1px solid var(--border-glass)'
          }}>
            <button
              type="button"
              onClick={() => setMintMergeAction('MINT')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: mintMergeAction === 'MINT' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: mintMergeAction === 'MINT' ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'var(--transition-smooth)'
              }}
            >
              MINT SHARES
            </button>
            <button
              type="button"
              onClick={() => setMintMergeAction('MERGE')}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: mintMergeAction === 'MERGE' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: mintMergeAction === 'MERGE' ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'var(--transition-smooth)'
              }}
            >
              MERGE SHARES
            </button>
          </div>

          {/* Quantity Field */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Bundle Quantity (1 YES + 1 NO = $1.00)
            </label>
            <input
              type="number"
              min="1"
              value={mintMergeQty}
              onChange={(e) => setMintMergeQty(e.target.value)}
              className="form-input"
              style={{ marginTop: '6px' }}
              required
            />
          </div>

          {/* Holdings and cost info box */}
          <div style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            border: '1px solid var(--border-glass)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Available Cash:</span>
              <span style={{ color: 'var(--text-main)' }}>${userCash.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Owned YES Shares:</span>
              <span style={{ color: 'var(--color-yes)' }}>{userPositions.YES}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Owned NO Shares:</span>
              <span style={{ color: 'var(--color-no)' }}>{userPositions.NO}</span>
            </div>
          </div>

          {/* Text Description of Action */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0 4px' }}>
            {mintMergeAction === 'MINT' 
              ? `Locks $${numMintMergeQty.toFixed(2)} cash to mint ${numMintMergeQty} YES shares and ${numMintMergeQty} NO shares.` 
              : `Combines ${numMintMergeQty} YES shares and ${numMintMergeQty} NO shares to unlock $${numMintMergeQty.toFixed(2)} cash.`}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ marginTop: 'auto' }}
          >
            {loading 
              ? 'Processing...' 
              : mintMergeAction === 'MINT' 
                ? `Mint ${mintMergeQty} Pairs (-$${numMintMergeQty.toFixed(2)})` 
                : `Merge ${mintMergeQty} Pairs (+$${numMintMergeQty.toFixed(2)})`}
          </button>
        </form>
      )}

    </div>
  );
}
