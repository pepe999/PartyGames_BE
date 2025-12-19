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
} from '../services/roomService';

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
    req.user?.userId
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
  const { playerName, team } = joinRoomSchema.parse(req.body);

  // Připoj hráče (userId je optional - může být anonymní)
  const player = await joinRoom(
    roomCode,
    playerName,
    team,
    req.user?.userId
  );

  res.status(200).json({
    success: true,
    data: { player },
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
  // Toto může být implementováno později pro public lobby
  // Prozatím vracíme prázdný seznam

  res.status(200).json({
    success: true,
    data: {
      rooms: [],
      total: 0,
    },
    message: 'Feature not implemented yet',
  });
});
