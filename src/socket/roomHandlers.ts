import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export function handleRoomEvents(socket: Socket, io: Server): void {
  // Připojení do místnosti
  socket.on('join-room', async (data) => {
    try {
      const { roomCode, playerName, team } = data;

      // Najít místnost
      const room = await prisma.gameRoom.findUnique({
        where: { roomCode },
        include: { players: true },
      });

      if (!room) {
        socket.emit('error', {
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        });
        return;
      }

      // Přidat hráče do místnosti (v DB)
      const player = await prisma.roomPlayer.create({
        data: {
          roomId: room.id,
          playerName,
          team: team as any,
          isConnected: true,
        },
      });

      // Připojit socket do room
      socket.join(roomCode);

      // Uložit info o hráči do socketu
      (socket as any).roomCode = roomCode;
      (socket as any).playerId = player.id;

      // Získat aktualizovaná data
      const updatedRoom = await prisma.gameRoom.findUnique({
        where: { roomCode },
        include: { players: true, game: true },
      });

      // Notify všechny v místnosti
      io.to(roomCode).emit('room-updated', {
        room: updatedRoom,
        players: updatedRoom?.players || [],
      });

      // Notify o novém hráči
      socket.to(roomCode).emit('player-joined', { player });

      logger.info(`Player ${playerName} joined room ${roomCode}`);
    } catch (error) {
      logger.error('Error joining room:', error);
      socket.emit('error', {
        message: 'Failed to join room',
        code: 'JOIN_ROOM_ERROR',
      });
    }
  });

  // Opuštění místnosti
  socket.on('leave-room', async (data) => {
    try {
      const { roomCode } = data;
      const playerId = (socket as any).playerId;

      if (playerId) {
        // Odebrat hráče z DB
        await prisma.roomPlayer.delete({
          where: { id: playerId },
        });

        // Opustit socket room
        socket.leave(roomCode);

        // Notify ostatní
        socket.to(roomCode).emit('player-left', { playerId });

        logger.info(`Player left room ${roomCode}`);
      }
    } catch (error) {
      logger.error('Error leaving room:', error);
    }
  });

  // Změna týmu
  socket.on('change-team', async (data) => {
    try {
      const { roomCode, team } = data;
      const playerId = (socket as any).playerId;

      if (!playerId) return;

      await prisma.roomPlayer.update({
        where: { id: playerId },
        data: { team: team as any },
      });

      const updatedRoom = await prisma.gameRoom.findUnique({
        where: { roomCode },
        include: { players: true, game: true },
      });

      io.to(roomCode).emit('room-updated', {
        room: updatedRoom,
        players: updatedRoom?.players || [],
      });
    } catch (error) {
      logger.error('Error changing team:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    const roomCode = (socket as any).roomCode;
    const playerId = (socket as any).playerId;

    if (roomCode && playerId) {
      try {
        // Mark player as disconnected
        await prisma.roomPlayer.update({
          where: { id: playerId },
          data: { isConnected: false },
        });

        socket.to(roomCode).emit('player-left', { playerId });
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    }
  });
}
