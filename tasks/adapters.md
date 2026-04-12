# Museum API Adapter Notes

Reference for implementing adapters. All adapters must conform to the interface in CLAUDE.md.

---

## Met Museum

**Base URL:** `https://collectionapi.metmuseum.org/public/collection/v1`  
**Auth:** None required  
**Rate limit:** 80 requests/second  
**Status:** Implemented ✓

**Search strategy:** Returns all matching objectIDs in one call (`hasImages=true&isPublicDomain=true`). Client slices by page. Individual objects fetched in parallel batches of 5.

**Search filters implemented:**
- `departmentId` — dropdown from `GET /departments` (19 departments)
- `isHighlight` — boolean, highlights/important works only
- `isOnView` — boolean, currently on display
- `medium` — free text (pipe-delimited for multiple, e.g. `Paintings|Drawings`)
- `geoLocation` — free text (pipe-delimited)
- `dateBegin` / `dateEnd` — year range (both required together)
- `searchIn` — `title` or `tags` to narrow `q` field scope (default: all fields)

**Object detail:**
```
GET /objects/{objectID}
→ {
    objectID, title, artistDisplayName, objectDate,
    primaryImage,           ← full resolution (may be empty)
    primaryImageSmall,      ← thumbnail
    isPublicDomain,         ← must be true
    objectURL,              ← source page URL for attribution
    medium, department, culture
  }
```

**Important:** `primaryImage` can be an empty string even for public domain objects. Skip objects where both image fields are empty.

**Attribution fields:** `title`, `artistDisplayName` → artist, `objectDate` → date, `objectURL` → sourceUrl

---

## Art Institute of Chicago (ARTIC)

**Base URL:** `https://api.artic.edu/api/v1`  
**Auth:** None required — but include `AIC-User-Agent: Fresco/1.0 ...` on all API calls  
**Rate limit:** 60 requests/minute per IP  
**Docs:** https://api.artic.edu/docs/  
**Status:** Implemented ✓

**Search strategy:** POST to `/artworks/search` with Elasticsearch `bool.must` query body. Supports native pagination via `page`/`limit`. Returns full records (no secondary calls needed).

**Search filters implemented:**
- `artworkType` — dropdown from `GET /artwork-types` (45 types); uses `match` query on `artwork_type_title` (term query does not work — field is analyzed)
- `placeOfOrigin` — free text, `match` query on `place_of_origin`
- `dateBegin` / `dateEnd` — year range using Elasticsearch `range` on `date_start` / `date_end`

**Image URL construction:**
```
https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg   ← large (imageUrl)
https://www.artic.edu/iiif/2/{image_id}/full/200,/0/default.jpg   ← thumbnail
```
`image_id` can be null — filter those records out.

**Source URL:** `https://www.artic.edu/artworks/{id}` (not the API link — that goes to api.artic.edu)

**IIIF image downloads** require a `User-Agent` header (see pipeline.js). API calls use `AIC-User-Agent`.

**Attribution fields:** `title`, `artist_display` → artist, `date_display` → date

---

## NYPL Digital Collections

**Base URL:** `https://api.repo.nypl.org/api/v2`  
**Auth:** `Authorization: Token token="{NYPL_API_TOKEN}"` — token in `server/.env`  
**Rate limit:** 10,000 requests/day per token  
**Docs:** https://api.repo.nypl.org/  
**Status:** Implemented ✓  
**⚠️ Shutdown: August 1, 2026 — no public API replacement planned**

**Search strategy:** Single call to `GET /items/search?q=...&publicDomainOnly=true`. Image URLs are constructed directly from the `imageID` field in the search response — no per-item secondary calls, preserving the daily quota.

**Image URL construction:**
```
https://images.nypl.org/index.php?id={imageID}&t=b   ← ~100px thumbnail
https://images.nypl.org/index.php?id={imageID}&t=r   ← ~300px
https://images.nypl.org/index.php?id={imageID}&t=w   ← ~760px (used as imageUrl)
https://images.nypl.org/index.php?id={imageID}&t=q   ← ~1600px
```

**Search filters implemented:**
- `searchField: 'title'` — adds `field=title` to search query (title-only search). Only `title` is accepted; `titleProper`, `subjectLiteral`, `creator` all return 500.

**Known limitations:**
- `artist` and `date` are not available in search results — returned as null. They are parsed from MODS metadata in `getById()` but that requires an extra API call.
- Results are filtered to `typeOfResource === 'still image'` only.
- `per_page` max is 500.

**Source URL:** `item.itemLink` (converted from http to https)

---

## Adding Future Adapters

Create `server/adapters/<source-id>/adapter.js` implementing the standard interface.

Register in `server/adapters/index.js` — this is the only file that needs to change to add a new source.

**Remaining adapters (not yet implemented):**
- Cleveland Museum of Art (`https://openaccess-api.clevelandart.org/api/artworks`)
- Smithsonian (`https://api.si.edu/openaccess/api/v1.0/search`)
- Rijksmuseum (`https://www.rijksmuseum.nl/api/en/collection`)
- Minneapolis Institute of Art
- National Gallery of Art
