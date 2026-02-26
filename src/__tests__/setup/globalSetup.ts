// Global test setup - runs before all tests
// Sets up environment variables needed for tests
import dotenv from 'dotenv';

// Load .env file first
dotenv.config();

// Set test environment variables - keep DATABASE_URL from .env (public schema)
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Random port
// Use existing DATABASE_URL from .env - don't override to test schema
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-must-be-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-must-be-at-least-32-characters-long';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
process.env.RATE_LIMIT_AUTH_MAX_REQUESTS = '1000';

// Increase test timeout for socket operations
jest.setTimeout(30000);

// Global afterAll to clean up any lingering connections
afterAll(async () => {
  // Give time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});
