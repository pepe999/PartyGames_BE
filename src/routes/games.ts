import { Router } from 'express';
import {
  getGames,
  getGame,
  getContent,
  createContent,
  toggleFavorite,
  getFavorites,
} from '../controllers/gamesController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/games
 * Získá seznam všech her s filtrováním
 * Query params: type, category, difficulty, search, limit, offset
 */
router.get('/', getGames);

/**
 * GET /api/games/favorites
 * Získá oblíbené hry uživatele
 * Vyžaduje autentizaci
 */
router.get('/favorites', requireAuth, getFavorites);

/**
 * GET /api/games/:slug
 * Získá detail hry podle slug
 */
router.get('/:slug', getGame);

/**
 * GET /api/games/:gameId/content
 * Získá obsah hry (otázky, aktivity, atd.)
 * Query params: category, difficulty, type, limit
 */
router.get('/:gameId/content', getContent);

/**
 * POST /api/games/:gameId/content
 * Vytvoří nový obsah hry (user-generated)
 * Vyžaduje autentizaci
 * Body: { type, content, category?, difficulty? }
 */
router.post('/:gameId/content', requireAuth, createContent);

/**
 * POST /api/games/:gameId/favorite
 * Přidá/odebere hru z oblíbených
 * Vyžaduje autentizaci
 */
router.post('/:gameId/favorite', requireAuth, toggleFavorite);

export default router;
