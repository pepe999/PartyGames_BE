import express, { Application } from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from '../../routes/auth';
import gamesRoutes from '../../routes/games';
import roomsRoutes from '../../routes/rooms';
import gameRoutes from '../../routes/game';

// Import socket handlers
import { handleRoomEvents } from '../../socket/roomHandlers';
import { handleGameEvents } from '../../socket/gameHandlers';

export interface TestServer {
  app: Application;
  httpServer: HttpServer;
  io: SocketServer;
  prisma: PrismaClient;
  baseUrl: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Creates a test server instance with Express + Socket.io
 * Each test can have its own isolated server
 * Note: No rate limiting for tests
 */
export async function createTestServer(): Promise<TestServer> {
  const app = express();

  // Middleware - NO rate limiting for tests
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes (without rate limiting)
  app.use('/api/auth', authRoutes);
  app.use('/api/games', gamesRoutes);
  app.use('/api/rooms', roomsRoutes);
  app.use('/api/game', gameRoutes);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test server error:', err);
    res.status(err.statusCode || 500).json({
      success: false,
      error: { message: err.message, code: err.code || 'INTERNAL_ERROR' },
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        message: 'Endpoint not found',
        code: 'NOT_FOUND',
        status: 404,
      },
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize Socket.io (without using initializeSocket to avoid global state)
  const io = new SocketServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    handleRoomEvents(socket, io);
    handleGameEvents(socket, io);
  });

  // Create Prisma client
  const prisma = new PrismaClient();

  // Start server on random available port
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });

  const address = httpServer.address() as { port: number };
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;

  return {
    app,
    httpServer,
    io,
    prisma,
    baseUrl,
    port,
    close: async () => {
      // Disconnect all sockets first
      const sockets = await io.fetchSockets();
      sockets.forEach((s) => s.disconnect(true));

      // Close Socket.io server
      io.close();

      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Disconnect Prisma
      await prisma.$disconnect();
    },
  };
}
