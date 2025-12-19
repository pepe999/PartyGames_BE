import { Router } from 'express';
import {
  createGameRoom,
  getRoom,
  joinGameRoom,
  updateSettings,
  startGameInRoom,
  changeTeam,
  getActiveRooms,
} from '../controllers/roomsController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/rooms
 * Získá seznam aktivních místností (pro lobby)
 */
router.get('/', getActiveRooms);

/**
 * POST /api/rooms
 * Vytvoří novou herní místnost
 * Optional auth - může být anonymní nebo authenticated
 * Body: { gameId, settings }
 */
router.post('/', optionalAuth, createGameRoom);

/**
 * GET /api/rooms/:roomCode
 * Získá detail místnosti
 */
router.get('/:roomCode', getRoom);

/**
 * POST /api/rooms/:roomCode/join
 * Připojí hráče do místnosti
 * Optional auth - může být anonymní nebo authenticated
 * Body: { playerName, team? }
 */
router.post('/:roomCode/join', optionalAuth, joinGameRoom);

/**
 * PATCH /api/rooms/:roomCode/settings
 * Aktualizuje nastavení místnosti (pouze host)
 * Optional auth - ověří se, zda je user host
 * Body: { settings }
 */
router.patch('/:roomCode/settings', optionalAuth, updateSettings);

/**
 * POST /api/rooms/:roomCode/start
 * Spustí hru v místnosti (pouze host)
 * Optional auth - ověří se, zda je user host
 */
router.post('/:roomCode/start', optionalAuth, startGameInRoom);

/**
 * POST /api/rooms/:roomCode/players/:playerId/team
 * Změní tým hráče
 * Body: { team }
 */
router.post('/:roomCode/players/:playerId/team', changeTeam);

export default router;
