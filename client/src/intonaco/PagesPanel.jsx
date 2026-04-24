import { useState } from 'react';
import { api } from '../shared/api';

export default function PagesPanel({ projectId, pages, activePage, onPagesChange, onPageSelect }) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const page = await api.createPage(projectId, name);
      onPagesChange((prev) => [...prev, page]);
      setNewName('');
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(page) {
    if (!window.confirm(`Delete page "${page.page_name}"?`)) return;
    await api.deletePage(projectId, page.id);
    const next = pages.filter((p) => p.id !== page.id);
    onPagesChange(next);
    if (activePage?.id === page.id && next.length) {
      onPageSelect(next[0]);
    }
  }

  async function handleMove(page, dir) {
    const idx = pages.findIndex((p) => p.id === page.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;
    const reordered = [...pages];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    onPagesChange(reordered);
    await api.reorderPages(projectId, reordered.map((p) => p.id));
  }

  return (
    <div style={s.root}>
      <p style={s.label}>Pages</p>

      <div style={s.list}>
        {pages.map((page, idx) => (
          <div
            key={page.id}
            style={{ ...s.row, ...(activePage?.id === page.id ? s.rowActive : {}) }}
            onClick={() => onPageSelect(page)}
          >
            <span style={s.pageName}>{page.page_name}</span>
            <div style={s.rowActions} onClick={(e) => e.stopPropagation()}>
              <button style={s.arrowBtn} onClick={() => handleMove(page, -1)} disabled={idx === 0} title="Move up">↑</button>
              <button style={s.arrowBtn} onClick={() => handleMove(page, 1)} disabled={idx === pages.length - 1} title="Move down">↓</button>
              <button style={s.deleteBtn} onClick={() => handleDelete(page)} title="Delete page">×</button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} style={s.addForm}>
        <input
          style={s.input}
          type="text"
          placeholder="New page name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={adding || !newName.trim()} style={s.addBtn}>
          {adding ? '…' : '+'}
        </button>
      </form>
    </div>
  );
}

const s = {
  root: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 0' },
  label: { fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 20px', marginBottom: 6 },
  list: { flex: 1, overflowY: 'auto' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 20px', cursor: 'pointer', borderLeft: '3px solid transparent',
  },
  rowActive: { background: '#f0ede6', borderLeft: '3px solid #1a1a1a' },
  pageName: { fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowActions: { display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' },
  arrowBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 12, padding: '2px 4px' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 14, padding: '2px 4px' },
  addForm: { display: 'flex', gap: 6, padding: '10px 20px', borderTop: '1px solid #e0ddd6' },
  input: { flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid #d0cdc6', borderRadius: 4, background: '#fff' },
  addBtn: { padding: '5px 10px', fontSize: 14, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
};
