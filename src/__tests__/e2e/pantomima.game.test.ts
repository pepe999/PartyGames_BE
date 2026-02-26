import request from 'supertest';
import { io as ioClient, Socket } from 'socket.io-client';
import { createTestServer, TestServer } from '../setup/testServer';
import { getPantomimaGame, cleanupTestData } from '../setup/testDatabase';

describe('Pantomima Game E2E Flow', () => {
  let server: TestServer;
  let pantomimaGameId: string;

  beforeAll(async () => {
    // Create test server
    server = await createTestServer();

    // Get existing Pantomima game from seeded database
    const gameData = await getPantomimaGame(server.prisma);
    pantomimaGameId = gameData.pantomimaGameId;
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    // Clean up rooms and players after each test
    await cleanupTestData(server.prisma);
  });

  describe('Room Creation and Joining', () => {
    it('should create a new Pantomima room', async () => {
      const response = await request(server.app)
        .post('/api/rooms')
        .send({
          gameId: pantomimaGameId,
          settings: {
            rounds: 3,
            timePerQuestion: 60,
            teamMode: true,
            maxPlayers: 10,
          },
          isPrivate: false,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.room.roomCode).toBeDefined();
      expect(response.body.data.room.roomCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should allow players to join the room', async () => {
      // Create room
      const createResponse = await request(server.app)
        .post('/api/rooms')
        .send({
          gameId: pantomimaGameId,
          settings: { rounds: 3, teamMode: true },
          isPrivate: false,
        })
        .expect(201);

      const roomCode = createResponse.body.data.room.roomCode;

      // Join 4 players
      const players = [
        { name: 'Host', team: 'A' },
        { name: 'Player 2', team: 'A' },
        { name: 'Player 3', team: 'B' },
        { name: 'Player 4', team: 'B' },
      ];

      for (const player of players) {
        const joinResponse = await request(server.app)
          .post(`/api/rooms/${roomCode}/join`)
          .send({
            playerName: player.name,
            team: player.team,
          })
          .expect(200);

        expect(joinResponse.body.success).toBe(true);
        expect(joinResponse.body.data.player.playerName).toBe(player.name);
      }

      // Verify room has 4 players
      const roomResponse = await request(server.app)
        .get(`/api/rooms/${roomCode}/players`)
        .expect(200);

      expect(roomResponse.body.data.players).toHaveLength(4);
    });
  });

  describe('Full Game Flow with 4 Players', () => {
    let roomCode: string;
    const sockets: Socket[] = [];

    afterEach(() => {
      // Clean up sockets after each test
      sockets.forEach((socket) => {
        if (socket.connected) {
          socket.disconnect();
        }
      });
      sockets.length = 0;
    });

    it('should create room, connect 4 players, start game and receive word-show event', async () => {
      // Step 1: Create room via API
      const createResponse = await request(server.app)
        .post('/api/rooms')
        .send({
          gameId: pantomimaGameId,
          settings: {
            rounds: 3,
            timePerQuestion: 10, // Short timeout for tests
            teamMode: true,
          },
          isPrivate: false,
        })
        .expect(201);

      roomCode = createResponse.body.data.room.roomCode;
      expect(roomCode).toBeDefined();

      // Step 2: Join 4 players via API
      const players = [
        { name: 'Host', team: 'A' as const },
        { name: 'Player 2', team: 'A' as const },
        { name: 'Player 3', team: 'B' as const },
        { name: 'Player 4', team: 'B' as const },
      ];

      const playerIds: string[] = [];

      for (const player of players) {
        const joinResponse = await request(server.app)
          .post(`/api/rooms/${roomCode}/join`)
          .send({
            playerName: player.name,
            team: player.team,
          })
          .expect(200);

        playerIds.push(joinResponse.body.data.player.id);
      }

      // Step 3: Connect 4 socket.io clients
      const receivedEvents: { socketIndex: number; event: string; data: any }[] = [];

      const connectSocket = (index: number): Promise<Socket> => {
        return new Promise((resolve, reject) => {
          const socket = ioClient(server.baseUrl, {
            transports: ['websocket'],
            autoConnect: true,
          });

          const timeout = setTimeout(() => {
            reject(new Error(`Socket ${index} connection timeout`));
          }, 5000);

          socket.on('connect', () => {
            clearTimeout(timeout);
            // Join room via socket
            socket.emit('room:join', roomCode);
            resolve(socket);
          });

          socket.on('connect_error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      };

      // Connect all 4 sockets
      for (let i = 0; i < 4; i++) {
        const socket = await connectSocket(i);
        sockets.push(socket);

        // Set up event listeners
        socket.on('game-started', (data) => {
          receivedEvents.push({ socketIndex: i, event: 'game-started', data });
        });

        socket.on('word-show', (data) => {
          receivedEvents.push({ socketIndex: i, event: 'word-show', data });
        });

        socket.on('round-end', (data) => {
          receivedEvents.push({ socketIndex: i, event: 'round-end', data });
        });
      }

      // Wait for sockets to fully connect and join room
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 4: Start the game via socket (first socket is the "host")
      sockets[0].emit('start-game', { roomCode });

      // Step 5: Wait for word-show events
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 6: Verify all 4 sockets received game-started
      const gameStartedEvents = receivedEvents.filter((e) => e.event === 'game-started');
      expect(gameStartedEvents.length).toBe(4);

      // Step 7: Verify all 4 sockets received word-show
      const wordShowEvents = receivedEvents.filter((e) => e.event === 'word-show');
      expect(wordShowEvents.length).toBe(4);

      // Step 8: Verify word-show data structure
      const wordData = wordShowEvents[0].data;
      expect(wordData).toHaveProperty('word');
      expect(wordData.word).toHaveProperty('id');
      expect(wordData.word).toHaveProperty('word');
      expect(wordData.word).toHaveProperty('category');
      expect(wordData.word).toHaveProperty('difficulty');
      expect(wordData).toHaveProperty('timeLimit');
      expect(typeof wordData.timeLimit).toBe('number');
      expect(wordData.timeLimit).toBeGreaterThan(0);

      // Step 9: Verify the word is a non-empty string
      expect(typeof wordData.word.word).toBe('string');
      expect(wordData.word.word.length).toBeGreaterThan(0);

      // Step 10: Verify room status is PLAYING
      const room = await server.prisma.gameRoom.findUnique({
        where: { roomCode },
      });
      expect(room?.status).toBe('PLAYING');
    });

    it('should receive round-end event after timeout', async () => {
      // Create room with minimum timeout (5 seconds)
      const createResponse = await request(server.app)
        .post('/api/rooms')
        .send({
          gameId: pantomimaGameId,
          settings: {
            rounds: 1,
            timePerQuestion: 5, // Minimum allowed timeout
            teamMode: true,
          },
          isPrivate: false,
        })
        .expect(201);

      roomCode = createResponse.body.data.room.roomCode;

      // Join 2 players (minimum for teams)
      for (const player of [{ name: 'P1', team: 'A' }, { name: 'P2', team: 'B' }]) {
        await request(server.app)
          .post(`/api/rooms/${roomCode}/join`)
          .send({ playerName: player.name, team: player.team })
          .expect(200);
      }

      const receivedEvents: { event: string; data: any }[] = [];

      // Connect socket
      const socket = await new Promise<Socket>((resolve) => {
        const s = ioClient(server.baseUrl, { transports: ['websocket'] });
        s.on('connect', () => {
          s.emit('room:join', roomCode);
          resolve(s);
        });
      });
      sockets.push(socket);

      socket.on('word-show', (data) => {
        receivedEvents.push({ event: 'word-show', data });
      });

      socket.on('round-end', (data) => {
        receivedEvents.push({ event: 'round-end', data });
      });

      socket.on('game-finished', (data) => {
        receivedEvents.push({ event: 'game-finished', data });
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Start game
      socket.emit('start-game', { roomCode });

      // Wait for round-end (timeout is 5s + 2s buffer = 7s)
      await new Promise((resolve) => setTimeout(resolve, 9000));

      // Verify word-show was received
      const wordShowEvents = receivedEvents.filter((e) => e.event === 'word-show');
      expect(wordShowEvents.length).toBeGreaterThanOrEqual(1);

      // Verify round-end was received
      const roundEndEvents = receivedEvents.filter((e) => e.event === 'round-end');
      expect(roundEndEvents.length).toBeGreaterThanOrEqual(1);

      // Verify round-end data
      const roundEndData = roundEndEvents[0].data;
      expect(roundEndData).toHaveProperty('word');
      expect(roundEndData).toHaveProperty('scores');
      expect(roundEndData.scores).toHaveProperty('teamA');
      expect(roundEndData.scores).toHaveProperty('teamB');
    });
  });

  describe('API Endpoints', () => {
    it('GET /api/games should return Pantomima game', async () => {
      const response = await request(server.app)
        .get('/api/games')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.games).toBeInstanceOf(Array);

      const pantomima = response.body.data.games.find((g: any) => g.slug === 'pantomima');
      expect(pantomima).toBeDefined();
      expect(pantomima.name).toBe('Pantomima');
    });

    it('GET /api/rooms/:roomCode should return room details', async () => {
      // Create room
      const createResponse = await request(server.app)
        .post('/api/rooms')
        .send({
          gameId: pantomimaGameId,
          settings: { rounds: 5, teamMode: true },
          isPrivate: false,
        })
        .expect(201);

      const roomCode = createResponse.body.data.room.roomCode;

      // Get room details
      const roomResponse = await request(server.app)
        .get(`/api/rooms/${roomCode}`)
        .expect(200);

      expect(roomResponse.body.success).toBe(true);
      expect(roomResponse.body.data.room.roomCode).toBe(roomCode);
      expect(roomResponse.body.data.room.status).toBe('WAITING');
    });
  });
});
