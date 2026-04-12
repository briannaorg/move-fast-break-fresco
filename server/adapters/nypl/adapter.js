// NYPL Digital Collections API adapter
// API shutdown date: August 1, 2026 — no public replacement planned.
// Rate limit: 10,000 requests/day per token.
// Strategy: single search call per page; image URLs constructed from imageID
// without secondary per-item calls to preserve the daily quota.

const BASE = 'https://api.repo.nypl.org/api/v2';

function authHeader() {
  const token = process.env.NYPL_API_TOKEN;
  if (!token) throw Object.assign(new Error('NYPL_API_TOKEN is not set'), { status: 500, code: 'MISSING_API_TOKEN' });
  return { Authorization: `Token token="${token}"` };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) throw new Error(`NYPL API error: ${res.status}`);
  return res.json();
}

// Image URL format: https://images.nypl.org/index.php?id={imageID}&t={size}
// Sizes: b=100px, f=140px, t=150px, r=300px, w=760px, q=1600px, g=original
function imageUrl(imageID, size) {
  return `https://images.nypl.org/index.php?id=${encodeURIComponent(imageID)}&t=${size}`;
}

async function search(query, options = {}) {
  const {
    page = 0,
    limit = 20,
    searchField, // 'title' | (empty = all fields)
  } = options;

  const params = new URLSearchParams({
    q: query,
    publicDomainOnly: 'true',
    page: String(page + 1), // NYPL is 1-based
    per_page: String(Math.min(limit, 500)),
  });

  if (searchField) params.set('field', searchField);

  const json = await fetchJson(`${BASE}/items/search?${params}`);
  const response = json?.nyplAPI?.response;
  const total = parseInt(response?.numResults ?? '0', 10);
  const rawResults = response?.result ?? [];

  const results = rawResults
    .filter((item) => item.imageID && item.typeOfResource === 'still image')
    .map((item) => ({
      sourceId: item.uuid,
      title: item.title || 'Untitled',
      artist: null, // not available in search response; requires MODS detail call
      date: null,   // not available in search response; requires MODS detail call
      thumbnailUrl: imageUrl(item.imageID, 'b'),
      imageUrl: imageUrl(item.imageID, 'w'),
      license: 'public domain',
      sourceUrl: item.itemLink?.replace(/^http:/, 'https:') || null,
      metadata: {
        typeOfResource: item.typeOfResource || null,
        imageID: item.imageID,
      },
    }));

  return { results, total, page, limit };
}

async function getById(sourceId) {
  const json = await fetchJson(`${BASE}/items/item_details/${sourceId}`);
  const response = json?.nyplAPI?.response;

  // item_details returns mods + sibling_captures
  const mods = response?.mods;
  const captures = response?.capture ?? response?.sibling_captures ?? [];

  if (!captures.length) return null;

  // Use the first capture that has imageLinks
  const capture = captures.find((c) => c.imageLinks?.imageLink?.length) ?? captures[0];
  if (!capture?.imageID) return null;

  // Extract title from MODS titleInfo
  const titleInfo = Array.isArray(mods?.titleInfo) ? mods.titleInfo : [mods?.titleInfo];
  const primaryTitle = titleInfo.find((t) => t?.usage === 'primary') ?? titleInfo[0];
  const title = primaryTitle?.title?.$ || 'Untitled';

  // Extract creator from MODS name
  const names = Array.isArray(mods?.name) ? mods.name : (mods?.name ? [mods.name] : []);
  const creator = names.find((n) => n?.role?.roleTerm?.$ === 'creator') ?? names[0];
  const artist = creator?.namePart?.$ ?? creator?.namePart?.[0]?.$ ?? null;

  // Extract date from MODS originInfo
  const dateCreated = mods?.originInfo?.dateCreated;
  const dateArr = Array.isArray(dateCreated) ? dateCreated : (dateCreated ? [dateCreated] : []);
  const date = dateArr.find((d) => d?.keyDate === 'yes')?.$
    ?? dateArr[0]?.$
    ?? null;

  return {
    sourceId,
    title,
    artist,
    date,
    thumbnailUrl: imageUrl(capture.imageID, 'b'),
    imageUrl: imageUrl(capture.imageID, 'w'),
    license: 'public domain',
    sourceUrl: capture.itemLink?.replace(/^http:/, 'https:') || null,
    metadata: {
      typeOfResource: 'still image',
      imageID: capture.imageID,
    },
  };
}

module.exports = {
  id: 'nypl',
  name: 'NYPL Digital Collections',
  search,
  getById,
};
