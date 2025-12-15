# Backend - Společenské hry online

## Přehled

Backend API server pro aplikaci společenských her s podporou real-time komunikace přes WebSockets.

## Technologie

- **Runtime**: Node.js 20+ (TypeScript)
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Authentication**: Passport.js (Google OAuth 2.0)
- **Validation**: Zod
- **ORM**: Prisma
- **Session**: JWT (jsonwebtoken)
- **Security**: Helmet, CORS, Rate limiting

## Struktura projektu

```
backend/
├── src/
│   ├── config/           # Konfigurace (DB, OAuth, secrets)
│   ├── controllers/      # Request handlery
│   │   ├── authController.ts
│   │   ├── gamesController.ts
│   │   ├── roomsController.ts
│   │   ├── contentController.ts
│   │   └── userController.ts
│   ├── middleware/       # Middleware funkce
│   │   ├── auth.ts      # JWT verifikace
│   │   ├── validate.ts  # Zod validace
│   │   └── errorHandler.ts
│   ├── routes/          # API route definitions
│   │   ├── auth.ts
│   │   ├── games.ts
│   │   ├── rooms.ts
│   │   ├── content.ts
│   │   └── users.ts
│   ├── services/        # Business logika
│   │   ├── authService.ts
│   │   ├── gameService.ts
│   │   ├── roomService.ts
│   │   └── contentService.ts
│   ├── socket/          # WebSocket handlers
│   │   ├── index.ts
│   │   ├── roomHandlers.ts
│   │   └── gameHandlers.ts
│   ├── types/           # TypeScript definice
│   │   └── index.ts
│   ├── utils/           # Utility funkce
│   │   ├── logger.ts
│   │   └── roomCodeGenerator.ts
│   ├── validators/      # Zod schemas
│   │   └── schemas.ts
│   └── server.ts        # Hlavní server soubor
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/               # Testy
│   ├── unit/
│   └── integration/
├── .env.example         # Příklad env variables
├── .gitignore
├── package.json
├── tsconfig.json
└── readme.md
```

## Instalace

### Předpoklady
- Node.js 20+
- PostgreSQL 15+ běžící
- npm nebo yarn

### Kroky

1. **Instalace závislostí**
```bash
cd backend
npm install
```

2. **Konfigurace prostředí**
```bash
cp .env.example .env
```

Editujte `.env` s vlastními hodnotami:
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://gamesapp_user:password@localhost:5432/gamesapp?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# CORS
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

3. **Databázové migrace**
```bash
npx prisma migrate dev
npx prisma generate
```

4. **Seed data**
```bash
npx prisma db seed
```

5. **Spuštění vývojového serveru**
```bash
npm run dev
```

Server poběží na `http://localhost:3000`

## Skripty

```bash
# Vývoj s hot-reload
npm run dev

# Build pro produkci
npm run build

# Spuštění produkční verze
npm start

# Testy
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Prisma
npm run prisma:migrate
npm run prisma:generate
npm run prisma:studio
npm run prisma:seed
```

## API Endpointy

### Authentication

#### POST /api/auth/google
Přihlášení přes Google OAuth
```json
Request:
{
  "credential": "google-jwt-token"
}

Response:
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jan Novák",
    "avatar": "https://..."
  }
}
```

#### GET /api/auth/me
Získání aktuálního uživatele (vyžaduje Auth header)
```
Headers: Authorization: Bearer <token>

Response: User object
```

### Games

#### GET /api/games
Seznam her s filtrováním
```
Query params:
- type: "static" | "online"
- category: string
- difficulty: "easy" | "medium" | "hard"
- minPlayers: number
- maxPlayers: number

Response: Game[]
```

#### GET /api/games/:slug
Detail hry
```
Response: Game (včetně pravidel)
```

#### GET /api/games/:gameId/content
Herní obsah (otázky, slova, atd.)
```
Query params:
- category: string
- difficulty: string
- limit: number
- isUserGenerated: boolean

Response: GameContent[]
```

### Game Rooms

#### POST /api/rooms
Vytvoření nové místnosti
```json
Request:
{
  "gameId": "uuid",
  "settings": {
    "rounds": 10,
    "timePerQuestion": 30,
    "categories": ["geography", "history"]
  }
}

Response:
{
  "id": "uuid",
  "roomCode": "ABCD-1234",
  "gameId": "uuid",
  "status": "waiting",
  ...
}
```

#### GET /api/rooms/:roomCode
Info o místnosti
```
Response: GameRoom + players[]
```

#### POST /api/rooms/:roomCode/join
Připojení do místnosti
```json
Request:
{
  "playerName": "Jan",
  "team": "A" | "B" | "spectator"
}

Response: RoomPlayer
```

### User Content

#### POST /api/content
Vytvoření vlastního obsahu (Auth required)
```json
Request:
{
  "gameId": "uuid",
  "type": "question" | "activity" | "proverb",
  "content": { ... },
  "category": "geography",
  "difficulty": "medium"
}

Response: GameContent
```

#### GET /api/content/my
Můj vytvořený obsah (Auth required)

#### PUT /api/content/:id
Úprava obsahu (Auth required)

#### DELETE /api/content/:id
Smazání obsahu (Auth required)

### User Profile

#### GET /api/users/me/profile
Profil a statistiky (Auth required)

#### GET /api/users/me/history
Historie her (Auth required)

#### POST /api/users/me/favorites/:gameId
Přidat do oblíbených (Auth required)

#### DELETE /api/users/me/favorites/:gameId
Odebrat z oblíbených (Auth required)

## WebSocket Events

### Client → Server

#### join-room
```json
{
  "roomCode": "ABCD-1234",
  "playerName": "Jan",
  "team": "A"
}
```

#### leave-room
```json
{
  "roomCode": "ABCD-1234"
}
```

#### start-game
```json
{
  "roomCode": "ABCD-1234"
}
```
Pouze host místnosti

#### submit-answer
```json
{
  "roomCode": "ABCD-1234",
  "answerId": 2,
  "timestamp": 1234567890
}
```

#### next-question
```json
{
  "roomCode": "ABCD-1234"
}
```

### Server → Client

#### room-updated
```json
{
  "room": { ... },
  "players": [ ... ]
}
```

#### player-joined
```json
{
  "player": { ... }
}
```

#### game-started
```json
{
  "gameState": { ... }
}
```

#### question-show
```json
{
  "question": {
    "id": "uuid",
    "content": { ... },
    "category": "geography"
  },
  "timeLimit": 30
}
```

#### answer-submitted
```json
{
  "playerId": "uuid",
  "answerId": 2,
  "isCorrect": true,
  "timeElapsed": 12.5
}
```

#### round-result
```json
{
  "correctAnswer": 1,
  "explanation": "...",
  "scores": {
    "teamA": 85,
    "teamB": 62
  }
}
```

#### game-finished
```json
{
  "finalScores": { ... },
  "winner": "teamA",
  "stats": { ... }
}
```

## Autentizace

### Google OAuth 2.0 Flow

1. Frontend získá Google credential (JWT)
2. Frontend pošle credential na `/api/auth/google`
3. Backend:
   - Validuje Google token
   - Vytvoří/najde uživatele v DB
   - Vygeneruje vlastní JWT token
   - Vrátí token + user data
4. Frontend ukládá token (localStorage)
5. Frontend posílá token v Authorization header

### JWT Token struktura
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Chráněné endpointy
Použijte middleware `requireAuth`:
```typescript
router.get('/protected', requireAuth, handler);
```

## Bezpečnost

### Implementovaná opatření

- **Helmet.js** - Security HTTP headers
- **CORS** - Whitelist povolených domén
- **Rate Limiting** - Ochrana proti brute-force
  - API: 100 req / 15 min / IP
  - Auth: 5 req / 15 min / IP
- **Input Validation** - Zod schemas
- **XSS Protection** - Sanitizace inputů
- **SQL Injection** - Prisma ORM (prepared statements)
- **JWT** - Secure token-based auth
- **Environment Variables** - Secrets v .env

### Best practices

- Nikdy necommitujte `.env`
- Používejte silný JWT_SECRET (min. 32 znaků)
- V produkci nastavte `NODE_ENV=production`
- Používejte HTTPS (Let's Encrypt)
- Pravidelně aktualizujte závislosti

## Error Handling

### Error Response struktura
```json
{
  "error": {
    "message": "Chybová zpráva",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

### Error kódy
- `INVALID_TOKEN` - Neplatný JWT token
- `ROOM_NOT_FOUND` - Místnost neexistuje
- `UNAUTHORIZED` - Nedostatečná oprávnění
- `VALIDATION_ERROR` - Nevalidní vstupní data
- `GAME_NOT_FOUND` - Hra neexistuje

## Testování

### Unit testy
```bash
npm test
```

### Integration testy
```bash
npm run test:integration
```

### Coverage
```bash
npm run test:coverage
```

Cíl: 70%+ coverage

## Deployment

### Příprava

1. **Build**
```bash
npm run build
```

2. **Migrace DB**
```bash
npx prisma migrate deploy
```

3. **Environment**
Zkopírujte `.env` na server a nastavte produkční hodnoty

### PM2 (doporučeno)

```bash
# Instalace PM2
npm install -g pm2

# Spuštění
pm2 start dist/server.js --name games-api

# Monitoring
pm2 monit

# Logs
pm2 logs games-api

# Restart
pm2 restart games-api

# Auto-start při reboot
pm2 startup
pm2 save
```

### Docker (volitelně)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring

### Logs
```bash
# PM2 logs
pm2 logs games-api --lines 100

# Save logs
pm2 logs --json > logs.json
```

### Error Tracking
Doporučeno: Sentry.io
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Performance Monitoring
- Response times
- Database query times
- WebSocket latency

## Údržba

### Databázové indexy
Pravidelně kontrolujte:
```sql
SELECT * FROM pg_stat_user_indexes;
```

### Vyčištění starých dat
Cron job pro mazání starých místností:
```sql
DELETE FROM "GameRoom"
WHERE status = 'finished'
AND "finishedAt" < NOW() - INTERVAL '7 days';
```

### Aktualizace závislostí
```bash
npm outdated
npm update
```

## Troubleshooting

### Server se nespustí
- Zkontrolujte `.env` soubor
- Ověřte dostupnost PostgreSQL
- Zkontrolujte port 3000 (možná obsazený)

### WebSocket připojení selhává
- Zkontrolujte CORS nastavení
- Ověřte frontend URL v `.env`
- Zkontrolujte firewall

### Databázové chyby
- Ověřte DATABASE_URL
- Zkontrolujte běh PostgreSQL
- Spusťte migrace: `npx prisma migrate deploy`

## Další kroky

Po nastavení backendu:
1. Připojte frontend aplikaci
2. Nastavte Google OAuth credentials
3. Implementujte jednotlivé hry
4. Nasaďte na Hetzner VPS

## Kontakt

Pro otázky ohledně backendu kontaktujte tech lead projektu.
