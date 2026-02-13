import { Response } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import {
  createRoomSchema,
  roomCodeSchema,
  joinRoomSchema,
  updateRoomSettingsSchema,
} from '../validators/schemas';
import {
  createRoom,
  getRoomByCode,
  joinRoom,
  updateRoomSettings,
  startGame,
  changePlayerTeam,
  setPlayerReady,
  getRoomMetadata,
} from '../services/roomService';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

/**
 * POST /api/rooms
 * Vytvoří novou herní místnost
 */
export const createGameRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const data = createRoomSchema.parse(req.body);

  // Vytvoř místnost (hostId je optional - může být anonymní)
  const room = await createRoom(
    data.gameId,
    data.settings,
    req.user?.userId,
    data.isPrivate,
    data.password,
    data.roomName
  );

  res.status(201).json({
    success: true,
    data: { room },
    message: 'Room created successfully',
  });
});

/**
 * GET /api/rooms/:roomCode
 * Získá detail místnosti
 */
export const getRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode } = roomCodeSchema.parse(req.params);

  // Získej místnost
  const room = await getRoomByCode(roomCode);

  res.status(200).json({
    success: true,
    data: { room },
  });
});

/**
 * POST /api/rooms/:roomCode/join
 * Připojí hráče do místnosti
 */
export const joinGameRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode } = roomCodeSchema.parse(req.params);
  const { playerName, team, password } = joinRoomSchema.parse(req.body);

  // Připoj hráče (userId je optional - může být anonymní)
  const { player, isNew } = await joinRoom(
    roomCode,
    playerName,
    team,
    req.user?.userId,
    password
  );

  // Získej room pro určení hosta
  const room = await getRoomByCode(roomCode);
  const playerWithHost = {
    ...player,
    isHost: player.user?.id === room.host?.id,
  };

  // Notify ostatní hráče přes WebSocket pouze pokud je hráč nový
  if (isNew) {
    const { io } = await import('../server');
    io.to(roomCode).emit('player:joined', playerWithHost);
  }

  res.status(200).json({
    success: true,
    data: { player: playerWithHost },
    message: 'Successfully joined room',
  });
});

/**
 * PATCH /api/rooms/:roomCode/settings
 * Aktualizuje nastavení místnosti (pouze host)
 */
export const updateSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode } = roomCodeSchema.parse(req.params);
  const { settings } = updateRoomSettingsSchema.parse(req.body);

  // Aktualizuj nastavení
  const room = await updateRoomSettings(
    roomCode,
    settings,
    req.user?.userId
  );

  res.status(200).json({
    success: true,
    data: { room },
    message: 'Room settings updated successfully',
  });
});

/**
 * POST /api/rooms/:roomCode/start
 * Spustí hru v místnosti (pouze host)
 */
export const startGameInRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode } = roomCodeSchema.parse(req.params);

  // Spusť hru
  const room = await startGame(roomCode, req.user?.userId);

  // Notify všechny hráče přes WebSocket
  const { io } = await import('../server');

  // Pro kvízové hry používáme jiný event handling
  const roomWithGame = await prisma.gameRoom.findUnique({
    where: { roomCode },
    include: { game: true },
  });

  if (roomWithGame?.game?.type === 'ONLINE') {
    // Pro kvízové hry nejdřív pošleme game:started aby se Room přesměroval
    io.to(roomCode).emit('game:started', { gameState: { currentRound: 0, scores: { teamA: 0, teamB: 0 } } });

    // Pak pošleme game-started pro inicializaci game state v QuizGame komponentě
    const gameState = {
      currentRound: 0,
      scores: { teamA: 0, teamB: 0 },
    };
    io.to(roomCode).emit('game-started', { gameState });

    // Odeslat první otázku
    const { sendNextQuestion } = await import('../socket/gameHandlers');
    await sendNextQuestion(roomCode, io);
  } else {
    // Pro Word hry použijeme původní logiku
    io.to(roomCode).emit('game:started', room);

    // Automaticky spusť první tah
    try {
      await startFirstTurn(roomCode);
    } catch (error) {
      logger.error('Failed to start first turn:', error);
      // Pokračuj i když první tah selže - hra je už spuštěná
    }
  }

  res.status(200).json({
    success: true,
    data: { room },
    message: 'Game started successfully',
  });
});

/**
 * POST /api/rooms/:roomCode/players/:playerId/team
 * Změní tým hráče
 */
export const changeTeam = asyncHandler(async (_req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode, playerId } = _req.params;
  const { team } = _req.body;

  if (!team || !['A', 'B', 'SPECTATOR'].includes(team)) {
    throw new AppError('Invalid team', 400, 'INVALID_TEAM');
  }

  // Změní tým
  const player = await changePlayerTeam(roomCode, playerId, team);

  res.status(200).json({
    success: true,
    data: { player },
    message: 'Team changed successfully',
  });
});

/**
 * GET /api/rooms
 * Získá seznam aktivních místností (optional - pro lobby)
 */
export const getActiveRooms = asyncHandler(async (_req: AuthRequest, res: Response) => {
  // Získej všechny aktivní místnosti (WAITING status) - pouze veřejné
  const rooms = await prisma.gameRoom.findMany({
    where: {
      status: 'WAITING',
      isPrivate: false,
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          minPlayers: true,
          maxPlayers: true,
        },
      },
      host: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      players: {
        where: { isConnected: true },
        select: {
          id: true,
          playerName: true,
          team: true,
          userId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Transformuj data pro frontend
  const transformedRooms = rooms.map(room => ({
    id: room.id,
    code: room.roomCode,
    name: room.game.name,
    roomName: (room as any).roomName,
    gameType: room.game.slug.toUpperCase(),
    status: room.status,
    settings: room.settings,
    isPrivate: (room as any).isPrivate,
    currentPlayers: room.players.length,
    maxPlayers: (room.settings as any)?.maxPlayers || room.game.maxPlayers,
    createdBy: room.host?.id || '',
    createdAt: room.createdAt,
    players: room.players.map(p => ({
      id: p.id,
      playerName: p.playerName,
      team: p.team,
      userId: p.userId || undefined,
    })),
  }));

  res.status(200).json({
    success: true,
    data: {
      rooms: transformedRooms,
      total: transformedRooms.length,
    },
  });
});

/**
 * GET /api/rooms/:roomCode/players
 * Získá seznam hráčů v místnosti
 */
export const getRoomPlayers = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode } = roomCodeSchema.parse(req.params);

  // Získej místnost s hráči
  const room = await getRoomByCode(roomCode);

  // Přidej isHost flag ke každému hráči
  const playersWithHost = room.players.map(player => ({
    ...player,
    isHost: player.user?.id === room.host?.id,
  }));

  res.status(200).json({
    success: true,
    data: { players: playersWithHost },
  });
});

/**
 * POST /api/rooms/:roomCode/players/:playerId/ready
 * Nastaví připravenost hráče
 */
export const setReady = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace
  const { roomCode, playerId } = req.params;
  const { isReady } = req.body;

  if (typeof isReady !== 'boolean') {
    throw new AppError('isReady must be a boolean', 400, 'INVALID_INPUT');
  }

  // Nastaví připravenost
  const player = await setPlayerReady(roomCode, playerId, isReady);

  res.status(200).json({
    success: true,
    data: { player },
    message: 'Ready status updated successfully',
  });
});

/**
 * POST /api/rooms/:roomCode/leave
 * Hráč opouští místnost
 */
export const leaveGameRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { roomCode } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError('User must be authenticated to leave room', 401, 'UNAUTHORIZED');
  }

  // Najít hráče v místnosti
  const player = await prisma.roomPlayer.findFirst({
    where: {
      userId,
      room: { roomCode },
    },
    include: {
      room: {
        select: {
          id: true,
          hostId: true,
        },
      },
    },
  });

  if (!player) {
    throw new AppError('Player not found in room', 404, 'PLAYER_NOT_FOUND');
  }

  const isHost = player.userId === player.room.hostId;

  if (isHost) {
    // Host opouští místnost - pokusit se přenést hostitele
    const { transferHost } = await import('../services/roomService');
    const transferResult = await transferHost(player.room.id, userId);

    if (transferResult) {
      // Přenos hostitele úspěšný - smazat původního hosta z hráčů
      await prisma.roomPlayer.delete({
        where: { id: player.id },
      });

      // Notify všechny hráče o změně hostitele
      const { io } = await import('../server');
      io.to(roomCode).emit('host:transferred', {
        newHost: transferResult.newHost,
        message: `${transferResult.newHost.playerName} je nyní hostitel místnosti`,
      });

      // Notify o odchodu hráče
      io.to(roomCode).emit('player-left', { playerId: player.id });

      logger.info(`Host left room ${roomCode}, transferred to ${transferResult.newHost.userId}`);
    } else {
      // Žádný další hráč k dispozici - zrušit místnost
      await prisma.gameRoom.delete({
        where: { id: player.room.id },
      });

      // Notify všechny hráče, že místnost byla zrušena
      const { io } = await import('../server');
      io.to(roomCode).emit('room:closed', {
        message: 'Host opustil místnost, hra byla ukončena',
        reason: 'HOST_LEFT_NO_PLAYERS',
      });

      logger.info(`Host left room ${roomCode}, no players left, room deleted`);
    }
  } else {
    // Normální hráč opouští místnost
    await prisma.roomPlayer.delete({
      where: { id: player.id },
    });

    // Notify ostatní
    const { io } = await import('../server');
    io.to(roomCode).emit('player-left', { playerId: player.id });

    logger.info(`Player ${player.id} left room ${roomCode}`);
  }

  res.status(200).json({
    success: true,
    message: 'Successfully left room',
  });
});

/**
 * Helper: Spustí první tah ve hře
 */
const startFirstTurn = async (roomCode: string) => {
  try {
    // Získej místnost s hráči a game info
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
            type: true,
            slug: true,
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    // Vyber prvního hráče z týmu A
    const firstPlayer = room.players.find(p => p.team === 'A');

    if (!firstPlayer) {
      throw new AppError('No players in team A', 400, 'NO_TEAM_A_PLAYERS');
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

    // Vytvoř turn objekt (in-memory, neukládáme do DB)
    const turn = {
      id: `turn-${Date.now()}`,
      roomId: room.id,
      playerId: firstPlayer.id,
      roundNumber: 1,
      wordId: randomContent.id,
      action: 'EXPLAIN',
      points: 0,
      startedAt: new Date().toISOString(),
      player: {
        id: firstPlayer.id,
        userId: firstPlayer.userId,
        roomId: firstPlayer.roomId,
        teamNumber: firstPlayer.team === 'A' ? 1 : 2,
        score: 0,
        isHost: false,
        isReady: firstPlayer.isReady,
        isConnected: firstPlayer.isConnected,
        joinedAt: firstPlayer.joinedAt.toISOString(),
        user: firstPlayer.user,
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

    // Emit WebSocket event
    const { io } = await import('../server');
    io.to(roomCode).emit('game:turn-started', turn, word);

    logger.info(`First turn started in room ${roomCode} for player ${firstPlayer.id}`);
  } catch (error) {
    logger.error('Error starting first turn:', error);
    throw error;
  }
};

/**
 * GET /api/rooms/:roomCode/metadata
 * Získá metadata místnosti bez citlivých dat
 */
export const getRoomMetadataController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { roomCode } = roomCodeSchema.parse(req.params);

  const metadata = await getRoomMetadata(roomCode);

  res.status(200).json({
    success: true,
    data: { metadata },
  });
});
