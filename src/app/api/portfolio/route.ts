import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = parseInt((session.user as any).id, 10);

  try {
    // 1. Fetch user cash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cash: true }
    });

    // 2. Fetch positions
    const positions = await prisma.position.findMany({
      where: { userId },
      include: {
        market: {
          select: { id: true, title: true, status: true }
        }
      }
    });

    // Calculate current prices for position valuation
    const positionsWithValuation = await Promise.all(
      positions.map(async (pos) => {
        // Find last trade to get price
        const lastTrade = await prisma.trade.findFirst({
          where: { marketId: pos.marketId },
          orderBy: { createdAt: 'desc' }
        });

        let currentPrice = 0.50; // default
        if (lastTrade) {
          const yesPrice = lastTrade.outcome === 'YES' 
            ? lastTrade.price 
            : parseFloat((1 - lastTrade.price).toFixed(2));
          currentPrice = pos.outcome === 'YES' ? yesPrice : parseFloat((1 - yesPrice).toFixed(2));
        }

        const initialCost = pos.quantity * pos.avgPrice;
        const currentValue = pos.quantity * currentPrice;
        const pnl = currentValue - initialCost;

        return {
          id: pos.id,
          marketId: pos.marketId,
          marketTitle: pos.market.title,
          outcome: pos.outcome,
          quantity: pos.quantity,
          avgPrice: pos.avgPrice,
          currentPrice,
          currentValue,
          pnl
        };
      })
    );

    // 3. Fetch open orders across all markets
    const openOrders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'PARTIAL'] }
      },
      include: {
        market: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 4. Fetch trade history (last 50 trades)
    const trades = await prisma.trade.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      },
      include: {
        market: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const formattedTrades = trades.map(t => {
      const isBuyer = t.buyerId === userId;
      return {
        id: t.id,
        marketId: t.marketId,
        marketTitle: t.market.title,
        type: isBuyer ? 'BUY' : 'SELL',
        outcome: t.outcome,
        price: t.price,
        quantity: t.quantity,
        totalValue: t.price * t.quantity,
        createdAt: t.createdAt
      };
    });

    return NextResponse.json({
      cash: user?.cash || 0,
      positions: positionsWithValuation,
      openOrders,
      trades: formattedTrades
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch portfolio data' }, { status: 500 });
  }
}
