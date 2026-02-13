import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createGameRoom,
  getRoom,
  joinGameRoom,
  updateSettings,
  startGameInRoom,
  changeTeam,
  getActiveRooms,
  getRoomPlayers,
  setReady,
  leaveGameRoom,
  getRoomMetadataController,
} from '../controllers/roomsController';
import { optionalAuth, requireAuth } from '../middleware/auth';

// Rate limiter pro pokusy o zadání hesla
const passwordVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 5, // 5 pokusů za 15 minut
  message: 'Příliš mnoho pokusů o zadání hesla, zkuste to prosím později',
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     tags: [Rooms]
 *     summary: Seznam aktivních místností
 *     description: Získá seznam všech aktivních herních místností (pro lobby)
 *     responses:
 *       200:
 *         description: Seznam místností
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     rooms:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/GameRoom'
 *                     total:
 *                       type: integer
 *   post:
 *     tags: [Rooms]
 *     summary: Vytvoření nové místnosti
 *     description: Vytvoří novou herní místnost (může být anonymní nebo s hostitelem)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gameId
 *               - settings
 *             properties:
 *               gameId:
 *                 type: string
 *                 format: uuid
 *                 description: ID hry
 *               settings:
 *                 type: object
 *                 properties:
 *                   rounds:
 *                     type: integer
 *                     description: Počet kol
 *                   timePerQuestion:
 *                     type: integer
 *                     description: Čas na otázku v sekundách
 *                   categories:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Povolené kategorie
 *                   difficulty:
 *                     type: string
 *                     enum: [EASY, MEDIUM, HARD]
 *                     description: Obtížnost
 *                   teamMode:
 *                     type: boolean
 *                     description: Týmový režim
 *                   maxPlayers:
 *                     type: integer
 *                     description: Maximální počet hráčů
 *     responses:
 *       201:
 *         description: Místnost vytvořena
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     room:
 *                       $ref: '#/components/schemas/GameRoom'
 *       400:
 *         description: Validační chyba
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Hra nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getActiveRooms);
router.post('/', optionalAuth, createGameRoom);

/**
 * @swagger
 * /api/rooms/{roomCode}:
 *   get:
 *     tags: [Rooms]
 *     summary: Detail místnosti
 *     description: Získá detailní informace o herní místnosti včetně hráčů
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{4}-[A-Z0-9]{4}$'
 *         description: Kód místnosti (např. ABCD-1234)
 *     responses:
 *       200:
 *         description: Detail místnosti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     room:
 *                       $ref: '#/components/schemas/GameRoom'
 *       404:
 *         description: Místnost nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:roomCode', getRoom);

/**
 * @swagger
 * /api/rooms/{roomCode}/metadata:
 *   get:
 *     tags: [Rooms]
 *     summary: Metadata místnosti
 *     description: Získá základní informace o místnosti (bez citlivých dat) - používá se pro kontrolu před vstupem
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{4}-[A-Z0-9]{4}$'
 *         description: Kód místnosti
 *     responses:
 *       200:
 *         description: Metadata místnosti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         roomCode:
 *                           type: string
 *                         roomName:
 *                           type: string
 *                         isPrivate:
 *                           type: boolean
 *                         requiresPassword:
 *                           type: boolean
 *                         status:
 *                           type: string
 *                         gameName:
 *                           type: string
 *       404:
 *         description: Místnost nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:roomCode/metadata', getRoomMetadataController);

/**
 * @swagger
 * /api/rooms/{roomCode}/players:
 *   get:
 *     tags: [Rooms]
 *     summary: Seznam hráčů v místnosti
 *     description: Získá seznam všech hráčů v místnosti
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{4}-[A-Z0-9]{4}$'
 *         description: Kód místnosti
 *     responses:
 *       200:
 *         description: Seznam hráčů
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     players:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RoomPlayer'
 *       404:
 *         description: Místnost nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:roomCode/players', getRoomPlayers);

/**
 * @swagger
 * /api/rooms/{roomCode}/join:
 *   post:
 *     tags: [Rooms]
 *     summary: Připojení do místnosti
 *     description: Připojí hráče do herní místnosti (anonymní nebo přihlášený)
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{4}-[A-Z0-9]{4}$'
 *         description: Kód místnosti
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerName
 *             properties:
 *               playerName:
 *                 type: string
 *                 description: Jméno hráče
 *               team:
 *                 type: string
 *                 enum: [A, B, SPECTATOR]
 *                 default: SPECTATOR
 *                 description: Tým hráče
 *     responses:
 *       200:
 *         description: Hráč úspěšně připojen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     player:
 *                       $ref: '#/components/schemas/RoomPlayer'
 *       400:
 *         description: Místnost je plná nebo hra už běží
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Místnost nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:roomCode/join', passwordVerifyLimiter, optionalAuth, joinGameRoom);

/**
 * @swagger
 * /api/rooms/{roomCode}/settings:
 *   patch:
 *     tags: [Rooms]
 *     summary: Aktualizace nastavení (pouze host)
 *     description: Aktualizuje nastavení místnosti před startem hry
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Kód místnosti
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 properties:
 *                   rounds:
 *                     type: integer
 *                   timePerQuestion:
 *                     type: integer
 *                   categories:
 *                     type: array
 *                     items:
 *                       type: string
 *                   difficulty:
 *                     type: string
 *                     enum: [EASY, MEDIUM, HARD]
 *                   teamMode:
 *                     type: boolean
 *                   maxPlayers:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Nastavení aktualizováno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     room:
 *                       $ref: '#/components/schemas/GameRoom'
 *       403:
 *         description: Pouze host může měnit nastavení
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Místnost nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:roomCode/settings', optionalAuth, updateSettings);

/**
 * @swagger
 * /api/rooms/{roomCode}/start:
 *   post:
 *     tags: [Rooms]
 *     summary: Spuštění hry (pouze host)
 *     description: Spustí hru v místnosti
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Kód místnosti
 *     responses:
 *       200:
 *         description: Hra spuštěna
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     room:
 *                       $ref: '#/components/schemas/GameRoom'
 *       400:
 *         description: Nedostatečný počet hráčů
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Pouze host může spustit hru
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Místnost nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:roomCode/start', optionalAuth, startGameInRoom);

/**
 * @swagger
 * /api/rooms/{roomCode}/players/{playerId}/team:
 *   post:
 *     tags: [Rooms]
 *     summary: Změna týmu hráče
 *     description: Změní tým hráče v místnosti
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Kód místnosti
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID hráče
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B, SPECTATOR]
 *                 description: Nový tým
 *     responses:
 *       200:
 *         description: Tým změněn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     player:
 *                       $ref: '#/components/schemas/RoomPlayer'
 *       400:
 *         description: Hra už běží, nelze měnit tým
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Místnost nebo hráč nebyli nalezeni
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:roomCode/players/:playerId/team', changeTeam);

/**
 * @swagger
 * /api/rooms/{roomCode}/players/{playerId}/ready:
 *   post:
 *     tags: [Rooms]
 *     summary: Nastavení připravenosti hráče
 *     description: Nastaví či zruší připravenost hráče
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Kód místnosti
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID hráče
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isReady
 *             properties:
 *               isReady:
 *                 type: boolean
 *                 description: Připraven (true) nebo ne (false)
 *     responses:
 *       200:
 *         description: Připravenost změněna
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     player:
 *                       $ref: '#/components/schemas/RoomPlayer'
 *       400:
 *         description: Hra už běží, nelze měnit připravenost
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Místnost nebo hráč nebyli nalezeni
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:roomCode/players/:playerId/ready', setReady);

/**
 * @swagger
 * /api/rooms/{roomCode}/leave:
 *   post:
 *     tags: [Rooms]
 *     summary: Opuštění místnosti
 *     description: Hráč opouští místnost. Pokud je host, přenese se role na dalšího hráče.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{4}-[A-Z0-9]{4}$'
 *         description: Kód místnosti
 *     responses:
 *       200:
 *         description: Místnost úspěšně opuštěna
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Uživatel není přihlášen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Místnost nebo hráč nebyl nalezen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:roomCode/leave', requireAuth, leaveGameRoom);

export default router;
