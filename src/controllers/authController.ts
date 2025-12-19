import { Response } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { googleLoginSchema } from '../validators/schemas';
import { handleGoogleLogin, getUserById } from '../services/authService';
import { logger } from '../utils/logger';

/**
 * POST /api/auth/google
 * Autentizace přes Google OAuth
 */
export const googleLogin = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validace vstupu
  const { credential } = googleLoginSchema.parse(req.body);

  // Zpracuj Google login
  const { user, token } = await handleGoogleLogin(credential);

  logger.info(`User logged in: ${user.email}`);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
    },
  });
});

/**
 * GET /api/auth/me
 * Získá informace o aktuálně přihlášeném uživateli
 */
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Ověř, že uživatel je autentizován
  if (!req.user || !req.user.userId) {
    throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
  }

  // Získej uživatele z databáze
  const user = await getUserById(req.user.userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    },
  });
});

/**
 * POST /api/auth/logout
 * Odhlášení uživatele (na klientovi se smaže token)
 */
export const logout = asyncHandler(async (_req: AuthRequest, res: Response) => {
  // Na straně serveru není potřeba nic dělat (stateless JWT)
  // Token se invaliduje na klientovi

  res.status(200).json({
    success: true,
    message: 'Successfully logged out',
  });
});

/**
 * POST /api/auth/refresh
 * Obnovení JWT tokenu (pokud je potřeba)
 */
export const refreshToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || !req.user.userId) {
    throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
  }

  const user = await getUserById(req.user.userId);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Vygeneruj nový token
  const { generateJWT } = await import('../services/authService');
  const newToken = generateJWT(user);

  res.status(200).json({
    success: true,
    data: {
      token: newToken,
    },
  });
});
