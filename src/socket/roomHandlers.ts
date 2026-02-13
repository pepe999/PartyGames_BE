import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export function handleRoomEvents(socket: Socket, io: Server): void {
  // Připojení do místnosti (socket pouze pro real-time updates, ne pro vytváření hráče)
  socket.on('room:join', async (roomCode: string) => {
    try {
      // Najít místnost
      const room = await prisma.gameRoom.findUnique({
        where: { roomCode },
        include: {
          players: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (!room) {
        socket.emit('error', {
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        });
        return;
      }

      // Připojit socket do room pro real-time updates
      socket.join(roomCode);

      // Uložit info o místnosti do socketu
      (socket as any).roomCode = roomCode;

      logger.info(`Socket ${socket.id} joined room ${roomCode}`);
    } catch (error) {
      logger.error('Error joining room via socket:', error);
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
        // Najít hráče a místnost
        const player = await prisma.roomPlayer.findUnique({
          where: { id: playerId },
          include: { user: true },
        });

        const room = await prisma.gameRoom.findUnique({
          where: { roomCode },
          select: { hostId: true, id: true },
        });

        if (!player || !room) {
          logger.error(`Player or room not found: playerId=${playerId}, roomCode=${roomCode}`);
          return;
        }

        // Zkontrolovat, jestli je hráč host
        const isHost = player.userId === room.hostId;

        if (isHost) {
          // Host opouští místnost - pokusit se přenést hostitele
          const { transferHost } = await import('../services/roomService');
          const transferResult = await transferHost(room.id, player.userId!);

          if (transferResult) {
            // Přenos hostitele úspěšný - smazat původního hosta z hráčů
            await prisma.roomPlayer.delete({
              where: { id: playerId },
            });

            // Notify všechny hráče o změně hostitele
            io.to(roomCode).emit('host:transferred', {
              newHost: transferResult.newHost,
              message: `${transferResult.newHost.playerName} je nyní hostitel místnosti`,
            });

            // Notify o odchodu hráče
            socket.to(roomCode).emit('player-left', { playerId });

            logger.info(
              `Host left room ${roomCode}, transferred to ${transferResult.newHost.userId}`
            );
          } else {
            // Žádný další hráč k dispozici - zrušit místnost
            await prisma.gameRoom.delete({
              where: { id: room.id },
            });

            // Notify všechny hráče, že místnost byla zrušena
            io.to(roomCode).emit('room:closed', {
              message: 'Host opustil místnost, hra byla ukončena',
              reason: 'HOST_LEFT_NO_PLAYERS',
            });

            logger.info(`Host left room ${roomCode}, no players left, room deleted`);
          }
        } else {
          // Normální hráč opouští místnost
          await prisma.roomPlayer.delete({
            where: { id: playerId },
          });

          // Notify ostatní
          socket.to(roomCode).emit('player-left', { playerId });

          logger.info(`Player left room ${roomCode}`);
        }

        // Opustit socket room
        socket.leave(roomCode);
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

  // Změna připravenosti hráče (toto by se mělo volat přes REST API, ne socket)
  // Ponecháváme pro zpětnou kompatibilitu
  socket.on('player:set-ready', async (data) => {
    try {
      const { roomCode, isReady, playerId } = data;

      if (!playerId) {
        logger.error('Player ID is required for player:set-ready event');
        return;
      }

      await prisma.roomPlayer.update({
        where: { id: playerId },
        data: { isReady },
      });

      // Notify všechny v místnosti o změně připravenosti
      io.to(roomCode).emit('player:ready', playerId, isReady);

      logger.info(`Player ${playerId} set ready to ${isReady} in room ${roomCode}`);
    } catch (error) {
      logger.error('Error setting player ready:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    const roomCode = (socket as any).roomCode;
    const playerId = (socket as any).playerId;

    if (roomCode && playerId) {
      try {
        // Najít hráče a místnost
        const player = await prisma.roomPlayer.findUnique({
          where: { id: playerId },
          include: { user: true },
        });

        const room = await prisma.gameRoom.findUnique({
          where: { roomCode },
          select: { hostId: true, id: true },
        });

        if (!player || !room) {
          logger.error(`Player or room not found on disconnect: playerId=${playerId}, roomCode=${roomCode}`);
          return;
        }

        // Zkontrolovat, jestli je hráč host
        const isHost = player.userId === room.hostId;

        if (isHost) {
          // Host se odpojil - pokusit se přenést hostitele
          const { transferHost } = await import('../services/roomService');
          const transferResult = await transferHost(room.id, player.userId!);

          if (transferResult) {
            // Přenos hostitele úspěšný - označit původního hosta jako odpojeného
            await prisma.roomPlayer.update({
              where: { id: playerId },
              data: { isConnected: false },
            });

            // Notify všechny hráče o změně hostitele
            io.to(roomCode).emit('host:transferred', {
              newHost: transferResult.newHost,
              message: `${transferResult.newHost.playerName} je nyní hostitel místnosti`,
            });

            // Notify o odchodu hráče
            socket.to(roomCode).emit('player-left', { playerId });

            logger.info(
              `Host disconnected from room ${roomCode}, transferred to ${transferResult.newHost.userId}`
            );
          } else {
            // Žádný další hráč k dispozici - zrušit místnost
            await prisma.gameRoom.delete({
              where: { id: room.id },
            });

            // Notify všechny hráče, že místnost byla zrušena
            io.to(roomCode).emit('room:closed', {
              message: 'Host opustil místnost, hra byla ukončena',
              reason: 'HOST_DISCONNECTED_NO_PLAYERS',
            });

            logger.info(`Host disconnected from room ${roomCode}, no players left, room deleted`);
          }
        } else {
          // Mark player as disconnected
          await prisma.roomPlayer.update({
            where: { id: playerId },
            data: { isConnected: false },
          });

          socket.to(roomCode).emit('player-left', { playerId });

          logger.info(`Player ${playerId} disconnected from room ${roomCode}`);
        }
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    }
  });
}
