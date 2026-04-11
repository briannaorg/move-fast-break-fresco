const BASE = 'https://api.artic.edu/api/v1';
const AIC_UA = 'Fresco/1.0 (museum image curation; https://github.com/fresco)';
const FIELDS = 'id,title,artist_display,date_display,image_id,is_public_domain,artwork_type_title,place_of_origin';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'AIC-User-Agent': AIC_UA } });
  if (!res.ok) throw new Error(`ARTIC API error: ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'AIC-User-Agent': AIC_UA },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ARTIC API error: ${res.status}`);
  return res.json();
}

function imageUrl(imageId, width) {
  return `https://www.artic.edu/iiif/2/${imageId}/full/${width},/0/default.jpg`;
}

function artworkWebUrl(id) {
  return `https://www.artic.edu/artworks/${id}`;
}

async function getArtworkTypes() {
  const data = await fetchJson(`${BASE}/artwork-types?limit=100&fields=id,title`);
  return (data.data || []).map((t) => ({ id: t.id, title: t.title })).sort((a, b) => a.title.localeCompare(b.title));
}

async function search(query, options = {}) {
  const {
    page = 0,
    limit = 20,
    artworkType,
    placeOfOrigin,
    dateBegin,
    dateEnd,
  } = options;

  // Build Elasticsearch bool must clauses
  const must = [{ term: { is_public_domain: true } }];
  if (artworkType) must.push({ match: { artwork_type_title: artworkType } });
  if (placeOfOrigin) must.push({ match: { place_of_origin: placeOfOrigin } });
  if (dateBegin != null && dateBegin !== '') must.push({ range: { date_start: { gte: parseInt(dateBegin) } } });
  if (dateEnd != null && dateEnd !== '') must.push({ range: { date_end: { lte: parseInt(dateEnd) } } });

  const body = {
    q: query,
    query: { bool: { must } },
    fields: FIELDS,
    limit,
    page: page + 1, // ARTIC is 1-based
  };

  const json = await postJson(`${BASE}/artworks/search`, body);
  const total = json.pagination?.total ?? 0;

  const results = (json.data || [])
    .filter((art) => art.image_id)
    .map((art) => ({
      sourceId: String(art.id),
      title: art.title || 'Untitled',
      artist: art.artist_display || null,
      date: art.date_display || null,
      thumbnailUrl: imageUrl(art.image_id, 200),
      imageUrl: imageUrl(art.image_id, 843),
      license: 'public domain',
      sourceUrl: artworkWebUrl(art.id),
      metadata: {
        artworkType: art.artwork_type_title || null,
        placeOfOrigin: art.place_of_origin || null,
      },
    }));

  return { results, total, page, limit };
}

async function getById(sourceId) {
  const json = await fetchJson(`${BASE}/artworks/${sourceId}?fields=${FIELDS}`);
  const art = json.data;

  if (!art || !art.is_public_domain || !art.image_id) return null;

  return {
    sourceId: String(art.id),
    title: art.title || 'Untitled',
    artist: art.artist_display || null,
    date: art.date_display || null,
    thumbnailUrl: imageUrl(art.image_id, 200),
    imageUrl: imageUrl(art.image_id, 843),
    license: 'public domain',
    sourceUrl: artworkWebUrl(art.id),
    metadata: {
      artworkType: art.artwork_type_title || null,
      placeOfOrigin: art.place_of_origin || null,
    },
  };
}

module.exports = {
  id: 'artic',
  name: 'Art Institute of Chicago',
  search,
  getById,
  getArtworkTypes,
};
