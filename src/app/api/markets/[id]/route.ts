import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { cancelLimitOrder } from '@/lib/trading';

// Helper to get socket server from Next.js server instance
function getIo(req: any) {
  // @ts-ignore
  return global.prismaGlobal ? global.io : null; // WebSockets will be attached globally or passed
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const marketId = parseInt(params.id, 10);
  if (isNaN(marketId)) {
    return NextResponse.json({ error: 'Invalid market ID' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user ? parseInt((session.user as any).id, 10) : null;

  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId }
    });

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // 1. Get current user's positions in this market
    let userPositions = { YES: 0, NO: 0, avgPriceYES: 0, avgPriceNO: 0 };
    if (userId) {
      const positions = await prisma.position.findMany({
        where: { userId, marketId }
      });
      positions.forEach((pos) => {
        if (pos.outcome === 'YES') {
          userPositions.YES = pos.quantity;
          userPositions.avgPriceYES = pos.avgPrice;
        } else if (pos.outcome === 'NO') {
          userPositions.NO = pos.quantity;
          userPositions.avgPriceNO = pos.avgPrice;
        }
      });
    }

    // 2. Build the order book
    const activeOrders = await prisma.order.findMany({
      where: {
        marketId,
        status: { in: ['PENDING', 'PARTIAL'] }
      }
    });

    const bidsYES: Record<number, number> = {};
    const asksYES: Record<number, number> = {};
    const bidsNO: Record<number, number> = {};
    const asksNO: Record<number, number> = {};

    activeOrders.forEach(o => {
      const book = o.outcome === 'YES' 
        ? (o.type === 'BUY' ? bidsYES : asksYES)
        : (o.type === 'BUY' ? bidsNO : asksNO);
      book[o.price] = (book[o.price] || 0) + o.remaining;
    });

    const formatBook = (book: Record<number, number>, sortDesc: boolean) => {
      return Object.entries(book)
        .map(([price, qty]) => ({ price: parseFloat(price), quantity: qty }))
        .sort((a, b) => sortDesc ? b.price - a.price : a.price - b.price);
    };

    const orderBook = {
      YES: {
        bids: formatBook(bidsYES, true),
        asks: formatBook(asksYES, false)
      },
      NO: {
        bids: formatBook(bidsNO, true),
        asks: formatBook(asksNO, false)
      }
    };

    // 3. Get recent trades
    const trades = await prisma.trade.findMany({
      where: { marketId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        buyer: { select: { username: true } },
        seller: { select: { username: true } }
      }
    });

    const formattedTrades = trades.map(t => ({
      id: t.id,
      outcome: t.outcome,
      price: t.price,
      quantity: t.quantity,
      createdAt: t.createdAt,
      buyer: t.buyer.username,
      seller: t.seller.username
    }));

    // 4. Calculate total volume
    const volume = trades.reduce((sum, t) => sum + t.quantity, 0);

    // 5. Get current price of YES
    let currentPriceYES = 0.50;
    const lastTrade = trades[0];
    if (lastTrade) {
      currentPriceYES = lastTrade.outcome === 'YES'
        ? lastTrade.price
        : parseFloat((1 - lastTrade.price).toFixed(2));
    } else {
      const highestBid = orderBook.YES.bids[0];
      const lowestAsk = orderBook.YES.asks[0];
      if (highestBid && lowestAsk) {
        currentPriceYES = parseFloat(((highestBid.price + lowestAsk.price) / 2).toFixed(2));
      } else if (highestBid) {
        currentPriceYES = highestBid.price;
      } else if (lowestAsk) {
        currentPriceYES = lowestAsk.price;
      }
    }

    // 6. Get user's active/open orders in this market
    let openOrders: any[] = [];
    if (userId) {
      openOrders = await prisma.order.findMany({
        where: {
          userId,
          marketId,
          status: { in: ['PENDING', 'PARTIAL'] }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    return NextResponse.json({
      market: {
        ...market,
        currentPriceYES,
        volume
      },
      userPositions,
      orderBook,
      trades: formattedTrades,
      openOrders
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch market details' }, { status: 500 });
  }
}

// POST endpoint to resolve market (Admin action)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const marketId = parseInt(params.id, 10);
  if (isNaN(marketId)) {
    return NextResponse.json({ error: 'Invalid market ID' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { outcome } = body; // 'YES', 'NO', or 'CANCELLED'

    if (!['YES', 'NO', 'CANCELLED'].includes(outcome)) {
      return NextResponse.json({ error: 'Invalid resolution outcome. Must be YES, NO, or CANCELLED' }, { status: 400 });
    }

    // Load market and verify it's ACTIVE
    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }
    if (market.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Market is already resolved' }, { status: 400 });
    }

    // Run resolution in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Cancel all active orders in this market
      const activeOrders = await tx.order.findMany({
        where: {
          marketId,
          status: { in: ['PENDING', 'PARTIAL'] }
        }
      });

      for (const order of activeOrders) {
        const returnedQty = order.remaining;

        // Set order status to CANCELLED
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', remaining: 0 }
        });

        if (order.type === 'BUY') {
          // Refund cash to buyer
          const refundedCash = returnedQty * order.price;
          await tx.user.update({
            where: { id: order.userId },
            data: { cash: { increment: refundedCash } }
          });
        } else {
          // Return shares to seller's position
          const position = await tx.position.findUnique({
            where: {
              userId_marketId_outcome: {
                userId: order.userId,
                marketId,
                outcome: order.outcome
              }
            }
          });

          if (position) {
            await tx.position.update({
              where: { id: position.id },
              data: { quantity: { increment: returnedQty } }
            });
          } else {
            await tx.position.create({
              data: {
                userId: order.userId,
                marketId,
                outcome: order.outcome,
                quantity: returnedQty,
                avgPrice: order.price
              }
            });
          }
        }
      }

      // 2. Payout positions
      const positions = await tx.position.findMany({
        where: { marketId }
      });

      for (const pos of positions) {
        let payout = 0;

        if (outcome === 'YES' && pos.outcome === 'YES') {
          payout = pos.quantity * 1.00; // $1.00 per winning share
        } else if (outcome === 'NO' && pos.outcome === 'NO') {
          payout = pos.quantity * 1.00; // $1.00 per winning share
        } else if (outcome === 'CANCELLED') {
          payout = pos.quantity * 0.50; // split the pool: $0.50 per share
        }

        if (payout > 0) {
          await tx.user.update({
            where: { id: pos.userId },
            data: { cash: { increment: payout } }
          });
        }

        // Delete position since the market has resolved
        await tx.position.delete({ where: { id: pos.id } });
      }

      // 3. Update market status
      const finalStatus = outcome === 'YES' 
        ? 'RESOLVED_YES' 
        : outcome === 'NO' 
          ? 'RESOLVED_NO' 
          : 'CANCELLED';

      await tx.market.update({
        where: { id: marketId },
        data: { status: finalStatus }
      });
    });

    // Broadcast update using global IO
    // @ts-ignore
    const ioInstance = global.io;
    if (ioInstance) {
      ioInstance.to(`market_${marketId}`).emit('market_resolved', {
        marketId,
        outcome
      });
    }

    return NextResponse.json({ success: true, outcome });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Resolution failed' }, { status: 500 });
  }
}
