import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

interface GoogleTokenPayload {
  sub: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

interface UserData {
  userId: string;
  email: string;
  name: string;
  avatar?: string | null;
}

/**
 * Ověří Google JWT token a vrátí payload
 */
export const verifyGoogleToken = async (credential: string): Promise<GoogleTokenPayload> => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new AppError('Invalid Google token payload', 401, 'INVALID_TOKEN');
    }

    if (!payload.email_verified) {
      throw new AppError('Email not verified by Google', 401, 'EMAIL_NOT_VERIFIED');
    }

    if (!payload.email || !payload.sub || !payload.name) {
      throw new AppError('Missing required Google profile data', 401, 'MISSING_PROFILE_DATA');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error('Error verifying Google token:', error);
    throw new AppError('Failed to verify Google token', 401, 'GOOGLE_AUTH_FAILED');
  }
};

/**
 * Vytvoří nebo aktualizuje uživatele v databázi
 */
export const createOrUpdateUser = async (googleData: GoogleTokenPayload): Promise<UserData> => {
  try {
    const user = await prisma.user.upsert({
      where: {
        googleId: googleData.sub,
      },
      update: {
        email: googleData.email,
        name: googleData.name,
        avatar: googleData.picture,
        updatedAt: new Date(),
      },
      create: {
        googleId: googleData.sub,
        email: googleData.email,
        name: googleData.name,
        avatar: googleData.picture,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });

    logger.info(`User authenticated: ${user.email}`);

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };
  } catch (error) {
    logger.error('Error creating/updating user:', error);
    throw new AppError('Failed to create or update user', 500, 'DATABASE_ERROR');
  }
};

/**
 * Vygeneruje JWT token pro uživatele
 */
export const generateJWT = (user: UserData): string => {
  try {
    const payload = {
      userId: user.userId,
      email: user.email,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as string,
      issuer: 'partygames-api',
      subject: user.userId,
    } as jwt.SignOptions);

    return token;
  } catch (error) {
    logger.error('Error generating JWT:', error);
    throw new AppError('Failed to generate authentication token', 500, 'TOKEN_GENERATION_FAILED');
  }
};

/**
 * Ověří JWT token a vrátí payload
 */
export const verifyJWT = (token: string): { userId: string; email: string } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'partygames-api',
    }) as { userId: string; email: string };

    if (!decoded.userId || !decoded.email) {
      throw new AppError('Invalid token payload', 401, 'INVALID_TOKEN');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    if (error instanceof AppError) {
      throw error;
    }

    logger.error('Error verifying JWT:', error);
    throw new AppError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED');
  }
};

/**
 * Získá uživatele podle ID
 */
export const getUserById = async (userId: string): Promise<UserData | null> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };
  } catch (error) {
    logger.error('Error fetching user by ID:', error);
    throw new AppError('Failed to fetch user', 500, 'DATABASE_ERROR');
  }
};

/**
 * Kompletní Google login flow
 */
export const handleGoogleLogin = async (credential: string): Promise<{ user: UserData; token: string }> => {
  // 1. Ověř Google token
  const googleData = await verifyGoogleToken(credential);

  // 2. Vytvoř/aktualizuj uživatele
  const user = await createOrUpdateUser(googleData);

  // 3. Vygeneruj JWT
  const token = generateJWT(user);

  return { user, token };
};

/**
 * DEV ONLY - Vytvoří testovacího uživatele
 */
export const handleDevLogin = async (
  name: string,
  avatar?: string
): Promise<{ user: UserData; token: string }> => {
  try {
    // Vytvoř unikátní email pro testovacího uživatele
    const email = `dev-${name.toLowerCase().replace(/\s+/g, '-')}@test.local`;
    const googleId = `dev-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const user = await prisma.user.upsert({
      where: {
        email,
      },
      update: {
        name,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        updatedAt: new Date(),
      },
      create: {
        googleId,
        email,
        name,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });

    logger.info(`Dev user created/updated: ${user.email}`);

    const userData: UserData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    const token = generateJWT(userData);

    return { user: userData, token };
  } catch (error) {
    logger.error('Error creating dev user:', error);
    throw new AppError('Failed to create dev user', 500, 'DATABASE_ERROR');
  }
};
