const BASE = 'https://api.artic.edu/api/v1';
const FIELDS = 'id,title,artist_display,date_display,image_id,is_public_domain,api_link';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ARTIC API error: ${res.status}`);
  return res.json();
}

function imageUrl(imageId, width) {
  return `https://www.artic.edu/iiif/2/${imageId}/full/${width},/0/default.jpg`;
}

async function search(query, options = {}) {
  const url =
    `${BASE}/artworks/search?q=${encodeURIComponent(query)}` +
    `&query[term][is_public_domain]=true&fields=${FIELDS}&limit=20`;

  const json = await fetchJson(url);
  return (json.data || [])
    .filter((art) => art.image_id)
    .map((art) => ({
      sourceId: String(art.id),
      title: art.title || 'Untitled',
      artist: art.artist_display || null,
      date: art.date_display || null,
      thumbnailUrl: imageUrl(art.image_id, 200),
      imageUrl: imageUrl(art.image_id, 843),
      license: 'public domain',
      sourceUrl: art.api_link || null,
      metadata: {},
    }));
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
    sourceUrl: art.api_link || null,
    metadata: {},
  };
}

module.exports = {
  id: 'artic',
  name: 'Art Institute of Chicago',
  search,
  getById,
};
