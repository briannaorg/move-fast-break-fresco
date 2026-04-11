const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Met API error: ${res.status}`);
  return res.json();
}

async function getDepartments() {
  const data = await fetchJson(`${BASE}/departments`);
  return (data.departments || []).map((d) => ({ id: d.departmentId, name: d.displayName }));
}

async function search(query, options = {}) {
  const {
    page = 0,
    limit = 20,
    departmentId,
    isHighlight,
    isOnView,
    medium,
    dateBegin,
    dateEnd,
    geoLocation,
    searchIn,
  } = options;

  const params = new URLSearchParams({
    q: query,
    isPublicDomain: 'true',
    hasImages: 'true',
  });
  if (searchIn === 'title') params.set('title', 'true');
  if (searchIn === 'tags') params.set('tags', 'true');
  if (departmentId) params.set('departmentId', String(departmentId));
  if (isHighlight) params.set('isHighlight', 'true');
  if (isOnView) params.set('isOnView', 'true');
  if (medium) params.set('medium', medium);
  if (dateBegin != null && dateEnd != null) {
    params.set('dateBegin', String(dateBegin));
    params.set('dateEnd', String(dateEnd));
  }
  if (geoLocation) params.set('geoLocation', geoLocation);

  const data = await fetchJson(`${BASE}/search?${params}`);
  const allIds = data.objectIDs || [];
  const total = allIds.length;

  const start = page * limit;
  const pageIds = allIds.slice(start, start + limit);

  if (pageIds.length === 0) return { results: [], total, page, limit };

  const results = [];
  for (let i = 0; i < pageIds.length; i += 5) {
    const batch = pageIds.slice(i, i + 5);
    const settled = await Promise.allSettled(batch.map((id) => getById(String(id))));
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        results.push(outcome.value);
      }
    }
  }

  return { results, total, page, limit };
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
  getDepartments,
};
