import { useState, useEffect } from 'react';
import { api } from '../shared/api';
import SavePanel from './SavePanel';

const SOURCES = [
  { id: 'met', label: 'The Met' },
  { id: 'artic', label: 'Art Institute of Chicago' },
];

export default function SearchView() {
  const [source, setSource] = useState('met');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState({}); // sourceId → 'saved'
  const [panelResult, setPanelResult] = useState(null); // result being saved
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await api.search(query.trim(), source);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(result, { projectId, newProjectName, tags, templateTypes, blendModes }) {
    let resolvedProjectId = projectId;

    // Create a new project on the fly if requested
    if (newProjectName) {
      try {
        const project = await api.createProject(newProjectName);
        setProjects((prev) => [...prev, project]);
        resolvedProjectId = project.id;
      } catch (err) {
        console.error('Failed to create project:', err);
      }
    }

    try {
      await api.saveImage({
        sourceId: result.sourceId,
        source,
        title: result.title,
        artist: result.artist,
        date: result.date,
        imageUrl: result.imageUrl,
        sourceUrl: result.sourceUrl,
        metadata: result.metadata,
        projectId: resolvedProjectId || undefined,
        tags,
        templateTypes,
        blendModes,
      });
      setSaved((s) => ({ ...s, [result.sourceId]: 'saved' }));
    } catch (err) {
      setSaved((s) => ({ ...s, [result.sourceId]: 'error' }));
    } finally {
      setPanelResult(null);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Search</h1>
        <form onSubmit={handleSearch} style={styles.form}>
          <div style={styles.sourceRow}>
            {SOURCES.map((s) => (
              <label key={s.id} style={styles.sourceLabel}>
                <input
                  type="radio"
                  name="source"
                  value={s.id}
                  checked={source === s.id}
                  onChange={() => setSource(s.id)}
                />
                {' '}{s.label}
              </label>
            ))}
          </div>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              type="text"
              placeholder="Search for artwork…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {results.length > 0 && (
        <div style={styles.grid}>
          {results.map((result) => {
            const state = saved[result.sourceId];
            return (
              <div key={result.sourceId} style={styles.card}>
                <div style={styles.thumb}>
                  <img
                    src={result.thumbnailUrl}
                    alt={result.title}
                    style={styles.img}
                    loading="lazy"
                  />
                </div>
                <div style={styles.info}>
                  <p style={styles.cardTitle}>{result.title}</p>
                  {result.artist && <p style={styles.cardSub}>{result.artist}</p>}
                  {result.date && <p style={styles.cardDate}>{result.date}</p>}
                </div>
                <button
                  style={{
                    ...styles.saveBtn,
                    ...(state === 'saved' ? styles.savedBtn : {}),
                    ...(state === 'error' ? styles.errorBtn : {}),
                  }}
                  onClick={() => !state && setPanelResult(result)}
                  disabled={!!state}
                >
                  {state === 'saved' ? 'Saved' : state === 'error' ? 'Error' : 'Save…'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && results.length === 0 && query && (
        <p style={styles.empty}>No results found.</p>
      )}

      {panelResult && (
        <SavePanel
          result={panelResult}
          projects={projects}
          onSave={handleSave}
          onClose={() => setPanelResult(null)}
        />
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  sourceRow: { display: 'flex', gap: 20 },
  sourceLabel: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 },
  inputRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 15,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
    outline: 'none',
  },
  btn: {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  error: { color: '#c0392b', marginBottom: 16 },
  empty: { color: '#999', textAlign: 'center', marginTop: 48 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #e0ddd6',
    display: 'flex',
    flexDirection: 'column',
  },
  thumb: { aspectRatio: '1', background: '#f0ede6', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  info: { padding: '10px 12px', flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#666', marginBottom: 2 },
  cardDate: { fontSize: 11, color: '#999' },
  saveBtn: {
    margin: '0 12px 12px',
    padding: '8px 0',
    fontSize: 13,
    fontWeight: 600,
    background: '#f0ede6',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  savedBtn: { background: '#d4edda', color: '#155724', cursor: 'default' },
  errorBtn: { background: '#f8d7da', color: '#721c24', cursor: 'default' },
};
