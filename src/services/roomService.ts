import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TeamType } from '@prisma/client';
import bcrypt from 'bcrypt';

interface RoomSettings {
  rounds: number;
  timePerQuestion?: number;
  categories?: string[];
  difficulty?: string;
  teamMode: boolean;
  maxPlayers?: number;
}

/**
 * Vygeneruje unikátní kód místnosti (formát: ABCD-1234)
 */
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  code += '-';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

/**
 * Vytvoří novou herní místnost
 */
export const createRoom = async (
  gameId: string,
  settings: RoomSettings,
  hostId?: string,
  isPrivate: boolean = true,
  password?: string,
  roomName?: string
) => {
  try {
    // Ověř, že hra existuje a je online
    const game = await prisma.game.findUnique({
      where: { id: gameId, isActive: true },
      select: { id: true, type: true, name: true },
    });

    if (!game) {
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    if (game.type !== 'ONLINE') {
      throw new AppError('Game is not playable online', 400, 'GAME_NOT_ONLINE');
    }

    // Vygeneruj unikátní kód místnosti
    let roomCode: string;
    let codeExists = true;
    let attempts = 0;

    while (codeExists && attempts < 10) {
      roomCode = generateRoomCode();
      const existing = await prisma.gameRoom.findUnique({
        where: { roomCode },
      });
      codeExists = !!existing;
      attempts++;
    }

    if (codeExists) {
      throw new AppError('Failed to generate unique room code', 500, 'ROOM_CODE_GENERATION_FAILED');
    }

    // Hashuj heslo pokud je zadáno
    let passwordHash: string | null = null;
    if (password && password.trim().length > 0) {
      const SALT_ROUNDS = 10;
      passwordHash = await bcrypt.hash(password.trim(), SALT_ROUNDS);
    }

    // Vytvoř místnost
    const room = await prisma.gameRoom.create({
      data: {
        roomCode: roomCode!,
        gameId,
        hostId,
        status: 'WAITING',
        settings: settings as any,
        isPrivate,
        passwordHash,
        roomName: roomName?.trim() || null,
      },
      select: {
        id: true,
        roomCode: true,
        status: true,
        settings: true,
        isPrivate: true,
        roomName: true,
        createdAt: true,
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
      },
    });

    logger.info(`Room created: ${room.roomCode} for game ${game.name} (private: ${isPrivate}, password: ${!!passwordHash})`);

    return {
      ...room,
      hasPassword: !!passwordHash,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error creating room:', error);
    throw new AppError('Failed to create room', 500, 'DATABASE_ERROR');
  }
};

/**
 * Získá místnost podle kódu
 */
export const getRoomByCode = async (roomCode: string) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        roomCode: true,
        status: true,
        settings: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        game: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            description: true,
            rules: true,
            minPlayers: true,
            maxPlayers: true,
            imageUrl: true,
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
          select: {
            id: true,
            playerName: true,
            team: true,
            isConnected: true,
            isReady: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    return room;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error fetching room:', error);
    throw new AppError('Failed to fetch room', 500, 'DATABASE_ERROR');
  }
};

/**
 * Připojí hráče do místnosti
 */
export const joinRoom = async (
  roomCode: string,
  playerName: string,
  team: TeamType = 'SPECTATOR',
  userId?: string,
  password?: string
) => {
  try {
    // Získej místnost
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        status: true,
        settings: true,
        passwordHash: true,
        game: {
          select: {
            maxPlayers: true,
          },
        },
        _count: {
          select: {
            players: {
              where: {
                isConnected: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    // Ověř heslo pokud je nastaveno
    if (room.passwordHash) {
      if (!password || password.trim().length === 0) {
        throw new AppError('Password required', 401, 'PASSWORD_REQUIRED');
      }

      const isPasswordValid = await bcrypt.compare(password.trim(), room.passwordHash);
      if (!isPasswordValid) {
        throw new AppError('Invalid password', 401, 'INVALID_PASSWORD');
      }
    }

    if (room.status === 'FINISHED') {
      throw new AppError('Room has already finished', 400, 'ROOM_FINISHED');
    }

    if (room.status === 'PLAYING') {
      throw new AppError('Game has already started', 400, 'GAME_ALREADY_STARTED');
    }

    // Zkontroluj maximální počet hráčů
    const maxPlayers = (room.settings as any).maxPlayers || room.game.maxPlayers;
    if (room._count.players >= maxPlayers) {
      throw new AppError('Room is full', 400, 'ROOM_FULL');
    }

    // Zkontroluj, zda hráč už není v místnosti (podle userId)
    if (userId) {
      const existingPlayer = await prisma.roomPlayer.findFirst({
        where: {
          roomId: room.id,
          userId,
          isConnected: true,
        },
        select: {
          id: true,
          playerName: true,
          team: true,
          isConnected: true,
          joinedAt: true,
          isReady: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      if (existingPlayer) {
        // Hráč už je v místnosti, vrať ho
        return { player: existingPlayer, isNew: false };
      }
    }

    // Automaticky rozděl hráče do týmů pokud team není specifikován
    let assignedTeam = team;
    if (team === 'SPECTATOR') {
      // Spočítej hráče v týmech A a B
      const teamCounts = await prisma.roomPlayer.groupBy({
        by: ['team'],
        where: {
          roomId: room.id,
          isConnected: true,
          team: {
            in: ['A', 'B'],
          },
        },
        _count: true,
      });

      const teamACount = teamCounts.find(t => t.team === 'A')?._count || 0;
      const teamBCount = teamCounts.find(t => t.team === 'B')?._count || 0;

      // Přiřaď do týmu s menším počtem hráčů
      assignedTeam = teamACount <= teamBCount ? 'A' : 'B';
    }

    // Přidej hráče do místnosti
    const player = await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId,
        playerName,
        team: assignedTeam,
        isConnected: true,
      },
      select: {
        id: true,
        playerName: true,
        team: true,
        isConnected: true,
        isReady: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    logger.info(`Player ${playerName} joined room ${roomCode}`);

    return { player, isNew: true };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error joining room:', error);
    console.error('Detailed error joining room:', error);
    throw new AppError('Failed to join room', 500, 'DATABASE_ERROR');
  }
};

/**
 * Aktualizuje nastavení místnosti (pouze host)
 */
export const updateRoomSettings = async (
  roomCode: string,
  settings: Partial<RoomSettings>,
  userId?: string
) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        hostId: true,
        status: true,
        settings: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    // Ověř, že uživatel je host (nebo není vyžadována autentizace)
    if (room.hostId && userId && room.hostId !== userId) {
      throw new AppError('Only room host can update settings', 403, 'NOT_ROOM_HOST');
    }

    if (room.status !== 'WAITING') {
      throw new AppError('Cannot update settings after game has started', 400, 'GAME_ALREADY_STARTED');
    }

    // Aktualizuj nastavení
    const updatedRoom = await prisma.gameRoom.update({
      where: { roomCode },
      data: {
        settings: {
          ...(room.settings as object),
          ...settings,
        },
      },
      select: {
        id: true,
        roomCode: true,
        status: true,
        settings: true,
      },
    });

    logger.info(`Room ${roomCode} settings updated`);

    return updatedRoom;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error updating room settings:', error);
    throw new AppError('Failed to update room settings', 500, 'DATABASE_ERROR');
  }
};

/**
 * Spustí hru v místnosti
 */
export const startGame = async (roomCode: string, userId?: string) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        hostId: true,
        status: true,
        game: {
          select: {
            minPlayers: true,
          },
        },
        _count: {
          select: {
            players: {
              where: {
                isConnected: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    // Ověř, že uživatel je host
    if (room.hostId && userId && room.hostId !== userId) {
      throw new AppError('Only room host can start the game', 403, 'NOT_ROOM_HOST');
    }

    if (room.status !== 'WAITING') {
      throw new AppError('Game has already started', 400, 'GAME_ALREADY_STARTED');
    }

    // Zkontroluj minimální počet hráčů
    if (room._count.players < room.game.minPlayers) {
      throw new AppError(
        `Not enough players. Minimum ${room.game.minPlayers} players required.`,
        400,
        'NOT_ENOUGH_PLAYERS'
      );
    }

    // Spusť hru
    const updatedRoom = await prisma.gameRoom.update({
      where: { roomCode },
      data: {
        status: 'PLAYING',
        startedAt: new Date(),
      },
      select: {
        id: true,
        roomCode: true,
        status: true,
        startedAt: true,
      },
    });

    logger.info(`Game started in room ${roomCode} via HTTP API`);

    // Emit Socket.io events to start the game
    // Import dynamicky, aby se předešlo circular dependencies
    const { getIO } = await import('../socket');
    const { sendNextQuestion } = await import('../socket/gameHandlers');
    const io = getIO();

    if (io) {
      // Inicializovat game state
      const gameState = {
        currentRound: 0,
        scores: { teamA: 0, teamB: 0 },
      };

      // Emit game-started event
      io.to(roomCode).emit('game-started', { gameState });
      logger.info(`Emitted game-started event to room ${roomCode}`);

      // Send first question for quiz games
      await sendNextQuestion(roomCode, io);
      logger.info(`Sent first question to room ${roomCode}`);
    } else {
      logger.warn(`Socket.io instance not available for room ${roomCode}`);
    }

    return updatedRoom;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error starting game:', error);
    throw new AppError('Failed to start game', 500, 'DATABASE_ERROR');
  }
};

/**
 * Ukončí hru v místnosti
 */
export const finishGame = async (roomCode: string) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        status: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.status !== 'PLAYING') {
      throw new AppError('Game is not currently playing', 400, 'GAME_NOT_PLAYING');
    }

    const updatedRoom = await prisma.gameRoom.update({
      where: { roomCode },
      data: {
        status: 'FINISHED',
        finishedAt: new Date(),
      },
      select: {
        id: true,
        roomCode: true,
        status: true,
        finishedAt: true,
      },
    });

    logger.info(`Game finished in room ${roomCode}`);

    return updatedRoom;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error finishing game:', error);
    throw new AppError('Failed to finish game', 500, 'DATABASE_ERROR');
  }
};

/**
 * Odpojí hráče z místnosti
 */
export const leaveRoom = async (roomCode: string, playerId: string) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: { id: true },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    await prisma.roomPlayer.update({
      where: { id: playerId },
      data: { isConnected: false },
    });

    logger.info(`Player ${playerId} left room ${roomCode}`);

    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error leaving room:', error);
    throw new AppError('Failed to leave room', 500, 'DATABASE_ERROR');
  }
};

/**
 * Změní tým hráče
 */
export const changePlayerTeam = async (
  roomCode: string,
  playerId: string,
  newTeam: TeamType
) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        status: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.status !== 'WAITING') {
      throw new AppError('Cannot change team after game has started', 400, 'GAME_ALREADY_STARTED');
    }

    const player = await prisma.roomPlayer.update({
      where: { id: playerId },
      data: { team: newTeam },
      select: {
        id: true,
        playerName: true,
        team: true,
      },
    });

    logger.info(`Player ${playerId} changed team to ${newTeam} in room ${roomCode}`);

    return player;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error changing player team:', error);
    throw new AppError('Failed to change team', 500, 'DATABASE_ERROR');
  }
};

/**
 * Nastaví připravenost hráče
 */
export const setPlayerReady = async (
  roomCode: string,
  playerId: string,
  isReady: boolean
) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        status: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.status !== 'WAITING') {
      throw new AppError('Cannot change ready status after game has started', 400, 'GAME_ALREADY_STARTED');
    }

    const player = await prisma.roomPlayer.update({
      where: { id: playerId },
      data: { isReady },
      select: {
        id: true,
        playerName: true,
        isReady: true,
        team: true,
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    logger.info(`Player ${playerId} ready status changed to ${isReady} in room ${roomCode}`);

    // Broadcast ready status change via WebSocket
    const { io } = await import('../server');
    io.to(roomCode).emit('player:ready', playerId, isReady);

    return player;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error setting player ready status:', error);
    throw new AppError('Failed to set ready status', 500, 'DATABASE_ERROR');
  }
};

/**
 * Přenese hostitele na dalšího hráče v pořadí (nejstarší podle joinedAt)
 * Vrátí null pokud není další hráč (místnost by měla být smazána)
 */
export const transferHost = async (roomId: string, currentHostUserId: string) => {
  try {
    // Najít dalšího hráče v pořadí (nejstarší připojený hráč, který není host)
    const nextHost = await prisma.roomPlayer.findFirst({
      where: {
        roomId,
        userId: { not: currentHostUserId },
        isConnected: true,
      },
      orderBy: {
        joinedAt: 'asc', // Nejstarší hráč
      },
      select: {
        userId: true,
        playerName: true,
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!nextHost || !nextHost.userId) {
      // Žádný další hráč s userId není k dispozici
      logger.info(`No eligible player to transfer host role in room ${roomId}`);
      return null;
    }

    // Přenes hostitele na nového hráče
    const updatedRoom = await prisma.gameRoom.update({
      where: { id: roomId },
      data: { hostId: nextHost.userId },
      select: {
        id: true,
        roomCode: true,
        hostId: true,
        host: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    logger.info(
      `Host transferred from ${currentHostUserId} to ${nextHost.userId} in room ${roomId}`
    );

    return {
      newHost: nextHost,
      room: updatedRoom,
    };
  } catch (error) {
    logger.error('Error transferring host:', error);
    throw new AppError('Failed to transfer host', 500, 'DATABASE_ERROR');
  }
};

/**
 * Získá metadata místnosti bez citlivých dat
 * Používá se pro kontrolu před vstupem do místnosti
 */
export const getRoomMetadata = async (roomCode: string) => {
  try {
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      select: {
        id: true,
        roomCode: true,
        roomName: true,
        isPrivate: true,
        passwordHash: true,
        status: true,
        game: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    return {
      roomCode: room.roomCode,
      roomName: room.roomName,
      isPrivate: room.isPrivate,
      requiresPassword: !!room.passwordHash,
      status: room.status,
      gameName: room.game.name,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error fetching room metadata:', error);
    throw new AppError('Failed to fetch room metadata', 500, 'DATABASE_ERROR');
  }
};
