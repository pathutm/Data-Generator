import type { ConsolidatedEntity, ConsolidatedColumn } from '../types/schema';
import {
  IconGitMerge,
  IconDatabase,
  IconTable,
  IconKey,
  IconFolder,
  IconArrowRight,
  IconInfo,
} from './Icons';

interface SourceLineageInspectorProps {
  entities: ConsolidatedEntity[];
  selectedEntityName: string | null;
  selectedColumnName: string | null;
  onSelectEntity: (entityName: string) => void;
  onSelectColumn: (entityName: string, columnName: string) => void;
}

export function SourceLineageInspector({
  entities,
  selectedEntityName,
  selectedColumnName,
  onSelectEntity,
  onSelectColumn,
}: SourceLineageInspectorProps) {
  // Find current entity and column
  const currentEntity =
    entities.find((e) => e.name === selectedEntityName) || entities[0] || null;

  const currentColumn: ConsolidatedColumn | null =
    currentEntity && selectedColumnName
      ? currentEntity.columns.find((c) => c.name === selectedColumnName) ||
        currentEntity.columns[0] ||
        null
      : currentEntity && currentEntity.columns.length > 0
      ? currentEntity.columns[0]
      : null;

  if (!currentEntity) {
    return null;
  }

  return (
    <div className="lineage-card">
      {/* Lineage Header */}
      <div className="lineage-header">
        <div className="lineage-header__left">
          <div className="lineage-title-group">
            <IconGitMerge size={18} className="lineage-title-icon" />
            <h3 className="lineage-title">Source Lineage Inspection</h3>
          </div>
          <p className="lineage-subtitle">
            Trace the full derivation path from original CSV files to the consolidated schema.
          </p>
        </div>

        {/* Entity / Column Selectors */}
        <div className="lineage-selectors">
          <div className="lineage-select-wrapper">
            <label className="lineage-select-label">Entity:</label>
            <select
              className="lineage-select"
              value={currentEntity.name}
              onChange={(e) => {
                onSelectEntity(e.target.value);
                const ent = entities.find((ent) => ent.name === e.target.value);
                if (ent && ent.columns.length > 0) {
                  onSelectColumn(ent.name, ent.columns[0].name);
                }
              }}
            >
              {entities.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name} ({e.columns.length} cols)
                </option>
              ))}
            </select>
          </div>

          {currentEntity.columns.length > 0 && (
            <div className="lineage-select-wrapper">
              <label className="lineage-select-label">Column:</label>
              <select
                className="lineage-select"
                value={currentColumn?.name || ''}
                onChange={(e) => onSelectColumn(currentEntity.name, e.target.value)}
              >
                {currentEntity.columns.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.data_type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Lineage Visual Flow */}
      {currentColumn ? (
        <div className="lineage-flow-area">
          <div className="lineage-flow-summary-bar">
            <div className="lineage-target-summary">
              <span className="lineage-target-label">Target Field:</span>
              <strong className="lineage-target-name">
                {currentEntity.name}.{currentColumn.name}
              </strong>
              <span className="schema-col-type schema-col-type--pill">
                {currentColumn.data_type}
              </span>
              {currentColumn.is_primary_key && (
                <span className="schema-col-key schema-col-key--pk">
                  <IconKey size={11} /> PK
                </span>
              )}
              {currentColumn.is_foreign_key && (
                <span className="schema-col-key schema-col-key--fk">FK</span>
              )}
            </div>

            <span className="lineage-sources-count-badge">
              {currentColumn.sources.length} Original Source Reference
              {currentColumn.sources.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Lineage Branch Cards */}
          {currentColumn.sources.length === 0 ? (
            <div className="lineage-empty-sources">
              <IconInfo size={18} style={{ color: 'var(--color-text-tertiary)', marginBottom: 4 }} />
              <p>Direct or workflow-generated attribute without explicit source lineage.</p>
            </div>
          ) : (
            <div className="lineage-branches-list">
              {currentColumn.sources.map((src, index) => (
                <div key={index} className="lineage-chain-box">
                  <div className="lineage-chain-header">
                    <span className="lineage-branch-badge">Source Derivation #{index + 1}</span>
                    {src.confidence && (
                      <span className="lineage-confidence-badge">
                        Confidence: {Math.round(src.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  {/* 5-Step Visual Flowchart */}
                  <div className="lineage-nodes-flow">
                    {/* Step 1: Dataset */}
                    <div className="lineage-node-card lineage-node-card--dataset">
                      <div className="lineage-node-card__type">
                        <IconFolder size={12} />
                        Original Dataset
                      </div>
                      <div className="lineage-node-card__name">
                        {src.dataset || 'Submitted Dataset'}
                      </div>
                    </div>

                    <IconArrowRight size={16} className="lineage-node-arrow" />

                    {/* Step 2: Table */}
                    <div className="lineage-node-card lineage-node-card--table">
                      <div className="lineage-node-card__type">
                        <IconTable size={12} />
                        Original Table
                      </div>
                      <div className="lineage-node-card__name">
                        {src.table || 'Source CSV'}
                      </div>
                    </div>

                    <IconArrowRight size={16} className="lineage-node-arrow" />

                    {/* Step 3: Column */}
                    <div className="lineage-node-card lineage-node-card--column">
                      <div className="lineage-node-card__type">
                        <IconKey size={12} />
                        Original Column
                      </div>
                      <div className="lineage-node-card__name">
                        {src.column || 'Source Column'}
                      </div>
                    </div>

                    <IconArrowRight size={16} className="lineage-node-arrow" />

                    {/* Step 4: Consolidated Entity */}
                    <div className="lineage-node-card lineage-node-card--entity">
                      <div className="lineage-node-card__type">
                        <IconDatabase size={12} />
                        Consolidated Entity
                      </div>
                      <div className="lineage-node-card__name">
                        {currentEntity.name}
                      </div>
                    </div>

                    <IconArrowRight size={16} className="lineage-node-arrow" />

                    {/* Step 5: Consolidated Column */}
                    <div className="lineage-node-card lineage-node-card--target-col">
                      <div className="lineage-node-card__type">
                        <IconKey size={12} />
                        Consolidated Column
                      </div>
                      <div className="lineage-node-card__name">
                        {currentColumn.name}
                      </div>
                    </div>
                  </div>

                  {src.notes && (
                    <div className="lineage-node-notes">
                      <strong>Mapping Note:</strong> {src.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="lineage-empty-sources">
          <p>Select an entity and column above to inspect its lineage derivation.</p>
        </div>
      )}
    </div>
  );
}
