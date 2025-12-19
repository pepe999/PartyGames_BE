import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { GameType, Difficulty, ContentType } from '@prisma/client';

interface GameFilters {
  type?: GameType;
  category?: string;
  difficulty?: Difficulty;
  search?: string;
  limit?: number;
  offset?: number;
}

interface ContentFilters {
  category?: string;
  difficulty?: Difficulty;
  type?: ContentType;
  limit?: number;
}

/**
 * Získá seznam her s filtrováním
 */
export const getAllGames = async (filters: GameFilters = {}) => {
  try {
    const { type, category, difficulty, search, limit = 50, offset = 0 } = filters;

    const where: any = {
      isActive: true,
    };

    // Filtr podle typu hry
    if (type) {
      where.type = type;
    }

    // Filtr podle obtížnosti
    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Filtr podle kategorie
    if (category) {
      where.category = {
        has: category,
      };
    }

    // Fulltextové vyhledávání
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          type: true,
          category: true,
          minPlayers: true,
          maxPlayers: true,
          difficulty: true,
          estimatedTime: true,
          imageUrl: true,
          _count: {
            select: {
              gameContent: true,
              favoriteBy: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.game.count({ where }),
    ]);

    return {
      games: games.map((game) => ({
        ...game,
        contentCount: game._count.gameContent,
        favoritesCount: game._count.favoriteBy,
        _count: undefined,
      })),
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Error fetching games:', error);
    throw new AppError('Failed to fetch games', 500, 'DATABASE_ERROR');
  }
};

/**
 * Získá hru podle slug
 */
export const getGameBySlug = async (slug: string) => {
  try {
    const game = await prisma.game.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        rules: true,
        type: true,
        category: true,
        minPlayers: true,
        maxPlayers: true,
        difficulty: true,
        estimatedTime: true,
        imageUrl: true,
        _count: {
          select: {
            gameContent: true,
            favoriteBy: true,
            gameRooms: {
              where: {
                status: 'PLAYING',
              },
            },
          },
        },
      },
    });

    if (!game) {
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    return {
      ...game,
      contentCount: game._count.gameContent,
      favoritesCount: game._count.favoriteBy,
      activeRoomsCount: game._count.gameRooms,
      _count: undefined,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error fetching game by slug:', error);
    throw new AppError('Failed to fetch game', 500, 'DATABASE_ERROR');
  }
};

/**
 * Získá obsah hry (otázky, aktivity, atd.)
 */
export const getGameContent = async (gameId: string, filters: ContentFilters = {}) => {
  try {
    // Ověř, že hra existuje
    const game = await prisma.game.findUnique({
      where: { id: gameId, isActive: true },
      select: { id: true },
    });

    if (!game) {
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    const { category, difficulty, type, limit = 100 } = filters;

    const where: any = {
      gameId,
      status: 'APPROVED', // Pouze schválený obsah
    };

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (type) {
      where.type = type;
    }

    const content = await prisma.gameContent.findMany({
      where,
      select: {
        id: true,
        type: true,
        content: true,
        category: true,
        difficulty: true,
        isUserGenerated: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return content;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error fetching game content:', error);
    throw new AppError('Failed to fetch game content', 500, 'DATABASE_ERROR');
  }
};

/**
 * Vytvoří nový obsah hry (user-generated)
 */
export const createGameContent = async (
  gameId: string,
  userId: string,
  type: ContentType,
  content: any,
  category?: string,
  difficulty: Difficulty = 'MEDIUM'
) => {
  try {
    // Ověř, že hra existuje
    const game = await prisma.game.findUnique({
      where: { id: gameId, isActive: true },
      select: { id: true },
    });

    if (!game) {
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    // Validace obsahu podle typu
    validateContentByType(type, content);

    const newContent = await prisma.gameContent.create({
      data: {
        gameId,
        userId,
        type,
        content,
        category,
        difficulty,
        isUserGenerated: true,
        status: 'PENDING', // User-generated obsah vyžaduje schválení
      },
      select: {
        id: true,
        type: true,
        content: true,
        category: true,
        difficulty: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info(`New content created for game ${gameId} by user ${userId}`);

    return newContent;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error creating game content:', error);
    throw new AppError('Failed to create game content', 500, 'DATABASE_ERROR');
  }
};

/**
 * Přidá/odebere hru z oblíbených
 */
export const toggleFavoriteGame = async (userId: string, gameId: string) => {
  try {
    // Ověř, že hra existuje
    const game = await prisma.game.findUnique({
      where: { id: gameId, isActive: true },
      select: { id: true },
    });

    if (!game) {
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    // Zkontroluj, zda už hra je v oblíbených
    const existing = await prisma.favoriteGame.findUnique({
      where: {
        userId_gameId: {
          userId,
          gameId,
        },
      },
    });

    if (existing) {
      // Odeber z oblíbených
      await prisma.favoriteGame.delete({
        where: {
          userId_gameId: {
            userId,
            gameId,
          },
        },
      });

      return { isFavorite: false };
    } else {
      // Přidej do oblíbených
      await prisma.favoriteGame.create({
        data: {
          userId,
          gameId,
        },
      });

      return { isFavorite: true };
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error toggling favorite game:', error);
    throw new AppError('Failed to update favorite game', 500, 'DATABASE_ERROR');
  }
};

/**
 * Získá oblíbené hry uživatele
 */
export const getUserFavoriteGames = async (userId: string) => {
  try {
    const favorites = await prisma.favoriteGame.findMany({
      where: { userId },
      select: {
        addedAt: true,
        game: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            type: true,
            category: true,
            difficulty: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });

    return favorites.map((fav) => ({
      ...fav.game,
      addedAt: fav.addedAt,
    }));
  } catch (error) {
    logger.error('Error fetching user favorite games:', error);
    throw new AppError('Failed to fetch favorite games', 500, 'DATABASE_ERROR');
  }
};

/**
 * Validace obsahu podle typu
 */
const validateContentByType = (type: ContentType, content: any) => {
  switch (type) {
    case 'QUESTION':
      if (!content.question || !content.options || !Array.isArray(content.options) || content.options.length < 2) {
        throw new AppError('Invalid question content: missing question or options', 400, 'INVALID_CONTENT');
      }
      if (typeof content.correctAnswer !== 'number' || content.correctAnswer < 0 || content.correctAnswer >= content.options.length) {
        throw new AppError('Invalid question content: invalid correctAnswer', 400, 'INVALID_CONTENT');
      }
      break;

    case 'ACTIVITY':
      if (!content.word || typeof content.word !== 'string') {
        throw new AppError('Invalid activity content: missing word', 400, 'INVALID_CONTENT');
      }
      break;

    case 'PROVERB':
      if (!content.proverb || typeof content.proverb !== 'string') {
        throw new AppError('Invalid proverb content: missing proverb', 400, 'INVALID_CONTENT');
      }
      break;

    case 'EMOJI_MOVIE':
      if (!content.movieTitle || !content.emojis) {
        throw new AppError('Invalid emoji movie content: missing movieTitle or emojis', 400, 'INVALID_CONTENT');
      }
      break;

    default:
      throw new AppError('Unknown content type', 400, 'UNKNOWN_CONTENT_TYPE');
  }
};
