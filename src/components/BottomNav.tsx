import { NavLink, useNavigate } from 'react-router-dom';

const items = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/folders', label: 'Folders', icon: '📁', end: false },
  { to: '/recent', label: 'Recent', icon: '🕑', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
];

/** Fixed bottom navigation with a prominent central Scan action. */
export function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.slice(0, 2).map((it) => (
        <NavItem key={it.to} {...it} />
      ))}
      <button
        type="button"
        className="bottom-nav__item bottom-nav__scan"
        onClick={() => navigate('/scan')}
        aria-label="New scan"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          ＋
        </span>
        <span>Scan</span>
      </button>
      {items.slice(2).map((it) => (
        <NavItem key={it.to} {...it} />
      ))}
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: string;
  end: boolean;
}) {
  return (
    <NavLink to={to} end={end} className="bottom-nav__item">
      <span className="bottom-nav__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
