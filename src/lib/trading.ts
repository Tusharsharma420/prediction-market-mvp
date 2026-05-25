import prisma from './db';
import { enqueueOrderProcessing, broadcastMarketUpdates } from './matching';

/**
 * Mint 1 YES + 1 NO share by locking $1.00 cash per pair.
 */
export async function mintShares(userId: number, marketId: number, quantity: number) {
  if (quantity <= 0) throw new Error('Quantity must be greater than zero');

  return prisma.$transaction(async (tx) => {
    // 1. Fetch user and verify cash
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.cash < quantity) {
      throw new Error(`Insufficient cash. Required: $${quantity.toFixed(2)}, Available: $${user.cash.toFixed(2)}`);
    }

    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw new Error('Market not found');
    if (market.status !== 'ACTIVE') throw new Error('Market is resolved or inactive');

    // 2. Deduct cash
    await tx.user.update({
      where: { id: userId },
      data: { cash: { decrement: quantity } }
    });

    // 3. Add YES position
    const yesPosition = await tx.position.findUnique({
      where: { userId_marketId_outcome: { userId, marketId, outcome: 'YES' } }
    });
    if (yesPosition) {
      const newQty = yesPosition.quantity + quantity;
      // Recalculate avgPrice assuming minted shares cost $0.50 each (since 1 YES + 1 NO = $1.00)
      const newAvg = ((yesPosition.quantity * yesPosition.avgPrice) + (quantity * 0.50)) / newQty;
      await tx.position.update({
        where: { id: yesPosition.id },
        data: { quantity: newQty, avgPrice: parseFloat(newAvg.toFixed(4)) }
      });
    } else {
      await tx.position.create({
        data: { userId, marketId, outcome: 'YES', quantity, avgPrice: 0.50 }
      });
    }

    // 4. Add NO position
    const noPosition = await tx.position.findUnique({
      where: { userId_marketId_outcome: { userId, marketId, outcome: 'NO' } }
    });
    if (noPosition) {
      const newQty = noPosition.quantity + quantity;
      const newAvg = ((noPosition.quantity * noPosition.avgPrice) + (quantity * 0.50)) / newQty;
      await tx.position.update({
        where: { id: noPosition.id },
        data: { quantity: newQty, avgPrice: parseFloat(newAvg.toFixed(4)) }
      });
    } else {
      await tx.position.create({
        data: { userId, marketId, outcome: 'NO', quantity, avgPrice: 0.50 }
      });
    }

    return { success: true };
  });
}

/**
 * Merge 1 YES + 1 NO share to release $1.00 cash.
 */
export async function mergeShares(userId: number, marketId: number, quantity: number) {
  if (quantity <= 0) throw new Error('Quantity must be greater than zero');

  return prisma.$transaction(async (tx) => {
    // 1. Fetch positions
    const yesPosition = await tx.position.findUnique({
      where: { userId_marketId_outcome: { userId, marketId, outcome: 'YES' } }
    });
    const noPosition = await tx.position.findUnique({
      where: { userId_marketId_outcome: { userId, marketId, outcome: 'NO' } }
    });

    if (!yesPosition || yesPosition.quantity < quantity) {
      throw new Error(`Insufficient YES shares. Required: ${quantity}, Owned: ${yesPosition?.quantity || 0}`);
    }
    if (!noPosition || noPosition.quantity < quantity) {
      throw new Error(`Insufficient NO shares. Required: ${quantity}, Owned: ${noPosition?.quantity || 0}`);
    }

    // 2. Deduct shares from positions
    await tx.position.update({
      where: { id: yesPosition.id },
      data: { quantity: { decrement: quantity } }
    });
    await tx.position.update({
      where: { id: noPosition.id },
      data: { quantity: { decrement: quantity } }
    });

    // Clean up empty positions
    if (yesPosition.quantity === quantity) {
      await tx.position.delete({ where: { id: yesPosition.id } });
    }
    if (noPosition.quantity === quantity) {
      await tx.position.delete({ where: { id: noPosition.id } });
    }

    // 3. Add cash back
    await tx.user.update({
      where: { id: userId },
      data: { cash: { increment: quantity } }
    });

    return { success: true };
  });
}

/**
 * Place a limit order on the order book.
 */
export async function placeLimitOrder(
  userId: number,
  marketId: number,
  type: 'BUY' | 'SELL',
  outcome: 'YES' | 'NO',
  price: number,
  quantity: number,
  io: any
) {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a positive integer');
  }
  if (price < 0.01 || price > 0.99) {
    throw new Error('Price must be between 0.01 and 0.99');
  }
  // Round price to 2 decimal places to avoid floating point issues in order books
  const roundedPrice = parseFloat(price.toFixed(2));

  // 1. Validate order in a transaction & create order
  const order = await prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw new Error('Market not found');
    if (market.status !== 'ACTIVE') throw new Error('Market is resolved or inactive');

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (type === 'BUY') {
      const cost = quantity * roundedPrice;
      if (user.cash < cost) {
        throw new Error(`Insufficient cash. Cost: $${cost.toFixed(2)}, Balance: $${user.cash.toFixed(2)}`);
      }

      // Lock up cash immediately
      await tx.user.update({
        where: { id: userId },
        data: { cash: { decrement: cost } }
      });
    } else {
      // type === 'SELL'
      const position = await tx.position.findUnique({
        where: { userId_marketId_outcome: { userId, marketId, outcome } }
      });

      if (!position || position.quantity < quantity) {
        throw new Error(`Insufficient shares to sell. Required: ${quantity}, Owned: ${position?.quantity || 0}`);
      }

      // Lock up shares immediately
      const newQty = position.quantity - quantity;
      if (newQty === 0) {
        await tx.position.delete({ where: { id: position.id } });
      } else {
        await tx.position.update({
          where: { id: position.id },
          data: { quantity: newQty }
        });
      }
    }

    // Create the Order
    return tx.order.create({
      data: {
        userId,
        marketId,
        type,
        outcome,
        price: roundedPrice,
        quantity,
        remaining: quantity,
        status: 'PENDING'
      }
    });
  });

  // 2. Trigger the matching engine queue in the background (non-blocking)
  enqueueOrderProcessing(marketId, order.id, io);

  return order;
}

/**
 * Cancel a pending or partial limit order and return locked assets.
 */
export async function cancelLimitOrder(userId: number, orderId: number, io: any) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId }
    });

    if (!order) throw new Error('Order not found');
    if (order.userId !== userId) throw new Error('Unauthorized');
    if (order.status !== 'PENDING' && order.status !== 'PARTIAL') {
      throw new Error(`Order cannot be cancelled. Current status: ${order.status}`);
    }

    const returnedQty = order.remaining;

    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        remaining: 0
      }
    });

    if (order.type === 'BUY') {
      // Return locked cash
      const refundedCash = returnedQty * order.price;
      await tx.user.update({
        where: { id: userId },
        data: { cash: { increment: refundedCash } }
      });
    } else {
      // Return locked shares
      const position = await tx.position.findUnique({
        where: { userId_marketId_outcome: { userId, marketId: order.marketId, outcome: order.outcome } }
      });

      if (position) {
        await tx.position.update({
          where: { id: position.id },
          data: { quantity: { increment: returnedQty } }
        });
      } else {
        await tx.position.create({
          data: {
            userId,
            marketId: order.marketId,
            outcome: order.outcome,
            quantity: returnedQty,
            avgPrice: order.price // keep original average price assumption
          }
        });
      }
    }

    return updatedOrder;
  });

  // Broadcast the cancellation book update
  await broadcastMarketUpdates(result.marketId, io);

  return result;
}
