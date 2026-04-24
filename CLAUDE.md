# Fresco — Claude Code Briefing

Fresco is a **guided web creation tool** for building beautiful static websites using public domain museum artwork and pre-defined design templates.

It is fundamentally **not** a blank-canvas design tool. The mental model is: curated assets → constrained configuration → static site export.

---

## Repo Structure

```
fresco/
├── CLAUDE.md                  # This file
├── decisions/                 # Append-only ADR log (write here when making arch decisions)
├── tasks/                     # Phase task files
├── server/                    # Node.js + Express backend
│   ├── index.js               # App entry point
│   ├── db/                    # Database layer (schema, migrations, queries)
│   ├── adapters/              # Museum API adapters (one folder per source)
│   ├── images/                # Image processing pipeline
│   └── export/                # Static site export generator
├── client/                    # React single-page application
│   ├── src/
│   │   ├── arriccio/          # Asset curation views
│   │   ├── sinopia/           # Template configuration views
│   │   ├── intonaco/          # Content editing + export views
│   │   └── shared/            # Components, hooks, utils used across layers
│   └── public/
├── templates/                 # Template plugins (one folder per template)
│   └── counterpane/
│       ├── theme.json         # Machine-readable manifest (see Template System below)
│       ├── index.html
│       ├── style.css
│       └── script.js
└── storage/                   # Local dev image storage (gitignored)
```

**Single server serves everything.** The Express server handles:
- All `/api/*` routes (backend)
- Static client build from `/client/build`
- Template files from `/templates`
- Stored images from `/storage`

No separate dev servers. One `npm run dev` starts everything.

---

## Three-Layer Model

These are fixed architectural layers, not phases. Each maps to a section of the UI.

| Layer | Name | Purpose |
|---|---|---|
| 1 | **Arriccio** | Search museum APIs, save images, assign tags, extract color palettes |
| 2 | **Sinopia** | Assign images to template layers, configure colors/typography/components, live preview |
| 3 | **Intonaco** | Edit content in-place (WYSIWYG), manage pages, export static site |

The word "layer" is overloaded. Use **template layers** to mean named visual slots in a template (background, ornament, frame). Use **application layers** to mean Arriccio/Sinopia/Intonaco.

---

## Database

**Engine: SQLite via `better-sqlite3` + Knex.js.** Decision recorded in `decisions/001-database.md`.

- Migrations live in `server/db/migrations/`. Run with `npm run migrate` (from root) or `knex migrate:latest` (from `server/`).
- The server calls `db.migrate.latest()` automatically on startup — you do not need to run migrations manually in development.
- Seeds live in `server/db/seeds/`. Run with `npm run seed`.
- Database file: `storage/fresco.db` (created automatically; gitignored).
- Storage directory for images: `storage/` (created automatically; gitignored).

### Schema

```
users              — id, username, email, created_at

images             — id, user_id, source, source_id, title, artist, date,
                     source_url, original_path, metadata (JSON), palette (JSON),
                     status (pending|processing|ready|error), error_message,
                     created_at
                     UNIQUE(source, source_id, user_id)

image_variants     — id, image_id, variant_type (thumbnail|medium|large),
                     path, width, height

image_tags         — id, image_id, tag (indexed)

projects           — id, user_id, name, template_id (nullable — assigned in Sinopia),
                     customizations (JSON), created_at, updated_at

project_images     — id, project_id, image_id,
                     template_types (JSON string[]), blend_modes (JSON string[])
                     UNIQUE(project_id, image_id)

project_layers     — id, project_id, image_id, layer_name, blend_mode, settings (JSON)

project_pages      — id, project_id, page_name, content (JSON), page_order
```

**Key schema notes:**
- `images.status` tracks async pipeline progress. Always check this before treating an image as usable.
- `images.palette` and `images.metadata` are JSON stored as TEXT. Parse before use.
- `projects.template_id` is nullable. Projects are created as categorization buckets in Arriccio; a template is assigned later when the user enters Sinopia.
- `project_images` is the Phase 1 image→project association. It carries `template_types` (e.g. `["background","ornament"]`) and `blend_modes` (e.g. `["multiply","screen"]`) chosen by the user at save time. This is distinct from `project_layers`, which is the Phase 2 template-slot assignment.
- Variant paths and original paths are stored as URL paths (`/storage/variants/123_thumbnail.jpg`), not filesystem paths. The Express server serves `/storage` from the `storage/` directory.

---

## Frontend

**React throughout.** No vanilla JS frontends. One React SPA served from `/client`.

React Router handles navigation between Arriccio / Sinopia / Intonaco.

The Sinopia UI is **dynamically generated from `theme.json`** — do not hardcode controls for specific templates. Read the manifest, render appropriate controls.

State management: start with React Context + useReducer unless complexity clearly demands more.

### Client Routes

```
/                          → redirect to /arriccio
/arriccio                  → asset search and save         ← nested under ArriccioLayout
/arriccio/library          → saved images, tag management  ← nested under ArriccioLayout
/arriccio/projects         → create/list/delete projects   ← nested under ArriccioLayout
/sinopia/:projectId        → template configuration + live preview
/intonaco/:projectId       → content editing + export
```

All `/arriccio/*` routes are wrapped by `client/src/arriccio/ArriccioLayout.jsx`, which renders a Search / Library / Projects sub-nav and an `<Outlet>`. Use React Router nested routes when adding new Arriccio views.

---

## Template System

Templates are **pre-built, hand-coded experiences** — Fresco does not generate template HTML. Fresco provides a configuration UI for them via `theme.json`.

### theme.json Manifest

```json
{
  "id": "counterpane",
  "name": "Counterpane",
  "version": "1.0.0",
  "description": "Quilt-inspired bordered layout with masonry grid",
  "files": {
    "html": "index.html",
    "css": "style.css",
    "js": "script.js"
  },
  "layers": {
    "background": {
      "label": "Background",
      "required": true,
      "multiple": false,
      "accepts": ["background", "landscape", "texture"],
      "cssVar": "--bg-image"
    },
    "particles": {
      "label": "Scattered Elements",
      "required": false,
      "multiple": false,
      "accepts": ["ornament", "decorative"],
      "cssVar": "--particle-image",
      "behavior": "particle-system",
      "defaultCount": 20
    }
  },
  "colors": {
    "primary": {
      "label": "Primary Color",
      "cssVar": "--primary-color",
      "default": "#2c3e50",
      "canUseFromPalette": true
    }
  },
  "typography": {
    "fontPair": {
      "label": "Font Pairing",
      "cssVars": { "heading": "--heading-font", "body": "--body-font" },
      "options": [
        { "name": "Playfair + Lato", "heading": "Playfair Display", "body": "Lato" },
        { "name": "Merriweather + Open Sans", "heading": "Merriweather", "body": "Open Sans" }
      ]
    },
    "sizes": {
      "h1": { "cssVar": "--h1-size", "default": "48px", "min": 24, "max": 96 }
    }
  },
  "components": {
    "window-border": {
      "label": "Window Border",
      "enabled": true,
      "toggleable": false,
      "settings": {
        "width": { "cssVar": "--border-width", "default": "20px", "min": 0, "max": 100 }
      }
    }
  },
  "pages": {
    "supportMultiple": true,
    "defaultPages": ["index", "about", "gallery"],
    "requiresSourcesPage": true
  },
  "content": {
    "editableAreas": [
      { "selector": "[data-editable='heading']", "type": "heading", "maxLength": 100 },
      { "selector": "[data-editable='content']", "type": "richtext" }
    ]
  }
}
```

### CSS Variable Contract

Templates use CSS custom properties exclusively for customization. Fresco injects a `<style>` block into the preview with resolved values. Templates must not hardcode values that appear in `theme.json`.

### Template Layer Behaviors

- `fill` — image fills a region
- `particle-system` — one image duplicated N times, JS-positioned
- `border` — decorative frame, z-indexed above content

---

## Museum API Adapters

Each adapter lives in `server/adapters/<source-name>/` and exports a common interface:

```javascript
// adapter.js must export:
{
  search(query, options) → Promise<{ results, total, page, limit }>,
  getById(sourceId)      → Promise<AssetDetail | null>,
  name: string,          // display name
  id: string,            // slug used in DB
  // optional — if present, exposed via GET /api/search/departments?source=:id
  getDepartments()       → Promise<{ id, name }[]>,
  // optional — if present, exposed via GET /api/search/artwork-types?source=:id
  getArtworkTypes()      → Promise<{ id, title }[]>,
}

// SearchResult shape:
{
  sourceId: string,
  title: string,
  artist: string | null,
  date: string | null,
  thumbnailUrl: string,
  imageUrl: string,       // highest available resolution
  license: string,        // must be public domain
  sourceUrl: string | null, // link to the source museum's page for this work
  metadata: object,       // source-specific fields (medium, department, etc.)
}
```

**Adapters implemented:** Met Museum (`met`), Art Institute of Chicago (`artic`), NYPL Digital Collections (`nypl`).

Search returns `{ results, total, page, limit }` — not a bare array. All adapters follow this shape. The route (`GET /api/search`) accepts `page` and `limit` (capped at 40) and passes them through.

**Per-source rate limits:**
- Met: 80 req/sec — no throttling needed at current usage
- ARTIC: 60 req/min — single POST per search page, well within limit
- NYPL: 10,000 req/day — single GET per search page; no per-item calls during search

**ARTIC IIIF images require a `User-Agent` header** — returns 403 without one. `pipeline.js` sets this for image downloads. ARTIC adapter API calls use `AIC-User-Agent` header instead.

**NYPL API shuts down August 1, 2026** — no public replacement planned. Token stored in `NYPL_API_TOKEN` env var.

**Additional adapters to add later:** Cleveland Museum, Smithsonian, Rijksmuseum, Minneapolis Institute of Art, National Gallery of Art.

See `tasks/adapters.md` for per-source API notes and filter details.

---

## Image Processing Pipeline

On save, every image goes through this pipeline (async, with status tracking):

1. Download full-resolution image
2. Generate variants: `thumbnail` (200px), `medium` (800px), `large` (1600px)
3. Extract 6-color palette via colorthief
4. Persist all paths + palette to database
5. Update status to `ready`

Use **Sharp** for image processing. Status values: `pending` → `processing` → `ready` | `error`.

---

## Preview System

The Sinopia live preview loads the template in an `<iframe>` via `/preview/:projectId`.

**Engine:** Nunjucks renders the template HTML server-side. Template `index.html` files contain Nunjucks blocks for dynamic content (font preloads, CSS variables, conditional components).

The preview endpoint:
1. Loads project from database + template `theme.json`
2. Merges project customizations with theme.json defaults
3. Resolves the active font pair → generates `<link rel="preconnect">` and Google Fonts `<link>` tags for only the selected fonts
4. Resolves all CSS variable values → generates a `<style>:root { ... }</style>` block
5. Renders the Nunjucks template with the full context
6. Injects the postMessage listener script for live updates
7. Returns complete, well-formed HTML

**Font resolution:** The endpoint reads `theme.json.fonts` to find the source and weights for each font in the active font pair. MVP links to Google Fonts via URL. Font files are not bundled.

**CSS variable validation:** Before injection, all values are validated against type. Colors must match hex/rgb patterns. Sizes must be a number with a unit. Font names must match an option in theme.json. Reject anything else.

**Iframe sandboxing:** The React parent must use `sandbox="allow-scripts allow-same-origin"` on the preview iframe.

Live updates use `postMessage` from the React parent into the iframe — no full reloads for settings changes.

```javascript
// Parent → iframe
iframe.contentWindow.postMessage({ type: 'UPDATE_CSS_VARS', vars: { '--primary-color': '#3a5f7d' } });

// iframe listener
window.addEventListener('message', ({ data }) => {
  if (data.type === 'UPDATE_CSS_VARS') applyVars(data.vars);
});
```

---

## Export System

`POST /api/projects/:id/export` produces a zip containing:

```
project-name/
├── index.html
├── about.html
├── gallery.html
├── sources.html          ← auto-generated attribution page
├── css/style.css         ← template CSS with variables resolved as static values
├── js/script.js
└── images/
    ├── background.jpg    ← optimized copies of assigned images
    └── ornament.jpg
```

**Engine:** Nunjucks renders each page's HTML (same engine as preview). After rendering, the export pipeline does additional post-processing that preview does not:

1. Resolve all `var(--x)` references in the CSS to static values (exported CSS must not depend on the injected `:root` block)
2. Rewrite image paths from `/storage/...` to relative `./images/...`
3. Generate Google Fonts `<link>` tags for the selected font pair (MVP links to Google Fonts via URL — fonts are not bundled)
4. Copy optimized image variants (`large` size) into the export
5. Generate `sources.html` from database metadata
6. Stream the result as a zip via **Archiver** (not held in memory)

CSS variables must be **resolved to static values** in the export — the exported site must have zero runtime dependencies on Fresco.

`sources.html` is always generated. It lists every image with full museum attribution (title, artist, date, source URL, license).

---

## Constraints (Do Not Override Without an ADR)

- **No AI-generated images.** Fresco is explicitly human-curation-first.
- **No blank canvas.** Every project starts from a template. No freeform layout tools.
- **Templates are not generated.** `theme.json` manifests are written by hand.
- **Single server.** Do not introduce a second process.
- **Public domain only.** Adapter search results must filter to public domain licenses.
- **Sources page required.** Every export includes `sources.html`. This is non-negotiable.

---

## Decisions Log

When you make an architectural decision not specified here, write it to `decisions/NNN-title.md` using this format:

```markdown
# NNN — Title

**Date:** YYYY-MM-DD  
**Status:** Accepted

## Context
What situation required a decision.

## Decision
What you chose.

## Consequences
What this makes easier or harder going forward.
```

Start at `001`. Never edit a past decision — add a new one that supersedes it.

---

## Linear Integration

**Team:** TechnoSiren  
**Project:** Fresco

Linear is used for milestone-level tracking, not granular task logging.

### When to interact with Linear:
- **Session start:** List In Progress issues for the Fresco project to understand where work left off
- **Starting a deliverable:** Move the relevant issue to In Progress
- **Completing a deliverable:** Move it to Done and add a one-sentence comment describing what was built and any decisions made
- **Hitting a blocker:** Update the issue description with the blocker so it's visible on resume

### When NOT to use Linear:
- Do not create sub-issues for individual files or functions
- Do not log every code change as a comment
- Do not create issues for things not in the current phase task file

### Issue format when creating:
- Title: deliverable name (e.g., "Preview endpoint — /preview/:projectId")
- Description: what done looks like (copy from the phase task file's DoD checklist item)
- Label: the phase ("Phase 2")
- State: Todo initially; move to In Progress when work begins

---

## Start Here

Read `tasks/phase-2.md` for the current build scope.
