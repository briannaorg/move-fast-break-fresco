import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/arriccio', label: 'Search', end: true },
  { to: '/arriccio/library', label: 'Library' },
  { to: '/arriccio/projects', label: 'Projects' },
];

export default function ArriccioLayout() {
  return (
    <div>
      <div style={styles.subNav}>
        {tabs.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({ ...styles.tab, ...(isActive ? styles.activeTab : {}) })}
          >
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

const styles = {
  subNav: {
    display: 'flex',
    gap: 4,
    padding: '8px 24px',
    borderBottom: '1px solid #e0ddd6',
    background: '#faf9f7',
  },
  tab: {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: '#666',
    textDecoration: 'none',
    borderRadius: 5,
  },
  activeTab: { background: '#e8e4dc', color: '#1a1a1a', fontWeight: 600 },
};
