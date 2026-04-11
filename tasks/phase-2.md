# Phase 2 — Sinopia (Template Configuration)

**Prerequisite:** Phase 1 complete and passing all definition-of-done checks.

**Goal:** A user can create a project, select a template, assign saved images to template layers, configure colors and typography, and see a live preview update in real time.

---

## Deliverables

### 1. Project Management

**API endpoints:**
```
GET  /api/projects                         → Project[]
POST /api/projects                         → created Project
GET  /api/projects/:id                     → Project (with layers + customizations)
PATCH /api/projects/:id                    → updated Project
POST /api/projects/:id/layers              → upsert layer assignment
GET  /api/projects/:id/layers              → ProjectLayer[]
```

**Project creation flow:**
- User provides a name
- Template selected from available templates (read from `templates/` directory)
- Default pages created from `theme.json → pages.defaultPages`

### 2. Template Loading

`GET /api/templates` → list of available templates (from `templates/*/theme.json`)  
`GET /api/templates/:id` → single theme.json contents

The server reads `templates/` at startup and caches manifests. No hardcoding of template IDs anywhere in the server or client.

**Counterpane** is the only required template for Phase 2. Its `theme.json`, `index.html`, `style.css`, and `script.js` must be complete and functional.

### 3. Preview Endpoint

```
GET /preview/:projectId
```

Returns a complete HTML document:
1. Loads template HTML from `templates/:templateId/index.html`
2. Injects resolved CSS variables as a `<style>` block
3. Injects the iframe messaging listener script
4. Resolves image paths to `/storage/...` URLs

The preview must render correctly in an iframe with no console errors.

### 4. Sinopia React UI

`/sinopia/:projectId`

**Layout:** Two-column. Left sidebar (configuration). Right panel (preview iframe).

**Left sidebar sections — all driven by `theme.json`, not hardcoded:**

*Template Layers section:*
- One subsection per entry in `theme.json.layers`
- Thumbnail grid of images filtered by `layer.accepts` tags
- Falls back to all images if no tag matches
- Selected image highlighted; click to assign
- Blend mode dropdown if layer supports it

*Colors section:*
- One control per entry in `theme.json.colors`
- Hex input + color picker
- Palette swatches from the currently assigned background layer image (if available)
- Click swatch → applies to color field

*Typography section:*
- Font pair dropdown (options from `theme.json.typography.fontPair.options`)
- Size sliders for each entry in `theme.json.typography.sizes`

*Components section:*
- Toggle and/or slider per entry in `theme.json.components`

**Live preview behavior:**
- Every settings change sends a `postMessage` to the iframe
- Iframe applies CSS variable changes without reload
- Full iframe reload only on image reassignment

**Auto-save:** Debounced 500ms after any change. Saves to `PATCH /api/projects/:id`.

### 5. Color Palette Integration

When an image is assigned to any layer marked `canUseFromPalette: true` in its color config, the sidebar Colors section displays that image's extracted palette as clickable swatches.

---

## Out of Scope for Phase 2

- Intonaco / content editing
- Export
- Multiple templates (Counterpane only)
- Authentication

---

## Definition of Done

- [ ] Projects can be created and listed
- [ ] Counterpane template loads in preview iframe with no errors
- [ ] Assigning an image to a layer updates the preview
- [ ] Color changes propagate to preview via postMessage (no reload)
- [ ] Typography changes propagate to preview via postMessage
- [ ] All controls are generated from `theme.json` — no hardcoded template logic in client
- [ ] Settings auto-save and survive page refresh
- [ ] Palette swatches appear from assigned image and can be applied to color fields
