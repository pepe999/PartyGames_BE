# PartyGames Backend - Průvodce dokončením nastavení

## 📋 Co je potřeba dokonfigurovat

### 1. Google OAuth 2.0 - POVINNÉ ⚠️

Backend používá Google OAuth pro autentizaci uživatelů. Bez tohoto nastavení nebude fungovat přihlášení.

#### Krok 1: Vytvoření Google Cloud projektu

1. **Přejdi na Google Cloud Console:**
   - https://console.cloud.google.com/

2. **Vytvoř nový projekt:**
   - Klikni na dropdown s projekty (vpravo nahoře)
   - "New Project"
   - Název: `PartyGames`
   - Vytvoř projekt

#### Krok 2: Aktivace Google OAuth API

1. **V levém menu:**
   - `APIs & Services` → `Library`

2. **Vyhledej a aktivuj:**
   - "Google+ API" (nebo "Google People API")
   - Klikni "Enable"

#### Krok 3: Konfigurace OAuth souhlasu (Consent Screen)

1. **V levém menu:**
   - `APIs & Services` → `OAuth consent screen`

2. **Vyber typ aplikace:**
   - **External** (pro testování)
   - Později můžeš změnit na Internal, pokud máš Google Workspace

3. **Vyplň základní informace:**
   ```
   App name: PartyGames
   User support email: <tvůj email>
   Developer contact: <tvůj email>
   ```

4. **Scopes (rozsahy oprávnění):**
   - Přidej tyto scopes:
     - `userinfo.email`
     - `userinfo.profile`
     - `openid`

5. **Test users (pro development):**
   - Přidej své testovací Google účty
   - Klikni "Add Users"
   - Zadej emailové adresy (můžeš přidat i tvůj hlavní účet)

6. **Uložit a pokračovat**

#### Krok 4: Vytvoření OAuth Credentials

1. **V levém menu:**
   - `APIs & Services` → `Credentials`

2. **Vytvoř credentials:**
   - Klikni `+ CREATE CREDENTIALS`
   - Vyber `OAuth client ID`

3. **Typ aplikace:**
   - **Application type:** `Web application`
   - **Name:** `PartyGames Web Client`

4. **Authorized JavaScript origins:**
   ```
   http://localhost:5173
   http://localhost:3000
   ```

5. **Authorized redirect URIs:**
   ```
   http://localhost:5173
   http://localhost:5173/auth/callback
   ```

6. **Vytvoř** a **ULOŽ SI:**
   - ✅ **Client ID** (něco jako: `123456789-abc123.apps.googleusercontent.com`)
   - ✅ **Client Secret** (něco jako: `GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ`)

#### Krok 5: Aktualizace .env souboru

**Otevři soubor:**
```bash
/Users/josefbina/Vyvoj/Projekty/PartyGamesComplete/PartyGames_BE/.env
```

**Nahraď tyto hodnoty:**
```bash
# Google OAuth
GOOGLE_CLIENT_ID=<tvůj-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<tvůj-client-secret>
```

**Příklad:**
```bash
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

---

### 2. Frontend konfigurace (až budeš vytvářet frontend)

Frontend bude potřebovat stejný **Client ID** pro Google Sign-In button.

V React aplikaci budeš mít `.env` soubor:
```bash
VITE_GOOGLE_CLIENT_ID=<stejný-client-id-jako-v-backendu>
VITE_API_URL=http://localhost:3000
```

---

### 3. Produkční nasazení - až budeš deployovat na Hetzner

#### Google OAuth pro produkci:

1. **Vrať se do Google Cloud Console**
2. **Credentials → Edit Web Client**
3. **Přidej produkční URL:**
   ```
   Authorized JavaScript origins:
   https://partygames.cz
   https://www.partygames.cz

   Authorized redirect URIs:
   https://partygames.cz/auth/callback
   https://www.partygames.cz/auth/callback
   ```

4. **OAuth Consent Screen:**
   - Změň z "Testing" na "Published" (pokud chceš veřejnou aplikaci)
   - Nebo přidej konkrétní test users

#### Backend .env na serveru:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://gamesapp_user:strong_password@localhost:5432/gamesapp?schema=public

# Google OAuth (stejné credentials jako pro localhost)
GOOGLE_CLIENT_ID=<tvůj-client-id>
GOOGLE_CLIENT_SECRET=<tvůj-client-secret>

# Frontend URL
FRONTEND_URL=https://partygames.cz

# Security
JWT_SECRET=<vygeneruj nový dlouhý random secret - min 64 znaků>
JWT_EXPIRES_IN=7d
SESSION_SECRET=<vygeneruj nový dlouhý random secret - min 64 znaků>

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX_REQUESTS=5
```

**Pro generování secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔧 Testování Google OAuth

### Lokální testování:

1. **Ujisti se, že backend běží:**
   ```bash
   cd /Users/josefbina/Vyvoj/Projekty/PartyGamesComplete/PartyGames_BE
   npm run dev
   ```

2. **Zkontroluj Swagger dokumentaci:**
   - Otevři: http://localhost:3000/api-docs
   - Najdi endpoint: `POST /api/auth/google`

3. **Test přes curl (budeš potřebovat Google credential token):**
   ```bash
   curl -X POST http://localhost:3000/api/auth/google \
     -H "Content-Type: application/json" \
     -d '{"credential": "google-jwt-token-zde"}'
   ```

4. **Plný test:**
   - Počkej na frontend
   - Frontend bude mít Google Sign-In button
   - Po kliknutí získá credential token
   - Token pošle na `/api/auth/google`
   - Backend vrátí JWT token
   - Frontend uloží JWT token do localStorage
   - Všechny další requesty posílají JWT token v headeru: `Authorization: Bearer <jwt-token>`

---

## ✅ Checklist - Co je hotové

- ✅ Database nastavena a běží
- ✅ Backend implementován
- ✅ Swagger dokumentace na http://localhost:3000/api-docs
- ✅ WebSocket připraven pro real-time hry
- ✅ Všechny API endpointy funkční
- ✅ JWT autentizace implementována
- ✅ Rate limiting aktivní
- ✅ Security middleware (Helmet, CORS)
- ✅ Error handling
- ✅ Validace (Zod schemas)

## ⚠️ Co MUSÍŠ dodělat

- ⚠️ **Google OAuth credentials** - bez toho nebude fungovat přihlášení
- ⚠️ **Aktualizovat .env s Google Client ID a Secret**

## 📝 Volitelné

- Frontend aplikace (React + TypeScript + Vite)
- PM2 pro produkci
- Nginx reverse proxy
- SSL certifikáty (Let's Encrypt)
- CI/CD pipeline

---

## 🆘 Troubleshooting

### "Invalid Google token" chyba

**Příčina:** Špatný nebo expirovaný Google credential token

**Řešení:**
1. Zkontroluj, že Client ID v backendu odpovídá Client ID ve frontendu
2. Google tokens expirují po 1 hodině
3. Zkus získat nový token

### "GOOGLE_CLIENT_ID not configured" chyba

**Příčina:** Chybí Google credentials v .env

**Řešení:**
1. Zkontroluj `.env` soubor
2. Ujisti se, že obsahuje `GOOGLE_CLIENT_ID` a `GOOGLE_CLIENT_SECRET`
3. Restartuj server: `npm run dev`

### CORS chyby při testování z frontendu

**Příčina:** Frontend URL není v `FRONTEND_URL`

**Řešení:**
1. Zkontroluj `.env`: `FRONTEND_URL=http://localhost:5173`
2. Pokud frontend běží na jiném portu, uprav hodnotu
3. Restartuj server

---

## 📞 Kontakt

Pokud narazíš na problém s nastavením:
1. Zkontroluj logy serveru: sleduj výstup v terminálu
2. Zkontroluj `.env` soubor
3. Otevři Swagger UI a zkus volat endpointy ručně
4. Zkontroluj Google Cloud Console - OAuth consent screen status

---

**Aktuální stav serveru:**
- ✅ Běží na: http://localhost:3000
- ✅ Swagger UI: http://localhost:3000/api-docs
- ✅ Health check: http://localhost:3000/api/health
- ✅ Database: Připojena a funkční
- ⚠️ Google OAuth: Čeká na konfiguraci credentials
