// Renders one subsection per entry in theme.json.layers.
// Shows a thumbnail grid of images filtered by layer.accepts tags.
// Falls back to all images if no tag matches.

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-burn', 'luminosity'];

export default function LayersPanel({ layers, assignments, images, onAssign }) {
  if (!layers || !Object.keys(layers).length) {
    return <p style={s.empty}>No layers defined in this template.</p>;
  }

  return (
    <div style={s.root}>
      {Object.entries(layers).map(([key, def]) => (
        <LayerSection
          key={key}
          layerKey={key}
          def={def}
          assignment={assignments[key] || null}
          images={images}
          onAssign={onAssign}
        />
      ))}
    </div>
  );
}

function LayerSection({ layerKey, def, assignment, images, onAssign }) {
  const accepts = def.accepts || [];

  // Filter by accepted tags; fall back to all ready images
  const filtered = accepts.length
    ? images.filter(
        (img) =>
          img.status === 'ready' &&
          img.tags &&
          img.tags.some((t) => accepts.includes(t))
      )
    : images.filter((img) => img.status === 'ready');

  const displayImages = filtered.length ? filtered : images.filter((img) => img.status === 'ready');

  const selectedId = assignment?.imageId ?? null;
  const blendMode = assignment?.blendMode ?? 'normal';

  function thumb(img) {
    const t = img.variants?.find((v) => v.variant_type === 'thumbnail');
    return t?.path || img.original_path || '';
  }

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionLabel}>{def.label}</span>
        {def.required && <span style={s.required}>required</span>}
      </div>

      {displayImages.length === 0 ? (
        <p style={s.empty}>No saved images yet. Save some in Arriccio first.</p>
      ) : (
        <div style={s.grid}>
          {displayImages.map((img) => {
            const isSelected = img.id === selectedId;
            return (
              <button
                key={img.id}
                onClick={() => onAssign(layerKey, img.id, blendMode)}
                style={{
                  ...s.thumb,
                  ...(isSelected ? s.thumbSelected : {}),
                }}
                title={img.title || `Image ${img.id}`}
              >
                {thumb(img) ? (
                  <img src={thumb(img)} alt={img.title || ''} style={s.thumbImg} />
                ) : (
                  <div style={s.thumbPlaceholder} />
                )}
                {isSelected && <div style={s.checkmark}>✓</div>}
              </button>
            );
          })}
        </div>
      )}

      {/* Blend mode — only if there's a selection and layer has blend support */}
      {selectedId && def.behavior !== 'fill' && (
        <div style={s.blendRow}>
          <label style={s.blendLabel}>Blend mode</label>
          <select
            value={blendMode}
            onChange={(e) => onAssign(layerKey, selectedId, e.target.value)}
            style={s.select}
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Clear button */}
      {selectedId && (
        <button style={s.clearBtn} onClick={() => onAssign(layerKey, null, null)}>
          Clear layer
        </button>
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 24 },
  section: { paddingBottom: 20, borderBottom: '1px solid #ece9e2' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 13, fontWeight: 600 },
  required: { fontSize: 10, color: '#888', background: '#ece9e2', padding: '1px 5px', borderRadius: 3 },
  empty: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    marginBottom: 10,
  },
  thumb: {
    position: 'relative',
    aspectRatio: '1',
    border: '2px solid transparent',
    borderRadius: 4,
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#e8e5de',
    padding: 0,
  },
  thumbSelected: {
    border: '2px solid #1a1a1a',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    background: '#ddd',
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    background: '#1a1a1a',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
  },
  blendRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  blendLabel: { fontSize: 12, color: '#666', minWidth: 72 },
  select: {
    flex: 1,
    fontSize: 12,
    padding: '4px 6px',
    border: '1px solid #d0cdc6',
    borderRadius: 4,
    background: '#fff',
  },
  clearBtn: {
    fontSize: 11,
    color: '#999',
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: 4,
    padding: '3px 8px',
    cursor: 'pointer',
    marginTop: 4,
  },
};
