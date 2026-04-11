const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Met API error: ${res.status}`);
  return res.json();
}

async function search(query, options = {}) {
  const { data } = await fetchJson(`${BASE}/search?q=${encodeURIComponent(query)}&isPublicDomain=true`)
    .then((json) => ({ data: json }));

  const ids = (data.objectIDs || []).slice(0, 20);
  if (ids.length === 0) return [];

  const results = [];
  for (let i = 0; i < ids.length; i += 5) {
    const batch = ids.slice(i, i + 5);
    const settled = await Promise.allSettled(batch.map((id) => getById(String(id))));
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        results.push(outcome.value);
      }
    }
  }
  return results;
}

async function getById(sourceId) {
  const obj = await fetchJson(`${BASE}/objects/${sourceId}`);

  if (!obj.isPublicDomain) return null;
  if (!obj.primaryImage && !obj.primaryImageSmall) return null;

  return {
    sourceId: String(obj.objectID),
    title: obj.title || 'Untitled',
    artist: obj.artistDisplayName || null,
    date: obj.objectDate || null,
    thumbnailUrl: obj.primaryImageSmall || obj.primaryImage,
    imageUrl: obj.primaryImage || obj.primaryImageSmall,
    license: 'public domain',
    sourceUrl: obj.objectURL || null,
    metadata: {
      medium: obj.medium || null,
      department: obj.department || null,
      culture: obj.culture || null,
    },
  };
}

module.exports = {
  id: 'met',
  name: 'The Met',
  search,
  getById,
};
