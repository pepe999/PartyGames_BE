import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { GameState } from '../types';

// In-memory game states (pro real-time hry)
export const gameStates = new Map<string, GameState>();

export function handleGameEvents(socket: Socket, io: Server): void {
  // Spuštění hry
  socket.on('start-game', async (data) => {
    try {
      const { roomCode } = data;
      logger.info(`Received start-game event for room ${roomCode} from socket ${socket.id}`);

      const room = await prisma.gameRoom.findUnique({
        where: { roomCode },
        include: { game: true, players: true },
      });

      if (!room) {
        logger.error(`Room ${roomCode} not found`);
        socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
        return;
      }

      logger.info(`Room ${roomCode} found, updating status to PLAYING`);

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

      logger.info(`Emitting game-started event to room ${roomCode}`);
      // Notify všechny hráče
      io.to(roomCode).emit('game-started', { gameState });

      // Odeslat první otázku (pro kvízové hry)
      logger.info(`Sending first question to room ${roomCode}`);
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

export async function sendNextQuestion(roomCode: string, io: Server): Promise<void> {
  logger.info(`sendNextQuestion called for room ${roomCode}`);
  let gameState = gameStates.get(roomCode);

  // Pokud game state neexistuje, vytvoř ho
  if (!gameState) {
    logger.info(`Creating new game state for room ${roomCode}`);
    gameState = {
      currentRound: 0,
      scores: { teamA: 0, teamB: 0 },
    };
    gameStates.set(roomCode, gameState);
  }

  const room = await prisma.gameRoom.findUnique({
    where: { roomCode },
    include: { game: true },
  });

  if (!room) {
    logger.error(`Room ${roomCode} not found in sendNextQuestion`);
    return;
  }

  const settings = room.settings as any;
  const maxRounds = settings.rounds || 10;

  logger.info(`Current round: ${gameState.currentRound}, Max rounds: ${maxRounds}`);

  // Zkontrolovat, jestli hra neskončila
  if (gameState.currentRound >= maxRounds) {
    logger.info(`Game ended: currentRound (${gameState.currentRound}) >= maxRounds (${maxRounds})`);
    await endGame(roomCode, io);
    return;
  }

  gameState.currentRound++;
  logger.info(`Round incremented to: ${gameState.currentRound}`);

  // Určit typ obsahu podle názvu hry
  const gameSlug = room.game.slug;
  const isPantomima = gameSlug === 'pantomima';
  const contentType = isPantomima ? 'PANTOMIMA' : 'QUESTION';

  logger.info(`Game: ${room.game.name} (${gameSlug}), Content type: ${contentType}`);

  // Načíst náhodný obsah (otázku nebo slovo)
  const content = await prisma.gameContent.findMany({
    where: {
      gameId: room.gameId,
      type: contentType,
      status: 'APPROVED',
    },
    take: 100,
  });

  logger.info(`Found ${content.length} ${contentType} items for game ${room.gameId}`);

  if (content.length === 0) {
    logger.error(`No ${contentType} found for game ${room.gameId}, ending game`);
    await endGame(roomCode, io);
    return;
  }

  const randomContent = content[Math.floor(Math.random() * content.length)];
  gameState.currentQuestion = randomContent;
  gameState.roundStartTime = Date.now();

  const timeLimit = settings.timePerQuestion || 60;

  if (isPantomima) {
    // Pro pantomimu pošli slovo k předvádění
    const wordData = {
      id: randomContent.id,
      word: (randomContent.content as any).word,
      category: (randomContent.content as any).category,
      difficulty: randomContent.difficulty,
    };

    logger.info(`Sending pantomima word to room ${roomCode}:`, wordData);

    io.to(roomCode).emit('word-show', {
      word: wordData,
      timeLimit,
    });

    // Po timeoutu pokračuj dalším kolem
    setTimeout(() => {
      io.to(roomCode).emit('round-end', {
        word: wordData.word,
        scores: gameState.scores,
      });
    }, timeLimit * 1000 + 2000);
  } else {
    // Pro kvíz pošli otázku (bez správné odpovědi!)
    const questionData = {
      ...randomContent,
      content: {
        ...(randomContent.content as Record<string, unknown>),
        correctAnswer: undefined, // Skrýt správnou odpověď
      },
    };

    logger.info(`Sending question to room ${roomCode}:`, {
      questionId: randomContent.id,
      content: questionData.content,
      timeLimit,
    });

    io.to(roomCode).emit('question-show', {
      question: questionData,
      timeLimit,
    });

    // Po timeoutu zobrazit výsledek
    setTimeout(() => {
      io.to(roomCode).emit('round-result', {
        correctAnswer: (randomContent.content as any).correctAnswer,
        explanation: (randomContent.content as any).explanation,
        scores: gameState.scores,
      });
    }, timeLimit * 1000 + 2000);
  }
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
