import { Response } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import {
  getGamesSchema,
  gameSlugSchema,
  gameContentSchema,
  createContentSchema,
  addFavoriteSchema,
} from '../validators/schemas';
import {
  getAllGames,
  getGameBySlug,
  getGameContent,
  createGameContent,
  toggleFavoriteGame,
  getUserFavoriteGames,
} from '../services/gameService';

/**
 * GET /api/games
 * Získá seznam všech her s filtrováním
 */
export const getGames = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace query parametrů
  const filters = getGamesSchema.parse(req.query);

  // Získej hry
  const result = await getAllGames(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/games/:slug
 * Získá detail hry podle slug
 */
export const getGame = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace parametru
  const { slug } = gameSlugSchema.parse(req.params);

  // Získej hru
  const game = await getGameBySlug(slug);

  res.status(200).json({
    success: true,
    data: { game },
  });
});

/**
 * GET /api/games/:gameId/content
 * Získá obsah hry (otázky, aktivity, atd.)
 */
export const getContent = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace parametrů a query
  const params = gameContentSchema.parse({
    gameId: req.params.gameId,
    ...req.query,
  });

  // Získej obsah
  const content = await getGameContent(params.gameId, {
    category: params.category,
    difficulty: params.difficulty,
    type: params.type,
    limit: params.limit,
  });

  res.status(200).json({
    success: true,
    data: {
      content,
      total: content.length,
    },
  });
});

/**
 * POST /api/games/:gameId/content
 * Vytvoří nový obsah hry (user-generated)
 * Vyžaduje autentizaci
 */
export const createContent = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Ověř autentizaci
  if (!req.user || !req.user.userId) {
    throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
  }

  // Validace
  const data = createContentSchema.parse({
    gameId: req.params.gameId,
    ...req.body,
  });

  // Vytvoř obsah
  const content = await createGameContent(
    data.gameId,
    req.user.userId,
    data.type,
    data.content,
    data.category,
    data.difficulty
  );

  res.status(201).json({
    success: true,
    data: { content },
    message: 'Content created successfully and is pending approval',
  });
});

/**
 * POST /api/games/:gameId/favorite
 * Přidá/odebere hru z oblíbených
 * Vyžaduje autentizaci
 */
export const toggleFavorite = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Ověř autentizaci
  if (!req.user || !req.user.userId) {
    throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
  }

  // Validace
  const { gameId } = addFavoriteSchema.parse({
    gameId: req.params.gameId,
  });

  // Toggle oblíbenou hru
  const result = await toggleFavoriteGame(req.user.userId, gameId);

  res.status(200).json({
    success: true,
    data: result,
    message: result.isFavorite ? 'Game added to favorites' : 'Game removed from favorites',
  });
});

/**
 * GET /api/games/favorites
 * Získá oblíbené hry uživatele
 * Vyžaduje autentizaci
 */
export const getFavorites = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Ověř autentizaci
  if (!req.user || !req.user.userId) {
    throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
  }

  // Získej oblíbené hry
  const favorites = await getUserFavoriteGames(req.user.userId);

  res.status(200).json({
    success: true,
    data: {
      favorites,
      total: favorites.length,
    },
  });
});
