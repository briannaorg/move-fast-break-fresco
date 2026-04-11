async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  search: (q, source) => request(`/api/search?q=${encodeURIComponent(q)}&source=${source}`),
  getImages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/images${qs ? `?${qs}` : ''}`);
  },
  getImage: (id) => request(`/api/images/${id}`),
  saveImage: (body) => request('/api/images', { method: 'POST', body }),
  setTags: (id, tags) => request(`/api/images/${id}/tags`, { method: 'POST', body: { tags } }),
  getProjects: () => request('/api/projects'),
  createProject: (name) => request('/api/projects', { method: 'POST', body: { name } }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),
};
