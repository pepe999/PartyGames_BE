# 🔐 Google OAuth 2.0 - Detailní průvodce nastavením

## 📚 Co budeme dělat

Nastavíme Google OAuth 2.0, aby uživatelé mohli přihlašovat pomocí svého Google účtu.
Po dokončení tohoto průvodce budeš mít:
- ✅ Google Cloud projekt
- ✅ OAuth 2.0 Client ID a Secret
- ✅ Funkční přihlášení přes Google

---

## 🎯 Krok 1: Vytvoření Google Cloud projektu

### 1.1 Přejdi na Google Cloud Console

**URL:** https://console.cloud.google.com/

**Co uvidíš:**
- Dashboard Google Cloud Console
- Možná budeš muset souhlasit s podmínkami použití (pokud jsi tam poprvé)

### 1.2 Vytvoř nový projekt

**Kde kliknout:**
1. Nahoře vlevo vedle "Google Cloud" je **dropdown s názvem projektu**
2. Klikni na něj → otevře se dialog "Select a project"
3. Klikni na tlačítko **"NEW PROJECT"** (vpravo nahoře v dialogu)

**Co vyplnit:**
```
Project name: PartyGames
Organization: (nech prázdné, pokud nemáš organizaci)
Location: No organization
```

**Důležité:**
- Project ID se vygeneruje automaticky (např. `partygames-123456`)
- Zapamatuj si ho, ale nemusíš ho teď nikam kopírovat

**Klikni:** **"CREATE"**

**Čekání:** 10-30 sekund, než se projekt vytvoří

**Po vytvoření:**
- Automaticky tě přepne do nového projektu
- Nahoře vlevo uvidíš název "PartyGames"

---

## 🎯 Krok 2: Aktivace potřebných API

### 2.1 Otevři API Library

**Kde kliknout:**
1. Levé menu (☰ hamburger ikona)
2. **"APIs & Services"** → **"Library"**

**Nebo rychlá cesta:**
- URL: https://console.cloud.google.com/apis/library

### 2.2 Aktivuj Google People API

**Kroky:**
1. V search baru nahoře zadej: **"Google People API"**
2. Klikni na výsledek **"Google People API"**
3. Uvidíš stránku s popisem API
4. Klikni na modré tlačítko **"ENABLE"**

**Čekání:** 5-10 sekund

**Výsledek:**
- Uvidíš "API enabled" nebo tě přesměruje na API Dashboard
- Můžeš vidět notifikaci: "Google People API has been enabled"

### 2.3 (Volitelné) Aktivuj Google+ API

**Poznámka:** Toto API je deprecated, ale některé starší implementace ho používají.

**Kroky:**
1. Zpět do Library (levé menu → APIs & Services → Library)
2. Vyhledej: **"Google+ API"**
3. Klikni na výsledek
4. Klikni **"ENABLE"**

---

## 🎯 Krok 3: Konfigurace OAuth Consent Screen

**Co to je:** Obrazovka, kterou uživatelé uvidí, když se přihlašují přes Google.

### 3.1 Otevři OAuth consent screen

**Kde kliknout:**
1. Levé menu → **"APIs & Services"** → **"OAuth consent screen"**

**Nebo URL:**
- https://console.cloud.google.com/apis/credentials/consent

### 3.2 Vyber typ uživatelů

**Co uvidíš:**
Dva radio buttony:
- ⚪ **Internal** (pouze pro Google Workspace uživatele)
- 🔵 **External** (kdokoliv s Google účtem)

**Co vybrat:**
- ✅ **External** (pokud nemáš Google Workspace)

**Klikni:** **"CREATE"**

### 3.3 Vyplň základní informace (stránka 1/4)

**Povinná pole:**

```
App name: PartyGames
User support email: [tvůj-email@gmail.com]
```

**Logo aplikace (volitelné):**
- Můžeš přeskočit nebo nahrát logo (čtvercový obrázek, min 120x120px)

**Application home page (volitelné):**
```
http://localhost:5173
```

**Application privacy policy link (volitelné):**
- Můžeš přeskočit teď

**Application terms of service link (volitelné):**
- Můžeš přeskočit teď

**Authorized domains:**
- Pro lokální vývoj NEPŘIDÁVEJ nic
- Pro produkci později přidáš: `partygames.cz`

**Developer contact information:**
```
Email addresses: [tvůj-email@gmail.com]
```

**Klikni:** **"SAVE AND CONTINUE"**

### 3.4 Scopes - Oprávnění (stránka 2/4)

**Co to je:** Jaká data od uživatelů chceš získat

**Kroky:**
1. Klikni na **"ADD OR REMOVE SCOPES"**
2. Otevře se boční panel se všemi možnými scopes

**Najdi a zaškrtni tyto scopes:**

```
✅ .../auth/userinfo.email
   Email address

✅ .../auth/userinfo.profile
   Basic profile info

✅ openid
   Associate you with your personal info on Google
```

**Jak je najít:**
- Použij search bar v panelu
- Zadej "email" → najdeš `userinfo.email`
- Zadej "profile" → najdeš `userinfo.profile`
- Zadej "openid" → najdeš `openid`

**Po zaškrtnutí:**
- Klikni **"UPDATE"** (dole v panelu)
- Uvidíš je v tabulce "Your non-sensitive scopes"

**Klikni:** **"SAVE AND CONTINUE"**

### 3.5 Test users (stránka 3/4)

**Co to je:** Když je app v "Testing" módu, mohou se přihlásit pouze tito uživatelé.

**Kroky:**
1. Klikni **"+ ADD USERS"**
2. Zadej své Google emaily (můžeš zadat víc, oddělených enterem):

```
tvuj-email@gmail.com
dalsi-email@gmail.com
```

**Kolik přidat:**
- Minimálně jeden (tvůj vlastní testovací účet)
- Můžeš přidat až 100 test users

**Klikni:** **"ADD"**

**Pak:** **"SAVE AND CONTINUE"**

### 3.6 Summary (stránka 4/4)

**Co uvidíš:**
- Shrnutí všeho, co jsi vyplnil
- Zkontroluj, že všechno sedí

**Klikni:** **"BACK TO DASHBOARD"**

---

## 🎯 Krok 4: Vytvoření OAuth 2.0 Client ID

**Tohle je nejdůležitější krok!** Získáš Client ID a Client Secret.

### 4.1 Otevři Credentials

**Kde kliknout:**
1. Levé menu → **"APIs & Services"** → **"Credentials"**

**Nebo URL:**
- https://console.cloud.google.com/apis/credentials

### 4.2 Vytvoř credentials

**Kroky:**
1. Nahoře klikni na **"+ CREATE CREDENTIALS"**
2. Z dropdownu vyber **"OAuth client ID"**

### 4.3 Vyplň formulář

**Application type:**
```
⚪ Web application  ✅ VYBER TOTO!
⚪ Android
⚪ Chrome extension
⚪ iOS
⚪ Desktop app
```

**Name:**
```
PartyGames Web Client
```

### 4.4 Authorized JavaScript origins

**Co to je:** Z jakých URL může frontend volat Google APIs

**Klikni:** **"+ ADD URI"**

**Přidej tyto URL (každé na samostatný řádek):**

```
http://localhost:5173
http://localhost:3000
```

**Vysvětlení:**
- `http://localhost:5173` = Vite dev server (frontend)
- `http://localhost:3000` = Express backend

**Formát:**
- ✅ `http://localhost:5173` - SPRÁVNĚ
- ❌ `http://localhost:5173/` - ŠPATNĚ (nesmí mít trailing slash)
- ❌ `http://localhost:5173/auth` - ŠPATNĚ (nesmí mít path)

### 4.5 Authorized redirect URIs

**Co to je:** Kam Google přesměruje po přihlášení

**Klikni:** **"+ ADD URI"**

**Přidej tyto URL:**

```
http://localhost:5173
http://localhost:5173/auth/callback
```

**Poznámka:**
- První URI je fallback
- Druhé URI použije frontend po dokončení OAuth flow

**Klikni:** **"CREATE"**

### 4.6 ⭐ ULOŽ SI CLIENT ID A SECRET ⭐

**Co uvidíš:**
Dialog s nadpisem "OAuth client created"

**DŮLEŽITÉ - Zkopíruj tyto hodnoty:**

```
Your Client ID:
123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

Your Client Secret:
GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**Kam si je ulož:**
1. ✅ Poznámkový blok / Notes
2. ✅ Secure password manager (1Password, Bitwarden)
3. ❌ **NIKDY** je necommituj do gitu!

**Klikni:** **"OK"** (dialog zmizí)

**Pokud jsi zapomněl zkopírovat:**
- Nevadí! Můžeš se k nim vrátit
- V Credentials → klikni na "PartyGames Web Client"
- Client ID je vidět, Secret musíš resetovat

---

## 🎯 Krok 5: Aktualizace .env souboru

### 5.1 Otevři .env soubor

**Cesta:**
```
/Users/josefbina/Vyvoj/Projekty/PartyGamesComplete/PartyGames_BE/.env
```

**Příkaz v terminálu:**
```bash
code /Users/josefbina/Vyvoj/Projekty/PartyGamesComplete/PartyGames_BE/.env
```

Nebo v VS Code:
- Cmd+P → zadej `.env` → Enter

### 5.2 Najdi tyto řádky:

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 5.3 Nahraď je svými hodnotami:

**PŘED:**
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**PO (s tvými reálnými hodnotami):**
```bash
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**Kontrola:**
- ✅ Client ID končí na `.apps.googleusercontent.com`
- ✅ Client Secret začíná `GOCSPX-`
- ✅ ŽÁDNÉ mezery před nebo za hodnotou
- ✅ ŽÁDNÉ uvozovky (ani jednoduché, ani dvojité)

### 5.4 Ulož soubor

**Klávesová zkratka:**
- Mac: `Cmd + S`
- Windows: `Ctrl + S`

---

## 🎯 Krok 6: Restart backendu

### 6.1 Zastav běžící server

**Pokud máš backend spuštěný:**
1. Najdi terminál, kde běží `npm run dev`
2. Stiskni: `Ctrl + C`
3. Počkej, než se server vypne (uvidíš "Server closed")

### 6.2 Spusť server znovu

```bash
cd /Users/josefbina/Vyvoj/Projekty/PartyGamesComplete/PartyGames_BE
npm run dev
```

### 6.3 Zkontroluj, že se načetly credentials

**Co hledat v logu:**
- ✅ Server běží normálně
- ✅ Žádná chyba typu "GOOGLE_CLIENT_ID not configured"

**Pokud vidíš chybu:**
- Zkontroluj .env soubor
- Ujisti se, že nemáš překlepy
- Ujisti se, že jsi uložil soubor

---

## 🎯 Krok 7: Testování (po vytvoření frontendu)

**Poznámka:** Frontend zatím nemáš, takže toto je pro později.

### 7.1 Jak bude vypadat flow:

1. **Frontend (React):**
   - Uživatel klikne na "Sign in with Google"
   - Zobrazí se Google přihlašovací dialog
   - Uživatel se přihlásí Google účtem
   - Google vrátí `credential` token

2. **Frontend pošle request:**
   ```javascript
   POST http://localhost:3000/api/auth/google
   Content-Type: application/json

   {
     "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
   }
   ```

3. **Backend zpracuje:**
   - Ověří Google token pomocí `GOOGLE_CLIENT_ID`
   - Vytvoří/aktualizuje uživatele v databázi
   - Vygeneruje JWT token
   - Vrátí JWT token frontendu

4. **Frontend uloží JWT:**
   - `localStorage.setItem('token', jwtToken)`
   - Všechny další requesty obsahují header:
     ```
     Authorization: Bearer <jwt-token>
     ```

### 7.2 Test přes Swagger (bez Google přihlášení)

**Můžeš otestovat endpoint, ale potřebuješ validní Google credential token:**

1. Otevři: http://localhost:3000/api-docs
2. Najdi: `POST /api/auth/google`
3. Klikni "Try it out"
4. Do `credential` vlož... **⚠️ PROBLÉM: Nemáš odkud získat token bez frontendu**

**Závěr:** Skutečný test bude možný až s frontendem.

---

## 🔧 Troubleshooting

### Chyba: "Invalid Google token"

**Možné příčiny:**
1. ❌ Špatný Client ID v backendu
2. ❌ Token vygenerovaný jiným Client ID (frontend vs backend)
3. ❌ Expirovaný token (Google tokeny vyprší za 1 hodinu)

**Řešení:**
1. ✅ Zkontroluj `.env` - Client ID musí být stejný jako ve frontendu
2. ✅ Ujisti se, že frontend i backend používají stejný Client ID
3. ✅ Získej nový token (obnoviž stránku ve frontendu)

### Chyba: "redirect_uri_mismatch"

**Co vidíš:**
```
Error 400: redirect_uri_mismatch
The redirect URI in the request, http://localhost:5173/something,
does not match the ones authorized for the OAuth client.
```

**Řešení:**
1. Jdi do Google Cloud Console → Credentials
2. Klikni na "PartyGames Web Client"
3. Zkontroluj "Authorized redirect URIs"
4. Musí obsahovat přesně tu URL, kterou používá frontend
5. Přidej chybějící URI
6. Klikni "SAVE"
7. **Počkej 5 minut** (změny se neprojeví okamžitě)

### Chyba: "origin_mismatch"

**Co vidíš:**
```
Error: origin_mismatch
The JavaScript origin http://localhost:5173 does not match
the authorized origins.
```

**Řešení:**
1. Jdi do Google Cloud Console → Credentials
2. Klikni na "PartyGames Web Client"
3. Zkontroluj "Authorized JavaScript origins"
4. Přidej `http://localhost:5173`
5. Klikni "SAVE"
6. Počkej 5 minut

### Chyba: "Access blocked: This app's request is invalid"

**Co vidíš:**
Google dialog s červeným varováním

**Možné příčiny:**
1. ❌ OAuth Consent Screen není kompletně vyplněný
2. ❌ Chybí povinné scopes

**Řešení:**
1. Jdi do OAuth consent screen
2. Zkontroluj, že máš vyplněné:
   - App name
   - User support email
   - Developer contact email
3. Zkontroluj Scopes:
   - Musí obsahovat `userinfo.email`, `userinfo.profile`, `openid`
4. Ulož změny

### Uživatel není v test users

**Co vidíš:**
```
Error 403: access_denied
The developer hasn't given you access to this app.
```

**Řešení:**
1. Jdi do OAuth consent screen → Test users
2. Klikni "+ ADD USERS"
3. Přidej email uživatele, který se snaží přihlásit
4. Klikni "SAVE"

**Nebo:**
- Změň Publishing status z "Testing" na "In production"
- **Varování:** Všichni s Google účtem se budou moct přihlásit!

---

## 📋 Checklist

Po dokončení tohoto průvodce byste měl mít:

- ✅ Google Cloud projekt "PartyGames"
- ✅ Google People API aktivováno
- ✅ OAuth Consent Screen nakonfigurován (External)
- ✅ Test users přidáni
- ✅ OAuth 2.0 Client ID vytvořen
- ✅ Client ID zkopírován do `.env`
- ✅ Client Secret zkopírován do `.env`
- ✅ Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:3000`
- ✅ Authorized redirect URIs: `http://localhost:5173`, `http://localhost:5173/auth/callback`
- ✅ Backend restartován s novými credentials
- ✅ Žádné chyby při startu serveru

---

## 🚀 Produkční nasazení (později)

Až budeš připraven nasadit na produkci:

### Aktualizace Credentials

1. **Authorized JavaScript origins - PŘIDEJ:**
   ```
   https://partygames.cz
   https://www.partygames.cz
   ```

2. **Authorized redirect URIs - PŘIDEJ:**
   ```
   https://partygames.cz/auth/callback
   https://www.partygames.cz/auth/callback
   ```

### Publishing OAuth Consent Screen

1. Jdi do OAuth consent screen
2. Klikni "PUBLISH APP"
3. Google možná bude chtít verification (pokud požaduješ sensitive scopes)
4. Pro `userinfo.email`, `userinfo.profile`, `openid` není verification potřeba

### Backend .env na produkci

```bash
# Stejné credentials jako lokálně!
GOOGLE_CLIENT_ID=123456789012-abc...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...

# Ale jiná URL
FRONTEND_URL=https://partygames.cz
```

---

## 📞 Potřebuješ pomoc?

**Google Cloud Console:**
- https://console.cloud.google.com/

**Google OAuth dokumentace:**
- https://developers.google.com/identity/protocols/oauth2

**Swagger dokumentace našeho API:**
- http://localhost:3000/api-docs

**Logy backendu:**
- Sleduj terminál, kde běží `npm run dev`
- Všechny chyby se logují do konzole

---

**Hotovo! 🎉**

Nyní máš kompletně nastavený Google OAuth 2.0 a backend je připraven přijímat přihlášení od uživatelů.

Další krok: Vytvoření frontendu s Google Sign-In buttonem.
