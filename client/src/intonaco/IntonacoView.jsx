import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import PagesPanel from './PagesPanel';
import FloatingToolbar from './FloatingToolbar';
import ExportModal from './ExportModal';

const AUTOSAVE_DELAY = 500;

export default function IntonacoView() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toolbar, setToolbar] = useState(null); // { rect: {top,left,width,height} }

  const iframeRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const pendingContentRef = useRef({});
  const activePageRef = useRef(null);

  useEffect(() => { activePageRef.current = activePage; }, [activePage]);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const proj = await api.getProject(projectId);
        setProject(proj);
        const pageList = await api.getPages(projectId);
        setPages(pageList);
        if (pageList.length) setActivePage(pageList[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // ── postMessage listener ──────────────────────────────────────────────────

  const scheduleSave = useCallback((key, value) => {
    pendingContentRef.current[key] = value;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const page = activePageRef.current;
      if (!page) return;
      const contentPatch = { ...pendingContentRef.current };
      pendingContentRef.current = {};
      try {
        const merged = { ...(page.content || {}), ...contentPatch };
        const updated = await api.updatePage(projectId, page.id, { content: merged });
        setActivePage(updated);
        setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } catch (err) {
        console.error('Content save failed:', err);
      }
    }, AUTOSAVE_DELAY);
  }, [projectId]);

  useEffect(() => {
    function handleMessage(e) {
      if (!e.data) return;
      const { type, key, value, rect } = e.data;
      if (type === 'CONTENT_CHANGE') {
        scheduleSave(key, value);
      } else if (type === 'FOCUS_EDITABLE') {
        // rect is relative to iframe viewport; offset by iframe position
        const iframeEl = iframeRef.current;
        if (!iframeEl) return;
        const iframeRect = iframeEl.getBoundingClientRect();
        setToolbar({
          top: iframeRect.top + rect.top - 40, // 40px above element
          left: iframeRect.left + rect.left,
        });
      } else if (type === 'BLUR_EDITABLE') {
        // Small delay so toolbar button clicks register before dismiss
        setTimeout(() => setToolbar(null), 150);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [scheduleSave]);

  // ── Toolbar commands ──────────────────────────────────────────────────────

  function execInIframe(command, value) {
    iframeRef.current?.contentWindow?.postMessage({ type: 'EXEC_COMMAND', command, value }, '*');
  }

  // ── Page navigation ───────────────────────────────────────────────────────

  function previewUrl(page) {
    if (!page) return `/preview/${projectId}?mode=edit`;
    return `/preview/${projectId}?mode=edit&page=${encodeURIComponent(page.page_name)}`;
  }

  function handlePageSelect(page) {
    setActivePage(page);
    setToolbar(null);
    if (iframeRef.current) iframeRef.current.src = previewUrl(page);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div style={s.loading}><p>Loading project…</p></div>;
  if (error) return (
    <div style={s.loading}>
      <p style={{ color: '#c0392b' }}>Error: {error}</p>
      <button onClick={() => navigate('/arriccio/projects')} style={s.backBtn}>Back to Projects</button>
    </div>
  );

  return (
    <div style={s.layout}>
      {showExportModal && (
        <ExportModal
          projectId={projectId}
          onClose={(action) => {
            setShowExportModal(false);
            if (action === 'retry') setTimeout(() => setShowExportModal(true), 50);
          }}
        />
      )}
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <button onClick={() => navigate('/arriccio/projects')} style={s.backLink}>← Projects</button>
          <h2 style={s.projectName}>{project?.name}</h2>
          <div style={s.headerActions}>
            <button onClick={() => navigate(`/sinopia/${projectId}`)} style={s.designBtn}>← Design</button>
            <button onClick={() => setShowExportModal(true)} style={s.exportBtn}>
              Export Site
            </button>
          </div>
        </div>

        <PagesPanel
          projectId={projectId}
          pages={pages}
          activePage={activePage}
          onPagesChange={setPages}
          onPageSelect={handlePageSelect}
        />
      </div>

      {/* Preview + toolbar */}
      <div style={s.previewPane}>
        {toolbar && (
          <FloatingToolbar
            style={{ position: 'fixed', top: toolbar.top, left: toolbar.left, zIndex: 200 }}
            onBold={() => execInIframe('bold')}
            onItalic={() => execInIframe('italic')}
            onLink={() => {
              const url = window.prompt('Enter URL:');
              if (url) execInIframe('createLink', url);
            }}
          />
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl(activePage)}
          style={s.iframe}
          title="Content editor"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}

const s = {
  layout: { display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden' },
  sidebar: {
    width: 260, minWidth: 220, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #e0ddd6', background: '#faf9f6', overflow: 'hidden',
  },
  sidebarHeader: { padding: '16px 20px 12px', borderBottom: '1px solid #e0ddd6' },
  backLink: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 12, padding: 0, marginBottom: 8 },
  projectName: { fontSize: 15, fontWeight: 700, marginBottom: 10 },
  headerActions: { display: 'flex', gap: 6 },
  designBtn: { flex: 1, padding: '7px 10px', fontSize: 12, background: 'none', border: '1px solid #c8c4bc', borderRadius: 5, cursor: 'pointer', color: '#555' },
  exportBtn: { flex: 1, padding: '7px 10px', fontSize: 12, fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' },
  previewPane: { flex: 1, display: 'flex', position: 'relative', background: '#1a1a1a', overflow: 'hidden' },
  iframe: { flex: 1, width: '100%', border: 'none', background: '#fff' },
  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, color: '#666' },
  backBtn: { padding: '8px 16px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13 },
};
