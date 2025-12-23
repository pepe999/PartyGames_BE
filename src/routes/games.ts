import { Router } from 'express';
import {
  getGames,
  getGame,
  getContent,
  createContent,
  toggleFavorite,
  getFavorites,
} from '../controllers/gamesController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/games:
 *   get:
 *     tags: [Games]
 *     summary: Seznam her
 *     description: Získá seznam všech her s možností filtrování a stránkování
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ONLINE, OFFLINE, BOTH]
 *         description: Filtr podle typu hry
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtr podle kategorie
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *         description: Filtr podle obtížnosti
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Hledání podle názvu nebo popisu
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Počet her na stránku
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset pro stránkování
 *     responses:
 *       200:
 *         description: Seznam her
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
 *                     games:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Game'
 *                     total:
 *                       type: integer
 */
router.get('/', getGames);

/**
 * @swagger
 * /api/games/favorites:
 *   get:
 *     tags: [Games]
 *     summary: Oblíbené hry uživatele
 *     description: Získá seznam her označených jako oblíbené aktuálním uživatelem
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seznam oblíbených her
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
 *                     games:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Game'
 *       401:
 *         description: Není přihlášen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/favorites', requireAuth, getFavorites);

/**
 * @swagger
 * /api/games/{slug}:
 *   get:
 *     tags: [Games]
 *     summary: Detail hry
 *     description: Získá detailní informace o hře podle slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: URL slug hry
 *     responses:
 *       200:
 *         description: Detail hry
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
 *                     game:
 *                       $ref: '#/components/schemas/Game'
 *       404:
 *         description: Hra nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:slug', getGame);

/**
 * @swagger
 * /api/games/{gameId}/content:
 *   get:
 *     tags: [Games]
 *     summary: Obsah hry
 *     description: Získá obsah hry (otázky, aktivity, výzvy)
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID hry
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [QUESTION, ACTIVITY, CHALLENGE]
 *         description: Filtr podle typu obsahu
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtr podle kategorie
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *         description: Filtr podle obtížnosti
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Počet položek
 *     responses:
 *       200:
 *         description: Obsah hry
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
 *                     content:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/GameContent'
 *                     total:
 *                       type: integer
 *       404:
 *         description: Hra nebyla nalezena
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Games]
 *     summary: Vytvoření user-generated obsahu
 *     description: Přidá nový obsah do hry (vytvořený uživatelem)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID hry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [QUESTION, ACTIVITY, CHALLENGE]
 *               content:
 *                 type: object
 *                 description: Obsah závisí na typu (question, activity, challenge)
 *               category:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *     responses:
 *       201:
 *         description: Obsah vytvořen
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
 *                     content:
 *                       $ref: '#/components/schemas/GameContent'
 *       400:
 *         description: Validační chyba
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Není přihlášen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:gameId/content', getContent);
router.post('/:gameId/content', requireAuth, createContent);

/**
 * @swagger
 * /api/games/{gameId}/favorite:
 *   post:
 *     tags: [Games]
 *     summary: Oblíbená hra (toggle)
 *     description: Přidá nebo odebere hru z oblíbených
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID hry
 *     responses:
 *       200:
 *         description: Oblíbená aktualizována
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
 *                     isFavorite:
 *                       type: boolean
 *       401:
 *         description: Není přihlášen
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
router.post('/:gameId/favorite', requireAuth, toggleFavorite);

export default router;
