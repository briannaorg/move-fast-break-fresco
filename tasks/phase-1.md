# Phase 1 — Foundation

**Status: Complete** ✓  
All deliverables shipped and verified. See additional scope section below for features added beyond the original spec.

**Goal:** A running application where a user can search museum APIs, save images with tags, and see them in a library view. No Sinopia or Intonaco yet.

This phase proves the full vertical stack: database → image pipeline → API → React UI.

---

## Deliverables

### 1. Project Scaffold

- Single repo with `server/` and `client/` directories
- `npm run dev` at root starts both (use concurrently or similar)
- `npm run build` produces a production build the server can serve statically
- Environment config via `.env` with documented `.env.example`

### 2. Database

- Chosen engine with justification in `decisions/001-database.md`
- Schema matches the spec in CLAUDE.md exactly
- Migration system in place (so schema changes are versioned)
- Seed script that creates one default user

### 3. Arriccio: Search & Save

**API endpoints:**
```
GET  /api/search?q=...&source=met     → SearchResult[]
POST /api/images                       → saved image record
GET  /api/images?tag=...&userId=...   → Image[]
GET  /api/images/:id                  → Image (with variants + palette)
POST /api/images/:id/tags             → updated tag list
```

**Image save flow:**
- Accept `{ sourceId, source, title, artist, date, imageUrl }`
- Run full processing pipeline (download → variants → palette)
- Return immediately with `status: 'pending'`; processing is async
- Client polls or uses status endpoint to know when `ready`

**Met Museum adapter** working and tested.  
**ARTIC adapter** working and tested.

### 4. React Client — Arriccio Views

`/arriccio` — Search interface:
- Source selector (Met / ARTIC)
- Search input
- Results grid (thumbnail, title, artist)
- "Save" button per result; shows saved state

`/arriccio/library` — Saved images:
- Grid of saved images with thumbnails
- Tag input per image (comma-separated, saved on blur)
- Filter by tag
- Processing status indicator (pending / ready / error)

No authentication UI required. Hardcode `userId: 1` (from seed) for Phase 1.

### 5. Basic Shell

The React app should have a persistent nav that shows all three layer names (Arriccio / Sinopia / Intonaco) even if Sinopia and Intonaco routes just render a placeholder. This establishes the UX mental model from the start.

---

## Out of Scope for Phase 1

- Sinopia editor (any of it)
- Intonaco / export
- Template loading or preview
- Authentication
- Production deployment config
- Any adapter beyond Met and ARTIC

---

## Additional Scope Delivered

The following features were added beyond the original spec during Phase 1 at user request:

- **Projects** — users can create named projects as categorization buckets for images. Projects exist without a template; `template_id` is assigned later in Sinopia. API: `GET/POST/DELETE /api/projects`.
- **project_images table** — many-to-many association between images and projects, carrying `template_types` and `blend_modes` chosen at save time. Distinct from `project_layers` (Phase 2).
- **Expanded save UX** — clicking Save on a search result opens a modal panel (`SavePanel.jsx`) with: project selector (with inline "New project…" creation), Template Type checkboxes (background, ornament, frame, particle, foreground, border, icon, capital, other), CSS Blend checkboxes (normal, multiply, screen, overlay, hard-light, soft-light, all), and a tag input. All fields are optional.
- **Arriccio sub-navigation** — `ArriccioLayout.jsx` wraps all `/arriccio/*` routes with a Search / Library / Projects tab bar using React Router nested routes.
- **Bug fix: ARTIC 403** — ARTIC's IIIF server blocks requests without a `User-Agent` header. Fixed in `server/images/pipeline.js`.

---

## Definition of Done

- [x] `npm run dev` starts without errors
- [x] Search returns results from Met Museum
- [x] Search returns results from ARTIC
- [x] Saving an image triggers the pipeline; status reaches `ready`
- [x] Saved image has thumbnail, medium, large variants on disk
- [x] Saved image has 6-color palette in database
- [x] Library view shows all saved images
- [x] Tags can be added and filtered in library view
- [x] All API endpoints return consistent error shapes `{ error: string, code: string }`
