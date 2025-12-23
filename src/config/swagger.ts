import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PartyGames API',
      version: '1.0.0',
      description: 'REST API pro PartyGames aplikaci - multiplayer párty hry s Google OAuth autentizací',
      contact: {
        name: 'API Support',
        email: 'support@partygames.cz',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
      {
        url: 'https://api.partygames.cz',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token získaný z Google OAuth přihlášení',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                status: { type: 'number' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatar: { type: 'string', format: 'uri', nullable: true },
          },
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            rules: { type: 'string' },
            type: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'BOTH'] },
            category: { type: 'string' },
            difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
            minPlayers: { type: 'number' },
            maxPlayers: { type: 'number' },
            estimatedTime: { type: 'number' },
            imageUrl: { type: 'string', format: 'uri', nullable: true },
            isActive: { type: 'boolean' },
          },
        },
        GameContent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            gameId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['QUESTION', 'ACTIVITY', 'CHALLENGE'] },
            content: { type: 'object' },
            category: { type: 'string', nullable: true },
            difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'], nullable: true },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
          },
        },
        GameRoom: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roomCode: { type: 'string', pattern: '^[A-Z0-9]{4}-[A-Z0-9]{4}$' },
            status: { type: 'string', enum: ['WAITING', 'PLAYING', 'FINISHED'] },
            settings: { type: 'object' },
            game: { $ref: '#/components/schemas/Game' },
            players: { type: 'array', items: { $ref: '#/components/schemas/RoomPlayer' } },
            createdAt: { type: 'string', format: 'date-time' },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            finishedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        RoomPlayer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            playerName: { type: 'string' },
            team: { type: 'string', enum: ['A', 'B', 'SPECTATOR'] },
            isConnected: { type: 'boolean' },
            joinedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Autentizace a autorizace uživatelů',
      },
      {
        name: 'Games',
        description: 'Správa her a herního obsahu',
      },
      {
        name: 'Rooms',
        description: 'Správa herních místností',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
