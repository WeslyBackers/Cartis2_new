# CARTIS 2.0 - Project Overzicht

## ✅ Wat is er geïmplementeerd?

### 🏗️ Project Structuur
- **Monorepo setup** met backend en frontend
- **TypeScript** configuratie voor beide projecten
- **Development scripts** voor parallel starten van servers
- **Environment configuratie** (.env files)

### 🗄️ Database
- **Compleet PostgreSQL schema** (met PostGIS extensie) met 20+ tabellen:
  - Production Lines (Productielijnen)
  - Users met authenticatie
  - User Production Line Rights (role-based: can_view, can_edit, can_publish)
  - Notifications (Meldingen)
  - Notification Decisions
  - Notification Coordinates (extra locaties)
  - Notification Comments
  - Notification Zones
  - Notification Flags (MSI, opvolging, extra info)
  - Tasks (Taken)
  - Task Notifications (M2M)
  - Task Products (met status tracking)
  - Task Comments
  - Task Workflow
  - Task Production Line Status
  - Task Articles (voor publicatie)
  - Products (Producten) met GeoJSON geometry
  - Product Versions
  - Related Tasks
  - Attachments (Bijlagen)
  - Activity Log (Audit trail)

- **13 SQL migratie scripts** voor uitbreidingen (geometry, HPD, zones, commentaren, etc.)

- **Standaard data**:
  - 4 productielijnen (ZK, IENC, PILOT_ENC, PUBL)
  - 2 standaard gebruikers (admin@cartis.be, admin@cartis.com)

### 🔧 Backend (Node.js + Express + TypeScript)
- **Authentication systeem**:
  - JWT token based authentication
  - Login endpoint
  - Protected routes met middleware
  - User rights management

- **REST API Endpoints** (8 route modules, 70+ endpoints):
  - `/api/auth/*` - Authenticatie (login, profiel)
  - `/api/notifications/*` - Meldingen beheer (22 endpoints incl. beslissingen, bulk-decide, commentaren, coördinaten, bijlagen, zone detectie, product detectie)
  - `/api/tasks/*` - Taken beheer (20 endpoints incl. workflow, commentaren, artikelen, HPD projecten, vertaling, productielijn-status)
  - `/api/products/*` - Producten beheer (8 endpoints incl. notification linking)
  - `/api/product-versions/*` - Productversies beheer (incl. publicatie)
  - `/api/production-lines/*` - Productielijnen
  - `/api/users/*` - Gebruikers
  - `/api/coverages/*` - KML Coverage beheer

- **Services**:
  - Zone Detection Service (automatische zone detectie en linking)
  - HPD Project Service (CARIS HPD project synchronisatie)

- **Features**:
  - Database connection pooling
  - CORS configuratie
  - Security headers (Helmet)
  - Request logging (Morgan)
  - Error handling
  - Pagination ondersteuning
  - Filtering en zoeken
  - Activity logging
  - File upload met Multer (PDF, Office, afbeeldingen, XML, ZIP - max 10MB)
  - Multipart form-data support
  - Google Cloud Translate integratie (artikelen vertalen)
  - Nodemailer configuratie (nautinfo mailbox)
  - Health check endpoint (`GET /health`)

### 🎨 Frontend (React + TypeScript + Vite)
- **Authenticatie**:
  - Login pagina met formulier validatie
  - Protected routes
  - Token management
  - Auto-redirect bij unauthorized

- **State Management**:
  - Zustand store voor authenticatie (token, user, currentProductionLineId)
  - Persistent storage via localStorage
  - React Query voor data fetching en caching (auto-retry)
  - Productielijn selector (verplicht voor filtering)

- **Pagina's**:
  - Login pagina
  - Dashboard met statistieken (openstaande meldingen, actieve taken)
  - Meldingen overzicht (1000+ regels, uitgebreide filtering)
  - Melding detailpagina (1000+ regels, kaart, bijlagen, commentaren, coördinaten)
  - Taken overzicht (500+ regels, multi-productielijn status)
  - Taak detailpagina (1500+ regels, formulier met kaart, workflow, artikelen, HPD sync)
  - Producten catalogus (500+ regels, tabel- en kaartweergave)
  - Productversies overzicht

- **Componenten**:
  - Layout met header, inklapbare sidebar en content area
  - FileUpload component (drag & drop, bestandsvalidatie)
  - CoordinateInput component (7 coördinaatformaten: DD, DDM, DMS + 4 geprojecteerde CRS)
  - TaskCharts (SVG taartdiagram voor status verdeling)
  - Productielijn selector met waarschuwingsindicator

- **Features**:
  - Responsive design
  - Light theme (CSS variabelen design systeem)
  - Pagination
  - Status badges met kleuren
  - Beslissingen maken op meldingen (Ja/Nee + bulk)
  - Productielijn switcher
  - Interactieve kaarten met Leaflet + 14 WMS lagen
  - GeoJSON visualisatie op kaarten
  - Leaflet Draw tools
  - SunEditor WYSIWYG editor voor meldingen
  - Drag & drop bestandsupload
  - Commentaar systeem op meldingen en taken
  - Coördinaat conversie (proj4)
  - Shapefile export (JSZip + @mapbox/shp-write)
  - Sorteerbare kolommen (useTableSort hook)
  - Kleurcodering per producttype/gebruiksniveau

### 📋 Functionaliteiten per Module

#### Meldingen
- ✅ Lijst weergave met filtering op status, bron, datum
- ✅ Zoeken in titel, code en inhoud
- ✅ Beslissingen maken per productielijn (enkel + bulk)
- ✅ Automatische taak creatie bij "Ja" beslissing
- ✅ Producten koppelen aan meldingen
- ✅ Automatische product detectie
- ✅ Paginatie
- ✅ Bijlagen uploaden (drag & drop of file select, max 10MB)
- ✅ Bijlagen beheren (weergeven, downloaden en verwijderen)
- ✅ Detailweergave per melding met Leaflet kaart (WMS lagen)
- ✅ Expandable lijst items met volledige details
- ✅ SunEditor WYSIWYG editor
- ✅ Commentaar systeem (toevoegen, bewerken, verwijderen)
- ✅ Extra coördinaten toevoegen (DD/DDM/DMS/geprojecteerd)
- ✅ GML export van coördinaten
- ✅ Automatische zone detectie
- ✅ Handmatige zone toevoegen/verwijderen

#### Taken
- ✅ Lijst weergave per productielijn (multi-productielijn ondersteuning)
- ✅ Filtering op status
- ✅ Zoeken op taaknummer en titel
- ✅ Taaknummer generatie (jaar + volgnummer)
- ✅ BaZ nummer tracking
- ✅ MSI actief indicator
- ✅ Opvolging flags (MSI, needs followup, needs extra info)
- ✅ Producten status per taak (hoog_te_verwerken → voltooid)
- ✅ Gerelateerde taken
- ✅ Koppeling met meldingen
- ✅ Commentaar systeem
- ✅ Workflow status tracking
- ✅ Productielijn-specifieke status
- ✅ Taak detail formulier met kaart (14 WMS lagen)
- ✅ Artikelen beheer met Google Translate vertaling
- ✅ CARIS HPD project koppeling

#### Producten
- ✅ Lijst weergave per productielijn
- ✅ Product types
- ✅ Actief/Inactief status
- ✅ Geografische omtrek ondersteuning (GeoJSON geometry)
- ✅ Tabel- en kaartweergave toggle
- ✅ Kleurcodering per producttype/gebruiksniveau
- ✅ KML coverage import

#### Productversies
- ✅ Versie beheer per product
- ✅ Status tracking (In Progress, Ready, Published)
- ✅ Publicatiedatum
- ✅ Taken koppelen aan versies
- ✅ Automatisch doorschuiven incomplete taken bij publicatie

### 📚 Documentatie
- ✅ README.md met project overzicht
- ✅ INSTALL.md met installatie instructies
- ✅ DEVELOPMENT.md met ontwikkel handleiding
- ✅ Database schema documentatie in SQL
- ✅ API endpoints gedocumenteerd
- ✅ Startup scripts (start-cartis.ps1 en start-cartis.bat)

## 🚀 Hoe te starten?

1. **Database setup**:
   ```bash
   psql -U postgres -d cartis -f backend/database/schema.sql
   ```

2. **Dependencies installeren**:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Environment configureren**:
   ```bash
   cd backend
   copy .env.example .env
   # Pas database credentials aan in .env
   ```

4. **Starten**:
   
   **Optie A - PowerShell script (Aanbevolen)**:
   ```powershell
   .\start-cartis.ps1
   ```
   
   **Optie B - Batch file (Double-click)**:
   - Dubbelklik op `start-cartis.bat` in Windows Explorer
   
   **Optie C - NPM command**:
   ```bash
   npm run dev
   ```

5. **Toegang**:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000
   - Login: test@cartis.be / test123

## 🔄 Workflow volgens Project.md

De webapp implementeert de 4 hoofdprocessen zoals beschreven:

1. **Meldingen** → Inkomende nautische informatie vastleggen
2. **Taken** → Beslissingen omzetten in werkitems  
3. **Productversies** → Taken verwerken in producten
4. **Publicaties** → Producten publiceren

### Procesflow
```
Melding → Beslissing (Ja/Nee) → Taak aanmaken → Producten koppelen → 
Taken verwerken → Productversie aanmaken → Publiceren → 
Incomplete taken doorschuiven naar volgende versie
```

## 🎯 Wat ontbreekt nog? (Toekomstige uitbreidingen)

### Must-have (Prio 1)
- [x] File upload voor bijlagen (drag & drop, meerdere types, max 10MB)
- [x] Detail pagina's voor meldingen en taken
- [x] Edit functionaliteit voor taken (uitgebreid taak detail formulier)
- [x] WYSIWYG editor voor toelichtingen (SunEditor)
- [x] Geografisch overzicht (Leaflet kaarten met 14 WMS lagen)

### Should-have (Prio 2)
- [ ] Automatische mail import (nautinfo mailbox) — Nodemailer geconfigureerd, import nog niet geïmplementeerd
- [⚠] REST API integraties (MRCC, BASS, POAB, FLARIS) — .env configuratie aanwezig, endpoints nog niet geïmplementeerd
- [x] CARIS HPD integratie (HPD project service + endpoints aanwezig)
- [x] Bulk acties op meldingen (bulk-decide endpoint)
- [x] Export functionaliteit (Shapefile export via JSZip + shp-write)
- [x] BaZ1 artikels beheer (artikelen CRUD + Google Translate vertaling)

### Nice-to-have (Prio 3)
- [ ] Pushberichten (Wrakken, POSEIDON)
- [ ] Doorlooptijden tracking
- [ ] Email notificaties
- [ ] User management UI
- [ ] Advanced filtering
- [ ] Rapportages / dashboards
- [ ] Dark mode

### Technisch
- [ ] Unit & E2E tests
- [ ] API documentatie (Swagger)
- [ ] Docker containers
- [ ] CI/CD pipeline
- [ ] Error monitoring
- [ ] Performance optimization
- [ ] Rate limiting
- [ ] Input sanitization
- [ ] CSRF protection

## 🔐 Beveiliging

- ✅ JWT authenticatie (Bearer token)
- ✅ Password hashing (bcrypt)
- ✅ SQL injection preventie (parameterized queries)
- ✅ CORS configuratie
- ✅ Security headers (Helmet)
- ✅ Token expiration (24h standaard)
- ✅ Role-based access control (can_view, can_edit, can_publish per productielijn)
- ✅ Auto-logout bij 401 response
- ✅ File upload validatie (MIME types, max grootte)
- ⚠️ TODO: Rate limiting
- ⚠️ TODO: Input sanitization
- ⚠️ TODO: CSRF protection

## 📊 Database Schema Highlights

### Belangrijke relaties
- Users ↔ Production Lines (many-to-many via rights met role-based permissions)
- Notifications ↔ Products (many-to-many)
- Notifications ↔ Tasks (many-to-many via task_notifications)
- Notifications ↔ Zones (many-to-many via notification_zones)
- Tasks ↔ Products (many-to-many met status tracking)
- Tasks ↔ Articles (one-to-many met vertaling)
- Tasks ↔ Related Tasks (many-to-many)
- Products ↔ Product Versions (one-to-many)
- Task Products ↔ Product Versions (voor versie tracking)

### Slimme features
- Automatische taak nummer generatie
- Hergebruik taaknummer over productielijnen
- Activity log voor audit trail (entity, action, changes, user, timestamp)
- Flexible metadata (JSONB velden)
- PostGIS geometry support voor GIS data
- Automatische zone detectie voor meldingen
- Automatische product detectie voor meldingen
- Coördinaat conversie (7 formaten incl. Lambert 72, Lambert 2008, UTM)
- Artikelen vertaling via Google Cloud Translate
- Workflow state tracking per taak
- Productielijn-specifieke taak status

## � Technologie Stack

| Laag | Technologie |
|-------|------------|
| **Backend Runtime** | Node.js + Express 4.18 |
| **Backend Taal** | TypeScript 5.3 |
| **Database** | PostgreSQL 12+ (met PostGIS) |
| **Frontend Framework** | React 18.2 |
| **Frontend Taal** | TypeScript 5.2 |
| **Build Tool** | Vite 5.0 |
| **State Management** | Zustand 4.4 + React Query 5.14 |
| **Kaarten** | Leaflet 1.9 + React-Leaflet 4.2 + Leaflet Draw |
| **WMS Server** | gis.afdelingkust.be/ows (14 lagen) |
| **Rich Text Editor** | SunEditor React 3.6 |
| **HTTP Client** | Axios 1.6 |
| **Beveiliging** | Helmet 7.1, bcrypt, JWT |
| **File Upload** | Multer 1.4 |
| **Logging** | Morgan 1.10 |
| **Email** | Nodemailer 6.9 |
| **Vertaling** | Google Cloud Translate v2 |
| **Datum** | date-fns 3.0 |
| **Projecties** | Proj4 2.20 |
| **Export** | JSZip + @mapbox/shp-write |
| **KML Parsing** | @tmcw/togeojson + @xmldom/xmldom |

## �💡 Tips voor verder ontwikkelen

1. **Start met één productielijn** om te testen
2. **Voeg testdata toe** via SQL scripts
3. **Test de volledige flow**: Melding → Beslissing → Taak → Product → Versie
4. **Gebruik API testing tools** (Postman/Thunder Client)
5. **Check database constraints** bij fouten
6. **Bekijk activity_log** voor audit trail

## 🤝 Bijdragen

Dit is een basis implementatie. Uitbreidingen welkom volgens de TODO lijst in DEVELOPMENT.md

## 📝 Licentie

UNLICENSED - Vlaamse Hydrografie

---

**Versie**: 2.0.0  
**Laatste update**: 11 april 2026  
**Status**: ✅ Uitgebreide functionaliteit geïmplementeerd en werkend
