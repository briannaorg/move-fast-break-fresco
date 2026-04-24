import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import LayersPanel from './LayersPanel';
import ColorsPanel from './ColorsPanel';
import TypographyPanel from './TypographyPanel';
import ComponentsPanel from './ComponentsPanel';

const AUTOSAVE_DELAY = 500;

export default function SinopiaView() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [template, setTemplate] = useState(null);
  const [layers, setLayers] = useState({}); // { layerName: { imageId, blendMode, imagePath } }
  const [customizations, setCustomizations] = useState({});
  const [allImages, setAllImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('layers');

  const iframeRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [proj, images] = await Promise.all([
          api.getProject(projectId),
          api.getImages(),
        ]);
        setProject(proj);
        setAllImages(images);

        // Build layers map from project_layers
        const layerMap = {};
        for (const l of proj.layers || []) {
          layerMap[l.layer_name] = { imageId: l.image_id, blendMode: l.blend_mode };
        }
        setLayers(layerMap);
        setCustomizations(proj.customizations || {});

        // Load template manifest
        if (proj.template_id) {
          const tmpl = await api.getTemplate(proj.template_id);
          setTemplate(tmpl);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((nextCustomizations) => {
    pendingSaveRef.current = nextCustomizations;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const toSave = pendingSaveRef.current;
      if (!toSave) return;
      setSaving(true);
      try {
        await api.updateProject(projectId, { customizations: toSave });
      } catch (err) {
        console.error('Autosave failed:', err);
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DELAY);
  }, [projectId]);

  // ── postMessage to iframe ─────────────────────────────────────────────────

  const sendVarsToIframe = useCallback((vars) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'UPDATE_CSS_VARS', vars }, '*');
  }, []);

  // ── Customization change handler ──────────────────────────────────────────

  function handleCustomizationChange(cssVarOrObj, value) {
    const updates = typeof cssVarOrObj === 'object' ? cssVarOrObj : { [cssVarOrObj]: value };
    const next = { ...customizations, ...updates };
    setCustomizations(next);
    sendVarsToIframe(updates);
    scheduleSave(next);
  }

  // ── Layer assignment ───────────────────────────────────────────────────────

  async function handleLayerAssign(layerName, imageId, blendMode) {
    const layerDef = template?.layers?.[layerName];
    try {
      await api.upsertLayer(projectId, { layerName, imageId, blendMode: blendMode || null });
      setLayers((prev) => ({
        ...prev,
        [layerName]: imageId ? { imageId, blendMode } : null,
      }));
      // Full iframe reload on image change
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    } catch (err) {
      console.error('Layer assign failed:', err);
    }
  }

  // ── Template selection (first-run) ────────────────────────────────────────

  async function handleSelectTemplate(templateId) {
    try {
      const updated = await api.updateProject(projectId, { templateId });
      const tmpl = await api.getTemplate(templateId);
      setProject(updated);
      setTemplate(tmpl);
    } catch (err) {
      console.error('Template selection failed:', err);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.loading}>
        <p>Loading project…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.loading}>
        <p style={{ color: '#c0392b' }}>Error: {error}</p>
        <button onClick={() => navigate('/arriccio/projects')} style={s.backBtn}>Back to Projects</button>
      </div>
    );
  }

  // First-run: no template assigned yet
  if (!project.template_id) {
    return <TemplateSelector projectId={projectId} onSelect={handleSelectTemplate} />;
  }

  if (!template) {
    return <div style={s.loading}><p>Loading template…</p></div>;
  }

  const previewUrl = `/preview/${projectId}`;

  const sections = [
    { id: 'layers', label: 'Layers' },
    { id: 'colors', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'components', label: 'Components' },
  ];

  // Palette from the background layer image (if any)
  const bgLayerKey = Object.keys(template.layers || {}).find((k) =>
    Object.values(template.colors || {}).some((c) => c.canUseFromPalette)
  );
  const bgImageId = bgLayerKey && layers[bgLayerKey]?.imageId;
  const bgImage = bgImageId ? allImages.find((img) => img.id === bgImageId) : null;
  const palette = bgImage?.palette || [];

  return (
    <div style={s.layout}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <button onClick={() => navigate('/arriccio/projects')} style={s.backLink}>
            ← Projects
          </button>
          <h2 style={s.projectName}>{project.name}</h2>
          <p style={s.templateName}>{template.name}</p>
          {saving && <p style={s.savingBadge}>Saving…</p>}
        </div>

        {/* Section tabs */}
        <div style={s.tabs}>
          {sections.map((sec) => (
            <button
              key={sec.id}
              style={{ ...s.tab, ...(activeSection === sec.id ? s.tabActive : {}) }}
              onClick={() => setActiveSection(sec.id)}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={s.panelContent}>
          {activeSection === 'layers' && (
            <LayersPanel
              layers={template.layers}
              assignments={layers}
              images={allImages}
              onAssign={handleLayerAssign}
            />
          )}
          {activeSection === 'colors' && (
            <ColorsPanel
              colors={template.colors}
              customizations={customizations}
              palette={palette}
              onChange={handleCustomizationChange}
            />
          )}
          {activeSection === 'typography' && (
            <TypographyPanel
              typography={template.typography}
              customizations={customizations}
              onChange={handleCustomizationChange}
            />
          )}
          {activeSection === 'components' && (
            <ComponentsPanel
              components={template.components}
              customizations={customizations}
              onChange={handleCustomizationChange}
            />
          )}
        </div>
      </div>

      {/* Preview pane */}
      <div style={s.previewPane}>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          style={s.iframe}
          title="Site preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}

// ── Template selector (first-run) ─────────────────────────────────────────────

function TemplateSelector({ projectId, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    api.getTemplates().then(setTemplates).finally(() => setLoading(false));
  }, []);

  async function choose(templateId) {
    setSelecting(true);
    await onSelect(templateId);
    setSelecting(false);
  }

  return (
    <div style={s.templateSel}>
      <h2 style={s.tSelTitle}>Choose a Template</h2>
      <p style={s.tSelDesc}>Select a template to start configuring your project.</p>
      {loading && <p>Loading…</p>}
      <div style={s.tSelGrid}>
        {templates.map((t) => (
          <button
            key={t.id}
            style={s.tSelCard}
            onClick={() => choose(t.id)}
            disabled={selecting}
          >
            <p style={s.tSelCardName}>{t.name}</p>
            <p style={s.tSelCardDesc}>{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  layout: {
    display: 'flex',
    height: 'calc(100vh - 48px)', // subtract nav height
    overflow: 'hidden',
  },
  sidebar: {
    width: 300,
    minWidth: 260,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e0ddd6',
    background: '#faf9f6',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid #e0ddd6',
  },
  backLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#888',
    fontSize: 12,
    padding: 0,
    marginBottom: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 2,
  },
  templateName: {
    fontSize: 12,
    color: '#999',
  },
  savingBadge: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e0ddd6',
  },
  tab: {
    flex: 1,
    padding: '10px 4px',
    fontSize: 12,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    color: '#888',
  },
  tabActive: {
    color: '#1a1a1a',
    borderBottom: '2px solid #1a1a1a',
  },
  panelContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  },
  previewPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a1a',
    overflow: 'hidden',
  },
  iframe: {
    flex: 1,
    width: '100%',
    border: 'none',
    background: '#fff',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: 16,
    color: '#666',
  },
  backBtn: {
    padding: '8px 16px',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 13,
  },
  // Template selector
  templateSel: {
    maxWidth: 640,
    margin: '64px auto',
    padding: '0 24px',
  },
  tSelTitle: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  tSelDesc: { color: '#666', fontSize: 14, marginBottom: 32 },
  tSelGrid: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  tSelCard: {
    width: 220,
    padding: '20px 24px',
    background: '#fff',
    border: '1px solid #e0ddd6',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
  },
  tSelCardName: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  tSelCardDesc: { fontSize: 12, color: '#888', lineHeight: 1.5 },
};
