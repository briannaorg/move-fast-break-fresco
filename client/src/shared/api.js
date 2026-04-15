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
  search: (q, source, options = {}) => {
    const params = new URLSearchParams({ q, source });
    Object.entries(options).forEach(([k, v]) => v != null && v !== '' && v !== false && params.set(k, v));
    return request(`/api/search?${params}`);
  },
  getDepartments: (source) => request(`/api/search/departments?source=${source}`),
  getArtworkTypes: (source) => request(`/api/search/artwork-types?source=${source}`),
  getImages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/images${qs ? `?${qs}` : ''}`);
  },
  getImage: (id) => request(`/api/images/${id}`),
  saveImage: (body) => request('/api/images', { method: 'POST', body }),
  setTags: (id, tags) => request(`/api/images/${id}/tags`, { method: 'POST', body: { tags } }),
  getProjects: () => request('/api/projects'),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject: (name, templateId) => request('/api/projects', { method: 'POST', body: { name, templateId } }),
  updateProject: (id, body) => request(`/api/projects/${id}`, { method: 'PATCH', body }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  upsertLayer: (projectId, body) => request(`/api/projects/${projectId}/layers`, { method: 'POST', body }),
  getTemplates: () => request('/api/templates'),
  getTemplate: (id) => request(`/api/templates/${id}`),
};
