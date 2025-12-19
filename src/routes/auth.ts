import { Router } from 'express';
import { googleLogin, getMe, logout, refreshToken } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/google
 * Google OAuth login
 * Body: { credential: string }
 */
router.post('/google', googleLogin);

/**
 * GET /api/auth/me
 * Získá informace o aktuálně přihlášeném uživateli
 * Vyžaduje autentizaci
 */
router.get('/me', requireAuth, getMe);

/**
 * POST /api/auth/logout
 * Odhlášení uživatele
 */
router.post('/logout', logout);

/**
 * POST /api/auth/refresh
 * Obnovení JWT tokenu
 * Vyžaduje autentizaci
 */
router.post('/refresh', requireAuth, refreshToken);

export default router;
