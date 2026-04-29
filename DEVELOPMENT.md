# CARTIS 2.0 - Ontwikkelingshandleiding

## Project Structuur

```
cartis-2.0/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── config/         # Database en andere configuraties
│   │   ├── middleware/     # Express middleware (authenticatie, etc.)
│   │   ├── routes/         # API route handlers
│   │   └── index.ts        # Main server file
│   ├── database/
│   │   └── schema.sql      # Database schema
│   └── package.json
├── frontend/               # React + TypeScript
│   ├── src/
│   │   ├── components/    # Herbruikbare componenten
│   │   ├── pages/         # Pagina componenten
│   │   ├── services/      # API calls
│   │   ├── stores/        # Zustand state management
│   │   └── main.tsx       # Entry point
│   └── package.json
└── package.json           # Root package.json voor monorepo
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Meldingen (Notifications)
- `GET /api/notifications` - List notifications
- `GET /api/notifications/:id` - Get single notification
- `POST /api/notifications` - Create notification
- `POST /api/notifications/:id/decide` - Make decision (Ja/Nee)

### Taken (Tasks)
- `GET /api/tasks` - List tasks
- `GET /api/tasks/:id` - Get single task
- `PUT /api/tasks/:id` - Update task
- `PUT /api/tasks/:taskId/products/:productId` - Update task product status
- `POST /api/tasks/:taskId/related/:relatedTaskId` - Add related task

### Producten (Products)
- `GET /api/products` - List products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product

### Productversies (Product Versions)
- `GET /api/product-versions` - List product versions
- `GET /api/product-versions/:id` - Get single version with tasks
- `POST /api/product-versions` - Create version
- `POST /api/product-versions/:id/publish` - Publish version

### Productielijnen (Production Lines)
- `GET /api/production-lines` - List production lines

### Users
- `GET /api/users` - List users

## Database Schema

### Belangrijkste Tabellen

**production_lines**: Productielijnen (ZK, IENC, PILOT_ENC, PUBL)

**users**: Gebruikers met authenticatie

**user_production_line_rights**: Rechten per gebruiker per productielijn

**notifications**: Nautische meldingen

**notification_decisions**: Beslissingen per melding per productielijn

**tasks**: Taken die voortkomen uit meldingen

**task_products**: Koppeling taken-producten met status

**products**: Nautische producten (kaarten, publicaties)

**product_versions**: Versies van producten

**attachments**: Bijlagen bij meldingen

**activity_log**: Audit trail van alle acties

## State Management

De frontend gebruikt **Zustand** voor state management:

- `authStore.ts`: Authenticatie state (user, token, current production line)

## Styling

De applicatie gebruikt custom CSS met CSS variabelen:

```css
--color-primary: #0066cc
--color-success: #28a745
--color-danger: #dc3545
--color-warning: #ffc107
```

## Ontwikkel Tips

### Hot Reloading

Beide servers ondersteunen hot reloading:
- Backend: `ts-node-dev` herstart automatisch bij wijzigingen
- Frontend: Vite HMR (Hot Module Replacement)

### Debugging

Backend logs verschijnen in de terminal waar `npm run dev:backend` draait.

Frontend logs en errors verschijnen in de browser console.

### Database Queries Testen

Gebruik een PostgreSQL client zoals:
- pgAdmin
- DBeaver
- VSCode PostgreSQL extensie

### API Testen

Gebruik tools zoals:
- Postman
- Thunder Client (VSCode extensie)
- curl

Voorbeeld:
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cartis.be","password":"admin123"}'

# Get notifications (met token)
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Volgende Stappen / TODO

### Prioriteit Hoog
- [ ] File upload functionaliteit voor bijlagen
- [ ] Automatische mail import (nautinfo mailbox)
- [ ] API integraties (MRCC, BASS, POAB, FLARIS)
- [ ] CARIS integratie voor HPD projecten
- [ ] Geografisch overzicht (kaart weergave)

### Prioriteit Midden
- [ ] Pushberichten van Wrakkendatabank
- [ ] Pushberichten van POSEIDON
- [ ] BaZ1 artikels automatisch overnemen
- [ ] Doorlooptijden tracking
- [ ] Bulk beslissingen voor meldingen
- [ ] Geavanceerde filters en zoeken
- [ ] Export functionaliteit (Excel, PDF)

### Prioriteit Laag
- [ ] Email notificaties
- [ ] Gebruikersbeheer UI
- [ ] Rechten management UI
- [ ] Activity log viewer
- [ ] Dashboard statistieken uitbreiden
- [ ] Dark mode

### Technische Verbeteringen
- [ ] Unit tests (Jest voor backend, Vitest voor frontend)
- [ ] E2E tests (Playwright)
- [ ] API documentatie (Swagger/OpenAPI)
- [ ] Error logging service (Sentry)
- [ ] Performance monitoring
- [ ] Docker containerization
- [ ] CI/CD pipeline

## Code Conventies

### TypeScript
- Gebruik strict mode
- Definieer types/interfaces voor alle data
- Vermijd `any` waar mogelijk

### React
- Gebruik functional components
- Gebruik React Query voor data fetching
- Gebruik custom hooks voor herbruikbare logica

### Backend
- Gebruik async/await voor asynchrone code
- Valideer alle input
- Log belangrijke acties in activity_log
- Gebruik transactions voor multi-step database operaties

### Commit Messages
Gebruik conventional commits:
- `feat:` Nieuwe feature
- `fix:` Bug fix
- `docs:` Documentatie
- `style:` Formatting
- `refactor:` Code refactoring
- `test:` Tests toevoegen/updaten
- `chore:` Onderhoud taken
