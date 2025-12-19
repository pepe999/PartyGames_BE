import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  RATE_LIMIT_AUTH_MAX_REQUESTS: z.string().default('5'),
  SESSION_SECRET: z.string().min(32),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  PORT: parseInt(parsedEnv.data.PORT, 10),
  NODE_ENV: parsedEnv.data.NODE_ENV,
  DATABASE_URL: parsedEnv.data.DATABASE_URL,
  JWT_SECRET: parsedEnv.data.JWT_SECRET,
  JWT_EXPIRES_IN: parsedEnv.data.JWT_EXPIRES_IN,
  GOOGLE_CLIENT_ID: parsedEnv.data.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: parsedEnv.data.GOOGLE_CLIENT_SECRET,
  FRONTEND_URL: parsedEnv.data.FRONTEND_URL,
  RATE_LIMIT_WINDOW_MS: parseInt(parsedEnv.data.RATE_LIMIT_WINDOW_MS, 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(parsedEnv.data.RATE_LIMIT_MAX_REQUESTS, 10),
  RATE_LIMIT_AUTH_MAX_REQUESTS: parseInt(parsedEnv.data.RATE_LIMIT_AUTH_MAX_REQUESTS, 10),
  SESSION_SECRET: parsedEnv.data.SESSION_SECRET,
  IS_PRODUCTION: parsedEnv.data.NODE_ENV === 'production',
  IS_DEVELOPMENT: parsedEnv.data.NODE_ENV === 'development',
};
