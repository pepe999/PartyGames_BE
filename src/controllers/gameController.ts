import { Response } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * GET /api/game/:roomCode/word
 * Získá náhodné nové slovo pro hru
 */
export const getWord = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { roomCode } = req.params;

  // Získej místnost s game info
  const room = await prisma.gameRoom.findUnique({
    where: { roomCode },
    include: {
      game: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.status !== 'PLAYING') {
    throw new AppError('Game is not currently playing', 400, 'GAME_NOT_PLAYING');
  }

  // Získej náhodné slovo z game content
  const gameContent = await prisma.gameContent.findMany({
    where: {
      gameId: room.game.id,
      type: 'ACTIVITY',
      status: 'APPROVED',
    },
    take: 100,
  });

  if (!gameContent.length) {
    throw new AppError('No game content available', 404, 'NO_CONTENT');
  }

  // Vyber náhodné slovo
  const randomContent = gameContent[Math.floor(Math.random() * gameContent.length)];
  const wordData = randomContent.content as any;

  const word = {
    id: randomContent.id,
    gameType: room.game.slug.toUpperCase(),
    word: wordData.word || wordData.activity || wordData.content,
    difficulty: randomContent.difficulty,
    category: randomContent.category,
    language: 'cs',
  };

  res.status(200).json(word);
});

/**
 * POST /api/game/:roomCode/guess
 * Zaznamená výsledek hádání (úspěch nebo neúspěch)
 */
export const submitGuess = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { roomCode } = req.params;
  const { success, currentPlayerId } = req.body;

  if (typeof success !== 'boolean') {
    throw new AppError('Success must be a boolean', 400, 'INVALID_INPUT');
  }

  // Získej místnost s hráči
  const room = await prisma.gameRoom.findUnique({
    where: { roomCode },
    include: {
      players: {
        where: { isConnected: true, team: { in: ['A', 'B'] } },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
      game: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.status !== 'PLAYING') {
    throw new AppError('Game is not currently playing', 400, 'GAME_NOT_PLAYING');
  }

  // Najdi aktuálního hráče (toho, kdo hraje)
  const currentPlayer = currentPlayerId
    ? room.players.find(p => p.id === currentPlayerId)
    : room.players.find(p => p.userId === req.user?.userId);

  if (!currentPlayer) {
    throw new AppError('Player not found in room', 404, 'PLAYER_NOT_FOUND');
  }

  // Body za správnou odpověď
  const points = success ? 1 : 0;

  // Aktualizuj skóre hráče v databázi a získej nové skóre
  let updatedPlayer = currentPlayer;
  if (success && points > 0) {
    updatedPlayer = await prisma.roomPlayer.update({
      where: { id: currentPlayer.id },
      data: {
        score: {
          increment: points,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  // Emit WebSocket event pro všechny hráče
  const { io } = await import('../server');

  // Pošli aktualizované info včetně týmu, hráče a nového skóre
  io.to(roomCode).emit('game:word-guessed', {
    playerId: currentPlayer.id,
    userId: currentPlayer.userId,
    team: currentPlayer.team,
    teamNumber: currentPlayer.team === 'A' ? 1 : 2,
    success,
    points,
    newScore: updatedPlayer.score,
  });

  logger.info(`Guess submitted in room ${roomCode} by ${currentPlayer.id} (team ${currentPlayer.team}): ${success ? 'correct' : 'incorrect'}, points: ${points}, new score: ${updatedPlayer.score}`);

  res.status(200).json({
    success: true,
    message: 'Guess recorded',
    data: {
      points,
      newScore: updatedPlayer.score,
    },
  });
});

/**
 * POST /api/game/:roomCode/skip
 * Přeskočí aktuální slovo
 */
export const skipWord = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { roomCode } = req.params;

  // Získej místnost
  const room = await prisma.gameRoom.findUnique({
    where: { roomCode },
    select: {
      id: true,
      status: true,
      roomCode: true,
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.status !== 'PLAYING') {
    throw new AppError('Game is not currently playing', 400, 'GAME_NOT_PLAYING');
  }

  // Emit WebSocket event - frontend očekává playerId jako parametr
  const { io } = await import('../server');
  const playerId = req.user?.userId || 'unknown';
  io.to(roomCode).emit('game:word-skipped', playerId);

  logger.info(`Word skipped in room ${roomCode} by ${playerId}`);

  res.status(200).json({
    success: true,
    message: 'Word skipped',
  });
});

/**
 * POST /api/game/:roomCode/end-turn
 * Ukončí aktuální tah a začne další
 */
export const endTurn = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { roomCode } = req.params;

  // Získej místnost s hráči
  const room = await prisma.gameRoom.findUnique({
    where: { roomCode },
    include: {
      players: {
        where: { isConnected: true, team: { in: ['A', 'B'] } },
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
      game: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  if (room.status !== 'PLAYING') {
    throw new AppError('Game is not currently playing', 400, 'GAME_NOT_PLAYING');
  }

  // TODO: Implementovat rotaci hráčů mezi týmy
  // Prozatím vybereme dalšího hráče z týmu B nebo zpět na tým A
  const teamAPlayers = room.players.filter(p => p.team === 'A');
  const teamBPlayers = room.players.filter(p => p.team === 'B');

  // Střídej mezi týmy: A -> B -> A -> B
  // Pro zjednodušení vyberu náhodného hráče z druhého týmu
  const allPlayers = [...teamAPlayers, ...teamBPlayers];
  const nextPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];

  if (!nextPlayer) {
    throw new AppError('No players available for next turn', 400, 'NO_PLAYERS');
  }

  // Získej nové slovo
  const gameContent = await prisma.gameContent.findMany({
    where: {
      gameId: room.game.id,
      type: 'ACTIVITY',
      status: 'APPROVED',
    },
    take: 100,
  });

  if (!gameContent.length) {
    throw new AppError('No game content available', 404, 'NO_CONTENT');
  }

  const randomContent = gameContent[Math.floor(Math.random() * gameContent.length)];
  const wordData = randomContent.content as any;

  // Vytvoř nový turn
  const turn = {
    id: `turn-${Date.now()}`,
    roomId: room.id,
    playerId: nextPlayer.id,
    roundNumber: 1,
    wordId: randomContent.id,
    action: 'EXPLAIN',
    points: 0,
    startedAt: new Date().toISOString(),
    player: {
      id: nextPlayer.id,
      userId: nextPlayer.userId,
      roomId: nextPlayer.roomId,
      teamNumber: nextPlayer.team === 'A' ? 1 : 2,
      score: 0,
      isHost: false,
      isReady: nextPlayer.isReady,
      isConnected: nextPlayer.isConnected,
      joinedAt: nextPlayer.joinedAt.toISOString(),
      user: nextPlayer.user,
    },
  };

  const word = {
    id: randomContent.id,
    gameType: room.game.slug.toUpperCase(),
    word: wordData.word || wordData.activity || wordData.content,
    difficulty: randomContent.difficulty,
    category: randomContent.category,
    language: 'cs',
  };

  // Emit WebSocket events
  const { io } = await import('../server');
  io.to(roomCode).emit('game:turn-ended', { timestamp: new Date().toISOString() });
  io.to(roomCode).emit('game:turn-started', turn, word);

  logger.info(`Turn ended in room ${roomCode}, new turn started for player ${nextPlayer.id}`);

  res.status(200).json({
    success: true,
    message: 'Turn ended, new turn started',
  });
});
