import { useState, useMemo } from 'react';
import type { ConsolidatedEntity, ConsolidatedColumn } from '../types/schema';
import {
  IconDatabase,
  IconKey,
  IconSearch,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconLayers,
  IconChevronRight,
  IconInfo,
} from './Icons';

interface TablesColumnsExplorerProps {
  entities: ConsolidatedEntity[];
  sourceDatasets: string[];
  selectedEntityName: string | null;
  selectedColumnName: string | null;
  onSelectEntity: (entityName: string) => void;
  onSelectColumn: (entityName: string, columnName: string) => void;
}

export function TablesColumnsExplorer({
  entities,
  sourceDatasets,
  selectedEntityName,
  selectedColumnName,
  onSelectEntity,
  onSelectColumn,
}: TablesColumnsExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [onlyMultiSource, setOnlyMultiSource] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    entities.forEach((e) => {
      initial[e.name] = true;
    });
    return initial;
  });

  // Toggle single entity
  const toggleEntity = (entityName: string) => {
    setExpandedEntities((prev) => ({
      ...prev,
      [entityName]: !prev[entityName],
    }));
  };

  // Expand all / collapse all
  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    entities.forEach((e) => {
      next[e.name] = true;
    });
    setExpandedEntities(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    entities.forEach((e) => {
      next[e.name] = false;
    });
    setExpandedEntities(next);
  };

  // Filter entities and columns based on search, dataset filter, and multi-source flag
  const filteredEntities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entities
      .map((entity) => {
        const entityNameMatches = entity.name.toLowerCase().includes(query);

        // Filter columns
        const matchedColumns = entity.columns.filter((col) => {
          const colNameMatches = col.name.toLowerCase().includes(query);
          const colTypeMatches = col.data_type.toLowerCase().includes(query);
          const sourceTableMatches = col.sources.some(
            (s) =>
              s.table.toLowerCase().includes(query) ||
              s.column.toLowerCase().includes(query) ||
              s.dataset.toLowerCase().includes(query)
          );

          const matchesQuery = !query || entityNameMatches || colNameMatches || colTypeMatches || sourceTableMatches;

          // Dataset filter
          const matchesDataset =
            datasetFilter === 'all' ||
            col.sources.some((s) => s.dataset === datasetFilter) ||
            entity.source_tables?.some((st) => st.dataset === datasetFilter);

          // Multi-source filter
          const matchesMultiSource = !onlyMultiSource || col.sources.length > 1;

          return matchesQuery && matchesDataset && matchesMultiSource;
        });

        // Entity is included if query matches entity or if it has matching columns
        const isIncluded =
          (entityNameMatches && datasetFilter === 'all' && !onlyMultiSource) ||
          matchedColumns.length > 0;

        return {
          ...entity,
          columns: isIncluded ? (query || datasetFilter !== 'all' || onlyMultiSource ? matchedColumns : entity.columns) : [],
          isIncluded,
        };
      })
      .filter((e) => e.isIncluded);
  }, [entities, searchQuery, datasetFilter, onlyMultiSource]);

  const totalFilteredColumns = filteredEntities.reduce((sum, e) => sum + e.columns.length, 0);

  return (
    <div className="explorer-card">
      {/* Explorer Header */}
      <div className="explorer-header">
        <div>
          <h3 className="explorer-title">
            <IconLayers size={18} className="explorer-title-icon" />
            Tables &amp; Columns Explorer
          </h3>
          <p className="explorer-subtitle">
            Structured view of consolidated schema entities, columns, data types, and original source lineages.
          </p>
        </div>

        {/* Expand / Collapse Controls */}
        <div className="explorer-actions">
          <button className="btn btn--secondary btn--sm" onClick={handleExpandAll}>
            <IconChevronDown size={13} />
            Expand All
          </button>
          <button className="btn btn--secondary btn--sm" onClick={handleCollapseAll}>
            <IconChevronUp size={13} />
            Collapse All
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="explorer-toolbar">
        {/* Search Input */}
        <div className="explorer-search">
          <IconSearch size={15} className="explorer-search__icon" />
          <input
            type="text"
            className="explorer-search__input"
            placeholder="Search entities, columns, source tables…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="explorer-search__clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Dataset Filter Dropdown */}
        {sourceDatasets.length > 0 && (
          <div className="explorer-filter-group">
            <IconFilter size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Dataset:</span>
            <select
              className="explorer-select"
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value)}
            >
              <option value="all">All Source Datasets ({sourceDatasets.length})</option>
              {sourceDatasets.map((ds) => (
                <option key={ds} value={ds}>
                  {ds}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Multi-source toggle chip */}
        <button
          type="button"
          className={`explorer-toggle-chip ${onlyMultiSource ? 'explorer-toggle-chip--active' : ''}`}
          onClick={() => setOnlyMultiSource((v) => !v)}
        >
          <span>Multi-source Columns Only</span>
        </button>

        <span className="explorer-counter">
          Showing {filteredEntities.length} table{filteredEntities.length !== 1 ? 's' : ''} ({totalFilteredColumns} column{totalFilteredColumns !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Entity Table List */}
      <div className="explorer-entity-list">
        {filteredEntities.length === 0 ? (
          <div className="explorer-empty-state">
            <IconInfo size={24} style={{ color: 'var(--color-text-tertiary)', marginBottom: 8 }} />
            <p style={{ fontWeight: 500 }}>No matching tables or columns found</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Try adjusting your search keywords or dataset filter.
            </p>
          </div>
        ) : (
          filteredEntities.map((entity) => {
            const isExpanded = expandedEntities[entity.name] ?? true;
            const isSelected = selectedEntityName === entity.name;

            return (
              <div
                key={entity.id}
                className={`explorer-entity-card ${isSelected ? 'explorer-entity-card--selected' : ''}`}
              >
                {/* Entity Accordion Header */}
                <div
                  className="explorer-entity-header"
                  onClick={() => {
                    toggleEntity(entity.name);
                    onSelectEntity(entity.name);
                  }}
                >
                  <div className="explorer-entity-header__left">
                    <button
                      className="explorer-entity-toggle"
                      aria-label={isExpanded ? 'Collapse table' : 'Expand table'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEntity(entity.name);
                      }}
                    >
                      {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </button>

                    <div className="explorer-entity-name-group">
                      <IconDatabase size={16} className="explorer-entity-icon" />
                      <span className="explorer-entity-name">{entity.name}</span>
                    </div>

                    <span className="dataset-card__badge badge--info" style={{ fontSize: 11 }}>
                      {entity.columns.length} column{entity.columns.length !== 1 ? 's' : ''}
                    </span>

                    {/* Source Datasets Tag list */}
                    {entity.source_tables && entity.source_tables.length > 0 && (
                      <div className="explorer-entity-source-tags">
                        {entity.source_tables.map((st, i) => (
                          <span key={i} className="source-table-tag" title={`Source: ${st.dataset || 'N/A'} - ${st.table}`}>
                            {st.dataset ? `${st.dataset} · ` : ''}{st.table}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="explorer-entity-header__right">
                    <button
                      className="btn btn--secondary btn--sm"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntity(entity.name);
                      }}
                    >
                      Inspect Lineage
                    </button>
                  </div>
                </div>

                {/* Entity Description if available */}
                {entity.description && isExpanded && (
                  <div className="explorer-entity-desc">{entity.description}</div>
                )}

                {/* Entity Columns Table */}
                {isExpanded && (
                  <div className="explorer-columns-table-container">
                    <table className="explorer-columns-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Consolidated Column</th>
                          <th style={{ width: '14%' }}>Data Type</th>
                          <th style={{ width: '44%' }}>Original Source Reference (Lineage)</th>
                          <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entity.columns.map((col: ConsolidatedColumn) => {
                          const isColSelected = isSelected && selectedColumnName === col.name;
                          const hasMultiSources = col.sources.length > 1;

                          return (
                            <tr
                              key={col.id}
                              className={`explorer-col-row ${isColSelected ? 'explorer-col-row--selected' : ''}`}
                              onClick={() => {
                                onSelectEntity(entity.name);
                                onSelectColumn(entity.name, col.name);
                              }}
                            >
                              {/* Column Name */}
                              <td>
                                <div className="explorer-col-name-cell">
                                  {col.is_primary_key && (
                                    <span className="schema-col-key schema-col-key--pk" title="Primary Key">
                                      <IconKey size={11} /> PK
                                    </span>
                                  )}
                                  {!col.is_primary_key && col.is_foreign_key && (
                                    <span className="schema-col-key schema-col-key--fk" title="Foreign Key">
                                      FK
                                    </span>
                                  )}
                                  <span className="explorer-col-name-text">{col.name}</span>
                                </div>
                                {col.description && (
                                  <div className="explorer-col-desc">{col.description}</div>
                                )}
                              </td>

                              {/* Data Type */}
                              <td>
                                <span className="schema-col-type schema-col-type--pill">
                                  {col.data_type}
                                </span>
                              </td>

                              {/* Original Source Reference */}
                              <td>
                                {col.sources.length === 0 ? (
                                  <span className="source-ref-none">Direct / Generated</span>
                                ) : (
                                  <div className="source-refs-list">
                                    {col.sources.map((s, idx) => (
                                      <div key={idx} className="source-ref-item">
                                        <div className="source-ref-pill">
                                          {s.dataset && (
                                            <span className="source-ref-pill__dataset">
                                              {s.dataset}
                                            </span>
                                          )}
                                          <span className="source-ref-pill__table">
                                            {s.table || 'Table'}
                                          </span>
                                          <span className="source-ref-pill__arrow">➔</span>
                                          <span className="source-ref-pill__column">
                                            {s.column || 'column'}
                                          </span>
                                        </div>
                                        {s.notes && (
                                          <span className="source-ref-notes" title={s.notes}>
                                            ({s.notes})
                                          </span>
                                        )}
                                      </div>
                                    ))}

                                    {hasMultiSources && (
                                      <span className="multi-source-indicator">
                                        Merged from {col.sources.length} sources
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn--secondary btn--sm"
                                  style={{ padding: '2px 8px', fontSize: 11 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectEntity(entity.name);
                                    onSelectColumn(entity.name, col.name);
                                  }}
                                >
                                  Lineage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
