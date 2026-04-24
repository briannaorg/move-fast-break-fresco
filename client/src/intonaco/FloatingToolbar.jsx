export default function FloatingToolbar({ style, onBold, onItalic, onLink }) {
  return (
    <div style={{ ...s.toolbar, ...style }}>
      <button style={s.btn} onMouseDown={(e) => { e.preventDefault(); onBold(); }} title="Bold">
        <b>B</b>
      </button>
      <button style={s.btn} onMouseDown={(e) => { e.preventDefault(); onItalic(); }} title="Italic">
        <i>I</i>
      </button>
      <button style={s.btn} onMouseDown={(e) => { e.preventDefault(); onLink(); }} title="Link">
        🔗
      </button>
    </div>
  );
}

const s = {
  toolbar: {
    display: 'flex',
    gap: 2,
    background: '#1a1a1a',
    borderRadius: 6,
    padding: '4px 6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  btn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: 4,
    lineHeight: 1,
  },
};
