import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ServerToClientEvents, ClientToServerEvents } from '../types';
import { handleRoomEvents } from './roomHandlers';
import { handleGameEvents } from './gameHandlers';

export function initializeSocket(httpServer: HttpServer): Server {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Připojení event handlerů
    handleRoomEvents(socket, io);
    handleGameEvents(socket, io);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  logger.info('✅ WebSocket server initialized');

  return io;
}
