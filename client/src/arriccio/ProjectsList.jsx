import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function ProjectsList() {
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.getProjects(), api.getTemplates()])
      .then(([projs, tmpls]) => {
        setProjects(projs);
        setTemplates(tmpls);
        if (tmpls.length) setNewTemplate(tmpls[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const project = await api.createProject(newName.trim(), newTemplate || undefined);
      setProjects((prev) => [...prev, project]);
      setNewName('');
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Projects</h1>
      <p style={styles.desc}>Projects group saved images for a specific site you're building.</p>

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          type="text"
          placeholder="New project name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        {templates.length > 0 && (
          <select
            style={styles.templateSelect}
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button style={styles.createBtn} type="submit" disabled={creating || !newName.trim()}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {loading && <p style={styles.dim}>Loading…</p>}

      {!loading && projects.length === 0 && (
        <p style={styles.empty}>No projects yet. Create one above.</p>
      )}

      <div style={styles.list}>
        {projects.map((project) => (
          <div key={project.id} style={styles.row}>
            <div>
              <p style={styles.projectName}>{project.name}</p>
              <p style={styles.projectMeta}>
                {project.template_id ? `Template: ${project.template_id}` : 'No template'}
                {' · '}
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
            <div style={styles.actions}>
              <button
                style={styles.configureBtn}
                onClick={() => navigate(`/sinopia/${project.id}`)}
              >
                Configure →
              </button>
              <button
                style={styles.deleteBtn}
                onClick={() => {
                  if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                    handleDelete(project.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 680, margin: '0 auto', padding: 24 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  desc: { color: '#666', fontSize: 14, marginBottom: 28 },
  createForm: { display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' },
  input: {
    flex: 2,
    minWidth: 180,
    padding: '10px 14px',
    fontSize: 14,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
  },
  templateSelect: {
    flex: 1,
    minWidth: 140,
    padding: '10px 10px',
    fontSize: 13,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
  },
  createBtn: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  dim: { color: '#999' },
  empty: { color: '#999', textAlign: 'center', marginTop: 48 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: '#fff',
    border: '1px solid #e0ddd6',
    borderRadius: 6,
  },
  projectName: { fontSize: 15, fontWeight: 600, marginBottom: 2 },
  projectMeta: { fontSize: 12, color: '#999' },
  actions: { display: 'flex', gap: 8, alignItems: 'center' },
  configureBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#1a1a1a',
    background: 'none',
    border: '1px solid #c8c4bc',
    borderRadius: 5,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 12px',
    fontSize: 12,
    color: '#c0392b',
    background: 'none',
    border: '1px solid #e8c0bb',
    borderRadius: 5,
    cursor: 'pointer',
  },
};
