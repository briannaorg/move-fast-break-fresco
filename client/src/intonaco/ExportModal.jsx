import { useState, useEffect } from 'react';

const STEPS = [
  'Rendering pages…',
  'Copying images…',
  'Generating attribution page…',
  'Packaging zip…',
];

export default function ExportModal({ projectId, onClose }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState('running'); // running | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [fileSize, setFileSize] = useState('');

  useEffect(() => {
    let cancelled = false;

    // Advance through fake progress steps while the fetch resolves
    const stepInterval = setInterval(() => {
      setStepIdx((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 600);

    fetch(`/api/projects/${projectId}/export`, { method: 'POST' })
      .then(async (res) => {
        clearInterval(stepInterval);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Export failed: ${res.status}`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        const kb = (blob.size / 1024).toFixed(1);
        setFileSize(`${kb} KB`);
        setStepIdx(STEPS.length - 1);
        setStatus('success');

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.headers.get('X-Export-Filename') || 'export.zip';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        clearInterval(stepInterval);
        if (cancelled) return;
        setErrorMsg(err.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      clearInterval(stepInterval);
    };
  }, [projectId]);

  function handleRetry() {
    setStepIdx(0);
    setStatus('running');
    setErrorMsg('');
    setFileSize('');
    // Re-mount by closing and re-opening is simplest; here we just reset and re-run
    // by remounting the effect via key change — caller handles retry by re-mounting
    onClose('retry');
  }

  return (
    <div style={s.backdrop} onClick={(e) => { if (e.target === e.currentTarget && status !== 'running') onClose(); }}>
      <div style={s.modal}>
        <h3 style={s.title}>
          {status === 'running' && 'Exporting…'}
          {status === 'success' && 'Export complete'}
          {status === 'error' && 'Export failed'}
        </h3>

        {status === 'running' && (
          <div style={s.steps}>
            {STEPS.map((step, i) => (
              <div key={step} style={{ ...s.step, ...(i === stepIdx ? s.stepActive : i < stepIdx ? s.stepDone : s.stepPending) }}>
                <span style={s.stepDot}>{i < stepIdx ? '✓' : i === stepIdx ? '·' : '○'}</span>
                {step}
              </div>
            ))}
          </div>
        )}

        {status === 'success' && (
          <div style={s.success}>
            <p style={s.successMsg}>Your site has been downloaded.</p>
            {fileSize && <p style={s.fileSizeLabel}>File size: {fileSize}</p>}
            <button style={s.closeBtn} onClick={onClose}>Done</button>
          </div>
        )}

        {status === 'error' && (
          <div style={s.errorBox}>
            <p style={s.errorMsg}>{errorMsg}</p>
            <div style={s.errorActions}>
              <button style={s.retryBtn} onClick={handleRetry}>Try again</button>
              <button style={s.closeBtn} onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
  },
  modal: {
    background: '#fff', borderRadius: 10, padding: '28px 32px',
    minWidth: 320, maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  title: { fontSize: 17, fontWeight: 700, marginBottom: 20 },
  steps: { display: 'flex', flexDirection: 'column', gap: 10 },
  step: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 },
  stepActive: { color: '#1a1a1a', fontWeight: 600 },
  stepDone: { color: '#888' },
  stepPending: { color: '#ccc' },
  stepDot: { width: 18, fontSize: 13, flexShrink: 0 },
  success: { display: 'flex', flexDirection: 'column', gap: 10 },
  successMsg: { fontSize: 14, color: '#444' },
  fileSizeLabel: { fontSize: 12, color: '#999' },
  errorBox: { display: 'flex', flexDirection: 'column', gap: 14 },
  errorMsg: { fontSize: 13, color: '#c0392b' },
  errorActions: { display: 'flex', gap: 8 },
  closeBtn: { padding: '8px 18px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13 },
  retryBtn: { padding: '8px 18px', background: 'none', color: '#1a1a1a', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer', fontSize: 13 },
};
