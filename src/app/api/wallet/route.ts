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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cash: true }
  });

  const positions = await prisma.position.findMany({
    where: { userId },
    include: {
      market: {
        select: { title: true, status: true }
      }
    }
  });

  return NextResponse.json({
    cash: user?.cash || 0,
    positions
  });
}

// Faucet top-up endpoint
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = parseInt((session.user as any).id, 10);

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { cash: { increment: 1000.0 } }
    });

    return NextResponse.json({
      success: true,
      cash: updatedUser.cash
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Faucet error' }, { status: 500 });
  }
}
