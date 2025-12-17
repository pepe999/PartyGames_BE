# Instalační návod - Společenské hry online

Tento dokument popisuje kompletní instalaci aplikace jak na lokálním vývojovém prostředí, tak na produkčním serveru (Hetzner).

---

## 📋 Obsah

1. [Lokální instalace (vývojové prostředí)](#-1-lokální-instalace-vývojové-prostředí)
2. [Produkční instalace (Hetzner server)](#-2-produkční-instalace-hetzner-server)
3. [Údržba a monitoring](#-3-údržba-a-monitoring)
4. [Řešení problémů](#-4-řešení-problémů)

---

## 🖥️ 1. Lokální instalace (vývojové prostředí)

### 1.1 Předpoklady

Před začátkem instalace si ověřte, že máte nainstalováno:

- **Node.js** verze 20.x nebo vyšší
  ```bash
  node --version  # Mělo by zobrazit v20.x.x
  ```

- **npm** nebo **yarn**
  ```bash
  npm --version
  ```

- **PostgreSQL** verze 15 nebo vyšší
  ```bash
  psql --version
  ```

- **Git**
  ```bash
  git --version
  ```

#### Instalace Node.js (pokud nemáte)

**macOS:**
```bash
# Pomocí Homebrew
brew install node@20

# Nebo pomocí nvm (doporučeno)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # nebo ~/.zshrc
nvm install 20
nvm use 20
```

**Windows:**
- Stáhněte instalátor z [nodejs.org](https://nodejs.org/)
- Nebo použijte nvm-windows: [github.com/coreybutler/nvm-windows](https://github.com/coreybutler/nvm-windows)

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Instalace PostgreSQL

**macOS:**
```bash
# Pomocí Homebrew
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
- Stáhněte instalátor z [postgresql.org](https://www.postgresql.org/download/windows/)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

### 1.2 Klonování repozitáře

```bash
# Vytvořte složku pro projekt
mkdir PartyGamesComplete
cd PartyGamesComplete

# Klonujte všechny části projektu
git clone <URL_REPOSITORY_DB> PartyGames_DB
git clone <URL_REPOSITORY_BE> PartyGames_BE
git clone <URL_REPOSITORY_FE> PartyGames_FE
```

---

### 1.3 Nastavení databáze

#### Krok 1: Vytvoření databáze a uživatele

```bash
# Přihlaste se k PostgreSQL (macOS/Linux)
sudo -u postgres psql

# Windows - otevřete pgAdmin nebo použijte:
# psql -U postgres
```

V PostgreSQL konzoli spusťte:

```sql
-- Vytvoření databáze
CREATE DATABASE gamesapp;

-- Vytvoření uživatele s heslem
CREATE USER gamesapp_user WITH PASSWORD 'vase_heslo_zde';

-- Přidělení oprávnění
GRANT ALL PRIVILEGES ON DATABASE gamesapp TO gamesapp_user;

-- Připojení k databázi
\c gamesapp

-- Přidělení oprávnění na schéma
GRANT ALL ON SCHEMA public TO gamesapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gamesapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gamesapp_user;

-- Nastavení default oprávnění
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gamesapp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gamesapp_user;

-- Ukončení
\q
```

#### Krok 2: Spuštění inicializačního skriptu (volitelné)

```bash
cd PartyGames_DB
psql -U gamesapp_user -d gamesapp -f scripts/init-db.sql
```

Zadejte heslo, které jste nastavili pro `gamesapp_user`.

---

### 1.4 Nastavení databázové vrstvy (Prisma)

```bash
cd PartyGames_DB

# Instalace závislostí
npm install

# Vytvoření .env souboru
cat > .env << EOF
DATABASE_URL="postgresql://gamesapp_user:vase_heslo_zde@localhost:5432/gamesapp?schema=public"
EOF

# DŮLEŽITÉ: Nahraďte 'vase_heslo_zde' skutečným heslem!

# Vygenerování Prisma Client
npx prisma generate

# Vytvoření databázových tabulek (migrace)
npx prisma migrate dev --name init

# Naplnění databáze testovacími daty
npx prisma db seed
```

#### Ověření instalace databáze

```bash
# Otevřete Prisma Studio pro vizuální kontrolu
npx prisma studio
```

Otevře se v prohlížeči na `http://localhost:5555`. Měli byste vidět tabulky s daty.

---

### 1.5 Nastavení backendu

```bash
cd ../PartyGames_BE

# Instalace závislostí
npm install

# Vytvoření .env souboru
cat > .env << EOF
# Databáze
DATABASE_URL="postgresql://gamesapp_user:vase_heslo_zde@localhost:5432/gamesapp?schema=public"

# Server
PORT=3000
NODE_ENV=development

# Google OAuth (získejte z Google Cloud Console)
GOOGLE_CLIENT_ID="vas-google-client-id"
GOOGLE_CLIENT_SECRET="vas-google-client-secret"

# JWT Secret (vygenerujte náhodný string)
JWT_SECRET="vygenerovany-nahodny-tajny-retezec-min-32-znaku"

# Frontend URL (pro CORS)
FRONTEND_URL="http://localhost:5173"

# Session
SESSION_SECRET="dalsi-nahodny-tajny-retezec"
EOF
```

#### Získání Google OAuth credentials

1. Přejděte na [Google Cloud Console](https://console.cloud.google.com/)
2. Vytvořte nový projekt nebo vyberte existující
3. Zapněte Google+ API
4. Přejděte na "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Nastavte:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
6. Zkopírujte Client ID a Client Secret do `.env`

#### Vygenerování JWT Secret

```bash
# Vygenerování náhodného stringu
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Zkopírujte výstup do `JWT_SECRET` v `.env`.

#### Spuštění backend serveru

```bash
# Development režim s auto-reload
npm run dev

# Nebo standardní spuštění
npm start
```

Backend běží na `http://localhost:3000`.

#### Testování API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Mělo by vrátit: {"status":"ok"}
```

---

### 1.6 Nastavení frontendu

```bash
cd ../PartyGames_FE

# Instalace závislostí
npm install

# Vytvoření .env souboru
cat > .env << EOF
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=vas-google-client-id
EOF
```

**DŮLEŽITÉ:** Použijte stejný `GOOGLE_CLIENT_ID` jako v backendu!

#### Spuštění frontend serveru

```bash
# Development režim
npm run dev
```

Frontend běží na `http://localhost:5173` (nebo jiném portu, pokud je 5173 obsazený).

---

### 1.7 Ověření kompletní instalace

Nyní byste měli mít spuštěné:

1. ✅ PostgreSQL databázi na portu 5432
2. ✅ Backend API na `http://localhost:3000`
3. ✅ Frontend na `http://localhost:5173`

**Test celého systému:**

1. Otevřete prohlížeč na `http://localhost:5173`
2. Měli byste vidět homepage s hrami
3. Klikněte na "Přihlásit se" a vyzkoušejte Google OAuth
4. Zkuste vytvořit herní místnost

---

## 🚀 2. Produkční instalace (Hetzner server)

### 2.1 Objednání serveru na Hetzner

1. Přejděte na [hetzner.com](https://www.hetzner.com/)
2. Registrujte se nebo se přihlaste
3. Objednejte **Cloud Server CX21**:
   - **RAM:** 4 GB
   - **vCPU:** 2
   - **Storage:** 40 GB SSD
   - **Cena:** ~5.50 EUR/měsíc
   - **Lokace:** Falkenstein nebo Nuremberg (nejblíže ČR)
   - **OS:** Ubuntu 22.04 LTS

4. Po vytvoření serveru dostanete:
   - IP adresu serveru (např. `123.45.67.89`)
   - Root heslo (pošle se na email)

---

### 2.2 Připojení k serveru

```bash
# Připojte se přes SSH
ssh root@123.45.67.89

# Zadejte heslo z emailu
```

**Doporučení:** Po prvním přihlášení změňte root heslo:
```bash
passwd
```

---

### 2.3 Základní nastavení serveru

```bash
# Aktualizace systému
apt update && apt upgrade -y

# Instalace základních nástrojů
apt install -y git curl wget build-essential ufw fail2ban

# Vytvoření nového uživatele (bezpečnost - nepoužívat root)
adduser gamesapp
usermod -aG sudo gamesapp

# Nastavení firewallu
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

### 2.4 Instalace Node.js

```bash
# Instalace nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Načtení nvm do aktuální session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instalace Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Ověření
node --version
npm --version
```

---

### 2.5 Instalace PostgreSQL

```bash
# Instalace PostgreSQL 15
apt install -y postgresql-15 postgresql-contrib

# Spuštění a zapnutí auto-start
systemctl start postgresql
systemctl enable postgresql

# Ověření
systemctl status postgresql
```

---

### 2.6 Nastavení databáze na serveru

```bash
# Přepnutí na postgres uživatele
sudo -u postgres psql

# V PostgreSQL konzoli:
CREATE DATABASE gamesapp;
CREATE USER gamesapp_user WITH PASSWORD 'SILNE_PRODUKCI_HESLO';
GRANT ALL PRIVILEGES ON DATABASE gamesapp TO gamesapp_user;

\c gamesapp

GRANT ALL ON SCHEMA public TO gamesapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gamesapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gamesapp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gamesapp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gamesapp_user;

\q
```

**DŮLEŽITÉ:** Použijte silné heslo! Můžete vygenerovat:
```bash
openssl rand -base64 32
```

---

### 2.7 Nastavení aplikace na serveru

```bash
# Přepnutí na gamesapp uživatele
su - gamesapp

# Vytvoření struktury
mkdir -p /home/gamesapp/apps
cd /home/gamesapp/apps

# Klonování repozitářů
git clone <URL_REPOSITORY_DB> PartyGames_DB
git clone <URL_REPOSITORY_BE> PartyGames_BE
git clone <URL_REPOSITORY_FE> PartyGames_FE
```

---

### 2.8 Nastavení databázové vrstvy (produkce)

```bash
cd /home/gamesapp/apps/PartyGames_DB

# Instalace závislostí
npm install --production

# Vytvoření .env
nano .env
```

Vložte:
```env
DATABASE_URL="postgresql://gamesapp_user:VASE_PRODUKCI_HESLO@localhost:5432/gamesapp?schema=public"
```

Uložte (Ctrl+O, Enter, Ctrl+X).

```bash
# Vygenerování Prisma Client
npx prisma generate

# Spuštění migrací (POZOR: použijte deploy, ne dev!)
npx prisma migrate deploy

# Naplnění seed daty (volitelné - pouze pro testování)
npx prisma db seed
```

---

### 2.9 Nastavení backendu (produkce)

```bash
cd /home/gamesapp/apps/PartyGames_BE

# Instalace závislostí
npm install --production

# Vytvoření .env
nano .env
```

Vložte:
```env
DATABASE_URL="postgresql://gamesapp_user:VASE_PRODUKCI_HESLO@localhost:5432/gamesapp?schema=public"

PORT=3000
NODE_ENV=production

# Google OAuth - AKTUALIZUJTE redirect URI v Google Console!
# Redirect URI: https://vase-domena.cz/api/auth/google/callback
GOOGLE_CLIENT_ID="vas-google-client-id"
GOOGLE_CLIENT_SECRET="vas-google-client-secret"

# JWT Secret (vygenerujte nový pro produkci!)
JWT_SECRET="vygenerovany-produkci-jwt-secret-min-64-znaku"

FRONTEND_URL="https://vase-domena.cz"

SESSION_SECRET="vygenerovany-produkci-session-secret"
```

Uložte a zavřete.

```bash
# Build backend aplikace
npm run build

# Instalace PM2 pro správu procesu
npm install -g pm2

# Spuštění backend serveru
pm2 start dist/server.js --name gamesapp-api

# Nastavení auto-start po restartu serveru
pm2 startup
pm2 save

# Ověření
pm2 status
pm2 logs gamesapp-api
```

---

### 2.10 Build a nastavení frontendu

```bash
cd /home/gamesapp/apps/PartyGames_FE

# Instalace závislostí
npm install

# Vytvoření .env pro production build
nano .env.production
```

Vložte:
```env
VITE_API_URL=https://vase-domena.cz/api
VITE_WS_URL=https://vase-domena.cz
VITE_GOOGLE_CLIENT_ID=vas-google-client-id
```

```bash
# Build produkční verze
npm run build

# Výsledek je ve složce dist/
ls -la dist/
```

---

### 2.11 Instalace a nastavení Nginx

```bash
# Návrat k root uživateli
exit  # Odhlášení z gamesapp uživatele
# Nyní jste root

# Instalace Nginx
apt install -y nginx

# Vytvoření konfigurace pro aplikaci
nano /etc/nginx/sites-available/gamesapp
```

Vložte:
```nginx
# Frontend + Backend konfigurace
server {
    listen 80;
    server_name vase-domena.cz www.vase-domena.cz;

    # Frontend - statické soubory
    root /home/gamesapp/apps/PartyGames_FE/dist;
    index index.html;

    # Gzip komprese
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend routing (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache statických souborů
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**DŮLEŽITÉ:** Nahraďte `vase-domena.cz` vaší skutečnou doménou!

```bash
# Aktivace konfigurace
ln -s /etc/nginx/sites-available/gamesapp /etc/nginx/sites-enabled/

# Odstranění defaultní konfigurace
rm /etc/nginx/sites-enabled/default

# Test konfigurace
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

---

### 2.12 Nastavení SSL certifikátu (Let's Encrypt)

```bash
# Instalace Certbot
apt install -y certbot python3-certbot-nginx

# Získání SSL certifikátu (NAHRAĎTE SVOU DOMÉNOU!)
certbot --nginx -d vase-domena.cz -d www.vase-domena.cz

# Certbot se vás zeptá:
# 1. Email pro notifikace - zadejte váš email
# 2. Souhlas s podmínkami - Y
# 3. Newsletter - N (volitelné)
# 4. Redirect HTTP na HTTPS - 2 (doporučeno)

# Certbot automaticky upraví Nginx konfiguraci

# Ověření auto-renewal
certbot renew --dry-run

# Cron job pro automatické obnovení (již nastaveno automaticky)
# Certbot nastaví timer, zkontrolujte:
systemctl status certbot.timer
```

---

### 2.13 Nastavení DNS (u vašeho doménového registrátora)

U vašeho registrátora domény (např. Wedos, WebSupport, GoDaddy):

1. Přihlaste se k administraci domény
2. Přejděte na DNS záznamy
3. Nastavte:

```
Type    Name    Value               TTL
A       @       123.45.67.89        3600
A       www     123.45.67.89        3600
```

Kde `123.45.67.89` je IP adresa vašeho Hetzner serveru.

**Poznámka:** DNS propagace může trvat až 48 hodin (obvykle do 1 hodiny).

---

### 2.14 Aktualizace Google OAuth

Protože nyní máte produkční doménu, aktualizujte Google OAuth:

1. Přejděte na [Google Cloud Console](https://console.cloud.google.com/)
2. Vyberte váš projekt
3. Přejděte na Credentials → OAuth 2.0 Client ID
4. Přidejte do "Authorized redirect URIs":
   ```
   https://vase-domena.cz/api/auth/google/callback
   ```
5. Uložte

---

### 2.15 Ověření produkční instalace

```bash
# Kontrola běžících služeb
systemctl status nginx
systemctl status postgresql
pm2 status

# Test backend API
curl https://vase-domena.cz/api/health

# Zobrazení logů
pm2 logs gamesapp-api
journalctl -u nginx -f
```

**Test v prohlížeči:**
1. Otevřete `https://vase-domena.cz`
2. Měli byste vidět aplikaci přes HTTPS (zámek v adresním řádku)
3. Vyzkoušejte přihlášení přes Google
4. Vytvořte herní místnost a vyzkoušejte hru

---

## 🔧 3. Údržba a monitoring

### 3.1 Automatické zálohy databáze

```bash
# Vytvořte skript pro backup
sudo nano /usr/local/bin/backup-gamesapp-db.sh
```

Vložte:
```bash
#!/bin/bash
BACKUP_DIR="/home/gamesapp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup databáze
pg_dump -U gamesapp_user gamesapp > $BACKUP_DIR/gamesapp_$DATE.sql

# Komprese
gzip $BACKUP_DIR/gamesapp_$DATE.sql

# Smazání starších než 30 dní
find $BACKUP_DIR -name "gamesapp_*.sql.gz" -mtime +30 -delete

echo "Backup dokončen: gamesapp_$DATE.sql.gz"
```

```bash
# Nastavení oprávnění
chmod +x /usr/local/bin/backup-gamesapp-db.sh

# Test skriptu
/usr/local/bin/backup-gamesapp-db.sh

# Nastavení cron job pro denní backup (2:00 ráno)
crontab -e
```

Přidejte řádek:
```
0 2 * * * /usr/local/bin/backup-gamesapp-db.sh >> /var/log/db-backup.log 2>&1
```

---

### 3.2 Automatické čištění starých dat

```bash
# Vytvoření skriptu pro cleanup
sudo nano /usr/local/bin/cleanup-old-rooms.sh
```

Vložte:
```bash
#!/bin/bash
psql -U gamesapp_user -d gamesapp <<EOF
-- Smazání starých dokončených místností (7 dní)
DELETE FROM game_rooms
WHERE status = 'FINISHED'
AND finished_at < NOW() - INTERVAL '7 days';

-- Smazání odpojených hráčů ve starých čekajících místnostech (24h)
DELETE FROM room_players rp
USING game_rooms gr
WHERE rp.room_id = gr.id
AND gr.status = 'WAITING'
AND gr.created_at < NOW() - INTERVAL '24 hours'
AND rp.is_connected = false;

SELECT 'Cleanup dokončen';
EOF
```

```bash
chmod +x /usr/local/bin/cleanup-old-rooms.sh

# Cron job pro denní cleanup (3:00 ráno)
crontab -e
```

Přidejte:
```
0 3 * * * /usr/local/bin/cleanup-old-rooms.sh >> /var/log/db-cleanup.log 2>&1
```

---

### 3.3 Monitoring s PM2

```bash
# Zobrazení statusu
pm2 status

# Real-time monitoring
pm2 monit

# Zobrazení logů
pm2 logs gamesapp-api

# Zobrazení pouze chybových logů
pm2 logs gamesapp-api --err

# Statistiky využití
pm2 show gamesapp-api
```

---

### 3.4 Restart služeb

```bash
# Restart backend aplikace
pm2 restart gamesapp-api

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## ❓ 4. Řešení problémů

### 4.1 Backend se nespustí

**Problém:** `pm2 logs` ukazuje chyby

**Řešení:**
```bash
# Zkontrolujte .env soubor
cd /home/gamesapp/apps/PartyGames_BE
cat .env

# Zkontrolujte připojení k databázi
psql -U gamesapp_user -d gamesapp -c "SELECT 1;"

# Zkontrolujte porty
sudo netstat -tulpn | grep 3000

# Restartujte s verbose logováním
pm2 delete gamesapp-api
pm2 start dist/server.js --name gamesapp-api --log-date-format="YYYY-MM-DD HH:mm:ss Z"
pm2 logs gamesapp-api
```

---

### 4.2 Nginx vrací 502 Bad Gateway

**Problém:** Frontend se načte, ale API nefunguje

**Řešení:**
```bash
# Zkontrolujte, zda backend běží
pm2 status

# Zkontrolujte Nginx error log
sudo tail -f /var/log/nginx/error.log

# Test API přímo
curl http://localhost:3000/api/health

# Restartujte Nginx
sudo systemctl restart nginx
```

---

### 4.3 Google OAuth nefunguje

**Problém:** Přihlášení přes Google selhává

**Řešení:**
1. Zkontrolujte Google Cloud Console:
   - Je redirect URI správně nastavený? (`https://vase-domena.cz/api/auth/google/callback`)
   - Je Client ID a Secret správně zkopírovaný do `.env`?

2. Zkontrolujte CORS v backendu
3. Zkontrolujte, že používáte HTTPS (ne HTTP)

---

### 4.4 WebSocket připojení selhává

**Problém:** Real-time funkce nefungují

**Řešení:**
```bash
# Zkontrolujte Nginx konfiguraci pro WebSocket
sudo nano /etc/nginx/sites-available/gamesapp

# Mělo by obsahovat:
# location /socket.io {
#     proxy_http_version 1.1;
#     proxy_set_header Upgrade $http_upgrade;
#     proxy_set_header Connection "upgrade";
# }

# Restartujte Nginx
sudo systemctl restart nginx
```

---

### 4.5 Databáze je plná

**Problém:** PostgreSQL hlásí "disk full"

**Řešení:**
```bash
# Zkontrolujte velikost databáze
psql -U gamesapp_user -d gamesapp -c "SELECT pg_size_pretty(pg_database_size('gamesapp'));"

# Vyčistěte staré záznamy
/usr/local/bin/cleanup-old-rooms.sh

# VACUUM databáze (uvolní místo)
psql -U gamesapp_user -d gamesapp -c "VACUUM FULL;"
```

---

### 4.6 SSL certifikát expiroval

**Problém:** Certbot renewal selhal

**Řešení:**
```bash
# Zkontrolujte stav certifikátu
sudo certbot certificates

# Manuální obnovení
sudo certbot renew

# Zkontrolujte Certbot timer
sudo systemctl status certbot.timer

# Restart timeru
sudo systemctl restart certbot.timer
```

---

## 📊 Užitečné příkazy

### Zobrazení systémových zdrojů

```bash
# CPU a RAM
htop

# Disk usage
df -h

# Největší složky
du -sh /home/gamesapp/apps/*

# Aktivní připojení
sudo netstat -tulpn

# Logy systému
journalctl -xe
```

### Update aplikace (deploy nové verze)

```bash
# Na serveru
cd /home/gamesapp/apps/PartyGames_BE
git pull origin main
npm install
npm run build
pm2 restart gamesapp-api

cd /home/gamesapp/apps/PartyGames_FE
git pull origin main
npm install
npm run build

# Nginx automaticky načte nové soubory
```

---

## 🎉 Závěr

Gratulujeme! Aplikace "Společenské hry online" je nyní plně nainstalována a funkční.

**Lokální vývoj:**
- Databáze: `localhost:5432`
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

**Produkce:**
- Aplikace: `https://vase-domena.cz`
- Databáze běží lokálně na serveru
- Backend běží pod PM2
- Frontend servírován přes Nginx s HTTPS

**Další kroky:**
- Monitorujte aplikaci pravidelně
- Nastavte zálohy
- Implementujte error tracking (např. Sentry.io)
- Přidejte analytics (Google Analytics / Plausible)

---

**Kontakt:**
- V případě problémů vytvořte issue v GitHub repozitáři
- Dokumentace: README.md v každé složce projektu

**Poslední aktualizace:** 17. prosince 2024
**Verze:** 1.0
