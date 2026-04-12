import { useState, useEffect, useCallback } from 'react';
import { api } from '../shared/api';
import SavePanel from './SavePanel';

const SOURCES = [
  { id: 'met', label: 'The Met' },
  { id: 'artic', label: 'Art Institute of Chicago' },
  { id: 'nypl', label: 'NYPL Digital Collections' },
];

const LIMIT = 20;

const EMPTY_FILTERS = {
  // Met
  departmentId: '',
  isHighlight: false,
  isOnView: false,
  medium: '',
  geoLocation: '',
  searchIn: '',
  // ARTIC
  artworkType: '',
  placeOfOrigin: '',
  // NYPL
  searchField: '',
  // shared
  dateBegin: '',
  dateEnd: '',
};

export default function SearchView() {
  const [source, setSource] = useState('met');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState({});
  const [panelResult, setPanelResult] = useState(null);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [artworkTypes, setArtworkTypes] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (source === 'met') {
      api.getDepartments('met').then(setDepartments).catch(() => {});
    } else if (source === 'artic') {
      api.getArtworkTypes('artic').then(setArtworkTypes).catch(() => {});
    }
  }, [source]);

  const doSearch = useCallback(async (pageNum = 0, currentQuery = query, currentFilters = filters) => {
    if (!currentQuery.trim()) return;
    setLoading(true);
    setError(null);

    const options = { page: pageNum, limit: LIMIT };

    if (source === 'met') {
      if (currentFilters.departmentId) options.departmentId = currentFilters.departmentId;
      if (currentFilters.isHighlight) options.isHighlight = true;
      if (currentFilters.isOnView) options.isOnView = true;
      if (currentFilters.medium) options.medium = currentFilters.medium;
      if (currentFilters.geoLocation) options.geoLocation = currentFilters.geoLocation;
      if (currentFilters.searchIn) options.searchIn = currentFilters.searchIn;
    } else if (source === 'artic') {
      if (currentFilters.artworkType) options.artworkType = currentFilters.artworkType;
      if (currentFilters.placeOfOrigin) options.placeOfOrigin = currentFilters.placeOfOrigin;
    } else if (source === 'nypl') {
      if (currentFilters.searchField) options.searchField = currentFilters.searchField;
    }
    // date range applies to both sources
    if (currentFilters.dateBegin) options.dateBegin = currentFilters.dateBegin;
    if (currentFilters.dateEnd) options.dateEnd = currentFilters.dateEnd;

    try {
      const data = await api.search(currentQuery.trim(), source, options);
      setResults(data.results);
      setTotal(data.total);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [source, query, filters]);

  function handleSearch(e) {
    e.preventDefault();
    doSearch(0);
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleSourceChange(s) {
    setSource(s);
    setResults([]);
    setTotal(0);
    setPage(0);
    setFilters(EMPTY_FILTERS);
  }

  const activeFilterCount = [
    // Met
    source === 'met' && filters.departmentId,
    source === 'met' && filters.isHighlight,
    source === 'met' && filters.isOnView,
    source === 'met' && filters.medium,
    source === 'met' && filters.geoLocation,
    source === 'met' && filters.searchIn,
    // ARTIC
    source === 'artic' && filters.artworkType,
    source === 'artic' && filters.placeOfOrigin,
    // NYPL
    source === 'nypl' && filters.searchField,
    // shared
    filters.dateBegin || filters.dateEnd,
  ].filter(Boolean).length;

  async function handleSave(result, { projectId, newProjectName, tags, templateTypes, blendModes }) {
    let resolvedProjectId = projectId;

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

  const hasPrev = page > 0;
  const hasNext = (page + 1) * LIMIT < total;
  const rangeStart = total > 0 ? page * LIMIT + 1 : 0;
  const rangeEnd = page * LIMIT + results.length;

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
                  onChange={() => handleSourceChange(s.id)}
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
            <button
              type="button"
              style={{ ...styles.filterBtn, ...(activeFilterCount > 0 ? styles.filterBtnActive : {}) }}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {filtersOpen && (
            <div style={styles.filterPanel}>
              <div style={styles.filterGrid}>

                {source === 'met' && (<>
                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Search in</label>
                    <select
                      style={styles.filterSelect}
                      value={filters.searchIn}
                      onChange={(e) => setFilter('searchIn', e.target.value)}
                    >
                      <option value="">All fields (default)</option>
                      <option value="title">Title only</option>
                      <option value="tags">Subject tags</option>
                    </select>
                  </div>

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Department</label>
                    <select
                      style={styles.filterSelect}
                      value={filters.departmentId}
                      onChange={(e) => setFilter('departmentId', e.target.value)}
                    >
                      <option value="">All departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Medium</label>
                    <input
                      style={styles.filterInput}
                      type="text"
                      placeholder="e.g. Paintings"
                      value={filters.medium}
                      onChange={(e) => setFilter('medium', e.target.value)}
                    />
                  </div>

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Geographic location</label>
                    <input
                      style={styles.filterInput}
                      type="text"
                      placeholder="e.g. France"
                      value={filters.geoLocation}
                      onChange={(e) => setFilter('geoLocation', e.target.value)}
                    />
                  </div>

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Options</label>
                    <div style={styles.checkboxGroup}>
                      <label style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={filters.isHighlight}
                          onChange={(e) => setFilter('isHighlight', e.target.checked)}
                        />
                        {' '}Highlights only
                      </label>
                      <label style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={filters.isOnView}
                          onChange={(e) => setFilter('isOnView', e.target.checked)}
                        />
                        {' '}On view
                      </label>
                    </div>
                  </div>
                </>)}

                {source === 'artic' && (<>
                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Artwork type</label>
                    <select
                      style={styles.filterSelect}
                      value={filters.artworkType}
                      onChange={(e) => setFilter('artworkType', e.target.value)}
                    >
                      <option value="">All types</option>
                      {artworkTypes.map((t) => (
                        <option key={t.id} value={t.title}>{t.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Place of origin</label>
                    <input
                      style={styles.filterInput}
                      type="text"
                      placeholder="e.g. France"
                      value={filters.placeOfOrigin}
                      onChange={(e) => setFilter('placeOfOrigin', e.target.value)}
                    />
                  </div>
                </>)}

                {source === 'nypl' && (
                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Search in</label>
                    <select
                      style={styles.filterSelect}
                      value={filters.searchField}
                      onChange={(e) => setFilter('searchField', e.target.value)}
                    >
                      <option value="">All fields (default)</option>
                      <option value="title">Title only</option>
                    </select>
                  </div>
                )}

                <div style={styles.filterField}>
                  <label style={styles.filterLabel}>Date range</label>
                  <div style={styles.dateRange}>
                    <input
                      style={{ ...styles.filterInput, width: 90 }}
                      type="number"
                      placeholder="From"
                      value={filters.dateBegin}
                      onChange={(e) => setFilter('dateBegin', e.target.value)}
                    />
                    <span style={styles.dateSep}>–</span>
                    <input
                      style={{ ...styles.filterInput, width: 90 }}
                      type="number"
                      placeholder="To"
                      value={filters.dateEnd}
                      onChange={(e) => setFilter('dateEnd', e.target.value)}
                    />
                  </div>
                </div>

              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  style={styles.clearBtn}
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {results.length > 0 && (
        <>
          <div style={styles.grid}>
            {results.map((result) => {
              const state = saved[result.sourceId];
              return (
                <div key={result.sourceId} style={styles.card}>
                  <div style={styles.thumb}>
                    {result.sourceUrl ? (
                      <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" style={styles.imgLink}>
                        <img src={result.thumbnailUrl} alt={result.title} style={styles.img} loading="lazy" />
                      </a>
                    ) : (
                      <img src={result.thumbnailUrl} alt={result.title} style={styles.img} loading="lazy" />
                    )}
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

          <div style={styles.pagination}>
            <button
              style={styles.pageBtn}
              disabled={!hasPrev || loading}
              onClick={() => doSearch(page - 1)}
            >
              ← Prev
            </button>
            <span style={styles.pageInfo}>
              {rangeStart}–{rangeEnd} of ~{total.toLocaleString()}
            </span>
            <button
              style={styles.pageBtn}
              disabled={!hasNext || loading}
              onClick={() => doSearch(page + 1)}
            >
              Next →
            </button>
          </div>
        </>
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
  filterBtn: {
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    background: '#f0ede6',
    color: '#1a1a1a',
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterBtnActive: {
    background: '#1a1a1a',
    color: '#fff',
    borderColor: '#1a1a1a',
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
    whiteSpace: 'nowrap',
  },
  filterPanel: {
    background: '#faf9f7',
    border: '1px solid #e0ddd6',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  filterField: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em' },
  filterSelect: {
    padding: '7px 10px',
    fontSize: 13,
    border: '1px solid #d0cdc6',
    borderRadius: 5,
    background: '#fff',
  },
  filterInput: {
    padding: '7px 10px',
    fontSize: 13,
    border: '1px solid #d0cdc6',
    borderRadius: 5,
    background: '#fff',
  },
  dateRange: { display: 'flex', alignItems: 'center', gap: 6 },
  dateSep: { color: '#999', fontSize: 13 },
  checkboxGroup: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
  clearBtn: {
    alignSelf: 'flex-start',
    padding: '5px 12px',
    fontSize: 12,
    background: 'none',
    border: '1px solid #d0cdc6',
    borderRadius: 5,
    cursor: 'pointer',
    color: '#555',
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
  imgLink: { display: 'block', width: '100%', height: '100%' },
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
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 32,
    paddingBottom: 32,
  },
  pageBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    background: '#f0ede6',
    color: '#1a1a1a',
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    cursor: 'pointer',
  },
  pageInfo: { fontSize: 13, color: '#666' },
};
