import { useState } from 'react';

const TEMPLATE_TYPES = [
  'background', 'ornament', 'frame', 'particle',
  'foreground', 'border', 'icon', 'capital', 'other',
];

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay',
  'hard-light', 'soft-light', 'all',
];

export default function SavePanel({ result, projects, onSave, onClose }) {
  const [projectId, setProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [templateTypes, setTemplateTypes] = useState([]);
  const [blendModes, setBlendModes] = useState([]);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleItem(list, setList, value) {
    setList((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setSaving(true);
    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    let resolvedProjectId = projectId === '__new__' ? null : (projectId ? parseInt(projectId, 10) : null);

    await onSave(result, {
      projectId: resolvedProjectId,
      newProjectName: projectId === '__new__' ? newProjectName.trim() : null,
      tags: parsedTags,
      templateTypes,
      blendModes,
    });
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        <button style={styles.closeBtn} onClick={onClose}>×</button>

        <div style={styles.body}>
          {/* Left: image preview */}
          <div style={styles.preview}>
            <img src={result.thumbnailUrl} alt={result.title} style={styles.previewImg} />
            <p style={styles.previewTitle}>{result.title}</p>
            {result.artist && <p style={styles.previewSub}>{result.artist}</p>}
            {result.date && <p style={styles.previewDate}>{result.date}</p>}
          </div>

          {/* Right: options */}
          <div style={styles.options}>
            {/* Project */}
            <div style={styles.field}>
              <label style={styles.label}>Project</label>
              <select
                style={styles.select}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="__new__">New project…</option>
              </select>
              {projectId === '__new__' && (
                <input
                  style={{ ...styles.input, marginTop: 8 }}
                  type="text"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {/* Template type */}
            <div style={styles.field}>
              <label style={styles.label}>Template Type</label>
              <div style={styles.checkGrid}>
                {TEMPLATE_TYPES.map((type) => (
                  <label key={type} style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={templateTypes.includes(type)}
                      onChange={() => toggleItem(templateTypes, setTemplateTypes, type)}
                    />
                    {' '}{type}
                  </label>
                ))}
              </div>
            </div>

            {/* CSS Blend */}
            <div style={styles.field}>
              <label style={styles.label}>CSS Blend</label>
              <div style={styles.checkGrid}>
                {BLEND_MODES.map((mode) => (
                  <label key={mode} style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={blendModes.includes(mode)}
                      onChange={() => toggleItem(blendModes, setBlendModes, mode)}
                    />
                    {' '}{mode}
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div style={styles.field}>
              <label style={styles.label}>Tags</label>
              <input
                style={styles.input}
                type="text"
                placeholder="garden, floral, blue…"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button
            style={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || (projectId === '__new__' && !newProjectName.trim())}
          >
            {saving ? 'Saving…' : 'Save to Library'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  panel: {
    background: '#fff',
    borderRadius: 10,
    width: '100%',
    maxWidth: 760,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: '#666',
    lineHeight: 1,
  },
  body: {
    display: 'flex',
    gap: 24,
    padding: 24,
    overflowY: 'auto',
    flex: 1,
  },
  preview: {
    width: 180,
    flexShrink: 0,
  },
  previewImg: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: 6,
    background: '#f0ede6',
    display: 'block',
    marginBottom: 10,
  },
  previewTitle: { fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 },
  previewSub: { fontSize: 12, color: '#666', marginBottom: 2 },
  previewDate: { fontSize: 11, color: '#999' },
  options: { flex: 1, display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555' },
  select: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
  },
  input: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
    width: '100%',
  },
  checkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px 12px',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 24px',
    borderTop: '1px solid #e0ddd6',
  },
  cancelBtn: {
    padding: '9px 18px',
    fontSize: 14,
    border: '1px solid #d0cdc6',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 20px',
    fontSize: 14,
    fontWeight: 600,
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
