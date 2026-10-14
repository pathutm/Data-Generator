import {
  IconDatabase,
  IconMessageSquare,
  IconFolder,
  IconUpload,
  IconLayers,
  IconBot,
  IconCheck,
} from './Icons';

export type ActiveNavPage =
  | 'data_gen_chat'
  | 'data_gen_datasets'
  | 'schema_gen_upload'
  | 'schema_gen_visualisation';

interface SidebarProps {
  activePage: ActiveNavPage;
  onNavigate: (page: ActiveNavPage) => void;
  schemaReady?: boolean;
  uploadedDatasetCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activePage,
  onNavigate,
  schemaReady = false,
  uploadedDatasetCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const handleNavClick = (page: ActiveNavPage) => {
    onNavigate(page);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`app-sidebar ${isOpenMobile ? 'app-sidebar--mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand__logo">
            <IconDatabase size={18} />
          </div>
          <div className="sidebar-brand__info">
            <span className="sidebar-brand__title">Agent Workbench</span>
            <span className="sidebar-brand__version">v2.0 · Enterprise</span>
          </div>
        </div>

        <div className="sidebar-nav-container">
          {/* ─── 1. DATA GENERATION AGENT ─── */}
          <div className="sidebar-section">
            <div className="sidebar-section__header">
              <span className="sidebar-section__tag">01</span>
              <span className="sidebar-section__title">DATA GENERATION AGENT</span>
            </div>

            <nav className="sidebar-nav">
              <button
                type="button"
                className={`sidebar-nav-item ${activePage === 'data_gen_chat' ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleNavClick('data_gen_chat')}
                id="nav-data-gen-chat"
              >
                <div className="sidebar-nav-item__icon">
                  <IconMessageSquare size={16} />
                </div>
                <div className="sidebar-nav-item__text">
                  <span className="sidebar-nav-item__label">Chat & History</span>
                  <span className="sidebar-nav-item__sub">Request & collect data</span>
                </div>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activePage === 'data_gen_datasets' ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleNavClick('data_gen_datasets')}
                id="nav-data-gen-datasets"
              >
                <div className="sidebar-nav-item__icon">
                  <IconFolder size={16} />
                </div>
                <div className="sidebar-nav-item__text">
                  <span className="sidebar-nav-item__label">Collected Datasets</span>
                  <span className="sidebar-nav-item__sub">Supabase repository</span>
                </div>
              </button>
            </nav>
          </div>

          {/* ─── 2. SCHEMA GENERATION AGENT ─── */}
          <div className="sidebar-section">
            <div className="sidebar-section__header">
              <span className="sidebar-section__tag">02</span>
              <span className="sidebar-section__title">SCHEMA GENERATION AGENT</span>
            </div>

            <nav className="sidebar-nav">
              <button
                type="button"
                className={`sidebar-nav-item ${activePage === 'schema_gen_upload' ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleNavClick('schema_gen_upload')}
                id="nav-schema-gen-upload"
              >
                <div className="sidebar-nav-item__icon">
                  <IconUpload size={16} />
                </div>
                <div className="sidebar-nav-item__text">
                  <span className="sidebar-nav-item__label">Upload Dataset</span>
                  <span className="sidebar-nav-item__sub">Inspect & submit ZIPs</span>
                </div>
                {uploadedDatasetCount > 0 && (
                  <span className="sidebar-pill">{uploadedDatasetCount}</span>
                )}
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activePage === 'schema_gen_visualisation' ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleNavClick('schema_gen_visualisation')}
                id="nav-schema-gen-visualisation"
              >
                <div className="sidebar-nav-item__icon">
                  <IconLayers size={16} />
                </div>
                <div className="sidebar-nav-item__text">
                  <span className="sidebar-nav-item__label">Visualisation</span>
                  <span className="sidebar-nav-item__sub">Full ER & lineage view</span>
                </div>
                {schemaReady && (
                  <span className="sidebar-pill sidebar-pill--ready" title="Schema is generated and ready to view">
                    <IconCheck size={10} />
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Footer info */}
        <div className="sidebar-footer">
          <div className="sidebar-footer__badge">
            <IconBot size={14} />
            <span>Dual Agent Architecture</span>
          </div>
          <div className="sidebar-footer__desc">
            Independent agents connected via user requirements &amp; shared metadata.
          </div>
        </div>
      </aside>
    </>
  );
}
