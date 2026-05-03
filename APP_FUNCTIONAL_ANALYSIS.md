# CARTIS 2.0 - Full Functional Analysis

## Scope and Method
This document is an implementation-based analysis of the current app behavior (frontend + backend API wiring), focused on:
- Every routed screen
- Shared components
- Buttons, form fields, filters, and table actions
- Main backend endpoints used by UI flows
- Permissions and production-line behavior

It is based on the current source in `frontend/src` and `backend/src`.

---

## 1. System Architecture

### 1.1 Frontend
- Stack: React + TypeScript + Vite.
- State and data:
- `zustand` for auth/session state (`token`, user profile, selected production line).
- `@tanstack/react-query` for server data, caching, invalidation, and mutations.
- Routing: `react-router-dom` with protected routes.
- API client: Axios instance with:
- Base URL `/api`.
- Request interceptor adding `Authorization: Bearer <token>`.
- Response interceptor logging out on `401` and redirecting to `/login`.
- Mapping: Leaflet + Leaflet Draw + optional WMS overlays.
- Rich text: SunEditor for notes/comments and some bulk note fields.

### 1.2 Backend
- Stack: Express + TypeScript.
- Security: JWT authentication middleware on protected routes.
- API namespaces:
- `/api/auth`
- `/api/notifications`
- `/api/tasks`
- `/api/products`
- `/api/product-versions`
- `/api/production-lines`
- `/api/coverages`
- `/api/notes`
- `/api/users`
- File upload supported for notification and product-version attachments.
- Health endpoint: `/health`.

### 1.3 Deployment Shape
- Configured for Vercel:
- Node runtime for backend bundle.
- Static build for Vite frontend.
- Route rewrite sends `/api/*` to backend and all other paths to SPA entry.

---

## 2. Access Model and Permissions

### 2.1 Authentication
- Login requires email + password.
- JWT token is issued after credential and active-user validation.
- Login response also includes user rights per production line:
- `can_view`
- `can_edit`
- `can_publish`

### 2.2 Production Line Context
- Global production line selector in header.
- Most pages are disabled or show warning until a production line is selected.
- Data queries include `productionLineId` for context-aware filtering.

### 2.3 Route Guard
- All app routes except `/login` are protected.
- Without token, user is redirected to `/login`.

---

## 3. Global Layout and Navigation

## 3.1 Header Controls
- App logo/title.
- Production line dropdown:
- Field: `select` with `-- Selecteer --` and active production lines.
- Behavior: updates global production-line state.
- Validation cue: warning text + highlighted dropdown when none selected.
- User panel:
- Logged-in user name display.
- Button `Uitloggen` clears session and navigates to login.

## 3.2 Sidebar Controls
- Toggle button:
- Collapsed/expanded sidebar state.
- Icon changes (`☰` / `✕`).
- Nav links:
- Dashboard
- Meldingen (Notifications)
- Taken (Tasks)
- Productversies
- Gepubliceerde versies
- Producten
- Doorlooptijden

---

## 4. Page-by-Page Functional Analysis

## 4.1 Login Page
Purpose: Authenticate user and initialize session.

Fields and controls:
- `E-mailadres` (required, email input, autofocus).
- `Wachtwoord` (required, password input).
- Submit button:
- State text toggles between `Inloggen` and `Bezig met inloggen...`.
- Disabled while request in progress.
- Error banner displays API error.
- Static hint with default credentials text.

Flow:
1. POST `/auth/login` with email/password.
2. On success: store token/user and redirect to `/`.
3. On failure: show parsed API error.

---

## 4.2 Dashboard Page
Purpose: Operational entry overview + internal notes board.

Main areas:
- Production-line warning if none selected.
- Two KPI cards:
- `Openstaande Meldingen` (click navigates to notifications).
- `Actieve Taken` (click navigates to tasks).
- Welcome text and quick links.

Notes module (major feature):
- Sort dropdown:
- Priority high->low
- Priority low->high
- Newest first
- Oldest first
- Button `Nieuwe nota` opens note modal.
- Notes list per permission context, with metadata chips and priority badge.

Per-note actions:
- `Houden (<line>)`: force visibility for current line.
- `Verwijderen voor lijn`: remove note visibility for current line.
- `Bewerken`: open modal in edit mode (only when edit rights permit).
- `Verwijderen`: delete note (creator-only constraint in UI).

Note modal fields:
- Priority `select`: laag/gemiddeld/hoog.
- Production-line visibility checkboxes.
- Rich text editor content.
- Buttons:
- `Sluiten` / `Annuleren`
- Save button (`Nota opslaan` or `Wijzigingen opslaan`, pending state supported)

Validation:
- Empty rich text (after stripping HTML) blocked.
- At least one target production line required.

APIs used:
- GET `/notes`
- POST `/notes`
- PUT `/notes/:id`
- PUT `/notes/:id/line-visibility`
- DELETE `/notes/:id`

---

## 4.3 Notifications Page
Purpose: High-volume notification intake, triage, decisioning, and task creation.

### Top filter bar
Controls:
- Global text search input.
- Scope select:
- `Alleen niet beslist`
- `Alle meldingen`
- `Wis alle filters` button (shown conditionally).
- `+ Nieuwe Melding` button opens creation modal.

### Bulk selection panel
Shown when one or more rows selected.

Controls:
- `Deselecteer alles`.
- Bulk rich-text notes editor.
- Decision buttons:
- `Ja voor alle X`
- `Niet nodig voor alle X`

Behavior:
- Single selected or `Nee`: direct bulk decide.
- Multi selected + `Ja`: opens task-creation mode modal.

### Notification table and per-column filters
Columns include:
- Selection checkbox
- Code, dates, title, content preview
- Zones
- Affected products
- Linked tasks
- Per-production-line decision columns
- Actions

Interactive behaviors:
- Header sorting on key columns.
- Column filter row:
- Text filters for code/date/title/content/zones/products/task
- Decision dropdown filter per production line
- Row expand/collapse for rich detail panel.

Row actions:
- `Details` (new tab)
- `GML` export (all geometries)
- `Ja` / `Nee` decision buttons when not yet decided for active line

Pagination controls:
- `Vorige` and `Volgende`.

### New Notification Modal (full workflow)
Fields:
- `Titel` (required)
- `Code`
- `Bron` (preset source options)
- `Bron Detail`
- `Meldingsdatum` (required)
- `Inhoud`
- `Opmerkingen`

Email import block:
- Hidden file input (`.eml`, `.msg`) + drag-and-drop area.
- Auto-population logic:
- Sender -> source detail
- Subject -> title
- Body -> content
- Attachments extracted and appended

Attachment block:
- Uses reusable drag-drop file uploader component.
- Local pending-attachment list with remove buttons.

Geometry/location block:
- Mode toggle:
- Draw on map
- Type coordinates
- Coordinate format selector:
- DD, DDM, DMS, Lambert 72, Lambert 2008, ETRS89 UTM31N, WGS84 UTM31N
- Manual coordinate add with optional geometry name/description.
- Draw controls for Point/Line/Area.
- Geometries preview list with per-item removal.
- `Verwijder alles` to clear geometries.

WMS layer panel:
- Expand/collapse panel.
- Multi-select checkboxes for maritime overlays.
- Selected overlays rendered on the creation map.

Modal footer actions:
- `Annuleren`
- `Aanmaken` (pending state `Bezig...`)

Validation and behavior:
- Title required.
- Notification date required.
- Coordinate range validation for manual point entry.

### Task creation modal for bulk positive decisions
Shown after bulk `Ja` with multiple selected notifications.
Options:
- `Aparte taak voor elke melding`.
- `Eén taak voor alle meldingen`.
- `Annuleren`.

### Zone management dialog
Per notification zone maintenance.
Controls:
- List existing zones with badges and remove `x` action.
- Add-zone dropdown (excludes already linked zones).
- `Toevoegen`.
- `Sluiten`.

Core APIs used:
- GET `/notifications` (with pagination/filter params)
- GET `/notifications/:id`
- POST `/notifications`
- PUT `/notifications/:id`
- POST `/notifications/:id/decide`
- POST `/notifications/bulk-decide`
- GET/POST comments and info-requests under notification
- GET/POST/PUT/DELETE coordinates
- POST/GET/download/DELETE attachments
- POST `/notifications/:id/detect-zones`
- POST/DELETE zone links
- POST `/notifications/:id/detect-products`

---

## 4.4 Notification Detail Page
Purpose: Deep operational handling of a single notification.

Major modules:
- Base notification metadata display/edit support.
- Rich comments by production line.
- Coordinate and geometry management.
- Zone overlays and zone-link maintenance.
- Product link/unlink + product detection refresh.
- Attachment management.
- Info request email drafting and tracking.
- WMS overlays and advanced map interactions.

Key controls and fields:
- Notes comment editor (rich text) + submit.
- Opmerkingen edit/save toggles.
- Coordinate add/edit form:
- Latitude, longitude, label, description
- Drawing mode and manual line/area coordinate mode
- Coordinate format selector
- Map controls for drawing and clicking geometry vertices.
- Attachment uploader and per-attachment delete/download.
- Zone area display toggles:
- Show/hide areas
- Scope active vs all
- Selected zone area checklist
- Product panel:
- Product search
- Add/remove product links
- Product visibility toggles by type on map
- Re-detect products action.
- Info-request email form:
- Recipient
- Subject
- Body
- Save + open mail client behavior

Map behaviors:
- Supports multi-hit popups (multiple geometries at click point).
- Distinguishes zone hit items vs product hit items.
- Expand-to-fullscreen map mode with `Esc` exit.

---

## 4.5 Tasks Page
Purpose: Task list operations with status and cross-line tracking.

Top filters:
- Search input.
- Main status dropdown.
- Other-lines status dropdown.
- `Kolomfilters wissen` (conditional).

Task table:
Columns:
- Task number, title, BaZ number(s)
- MSI active flag
- Follow-up flag
- Extra-info flag
- Products
- Current line status
- Optional `Wachten op ZK` checkbox column (for relevant lines)
- Other production-line status columns
- Actions

Inline controls and actions:
- Column filters across all fields.
- Follow-up checkbox toggle.
- Extra-info checkbox toggle.
- Wait-for-ZK checkbox toggle (line specific).
- Product chips linking to Product Versions context.
- `Details` action opens detailed task page in new tab.

Expanded row panel:
- Detailed task metadata.
- BaZ article chips.
- Description block.
- MSI indicator.
- Flags toggles.
- `Meer info vragen` opens email composition section.
- Email form fields:
- Recipient
- Subject
- Body
- Buttons to open mailto and refresh draft

APIs heavily used:
- GET `/tasks`
- GET `/tasks/:id`
- PATCH `/tasks/:id/flags`
- PUT `/tasks/:id/production-line-status/:productionLineId`
- PATCH `/tasks/:id/production-line-status/:productionLineId/wait-for-zk`
- PUT `/tasks/:taskId/products/:productId`
- GET/POST task info-requests

---

## 4.6 Task Detail Page
Purpose: Full lifecycle control of one task, including workflows, notifications, products, statuses, and BaZ article operations.

Main functional blocks:
- Task metadata, statuses, and comments by production line.
- Workflow editor per production line.
- Product management:
- Add task-product link by line + product
- Update per-product task status
- Map display of related and optional all products
- Notification management:
- Link additional notifications into task
- Search candidates and attach
- Production-line status controls:
- Set line-specific status
- Toggle wait-for-ZK
- Follow-up and extra-info flags.
- Info request module:
- Recipient/subject/body fields
- Save info request + open email client

BaZ article module (notably for publication workflows):
- Create/edit/delete article entries.
- Fields:
- Book number
- Temporary article flag
- Dutch title/content
- English title/content
- Translate action (NL -> EN via API)
- Article list with expand/preview behavior.

Map capabilities:
- Layer and type filters.
- WMS overlay toggles.
- Multi-hit click handling.
- Fullscreen map expand/collapse.
- Split-pane resizing for detail/map.

---

## 4.7 Products Page
Purpose: Product master-data view and maintenance with table/map dual mode.

Top controls:
- View toggle: `Tabel` / `Kaart`.
- `+ Nieuw Product` button (visible only with edit rights).

Table mode:
Columns:
- Code
- Name
- OBJNAM-derived description
- Type
- Active status
- Geometry presence
- Actions (if editable)

Actions:
- `Bewerken` opens edit modal.

Edit modal fields:
- Name
- Type
- Description
- Active toggle
- Save/cancel actions

Create modal fields:
- Code
- Name
- Type
- Description
- Save/cancel actions

Map mode:
- Category filters by derived file category (ENC Ux, IENC, Pilot ENC Ux, Zeekaarten).
- Select-all/deselect-all categories button.
- `Vergroot kaart`/`Verklein kaart` toggle.
- Colored product geometries with popup metadata.
- Legend grouped by file category and product list.

APIs:
- GET `/products`
- PUT `/products/:id`
- POST `/products`

---

## 4.8 Product Versions Page (Open Versions)
Purpose: Create, manage, attach files, review tasks, and publish versions.

Create version panel:
- Collapsible section `Nieuwe Productversie`.
- Fields:
- Product select
- For manual products: Edition number + Update number
- For auto-version products (BaZ-2, Lichtenlijst, correction lists): auto previewed version scheme
- Version date
- Notes
- Action: `Versie aanmaken`

Open versions table:
- Product code/description
- Version number/date
- Status
- Creator
- Notes
- Row click selects version for detail pane

Selected version detail blocks:
- Correction-list preview block (when relevant product):
- NL/EN toggle
- Active BaZ numbers display
- `Print A4 (PDF)` action
- Sanitized HTML preview
- Attachment upload block:
- File picker
- `Bijlage uploaden`
- Attachments table with `Download`
- Linked tasks table:
- Task link
- title
- BaZ article/number
- task status
- execution status in product
- notes
- Inline update of execution status

Publish controls:
- Checkbox `nieuwe editie`.
- For chart-type products: required publication date field.
- `Publiceren` button with validation.

APIs:
- GET `/product-versions`
- GET `/product-versions/:id`
- POST `/product-versions`
- PATCH `/product-versions/:id/tasks/:taskId/execution-status`
- POST `/product-versions/:id/publish`
- GET `/product-versions/:id/corrections-list`
- POST/GET/download attachments

---

## 4.9 Published Product Versions Page
Purpose: Read-only style analysis of already published versions with linked-task visibility.

Controls:
- Per-column filter inputs across published-version table.
- `Kolomfilters wissen` when any filter active.
- Version row selection for detail pane.

Columns:
- Product
- Version number
- Version date
- Publication date
- Created by
- Notes

Selected version detail:
- Linked tasks table (task links, status, execution state, notes).
- For correction-list products:
- NL/EN preview switch
- Print action
- Sanitized HTML preview
- BaZ article preview modal (NL + EN side by side)

---

## 4.10 Lead Times Page
Purpose: KPI and row-level analysis of workflow lead times from notice through publication.

Top controls:
- Global search input.

Summary cards:
- Number of trajectories.
- Average notice -> task duration.
- Average task -> publication duration.
- Average total duration.

Table:
Columns:
- Notification
- Received date/time
- Task
- Completed date/time
- Product
- Version
- Publication date
- Notice->task days
- Task->publication days
- Total days

Column filter row:
- Text filter on each column.

Additional actions:
- `Kolomfilters wissen` button.
- Links to notification/task/product-version context pages.

API:
- GET `/tasks/lead-times`

---

## 5. Shared Components and Utility Behavior

## 5.1 Coordinate Input Component
Capabilities:
- Geographic formats: DD, DDM, DMS.
- Projected formats: EPSG 31370, 3812, 25831, 32631.
- Bidirectional conversion through `proj4`.
- Direction-aware UI for N/S and E/W.
- Supports precision and constrained ranges depending on mode.

## 5.2 File Upload Component
- Click-to-select and drag-and-drop behavior.
- Configurable accepted extensions and max size.
- File size validation with alert.
- Visual drag state feedback.

## 5.3 Table Sort Hook
- Tri-state sorting: asc -> desc -> none.
- Supports strings, numbers, dates, booleans.
- Returns sorted data plus icon helper.

## 5.4 Map Geometry Utilities
- Point-in-geometry hit testing:
- Polygon/MultiPolygon ray casting
- Point proximity via pixel tolerance
- Line/MultiLine segment distance in screen pixels
- Safe geometry parsing helper.

## 5.5 Task Chart Component
- Contains reusable SVG charts for task status, flags, and tasks over time.
- Provides tooltip-driven visual analytics.

---

## 6. Data and Workflow Characteristics

### 6.1 Notification Lifecycle
1. Notification intake (manual/email import + geometry/attachments).
2. Zone and product detection/enrichment.
3. Per production-line decision (`Ja`/`Nee`).
4. Optional automatic task creation from positive decisions.

### 6.2 Task Lifecycle
1. Task generated/linked from notifications.
2. Per-line and per-product status progression.
3. Optional flags (`needs_followup`, `needs_extra_info`, wait-for-ZK).
4. For publication line: BaZ article authoring/translation.

### 6.3 Product-Version Lifecycle
1. Create open version (manual or auto-generated numbering for specific publication products).
2. Link task execution outcomes.
3. Attach source files.
4. Publish with optional new edition and publication date rules.
5. Track in published archive view.

---

## 7. Backend Endpoint Catalog (UI-Relevant)

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`

### Production lines
- `GET /api/production-lines`

### Notes
- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `PUT /api/notes/:id/line-visibility`
- `DELETE /api/notes/:id`

### Notifications
- `GET /api/notifications`
- `GET /api/notifications/:id`
- `POST /api/notifications`
- `PUT /api/notifications/:id`
- `POST /api/notifications/:id/decide`
- `POST /api/notifications/bulk-decide`
- `GET /api/notifications/:id/comments`
- `POST /api/notifications/:id/comment`
- `GET /api/notifications/:id/info-requests`
- `POST /api/notifications/:id/info-requests`
- `GET /api/notifications/:id/coordinates`
- `POST /api/notifications/:id/coordinates`
- `PUT /api/notifications/:id/coordinates/:coordinateId`
- `DELETE /api/notifications/:id/coordinates/:coordinateId`
- `POST /api/notifications/:id/attachments`
- `GET /api/notifications/:id/attachments`
- `GET /api/notifications/:id/attachments/:attachmentId/download`
- `DELETE /api/notifications/:id/attachments/:attachmentId`
- `POST /api/notifications/:id/detect-zones`
- `POST /api/notifications/:id/zones/:zoneCoverageId`
- `DELETE /api/notifications/:id/zones/:zoneCoverageId`
- `POST /api/notifications/:id/detect-products`

### Tasks
- `GET /api/tasks`
- `GET /api/tasks/lead-times`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/flags`
- `PUT /api/tasks/:taskId/products/:productId`
- `POST /api/tasks/:taskId/products`
- `POST /api/tasks/:id/notifications`
- `GET /api/tasks/:id/comments`
- `POST /api/tasks/:id/comments`
- `PUT /api/tasks/comments/:commentId`
- `GET /api/tasks/:id/workflow`
- `POST /api/tasks/:id/workflow`
- `GET /api/tasks/:id/production-line-status`
- `PUT /api/tasks/:id/production-line-status/:productionLineId`
- `PATCH /api/tasks/:id/production-line-status/:productionLineId/wait-for-zk`
- `GET /api/tasks/:id/hpd-projects`
- `GET /api/tasks/:id/articles`
- `POST /api/tasks/:id/articles`
- `PUT /api/tasks/:id/articles/:articleId`
- `DELETE /api/tasks/:id/articles/:articleId`
- `POST /api/tasks/:id/articles/translate`
- `GET /api/tasks/:id/info-requests`
- `POST /api/tasks/:id/info-requests`

### Products
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `GET /api/products/for-notification/:notificationId`
- `POST /api/products/link-to-notification`
- `DELETE /api/products/unlink-from-notification/:notificationId/:productId`
- `GET /api/products/notification/:notificationId`

### Product versions
- `GET /api/product-versions`
- `GET /api/product-versions/:id`
- `POST /api/product-versions`
- `PATCH /api/product-versions/:id/tasks/:taskId/execution-status`
- `POST /api/product-versions/:id/publish`
- `GET /api/product-versions/:id/corrections-list`
- `POST /api/product-versions/:id/attachments`
- `GET /api/product-versions/:id/attachments`
- `GET /api/product-versions/:id/attachments/:attachmentId/download`

### Coverages and zones
- `GET /api/coverages/files`
- `GET /api/coverages/files/:id`
- `GET /api/coverages/products`
- `GET /api/coverages/zones`
- `GET /api/coverages/coverages/:id`
- `GET /api/coverages/coverages/code/:code`
- `GET /api/coverages/search`
- `GET /api/coverages/geojson`

---

## 8. Functional Strengths
- Rich operational tooling for notification triage, including geospatial workflows.
- Strong line-based segregation and per-line status visibility.
- Mature publication pipeline with task/article/version linkage.
- Good use of optimistic refresh through React Query invalidation.
- Built-in email request drafting and attachment handling in core flows.

## 9. Functional Risks and Considerations
- Large pages (notably notifications/task detail) concentrate many concerns and may be harder to maintain.
- Frequent `dangerouslySetInnerHTML` use requires continued strict sanitation discipline.
- Heavy map + WMS + geometry handling can impact performance for large datasets.
- Alert/confirm-based UX can be intrusive for high-volume operators.

---

## 10. Suggested Next Documentation Add-ons
- Role matrix by production line showing exact action permissions (`view/edit/publish`) per screen.
- Field-to-database mapping document for notification/task/version forms.
- End-to-end sequence diagrams for:
- Notification -> Task generation
- Task -> Product version -> Publish
- Correction-list generation and print flow
