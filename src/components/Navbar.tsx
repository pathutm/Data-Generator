import { IconDatabase, IconSliders } from './Icons';

interface NavbarProps {
  onToggleMobileSidebar?: () => void;
  activeTitle?: string;
}

export function Navbar({ onToggleMobileSidebar, activeTitle }: NavbarProps) {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar__brand">
        {onToggleMobileSidebar && (
          <button
            type="button"
            className="navbar__menu-btn"
            onClick={onToggleMobileSidebar}
            aria-label="Toggle navigation"
          >
            <IconSliders size={18} />
          </button>
        )}
        <div className="navbar__logo">
          <IconDatabase size={16} />
        </div>
        <span className="navbar__title">Dataset Schema Inspector</span>
        {activeTitle ? (
          <span className="navbar__subtitle" style={{ display: 'inline', fontWeight: 600, color: 'var(--color-primary)' }}>
            / {activeTitle}
          </span>
        ) : (
          <span className="navbar__subtitle">
            Upload ZIP archives · Inspect CSV tables · Prepare schemas
          </span>
        )}
      </div>
    </nav>
  );
}
