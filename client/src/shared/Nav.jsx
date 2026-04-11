import { NavLink } from 'react-router-dom';

const layers = [
  { to: '/arriccio', label: 'Arriccio', sub: 'Curate' },
  { to: '/sinopia/new', label: 'Sinopia', sub: 'Design' },
  { to: '/intonaco/new', label: 'Intonaco', sub: 'Publish' },
];

export default function Nav() {
  return (
    <nav style={styles.nav}>
      <span style={styles.wordmark}>Fresco</span>
      <div style={styles.layers}>
        {layers.map(({ to, label, sub }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}
          >
            <span style={styles.layerLabel}>{label}</span>
            <span style={styles.layerSub}>{sub}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
    padding: '12px 24px',
    borderBottom: '1px solid #e0ddd6',
    background: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  wordmark: {
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '-0.5px',
    color: '#1a1a1a',
  },
  layers: { display: 'flex', gap: 4 },
  link: {
    display: 'flex',
    flexDirection: 'column',
    padding: '6px 16px',
    borderRadius: 6,
    textDecoration: 'none',
    color: '#666',
    transition: 'background 0.15s',
  },
  active: { background: '#f0ede6', color: '#1a1a1a' },
  layerLabel: { fontSize: 14, fontWeight: 600 },
  layerSub: { fontSize: 11, opacity: 0.6 },
};
