import { useState, useEffect } from 'react';
import { api } from '../shared/api';

export default function ProjectsList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.getProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const project = await api.createProject(newName.trim());
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
        <button style={styles.createBtn} type="submit" disabled={creating || !newName.trim()}>
          {creating ? 'Creating…' : 'Create Project'}
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
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
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
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 640, margin: '0 auto', padding: 24 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  desc: { color: '#666', fontSize: 14, marginBottom: 28 },
  createForm: { display: 'flex', gap: 8, marginBottom: 32 },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
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
  list: { display: 'flex', flexDirection: 'column', gap: 1 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: '#fff',
    border: '1px solid #e0ddd6',
    borderRadius: 6,
    marginBottom: 6,
  },
  projectName: { fontSize: 15, fontWeight: 600, marginBottom: 2 },
  projectMeta: { fontSize: 12, color: '#999' },
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
