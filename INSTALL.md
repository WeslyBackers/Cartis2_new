# CARTIS 2.0 - Installatie Instructies

## Vereisten

- Node.js 18 of hoger
- PostgreSQL 14 of hoger
- npm of yarn

## Installatie Stappen

### 1. Database Setup

Start PostgreSQL en maak een database aan:

```sql
CREATE DATABASE cartis;
```

Voer het database schema uit:

```bash
psql -U postgres -d cartis -f backend/database/schema.sql
```

### 2. Backend Setup

Ga naar de backend folder en installeer dependencies:

```bash
cd backend
npm install
```

Kopieer het `.env.example` bestand naar `.env`:

```bash
copy .env.example .env
```

Pas de `.env` file aan met jouw database credentials:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/cartis
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cartis
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=change-this-to-a-random-secret
```

### 3. Frontend Setup

Ga naar de frontend folder en installeer dependencies:

```bash
cd ../frontend
npm install
```

### 4. Start de Applicatie

Er zijn meerdere manieren om CARTIS te starten:

#### Optie A: PowerShell Script (Aanbevolen - Windows)
```powershell
.\start-cartis.ps1
```
Dit script controleert automatisch of PostgreSQL draait en start beide servers.

#### Optie B: Batch File (Windows)
Dubbelklik op `start-cartis.bat` in Windows Explorer.

#### Optie C: NPM Command (Vanaf de root folder)
```bash
# Installeer root dependencies
npm install

# Start beide servers (backend + frontend)
npm run dev
```

#### Optie D: Manueel (Start ze apart)
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 5. Toegang tot de Applicatie

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/health

### Standaard Login Gegevens

- **Email**: admin@cartis.be
- **Wachtwoord**: admin123

## Productie Build

```bash
# Build beide applicaties
npm run build

# Start productie server
npm start
```

## Troubleshooting

### Database connectie problemen

Controleer of PostgreSQL draait:
```bash
# Windows
net start postgresql-x64-14

# Of controleer status
pg_isready
```

### Port al in gebruik

Als port 3000 of 5173 al in gebruik is, pas deze aan in:
- Backend: `backend/.env` (PORT=3000)
- Frontend: `frontend/vite.config.ts` (server.port)

### Dependencies installatie problemen

Probeer:
```bash
# Verwijder node_modules en installeer opnieuw
rm -rf node_modules package-lock.json
npm install
```

## Handige Commands

```bash
# TypeScript type checking
npm run typecheck

# Database schema opnieuw laden (LET OP: verwijdert alle data!)
psql -U postgres -d cartis -f backend/database/schema.sql
```
