import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const marketListWithPrices = await Promise.all(
      markets.map(async (market) => {
        // 1. Get the last trade price of YES
        const lastTrade = await prisma.trade.findFirst({
          where: { marketId: market.id },
          orderBy: { createdAt: 'desc' }
        });

        let price = 0.50; // default price

        if (lastTrade) {
          price = lastTrade.outcome === 'YES' 
            ? lastTrade.price 
            : parseFloat((1 - lastTrade.price).toFixed(2));
        } else {
          // If no trades, try to find mid-market price from YES book bids/asks
          const highestBidOrder = await prisma.order.findFirst({
            where: { marketId: market.id, outcome: 'YES', type: 'BUY', status: { in: ['PENDING', 'PARTIAL'] } },
            orderBy: { price: 'desc' }
          });
          const lowestAskOrder = await prisma.order.findFirst({
            where: { marketId: market.id, outcome: 'YES', type: 'SELL', status: { in: ['PENDING', 'PARTIAL'] } },
            orderBy: { price: 'asc' }
          });

          if (highestBidOrder && lowestAskOrder) {
            price = parseFloat(((highestBidOrder.price + lowestAskOrder.price) / 2).toFixed(2));
          } else if (highestBidOrder) {
            price = highestBidOrder.price;
          } else if (lowestAskOrder) {
            price = lowestAskOrder.price;
          }
        }

        // 2. Calculate volume (sum of all matched trade quantities)
        const trades = await prisma.trade.findMany({
          where: { marketId: market.id }
        });
        const volume = trades.reduce((sum, t) => sum + t.quantity, 0);

        return {
          ...market,
          currentPriceYES: price,
          volume
        };
      })
    );

    return NextResponse.json(marketListWithPrices);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch markets' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, category, expiresAt } = body;

    if (!title || !description || !category || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const market = await prisma.market.create({
      data: {
        title,
        description,
        category,
        expiresAt: new Date(expiresAt)
      }
    });

    return NextResponse.json(market);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create market' }, { status: 500 });
  }
}
