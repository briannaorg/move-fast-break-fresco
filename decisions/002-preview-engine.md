# 002 — Preview and Export Engine

**Date:** 2026-04-22  
**Status:** Accepted

## Context

The preview endpoint (`GET /preview/:projectId`) and export pipeline (`POST /api/projects/:id/export`) both need to assemble complete HTML documents from template files + project customizations. This includes resolving CSS variables, generating font preload tags for the active font pair, and conditionally including template components.

Template HTML files are hand-written and trusted (not user-submitted). The developer's background is primarily PHP, where this kind of HTML assembly is natural. However, introducing PHP would require a second runtime, conflicting with the single-server constraint that was established to eliminate the operational friction that stalled earlier versions of this project.

The export pipeline additionally needs to package the rendered output as a downloadable zip file.

## Decision

**Nunjucks** for HTML template rendering (both preview and export).  
**Archiver** for zip file generation (export only).

Nunjucks was chosen because:
- Runs inside the existing Node.js process — no second runtime
- Syntax is nearly identical to Twig/Jinja2, which maps directly to the developer's PHP templating experience
- Autoescaping enabled by default
- Mature and stable (Mozilla-maintained)
- Supports template inheritance and filters, which will be useful as more templates are added

Template `index.html` files become Nunjucks templates with dynamic blocks for font preloads, CSS variable injection, and conditional component rendering, while remaining readable and hand-editable.

**Font strategy (MVP):** Google Fonts linked via URL. Font files are not bundled into exports. This keeps the export pipeline simple and avoids font licensing complexity. Self-hosted font bundling can be added later as a feature if needed for a paid version.

**CSS variable validation:** All values injected into the preview are validated against their expected type before rendering. Colors must match hex/rgb patterns, sizes must include units, font names must match theme.json options.

## Consequences

**Easier:**
- Single runtime maintained — `npm run dev` stays one command
- Template authoring stays in familiar HTML with minimal Nunjucks markers
- Same engine serves both preview and export, reducing code duplication
- Archiver streams zip output, avoiding memory pressure on large exports

**Harder:**
- Developer needs to learn Nunjucks syntax (minimal lift given Twig/Jinja2 familiarity)
- Template HTML files are no longer pure static HTML — they require Nunjucks to render
- Exported sites require internet access to load Google Fonts (acceptable for MVP)
