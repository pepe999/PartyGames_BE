import { PrismaClient } from '@prisma/client';

/**
 * Gets the existing Pantomima game from the database
 * Assumes the database has been seeded with `npm run prisma:seed`
 */
export async function getPantomimaGame(prisma: PrismaClient): Promise<{ pantomimaGameId: string }> {
  const pantomimaGame = await prisma.game.findUnique({
    where: { slug: 'pantomima' },
  });

  if (!pantomimaGame) {
    throw new Error(
      'Pantomima game not found in database. Please run: npm run prisma:seed'
    );
  }

  // Verify there's content for Pantomima
  const contentCount = await prisma.gameContent.count({
    where: {
      gameId: pantomimaGame.id,
      type: 'PANTOMIMA',
      status: 'APPROVED',
    },
  });

  if (contentCount === 0) {
    throw new Error(
      'No Pantomima content found in database. Please run: npm run prisma:seed'
    );
  }

  return { pantomimaGameId: pantomimaGame.id };
}

/**
 * Cleans up test data from database (rooms and players created during tests)
 * Call this after each test to ensure isolation
 */
export async function cleanupTestData(prisma: PrismaClient): Promise<void> {
  // Delete in order respecting foreign key constraints
  // Only delete rooms created during tests (WAITING or PLAYING status, recent)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // Delete room players for recent rooms
  await prisma.roomPlayer.deleteMany({
    where: {
      room: {
        createdAt: { gte: tenMinutesAgo },
      },
    },
  });

  // Delete recent rooms
  await prisma.gameRoom.deleteMany({
    where: {
      createdAt: { gte: tenMinutesAgo },
    },
  });
}

/**
 * Full cleanup - removes all test data
 * Use this sparingly, mainly for cleanup after all tests
 */
export async function fullCleanup(prisma: PrismaClient): Promise<void> {
  await prisma.roomPlayer.deleteMany({});
  await prisma.gameRoom.deleteMany({});
}
