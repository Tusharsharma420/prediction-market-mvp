import prisma from './db';

const marketQueues = new Map<number, Promise<any>>();

export function enqueueOrderProcessing(marketId: number, orderId: number, io: any) {
  const currentPromise = marketQueues.get(marketId) || Promise.resolve();
  const nextPromise = currentPromise.then(async () => {
    try {
      await matchOrders(marketId, orderId, io);
    } catch (error) {
      console.error(`Error processing order ${orderId} for market ${marketId}:`, error);
    }
  });
  marketQueues.set(marketId, nextPromise);
  return nextPromise;
}

async function matchOrders(marketId: number, orderId: number, io: any) {
  // 1. Fetch the incoming order
  const newOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true }
  });

  if (!newOrder || newOrder.status === 'FILLED' || newOrder.status === 'CANCELLED') {
    return;
  }

  // 2. Fetch the market
  const market = await prisma.market.findUnique({
    where: { id: marketId }
  });
  if (!market || market.status !== 'ACTIVE') {
    return;
  }

  let remainingQty = newOrder.remaining;
  const isBuy = newOrder.type === 'BUY';
  const oppositeType = isBuy ? 'SELL' : 'BUY';

  // 3. Find matching opposite orders
  // If we are BUYING, we want the cheapest SELL orders first (ASC)
  // If we are SELLING, we want the highest BUY orders first (DESC)
  const oppositeOrders = await prisma.order.findMany({
    where: {
      marketId,
      outcome: newOrder.outcome,
      type: oppositeType,
      status: { in: ['PENDING', 'PARTIAL'] }
    },
    orderBy: [
      { price: isBuy ? 'asc' : 'desc' },
      { createdAt: 'asc' }
    ]
  });

  for (const oppositeOrder of oppositeOrders) {
    if (remainingQty <= 0) break;

    // Check price cross condition
    // Buyer price must be >= Seller price
    const buyerPrice = isBuy ? newOrder.price : oppositeOrder.price;
    const sellerPrice = isBuy ? oppositeOrder.price : newOrder.price;

    if (buyerPrice < sellerPrice) {
      // Prices do not cross, order book is spread
      break;
    }

    const matchPrice = oppositeOrder.price; // Price of the resting order
    const matchQty = Math.min(remainingQty, oppositeOrder.remaining);

    // Run the match in a single database transaction
    await prisma.$transaction(async (tx) => {
      // Deduct from remaining quantities
      remainingQty -= matchQty;
      const oppositeRemaining = oppositeOrder.remaining - matchQty;

      // Update new order
      await tx.order.update({
        where: { id: newOrder.id },
        data: {
          remaining: remainingQty,
          status: remainingQty === 0 ? 'FILLED' : 'PARTIAL'
        }
      });

      // Update opposite order
      await tx.order.update({
        where: { id: oppositeOrder.id },
        data: {
          remaining: oppositeRemaining,
          status: oppositeRemaining === 0 ? 'FILLED' : 'PARTIAL'
        }
      });

      // Determine Buyer and Seller IDs
      const buyerId = isBuy ? newOrder.userId : oppositeOrder.userId;
      const sellerId = isBuy ? oppositeOrder.userId : newOrder.userId;

      // Create Trade record
      await tx.trade.create({
        data: {
          marketId,
          buyerId,
          sellerId,
          outcome: newOrder.outcome,
          price: matchPrice,
          quantity: matchQty
        }
      });

      // --- ACCOUNT BALANCES & REFUNDS ---

      // 1. Credit the Seller with cash: Q * P_match
      const cashGain = matchQty * matchPrice;
      await tx.user.update({
        where: { id: sellerId },
        data: { cash: { increment: cashGain } }
      });

      // 2. Calculate if Buyer is owed a refund
      // If the incoming order is BUY, and matchPrice < newOrder.price, buyer gets a refund.
      // Because we deducted cash based on the buyer's full order price when placing the limit order.
      if (isBuy && matchPrice < newOrder.price) {
        const refund = matchQty * (newOrder.price - matchPrice);
        await tx.user.update({
          where: { id: newOrder.userId },
          data: { cash: { increment: refund } }
        });
      }

      // --- POSITIONS ---

      // 3. Credit Buyer with shares (we update or create Position)
      const existingBuyerPosition = await tx.position.findUnique({
        where: {
          userId_marketId_outcome: {
            userId: buyerId,
            marketId,
            outcome: newOrder.outcome
          }
        }
      });

      if (existingBuyerPosition) {
        const oldQty = existingBuyerPosition.quantity;
        const oldAvg = existingBuyerPosition.avgPrice;
        const newQty = oldQty + matchQty;
        const newAvg = ((oldQty * oldAvg) + (matchQty * matchPrice)) / newQty;

        await tx.position.update({
          where: { id: existingBuyerPosition.id },
          data: {
            quantity: newQty,
            avgPrice: parseFloat(newAvg.toFixed(4))
          }
        });
      } else {
        await tx.position.create({
          data: {
            userId: buyerId,
            marketId,
            outcome: newOrder.outcome,
            quantity: matchQty,
            avgPrice: matchPrice
          }
        });
      }

      // Note: Seller shares were already deducted from their position on order placement.
      // So no need to deduct seller shares here.
    });
  }

  // 4. Trigger socket broadcasts of updated order book and recent trades
  await broadcastMarketUpdates(marketId, io);
}

export async function broadcastMarketUpdates(marketId: number, io: any) {
  if (!io) return;

  // Fetch updated order books
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

  // Convert to sorted lists
  const formatBook = (book: Record<number, number>, sortDesc: boolean) => {
    return Object.entries(book)
      .map(([price, qty]) => ({ price: parseFloat(price), quantity: qty }))
      .sort((a, b) => sortDesc ? b.price - a.price : a.price - b.price);
  };

  const orderBookData = {
    YES: {
      bids: formatBook(bidsYES, true),  // highest bids first
      asks: formatBook(asksYES, false) // lowest asks first
    },
    NO: {
      bids: formatBook(bidsNO, true),
      asks: formatBook(asksNO, false)
    }
  };

  // Fetch recent trades
  const recentTrades = await prisma.trade.findMany({
    where: { marketId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      buyer: { select: { username: true } },
      seller: { select: { username: true } }
    }
  });

  // Broadcast to market room
  io.to(`market_${marketId}`).emit('market_update', {
    marketId,
    orderBook: orderBookData,
    trades: recentTrades.map(t => ({
      id: t.id,
      outcome: t.outcome,
      price: t.price,
      quantity: t.quantity,
      createdAt: t.createdAt,
      buyer: t.buyer.username,
      seller: t.seller.username
    }))
  });
}
