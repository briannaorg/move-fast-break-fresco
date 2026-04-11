import { useState, useEffect, useCallback } from 'react';
import { api } from '../shared/api';

const STATUS_COLORS = {
  pending: '#f0ad4e',
  processing: '#5bc0de',
  ready: '#5cb85c',
  error: '#d9534f',
};

export default function LibraryView() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState('');
  const [tagInputs, setTagInputs] = useState({});

  const load = useCallback(async () => {
    try {
      const params = filterTag ? { tag: filterTag } : {};
      const data = await api.getImages(params);
      setImages(data);
      const inputs = {};
      for (const img of data) inputs[img.id] = (img.tags || []).join(', ');
      setTagInputs(inputs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterTag]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Poll for status changes on pending/processing images
  useEffect(() => {
    const needsPoll = images.some((img) => img.status === 'pending' || img.status === 'processing');
    if (!needsPoll) return;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [images, load]);

  async function handleTagBlur(imageId) {
    const raw = tagInputs[imageId] || '';
    const tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      const result = await api.setTags(imageId, tags);
      setImages((imgs) =>
        imgs.map((img) => (img.id === imageId ? { ...img, tags: result.tags } : img))
      );
    } catch (err) {
      console.error('Failed to save tags:', err);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Library</h1>
        <div style={styles.filterRow}>
          <input
            style={styles.filterInput}
            type="text"
            placeholder="Filter by tag…"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          />
          {filterTag && (
            <button style={styles.clearBtn} onClick={() => setFilterTag('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && <p style={styles.dim}>Loading…</p>}

      {!loading && images.length === 0 && (
        <p style={styles.empty}>
          {filterTag ? `No images tagged "${filterTag}".` : 'No saved images yet. Search to add some.'}
        </p>
      )}

      <div style={styles.grid}>
        {images.map((img) => {
          const thumb = img.variants?.find((v) => v.variant_type === 'thumbnail');
          const src = thumb ? thumb.path : null;

          return (
            <div key={img.id} style={styles.card}>
              <div style={styles.thumbWrap}>
                {src ? (
                  <img src={src} alt={img.title} style={styles.img} loading="lazy" />
                ) : (
                  <div style={styles.placeholder} />
                )}
                <span
                  style={{
                    ...styles.badge,
                    background: STATUS_COLORS[img.status] || '#999',
                  }}
                >
                  {img.status}
                </span>
              </div>

              <div style={styles.info}>
                <p style={styles.cardTitle}>{img.title || 'Untitled'}</p>
                {img.artist && <p style={styles.cardSub}>{img.artist}</p>}

                {img.palette?.length > 0 && (
                  <div style={styles.palette}>
                    {img.palette.map((hex) => (
                      <span
                        key={hex}
                        title={hex}
                        style={{ ...styles.swatch, background: hex }}
                      />
                    ))}
                  </div>
                )}

                <input
                  style={styles.tagInput}
                  type="text"
                  placeholder="Add tags, comma-separated…"
                  value={tagInputs[img.id] ?? ''}
                  onChange={(e) =>
                    setTagInputs((prev) => ({ ...prev, [img.id]: e.target.value }))
                  }
                  onBlur={() => handleTagBlur(img.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 16 },
  filterRow: { display: 'flex', gap: 8, alignItems: 'center' },
  filterInput: {
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
    width: 240,
  },
  clearBtn: {
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
  },
  dim: { color: '#999' },
  empty: { color: '#999', textAlign: 'center', marginTop: 64 },
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
  thumbWrap: { position: 'relative', aspectRatio: '1', background: '#f0ede6' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: { width: '100%', height: '100%', background: '#ede9e1' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  info: { padding: '10px 12px 12px' },
  cardTitle: { fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#666', marginBottom: 8 },
  palette: { display: 'flex', gap: 4, marginBottom: 10 },
  swatch: { width: 16, height: 16, borderRadius: 3, display: 'inline-block' },
  tagInput: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 12,
    border: '1px solid #e0ddd6',
    borderRadius: 4,
    background: '#faf9f7',
    color: '#1a1a1a',
  },
};
