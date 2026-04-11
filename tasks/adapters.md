# Museum API Adapter Notes

Reference for implementing adapters. All adapters must conform to the interface in CLAUDE.md.

---

## Met Museum

**Base URL:** `https://collectionapi.metmuseum.org/public/collection/v1`  
**Auth:** None required  
**Rate limit:** Reasonable, no hard limit documented

**Search:**
```
GET /search?q={query}&isPublicDomain=true
→ { total, objectIDs: number[] }
```
Returns IDs only. Must fetch each object individually.

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

**Attribution fields to store:** `title`, `artistDisplayName` → artist, `objectDate` → date, `objectURL` → source URL, `department`

---

## Art Institute of Chicago (ARTIC)

**Base URL:** `https://api.artic.edu/api/v1`  
**Auth:** None required  
**Docs:** https://api.artic.edu/docs/

**Search:**
```
GET /artworks/search?q={query}&query[term][is_public_domain]=true&fields=id,title,artist_display,date_display,image_id,thumbnail
→ { data: Artwork[], pagination }
```

**Image URL construction:**
```
https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg   ← large
https://www.artic.edu/iiif/2/{image_id}/full/200,/0/default.jpg   ← thumbnail
```
`image_id` can be null — skip those records.

**Object detail:**
```
GET /artworks/{id}?fields=id,title,artist_display,date_display,image_id,is_public_domain,api_link
```

**Attribution fields:** `title`, `artist_display` → artist, `date_display` → date, `api_link` → source URL

---

## Adding Future Adapters

Create `server/adapters/<source-id>/adapter.js` implementing the standard interface.

Register in `server/adapters/index.js` — this is the only file that needs to change to add a new source.

Adapters to add in later phases (not Phase 1):
- Cleveland Museum of Art (`https://openaccess-api.clevelandart.org/api/artworks`)
- Smithsonian (`https://api.si.edu/openaccess/api/v1.0/search`)
- Rijksmuseum (`https://www.rijksmuseum.nl/api/en/collection`)
- NYPL Digital Collections
- Minneapolis Institute of Art
- National Gallery of Art
