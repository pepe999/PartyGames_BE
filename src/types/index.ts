import { Request } from 'express';

// Rozšíření Express Request o user
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// API Error Response
export interface ApiError {
  message: string;
  code: string;
  status: number;
}

// Room game state
export interface GameState {
  currentRound: number;
  currentQuestion?: any;
  scores: {
    teamA: number;
    teamB: number;
  };
  roundStartTime?: number;
}

// Socket events
export interface ServerToClientEvents {
  'room-updated': (data: any) => void;
  'player-joined': (data: any) => void;
  'player-left': (data: { playerId: string }) => void;
  'game-started': (data: { gameState: GameState }) => void;
  'question-show': (data: any) => void;
  'answer-submitted': (data: any) => void;
  'round-result': (data: any) => void;
  'game-finished': (data: any) => void;
  error: (data: { message: string; code: string }) => void;
}

export interface ClientToServerEvents {
  'join-room': (data: { roomCode: string; playerName: string; team: string }) => void;
  'leave-room': (data: { roomCode: string }) => void;
  'change-team': (data: { roomCode: string; team: string }) => void;
  'start-game': (data: { roomCode: string }) => void;
  'submit-answer': (data: { roomCode: string; answerId: number; timestamp: number }) => void;
  'next-question': (data: { roomCode: string }) => void;
  'game-action': (data: { roomCode: string; action: string; payload: any }) => void;
}
