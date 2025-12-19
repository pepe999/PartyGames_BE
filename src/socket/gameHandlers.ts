import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { GameState } from '../types';

// In-memory game states (pro real-time hry)
const gameStates = new Map<string, GameState>();

export function handleGameEvents(socket: Socket, io: Server): void {
  // Spuštění hry
  socket.on('start-game', async (data) => {
    try {
      const { roomCode } = data;

      const room = await prisma.gameRoom.findUnique({
        where: { roomCode },
        include: { game: true, players: true },
      });

      if (!room) {
        socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
        return;
      }

      // Aktualizovat status místnosti
      await prisma.gameRoom.update({
        where: { id: room.id },
        data: {
          status: 'PLAYING',
          startedAt: new Date(),
        },
      });

      // Inicializovat game state
      const gameState: GameState = {
        currentRound: 0,
        scores: { teamA: 0, teamB: 0 },
      };

      gameStates.set(roomCode, gameState);

      // Notify všechny hráče
      io.to(roomCode).emit('game-started', { gameState });

      // Odeslat první otázku (pro kvízové hry)
      await sendNextQuestion(roomCode, io);

      logger.info(`Game started in room ${roomCode}`);
    } catch (error) {
      logger.error('Error starting game:', error);
      socket.emit('error', {
        message: 'Failed to start game',
        code: 'START_GAME_ERROR',
      });
    }
  });

  // Odeslání odpovědi
  socket.on('submit-answer', async (data) => {
    try {
      const { roomCode, answerId } = data;
      const playerId = (socket as any).playerId;

      if (!playerId) return;

      const gameState = gameStates.get(roomCode);
      if (!gameState || !gameState.currentQuestion) return;

      const isCorrect =
        gameState.currentQuestion.content.correctAnswer === answerId;
      const timeElapsed = Date.now() - (gameState.roundStartTime || 0);

      // Notify všechny o odpovědi
      io.to(roomCode).emit('answer-submitted', {
        playerId,
        answerId,
        isCorrect,
        timeElapsed,
      });

      // Pokud správně, přidat body
      if (isCorrect) {
        const player = await prisma.roomPlayer.findUnique({
          where: { id: playerId },
        });

        if (player?.team === 'A') {
          gameState.scores.teamA += 10;
        } else if (player?.team === 'B') {
          gameState.scores.teamB += 10;
        }
      }
    } catch (error) {
      logger.error('Error submitting answer:', error);
    }
  });

  // Další otázka
  socket.on('next-question', async (data) => {
    try {
      const { roomCode } = data;
      await sendNextQuestion(roomCode, io);
    } catch (error) {
      logger.error('Error loading next question:', error);
    }
  });
}

async function sendNextQuestion(roomCode: string, io: Server): Promise<void> {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const room = await prisma.gameRoom.findUnique({
    where: { roomCode },
    include: { game: true },
  });

  if (!room) return;

  const settings = room.settings as any;
  const maxRounds = settings.rounds || 10;

  // Zkontrolovat, jestli hra neskončila
  if (gameState.currentRound >= maxRounds) {
    await endGame(roomCode, io);
    return;
  }

  gameState.currentRound++;

  // Načíst náhodnou otázku
  const questions = await prisma.gameContent.findMany({
    where: {
      gameId: room.gameId,
      type: 'QUESTION',
      status: 'APPROVED',
    },
    take: 100,
  });

  if (questions.length === 0) {
    await endGame(roomCode, io);
    return;
  }

  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  gameState.currentQuestion = randomQuestion;
  gameState.roundStartTime = Date.now();

  const timeLimit = settings.timePerQuestion || 30;

  // Odeslat otázku (bez správné odpovědi!)
  const questionData = {
    ...randomQuestion,
    content: {
      ...(randomQuestion.content as Record<string, unknown>),
      correctAnswer: undefined, // Skrýt správnou odpověď
    },
  };

  io.to(roomCode).emit('question-show', {
    question: questionData,
    timeLimit,
  });

  // Po timeoutu zobrazit výsledek
  setTimeout(() => {
    io.to(roomCode).emit('round-result', {
      correctAnswer: (randomQuestion.content as any).correctAnswer,
      explanation: (randomQuestion.content as any).explanation,
      scores: gameState.scores,
    });
  }, timeLimit * 1000 + 2000);
}

async function endGame(roomCode: string, io: Server): Promise<void> {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const winner =
    gameState.scores.teamA > gameState.scores.teamB
      ? 'teamA'
      : gameState.scores.teamB > gameState.scores.teamA
      ? 'teamB'
      : 'draw';

  // Aktualizovat místnost
  await prisma.gameRoom.update({
    where: { roomCode },
    data: {
      status: 'FINISHED',
      finishedAt: new Date(),
    },
  });

  // Notify o konci hry
  io.to(roomCode).emit('game-finished', {
    finalScores: gameState.scores,
    winner,
    stats: {
      totalRounds: gameState.currentRound,
    },
  });

  // Vyčistit state
  gameStates.delete(roomCode);

  logger.info(`Game finished in room ${roomCode}, winner: ${winner}`);
}
