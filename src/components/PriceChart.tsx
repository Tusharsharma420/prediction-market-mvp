'use client';

import React from 'react';

interface Trade {
  id: number;
  outcome: string;
  price: number;
  quantity: number;
  createdAt: string;
}

interface PriceChartProps {
  trades: Trade[];
}

export default function PriceChart({ trades }: PriceChartProps) {
  // Sort trades oldest to newest
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Convert trades to price of YES
  const pricePoints = sortedTrades.map((t) => {
    const priceYES = t.outcome === 'YES' ? t.price : parseFloat((1 - t.price).toFixed(2));
    return {
      time: new Date(t.createdAt).getTime(),
      price: priceYES
    };
  });

  // If there are no trades, add a default start point
  if (pricePoints.length === 0) {
    pricePoints.push({ time: Date.now() - 3600000, price: 0.50 });
    pricePoints.push({ time: Date.now(), price: 0.50 });
  } else if (pricePoints.length === 1) {
    // If only 1 trade, duplicate it backwards to make a flat line start
    pricePoints.unshift({ time: pricePoints[0].time - 3600000, price: 0.50 });
  }

  // Chart SVG bounds
  const width = 600;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const times = pricePoints.map((p) => p.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  // Map data to SVG coordinates
  const points = pricePoints.map((p) => {
    const x = paddingLeft + ((p.time - minTime) / timeRange) * chartWidth;
    // Y coordinate in SVG starts from top, so Y = height corresponds to price = 0
    const y = paddingTop + (1 - p.price) * chartHeight;
    return { x, y, price: p.price };
  });

  // Generate SVG path string
  const pathD = points.reduce(
    (path, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`),
    ''
  );

  // Generate filled area path string (goes to bottom of chart area)
  const fillD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : '';

  const currentPrice = pricePoints[pricePoints.length - 1].price;

  return (
    <div className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            YES Share Price
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>
              ${currentPrice.toFixed(2)}
            </h2>
            <span style={{ 
              color: currentPrice >= 0.5 ? 'var(--color-yes)' : 'var(--color-no)',
              fontSize: '0.9rem',
              fontWeight: 700
            }}>
              {(currentPrice * 100).toFixed(0)}% Probability
            </span>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>
          Live order book feed
        </div>
      </div>

      <div style={{ width: '100%', overflow: 'hidden' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          width="100%" 
          height="100%" 
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.0, 0.25, 0.5, 0.75, 1.0].map((level) => {
            const y = paddingTop + (1 - level) * chartHeight;
            return (
              <g key={level}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                  strokeDasharray={level === 0.5 ? '0' : '4 4'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="var(--text-dark)"
                  fontSize="10"
                  textAnchor="end"
                  fontWeight="600"
                >
                  ${level.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Time markings (start and end) */}
          <text
            x={paddingLeft}
            y={height - 8}
            fill="var(--text-dark)"
            fontSize="10"
            fontWeight="500"
          >
            Start
          </text>
          <text
            x={width - paddingRight}
            y={height - 8}
            fill="var(--text-dark)"
            fontSize="10"
            fontWeight="500"
            textAnchor="end"
          >
            Now
          </text>

          {/* Gradient Fill under the line */}
          {fillD && (
            <path
              d={fillD}
              fill="url(#chartGradient)"
            />
          )}

          {/* Price Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points/Dots on Trades */}
          {points.length > 2 && points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === points.length - 1 ? "5" : "3"}
              fill={i === points.length - 1 ? "var(--color-yes)" : "var(--color-primary)"}
              stroke="var(--bg-main)"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
