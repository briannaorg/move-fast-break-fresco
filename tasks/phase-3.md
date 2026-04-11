# Phase 3 — Intonaco (Content & Export)

**Prerequisite:** Phase 2 complete and passing all definition-of-done checks.

**Goal:** A user can edit content directly in the preview, manage pages, and export a complete static site as a zip file with full museum attribution.

---

## Deliverables

### 1. WYSIWYG Content Editing

The Intonaco view shares the same two-column layout as Sinopia. The difference: the preview iframe is in edit mode.

Template HTML uses `data-editable` attributes to mark editable regions (specified in `theme.json → content.editableAreas`). In Intonaco mode, these regions become contenteditable.

**Edit mode injection:** The preview endpoint accepts a `?mode=edit` query parameter. In edit mode it additionally injects:
- `contenteditable="true"` on all `[data-editable]` elements
- A lightweight script that `postMessage`s content changes back to the parent on `input` events
- Minimal edit-mode styling (focus outline, cursor change)

**Floating toolbar:** When a user focuses an editable heading or richtext area, the React parent renders a floating toolbar (positioned relative to the iframe using `getBoundingClientRect`) with: Bold, Italic, Link.

**Persistence:** Content changes are saved to `project_pages.content` (JSON keyed by `data-editable` value). Debounced 500ms.

### 2. Page Management

Left sidebar in Intonaco shows a pages panel:
- List of current pages
- Add page (name input)
- Delete page (with confirmation)
- Reorder pages (drag or up/down arrows)
- Click page → loads that page in preview iframe

**API endpoints:**
```
GET  /api/projects/:id/pages            → ProjectPage[]
POST /api/projects/:id/pages            → created ProjectPage
PATCH /api/projects/:id/pages/:pageId   → updated ProjectPage
DELETE /api/projects/:id/pages/:pageId  → deleted
PATCH /api/projects/:id/pages/order     → reorder (array of ids)
```

### 3. Export System

`POST /api/projects/:id/export` streams a zip file.

**Export pipeline:**
1. Load project, all pages, all layer assignments, all customizations
2. For each page:
   - Load template HTML
   - Inject resolved CSS variables as static values (no runtime variables — resolve `var(--x)` to actual values)
   - Inject page content into `[data-editable]` regions
   - Fix all asset paths to be relative (`./images/background.jpg`)
   - Write to `<project-slug>/<page-name>.html`
3. Copy template `style.css` with variables resolved to static values
4. Copy template `script.js` unchanged
5. Copy optimized image variants (use `large` variant for export)
6. Generate `sources.html` (see below)
7. Stream zip to client

**CSS variable resolution:** The export must not contain any `var(--x)` references. Walk the CSS and substitute all variables with their resolved values from project customizations.

**sources.html generation:**
- Auto-generated; not editable by the user
- Groups images by museum source
- For each image: title, artist, date, source museum name, original URL, license statement
- Includes a colophon crediting the template by name
- Styled consistently with the rest of the exported site

### 4. Export UX

- "Export" button in the Intonaco header
- Progress modal with status messages (generating pages... copying images... creating attribution page... packaging zip...)
- On complete: auto-download triggers, modal shows success with file size
- On error: modal shows error message with retry option

---

## Out of Scope for Phase 3

- Authentication
- Multiple templates beyond Counterpane
- WordPress export

---

## Definition of Done

- [ ] Clicking text in the preview (edit mode) makes it editable
- [ ] Content changes save and survive page refresh
- [ ] Pages can be added, deleted, and reordered
- [ ] Switching pages in the sidebar loads the correct page in the preview
- [ ] Export produces a valid zip file
- [ ] Exported HTML has no `var(--x)` references — all values are static
- [ ] All asset paths in export are relative
- [ ] `sources.html` is present and lists every assigned image with full attribution
- [ ] Exported site opens correctly when served from any static host (no Fresco dependency)
