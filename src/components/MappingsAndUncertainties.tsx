import { useState } from 'react';
import type {
  ConsolidatedRelationship,
  SourceMapping,
  SchemaUncertainty,
} from '../types/schema';
import {
  IconLink,
  IconGitMerge,
  IconWarning,
  IconCheck,
  IconInfo,
  IconSearch,
  IconArrowRight,
} from './Icons';

interface MappingsAndUncertaintiesProps {
  relationships: ConsolidatedRelationship[];
  sourceMappings: SourceMapping[];
  uncertainties: SchemaUncertainty[];
  onSelectEntity?: (entityName: string) => void;
  onSelectColumn?: (entityName: string, columnName: string) => void;
}

type ActiveTab = 'relationships' | 'source_mappings' | 'uncertainties';

export function MappingsAndUncertainties({
  relationships,
  sourceMappings,
  uncertainties,
  onSelectEntity,
  onSelectColumn,
}: MappingsAndUncertaintiesProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('relationships');
  const [searchQuery, setSearchQuery] = useState('');
  const [relFilter, setRelFilter] = useState<'all' | 'confirmed' | 'uncertain'>('all');

  const filteredRelationships = relationships.filter((rel) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      rel.source_entity.toLowerCase().includes(q) ||
      rel.source_column.toLowerCase().includes(q) ||
      rel.target_entity.toLowerCase().includes(q) ||
      rel.target_column.toLowerCase().includes(q) ||
      (rel.reason && rel.reason.toLowerCase().includes(q));

    const matchesFilter =
      relFilter === 'all' ||
      (relFilter === 'confirmed' && rel.status === 'confirmed') ||
      (relFilter === 'uncertain' && rel.status !== 'confirmed');

    return matchesSearch && matchesFilter;
  });

  const filteredMappings = sourceMappings.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      m.concept.toLowerCase().includes(q) ||
      (m.target_entity && m.target_entity.toLowerCase().includes(q)) ||
      (m.target_column && m.target_column.toLowerCase().includes(q)) ||
      m.sources.some(
        (s) =>
          s.table.toLowerCase().includes(q) ||
          s.column.toLowerCase().includes(q) ||
          s.dataset.toLowerCase().includes(q)
      )
    );
  });

  const filteredUncertainties = uncertainties.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      u.type.toLowerCase().includes(q) ||
      u.explanation.toLowerCase().includes(q) ||
      u.sources.some(
        (s) =>
          s.table.toLowerCase().includes(q) ||
          s.column.toLowerCase().includes(q) ||
          s.dataset.toLowerCase().includes(q)
      )
    );
  });

  return (
    <div className="mappings-uncertainties-card">
      {/* Tab Navigation Header */}
      <div className="mu-tabs-header">
        <div className="mu-tabs-nav">
          <button
            className={`mu-tab-btn ${activeTab === 'relationships' ? 'mu-tab-btn--active' : ''}`}
            onClick={() => {
              setActiveTab('relationships');
              setSearchQuery('');
            }}
          >
            <IconLink size={16} />
            <span>Relationships</span>
            <span className="mu-tab-count">{relationships.length}</span>
          </button>

          <button
            className={`mu-tab-btn ${activeTab === 'source_mappings' ? 'mu-tab-btn--active' : ''}`}
            onClick={() => {
              setActiveTab('source_mappings');
              setSearchQuery('');
            }}
          >
            <IconGitMerge size={16} />
            <span>Source Mappings</span>
            <span className="mu-tab-count">{sourceMappings.length}</span>
          </button>

          <button
            className={`mu-tab-btn ${activeTab === 'uncertainties' ? 'mu-tab-btn--active' : ''}`}
            onClick={() => {
              setActiveTab('uncertainties');
              setSearchQuery('');
            }}
          >
            <IconWarning size={16} />
            <span>Uncertainties</span>
            <span
              className={`mu-tab-count ${
                uncertainties.length > 0 ? 'mu-tab-count--warning' : ''
              }`}
            >
              {uncertainties.length}
            </span>
          </button>
        </div>

        {/* Search input in Tab Header */}
        <div className="mu-search-box">
          <IconSearch size={14} className="mu-search-icon" />
          <input
            type="text"
            className="mu-search-input"
            placeholder={`Filter ${
              activeTab === 'relationships'
                ? 'relationships'
                : activeTab === 'source_mappings'
                ? 'mappings'
                : 'uncertainties'
            }…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="mu-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Relationships */}
      {activeTab === 'relationships' && (
        <div className="mu-tab-content">
          <div className="mu-sub-toolbar">
            <div className="mu-filter-pills">
              <button
                className={`mu-pill-btn ${relFilter === 'all' ? 'mu-pill-btn--active' : ''}`}
                onClick={() => setRelFilter('all')}
              >
                All ({relationships.length})
              </button>
              <button
                className={`mu-pill-btn ${relFilter === 'confirmed' ? 'mu-pill-btn--active' : ''}`}
                onClick={() => setRelFilter('confirmed')}
              >
                Confirmed ({relationships.filter((r) => r.status === 'confirmed').length})
              </button>
              <button
                className={`mu-pill-btn ${relFilter === 'uncertain' ? 'mu-pill-btn--active' : ''}`}
                onClick={() => setRelFilter('uncertain')}
              >
                Uncertain ({relationships.filter((r) => r.status !== 'confirmed').length})
              </button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Showing {filteredRelationships.length} of {relationships.length}
            </span>
          </div>

          {filteredRelationships.length === 0 ? (
            <div className="mu-empty-state">
              <IconInfo size={20} style={{ color: 'var(--color-text-tertiary)', marginBottom: 6 }} />
              <p>No relationships match the current filter.</p>
            </div>
          ) : (
            <div className="mu-rel-list">
              {filteredRelationships.map((rel) => {
                const isConfirmed = rel.status === 'confirmed';

                return (
                  <div
                    key={rel.id}
                    className={`mu-rel-item ${
                      isConfirmed ? 'mu-rel-item--confirmed' : 'mu-rel-item--uncertain'
                    }`}
                  >
                    {/* Source Endpoint */}
                    <div className="mu-rel-endpoint mu-rel-endpoint--source">
                      <span className="mu-endpoint-entity">
                        {rel.source_entity || 'Source'}
                      </span>
                      <span className="mu-endpoint-col">
                        .{rel.source_column || '*'}
                      </span>
                    </div>

                    {/* Connector Arrow & Type Badge */}
                    <div className="mu-rel-middle">
                      <span
                        className={`mu-rel-type-badge ${
                          isConfirmed ? 'badge--info' : 'badge--warning'
                        }`}
                      >
                        {rel.type || '1:N'}
                      </span>
                      <IconArrowRight size={16} className="mu-rel-arrow" />
                    </div>

                    {/* Target Endpoint */}
                    <div className="mu-rel-endpoint mu-rel-endpoint--target">
                      <span className="mu-endpoint-entity">
                        {rel.target_entity || 'Target'}
                      </span>
                      <span className="mu-endpoint-col">
                        .{rel.target_column || '*'}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="mu-rel-status">
                      <span
                        className={`dataset-card__badge ${
                          isConfirmed ? 'badge--success' : 'badge--warning'
                        }`}
                      >
                        {isConfirmed ? (
                          <>
                            <IconCheck size={11} style={{ marginRight: 3 }} />
                            Confirmed
                          </>
                        ) : (
                          <>
                            <IconWarning size={11} style={{ marginRight: 3 }} />
                            {rel.status}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Reason / Notes */}
                    {rel.reason && (
                      <div className="mu-rel-reason">
                        <span className="mu-reason-label">Reason:</span> {rel.reason}
                      </div>
                    )}

                    {!rel.is_mapped_to_entities && (
                      <div className="mu-rel-unmapped-note">
                        ⚠ Source-level reference not directly mapped to a consolidated entity table name.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Source Mappings */}
      {activeTab === 'source_mappings' && (
        <div className="mu-tab-content">
          {filteredMappings.length === 0 ? (
            <div className="mu-empty-state">
              <IconInfo size={20} style={{ color: 'var(--color-text-tertiary)', marginBottom: 6 }} />
              <p>No source concept mappings found.</p>
            </div>
          ) : (
            <div className="mu-mappings-table-container">
              <table className="explorer-columns-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Consolidated Concept</th>
                    <th style={{ width: '46%' }}>Original Source References</th>
                    <th style={{ width: '14%' }}>Mapping Status</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          {m.concept}
                        </div>
                        {m.target_entity && (
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            Target: {m.target_entity}.{m.target_column}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="source-refs-list">
                          {m.sources.map((s, idx) => (
                            <div key={idx} className="source-ref-item">
                              <span className="source-ref-pill">
                                {s.dataset && (
                                  <span className="source-ref-pill__dataset">{s.dataset}</span>
                                )}
                                <span className="source-ref-pill__table">{s.table}</span>
                                <span className="source-ref-pill__arrow">➔</span>
                                <span className="source-ref-pill__column">{s.column}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                        {m.notes && (
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                            {m.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`dataset-card__badge ${
                            m.status === 'confirmed'
                              ? 'badge--success'
                              : m.status === 'inferred'
                              ? 'badge--info'
                              : 'badge--warning'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.target_entity && (
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => {
                              if (m.target_entity) onSelectEntity?.(m.target_entity);
                              if (m.target_entity && m.target_column)
                                onSelectColumn?.(m.target_entity, m.target_column);
                            }}
                          >
                            View Lineage
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Uncertainties */}
      {activeTab === 'uncertainties' && (
        <div className="mu-tab-content">
          {filteredUncertainties.length === 0 ? (
            <div className="mu-empty-state-success">
              <IconCheck size={24} style={{ color: 'var(--color-success)', marginBottom: 6 }} />
              <p style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                No Uncertainties Flagged
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                All schema entities, columns, and relationships were consolidated with high confidence.
              </p>
            </div>
          ) : (
            <div className="mu-uncertainty-list">
              {filteredUncertainties.map((unc) => (
                <div key={unc.id} className="mu-uncertainty-card">
                  <div className="mu-unc-header">
                    <div className="mu-unc-title-group">
                      <IconWarning size={16} className="mu-unc-icon" />
                      <span className="mu-unc-title">{unc.type}</span>
                    </div>

                    {unc.severity && (
                      <span
                        className={`dataset-card__badge ${
                          unc.severity === 'high'
                            ? 'badge--error'
                            : unc.severity === 'medium'
                            ? 'badge--warning'
                            : 'badge--info'
                        }`}
                      >
                        {unc.severity.toUpperCase()} Priority
                      </span>
                    )}
                  </div>

                  <p className="mu-unc-explanation">{unc.explanation}</p>

                  {unc.sources.length > 0 && (
                    <div className="mu-unc-sources">
                      <span className="mu-unc-sources-label">Affected Sources:</span>
                      <div className="source-refs-list">
                        {unc.sources.map((s, idx) => (
                          <span key={idx} className="source-ref-pill">
                            {s.dataset && (
                              <span className="source-ref-pill__dataset">{s.dataset}</span>
                            )}
                            <span className="source-ref-pill__table">{s.table}</span>
                            {s.column && (
                              <>
                                <span className="source-ref-pill__arrow">➔</span>
                                <span className="source-ref-pill__column">{s.column}</span>
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {unc.suggested_action && (
                    <div className="mu-unc-action">
                      <strong>Recommended Action:</strong> {unc.suggested_action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
