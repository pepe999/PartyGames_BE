import { Router } from 'express';
import {
  getWord,
  submitGuess,
  skipWord,
  endTurn,
} from '../controllers/gameController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/game/:roomCode/word
 * Získá nové náhodné slovo pro hru
 */
router.get('/:roomCode/word', optionalAuth, getWord);

/**
 * POST /api/game/:roomCode/guess
 * Zaznamená výsledek hádání
 */
router.post('/:roomCode/guess', optionalAuth, submitGuess);

/**
 * POST /api/game/:roomCode/skip
 * Přeskočí aktuální slovo
 */
router.post('/:roomCode/skip', optionalAuth, skipWord);

/**
 * POST /api/game/:roomCode/end-turn
 * Ukončí aktuální tah a začne další
 */
router.post('/:roomCode/end-turn', optionalAuth, endTurn);

export default router;
