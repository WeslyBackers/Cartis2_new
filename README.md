# CARTIS 2.0

CARTIS 2.0 is een moderne webapplicatie voor de administratieve opvolging van nautische meldingen en producten voor Vlaamse Hydrografie.

## Functionaliteiten

### Hoofdprocessen
- **Meldingen**: Beheer van inkomende nautische informatie via API's, mailboxen en handmatige invoer
- **Taken**: Concrete werkitems gekoppeld aan meldingen per productielijn
- **Productversies**: Versies van kaarten/publicaties waarin taken worden verwerkt
- **Publicaties**: Publiceren van nautische producten

### Productielijnen
- **ZK**: Zeekaartproductie (elektronische en papieren nautische kaarten)
- **IENC**: Inland ENC (binnenvaartkaarten)
- **Pilot ENC**: Gedetailleerde bathymetrische loodskaarten
- **Publ**: Publicaties (BaZ, Lichtenlijst, Verbeterlijst, etc.)

## Technische Stack

### Backend
- Node.js met Express
- TypeScript
- PostgreSQL database
- REST API's

### Frontend
- React met TypeScript
- Modern UI/UX
- Responsive design

## Installatie

```bash
# Installeer alle dependencies
npm run install:all
```

## Quick Start

Er zijn meerdere manieren om CARTIS te starten:

### Optie 1: PowerShell Script (Aanbevolen)
```powershell
.\start-cartis.ps1
```
Dit script controleert automatisch of PostgreSQL draait en start beide servers.

### Optie 2: Batch File (Windows)
Dubbelklik op `start-cartis.bat` in Windows Explorer

### Optie 3: NPM Command
```bash
# Start development mode
npm run dev
```

### Optie 4: Manueel
```bash
# Backend en frontend apart starten
npm run dev:backend
npm run dev:frontend

# Build voor productie
npm run build
```

## Development

### Backend
Draait op `http://localhost:3000`

### Frontend
Draait op `http://localhost:5173`

## Products Integration

CARTIS 2.0 bevat een geïntegreerd productbeheer systeem dat automatisch producten detecteert op basis van geografische overlapping met meldingen.

### Quick Start
```powershell
# 1. Schakel PostGIS in (eenmalig)
psql -U postgres -d cartis -f backend/database/enable-postgis.sql

# 2. Importeer producten uit KML bestanden
.\import-products-kml.ps1
```

### Functies
- **Automatische Detectie**: Producten worden automatisch gedetecteerd als hun geometrie overlapt met een melding
- **Handmatig Beheer**: Gebruikers kunnen producten koppelen en ontkoppelen per productielijn
- **Productielijn Filtering**: Alleen producten van de actieve productielijn worden getoond
- **KML Import**: Importeer producten vanuit KML bestanden per productielijn:
  - ENC*.kml → Zeekaartproductie (ZK)
  - IENC*.kml → Inland ENC (IENC)
  - Pilot-ENC*.kml → Pilot ENC

### Documentatie
- **[PRODUCTS_QUICK_START.md](PRODUCTS_QUICK_START.md)** - Snelstart gids
- **[PRODUCTS_INTEGRATION.md](PRODUCTS_INTEGRATION.md)** - Volledige documentatie

## Database Setup

### Local PostgreSQL
Zie `backend/database/schema.sql` voor database schema.

### Supabase Import
CARTIS 2.0 ondersteunt deployment naar Supabase. Meerdere import opties beschikbaar:

**Optie 1: PowerShell Script (Windows)**
```powershell
.\import-to-supabase.ps1
```

**Optie 2: Batch File (Windows)**
Dubbelklik op `import-to-supabase.bat`

**Optie 3: Node.js Script**
```bash
npm run import:supabase
# of
node import-to-supabase.js
```

Zie [SUPABASE_IMPORT.md](SUPABASE_IMPORT.md) voor gedetailleerde instructies.

## Configuratie

Maak een `.env` file aan in de backend folder met de volgende variabelen:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/cartis
JWT_SECRET=your-secret-key
NODE_ENV=development
```

## Project Structuur

```
cartis-2.0/
├── backend/          # Express API server
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── middleware/
│   └── database/
├── frontend/         # React applicatie
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── public/
└── project.md       # Project documentatie
```

## Licentie

UNLICENSED - Vlaamse Hydrografie
