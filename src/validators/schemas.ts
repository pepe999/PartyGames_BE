import { z } from 'zod';

// ============================================
// AUTH SCHEMAS
// ============================================

export const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export const tokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// ============================================
// GAME SCHEMAS
// ============================================

export const getGamesSchema = z.object({
  type: z.enum(['STATIC', 'ONLINE']).optional(),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  search: z.string().optional(),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  offset: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
});

export const gameSlugSchema = z.object({
  slug: z.string().min(1, 'Game slug is required'),
});

export const gameContentSchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  type: z.enum(['QUESTION', 'ACTIVITY', 'PROVERB', 'EMOJI_MOVIE']).optional(),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
});

// ============================================
// ROOM SCHEMAS
// ============================================

export const createRoomSchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
  settings: z.object({
    rounds: z.number().int().min(1).max(20).default(5),
    timePerQuestion: z.number().int().min(5).max(120).optional(), // v sekundách
    categories: z.array(z.string()).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    teamMode: z.boolean().default(true),
    maxPlayers: z.number().int().min(2).max(20).optional(),
  }),
});

export const roomCodeSchema = z.object({
  roomCode: z.string().length(9, 'Room code must be 9 characters (ABCD-1234)').regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid room code format'),
});

export const joinRoomSchema = z.object({
  playerName: z.string().min(2, 'Player name must be at least 2 characters').max(20, 'Player name must be at most 20 characters'),
  team: z.enum(['A', 'B', 'SPECTATOR']).default('SPECTATOR'),
});

export const updateRoomSettingsSchema = z.object({
  settings: z.object({
    rounds: z.number().int().min(1).max(20).optional(),
    timePerQuestion: z.number().int().min(5).max(120).optional(),
    categories: z.array(z.string()).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    teamMode: z.boolean().optional(),
    maxPlayers: z.number().int().min(2).max(20).optional(),
  }),
});

export const startGameSchema = z.object({
  roomCode: z.string().length(9, 'Room code must be 9 characters'),
});

export const submitAnswerSchema = z.object({
  roomCode: z.string().length(9, 'Room code must be 9 characters'),
  answerId: z.number().int().min(0),
  timestamp: z.number().int().positive(),
});

// ============================================
// CONTENT CREATION SCHEMAS
// ============================================

export const createContentSchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
  type: z.enum(['QUESTION', 'ACTIVITY', 'PROVERB', 'EMOJI_MOVIE']),
  content: z.object({
    // Pro QUESTION
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.number().optional(),

    // Pro ACTIVITY
    word: z.string().optional(),
    forbiddenWords: z.array(z.string()).optional(),

    // Pro PROVERB
    proverb: z.string().optional(),
    imageUrl: z.string().url().optional(),

    // Pro EMOJI_MOVIE
    movieTitle: z.string().optional(),
    emojis: z.string().optional(),
    hints: z.array(z.string()).optional(),
  }),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
});

// ============================================
// USER SCHEMAS
// ============================================

export const updateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  avatar: z.string().url().optional(),
});

// ============================================
// HISTORY AND FAVORITES SCHEMAS
// ============================================

export const addFavoriteSchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
});

export const saveGameHistorySchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
  roomId: z.string().uuid().optional(),
  result: z.object({
    scores: z.object({
      teamA: z.number().int().min(0),
      teamB: z.number().int().min(0),
    }),
    winner: z.enum(['A', 'B', 'TIE']),
    rounds: z.number().int().min(1),
    duration: z.number().int().positive(), // v sekundách
    players: z.array(z.object({
      name: z.string(),
      team: z.enum(['A', 'B', 'SPECTATOR']),
    })),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type GetGamesInput = z.infer<typeof getGamesSchema>;
export type GameSlugInput = z.infer<typeof gameSlugSchema>;
export type GameContentInput = z.infer<typeof gameContentSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type RoomCodeInput = z.infer<typeof roomCodeSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type UpdateRoomSettingsInput = z.infer<typeof updateRoomSettingsSchema>;
export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>;
export type SaveGameHistoryInput = z.infer<typeof saveGameHistorySchema>;
