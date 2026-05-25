import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import {
  mintShares,
  mergeShares,
  placeLimitOrder,
  cancelLimitOrder
} from '@/lib/trading';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = parseInt((session.user as any).id, 10);
  
  // @ts-ignore
  const io = global.io || null;

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
    }

    switch (action) {
      case 'mint': {
        const { marketId, quantity } = body;
        if (!marketId || !quantity) {
          return NextResponse.json({ error: 'Missing marketId or quantity' }, { status: 400 });
        }
        await mintShares(userId, parseInt(marketId, 10), parseInt(quantity, 10));
        return NextResponse.json({ success: true, message: 'Shares minted successfully' });
      }

      case 'merge': {
        const { marketId, quantity } = body;
        if (!marketId || !quantity) {
          return NextResponse.json({ error: 'Missing marketId or quantity' }, { status: 400 });
        }
        await mergeShares(userId, parseInt(marketId, 10), parseInt(quantity, 10));
        return NextResponse.json({ success: true, message: 'Shares merged successfully' });
      }

      case 'place_order': {
        const { marketId, type, outcome, price, quantity } = body;
        if (!marketId || !type || !outcome || price === undefined || !quantity) {
          return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
        }
        const order = await placeLimitOrder(
          userId,
          parseInt(marketId, 10),
          type, // 'BUY' | 'SELL'
          outcome, // 'YES' | 'NO'
          parseFloat(price),
          parseInt(quantity, 10),
          io
        );
        return NextResponse.json({ success: true, order });
      }

      case 'cancel_order': {
        const { orderId } = body;
        if (!orderId) {
          return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }
        const order = await cancelLimitOrder(userId, parseInt(orderId, 10), io);
        return NextResponse.json({ success: true, order });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Trading operation failed' }, { status: 500 });
  }
}
