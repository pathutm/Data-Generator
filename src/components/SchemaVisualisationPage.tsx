import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SubmissionResult } from '../types';
import type { ConsolidatedSchema } from '../types/schema';
import { normalizeConsolidatedSchema } from '../utils/schemaNormalizer';
import { fetchSchemaRuns, saveSchemaRun, type SchemaRunRecord } from '../utils/supabaseClient';
import { SchemaSummaryCards } from './SchemaSummaryCards';
import { SchemaDiagram } from './SchemaDiagram';
import { TablesColumnsExplorer } from './TablesColumnsExplorer';
import { MappingsAndUncertainties } from './MappingsAndUncertainties';
import { SourceLineageInspector } from './SourceLineageInspector';
import {
  IconLayers,
  IconClock,
  IconCheck,
  IconCode,
  IconX,
  IconUpload,
} from './Icons';

interface SchemaVisualisationPageProps {
  currentResult: SubmissionResult | null;
  activeRequirement?: string;
  sourceDatasetNames?: string[];
  onNavigateToUpload: () => void;
}

export function SchemaVisualisationPage({
  currentResult,
  activeRequirement,
  sourceDatasetNames = [],
  onNavigateToUpload,
}: SchemaVisualisationPageProps) {
  const [historyRuns, setHistoryRuns] = useState<SchemaRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);

  // Selected entity and column for cross-component focus
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null);

  // Load history runs on mount
  const loadHistory = useCallback(async () => {
    try {
      const runs = await fetchSchemaRuns();
      setHistoryRuns(runs);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Persist currentResult when a new successful submission occurs
  useEffect(() => {
    if (!currentResult || currentResult.status !== 'success' || !currentResult.responseBody) {
      return;
    }

    const normalized = normalizeConsolidatedSchema(currentResult.responseBody);
    if (!normalized || !normalized.summary || normalized.entities.length === 0) {
      return;
    }

    const runId = `run-${Date.now()}`;
    const newRecord: SchemaRunRecord = {
      id: runId,
      schema_name: `Consolidated Schema (${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })})`,
      user_requirement: activeRequirement || undefined,
      source_dataset_names: sourceDatasetNames,
      source_table_count: normalized.entities.length,
      consolidated_entity_count: normalized.summary.total_entities,
      column_count: normalized.summary.total_columns,
      relationship_count: normalized.summary.total_relationships,
      schema_json: currentResult.responseBody,
      status: 'success',
      created_at: new Date().toISOString(),
    };

    saveSchemaRun(newRecord).then(() => {
      loadHistory();
    });
  }, [currentResult, activeRequirement, sourceDatasetNames, loadHistory]);

  // Determine active raw schema: from selected historical run or current submission
  const activeRawData = useMemo(() => {
    if (selectedRunId) {
      const found = historyRuns.find((r) => r.id === selectedRunId);
      if (found) return found.schema_json;
    }
    if (currentResult && currentResult.status === 'success') {
      return currentResult.responseBody;
    }
    if (historyRuns.length > 0) {
      return historyRuns[0].schema_json;
    }
    return null;
  }, [selectedRunId, historyRuns, currentResult]);

  // Normalize into canonical schema model
  const normalizedSchema: ConsolidatedSchema = useMemo(() => {
    const emptySchema: ConsolidatedSchema = {
      raw_response: null,
      received_at: new Date().toISOString(),
      entities: [],
      relationships: [],
      source_mappings: [],
      uncertainties: [],
      source_datasets: [],
      summary: {
        total_entities: 0,
        total_columns: 0,
        total_relationships: 0,
        mapped_relationships: 0,
        unresolved_relationships: 0,
        confirmed_relationships: 0,
        uncertain_relationships: 0,
        uncertain_mappings: 0,
      },
    };
    if (!activeRawData) {
      return emptySchema;
    }
    const result = normalizeConsolidatedSchema(activeRawData);
    return result || emptySchema;
  }, [activeRawData]);

  const activeRunRecord = useMemo(() => {
    if (selectedRunId) {
      return historyRuns.find((r) => r.id === selectedRunId) || null;
    }
    if (historyRuns.length > 0 && !currentResult) {
      return historyRuns[0];
    }
    return null;
  }, [selectedRunId, historyRuns, currentResult]);

  const handleSelectEntity = useCallback((entityName: string) => {
    setSelectedEntityName(entityName);
    setSelectedColumnName(null);
  }, []);

  const handleSelectColumn = useCallback((entityName: string, columnName: string) => {
    setSelectedEntityName(entityName);
    setSelectedColumnName(columnName);
  }, []);

  // Empty state if no schema available
  if (!activeRawData || normalizedSchema.entities.length === 0) {
    return (
      <div className="section visualisation-empty-container">
        <div className="visualisation-empty-card">
          <div className="visualisation-empty-icon">
            <IconLayers size={48} />
          </div>
          <h2 className="visualisation-empty-title">No Schema Generated Yet</h2>
          <p className="visualisation-empty-desc">
            The Visualisation page displays the unified schema returned by the Schema Generation Agent workflow. To generate an interactive schema, upload your dataset ZIP archives and submit them to the workflow.
          </p>
          <div className="visualisation-empty-actions">
            <button
              type="button"
              className="btn btn--primary btn--md"
              onClick={onNavigateToUpload}
              id="btn-goto-upload-from-vis"
            >
              <IconUpload size={16} />
              Go to Upload Dataset ➔
            </button>
            {historyRuns.length > 0 && (
              <button
                type="button"
                className="btn btn--secondary btn--md"
                onClick={() => setShowHistoryDrawer(true)}
              >
                <IconClock size={16} />
                View Previous Runs ({historyRuns.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="visualisation-page-layout">
      {/* ─── Top Control Header ─── */}
      <header className="visualisation-header-bar">
        <div className="visualisation-header-bar__left">
          <div className="visualisation-header-bar__title-group">
            <IconLayers size={20} className="section__title-icon" />
            <h1 className="visualisation-header-bar__title">Consolidated Schema Visualisation</h1>
            <span className="dataset-card__badge badge--success" style={{ fontSize: 11, padding: '2px 8px' }}>
              <IconCheck size={10} style={{ display: 'inline', marginRight: 4 }} />
              Live Workflow Model
            </span>
          </div>

          <div className="visualisation-header-bar__meta">
            {activeRunRecord ? (
              <span>Run: <strong>{activeRunRecord.schema_name}</strong> · {new Date(activeRunRecord.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            ) : (
              <span>Current Workflow Submission · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {(activeRequirement || activeRunRecord?.user_requirement) && (
              <span className="requirement-pill">
                Req: &ldquo;{activeRequirement || activeRunRecord?.user_requirement}&rdquo;
              </span>
            )}
          </div>
        </div>

        <div className="visualisation-header-bar__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setShowJsonModal(true)}
            id="btn-view-schema-json"
          >
            <IconCode size={14} />
            View Raw JSON
          </button>

          <button
            type="button"
            className={`btn ${showHistoryDrawer ? 'btn--primary' : 'btn--secondary'} btn--sm`}
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            id="btn-toggle-run-history"
          >
            <IconClock size={14} />
            Run History ({historyRuns.length})
          </button>
        </div>
      </header>

      {/* ─── Main Visualisation Workspace ─── */}
      <div className="visualisation-content-wrapper">
        {/* Schema Overview Cards */}
        <div style={{ marginBottom: 20 }}>
          <SchemaSummaryCards summary={normalizedSchema.summary} />
        </div>

        {/* Interactive ER Diagram (Dedicated Full Viewport Container) */}
        <div className="diagram-container-card" style={{ marginBottom: 24 }}>
          <div className="diagram-card-header">
            <div className="diagram-card-title">
              <IconLayers size={16} />
              <span>Interactive Consolidated ER Diagram</span>
            </div>
            <span className="diagram-card-sub">
              Drag nodes to rearrange · Scroll or pinch to zoom · Click relationship connectors to view evidence
            </span>
          </div>
          <SchemaDiagram
            entities={normalizedSchema.entities}
            relationships={normalizedSchema.relationships}
            selectedEntityName={selectedEntityName}
            selectedColumnName={selectedColumnName}
            onSelectEntity={handleSelectEntity}
            onSelectColumn={handleSelectColumn}
          />
        </div>

        {/* Tables & Columns Explorer */}
        <div style={{ marginBottom: 24 }}>
          <TablesColumnsExplorer
            entities={normalizedSchema.entities}
            sourceDatasets={sourceDatasetNames}
            selectedEntityName={selectedEntityName}
            selectedColumnName={selectedColumnName}
            onSelectEntity={handleSelectEntity}
            onSelectColumn={handleSelectColumn}
          />
        </div>

        {/* Relationships Details & Uncertainty Cards */}
        <div style={{ marginBottom: 24 }}>
          <MappingsAndUncertainties
            relationships={normalizedSchema.relationships}
            uncertainties={normalizedSchema.uncertainties}
            sourceMappings={normalizedSchema.source_mappings}
          />
        </div>

        {/* Source Lineage Inspection */}
        <div style={{ marginBottom: 32 }}>
          <SourceLineageInspector
            entities={normalizedSchema.entities}
            selectedEntityName={selectedEntityName}
            selectedColumnName={selectedColumnName}
            onSelectEntity={handleSelectEntity}
            onSelectColumn={handleSelectColumn}
          />
        </div>
      </div>

      {/* ─── History Drawer ─── */}
      {showHistoryDrawer && (
        <div className="history-drawer-overlay" onClick={() => setShowHistoryDrawer(false)}>
          <aside className="history-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="history-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                <IconClock size={16} />
                <span>Permanent Schema Run History</span>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={() => setShowHistoryDrawer(false)}
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="history-drawer__body">
              {historyRuns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-tertiary)' }}>
                  No historical schema runs saved yet.
                </div>
              ) : (
                historyRuns.map((run) => {
                  const isSelected = run.id === (selectedRunId || (activeRunRecord?.id));
                  return (
                    <div
                      key={run.id}
                      className={`history-run-card ${isSelected ? 'history-run-card--active' : ''}`}
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setShowHistoryDrawer(false);
                      }}
                    >
                      <div className="history-run-card__header">
                        <span className="history-run-card__name">{run.schema_name}</span>
                        <span className="history-run-card__date">
                          {new Date(run.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {run.user_requirement && (
                        <div className="history-run-card__req">
                          &ldquo;{run.user_requirement}&rdquo;
                        </div>
                      )}

                      <div className="history-run-card__stats">
                        <span>{run.consolidated_entity_count} Entities</span>
                        <span>·</span>
                        <span>{run.column_count} Columns</span>
                        <span>·</span>
                        <span>{run.relationship_count} Links</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ─── Raw Response JSON Modal ─── */}
      {showJsonModal && (
        <div className="modal-overlay" onClick={() => setShowJsonModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px', width: '90%' }}>
            <div className="modal__header">
              <span className="modal__title">
                <IconCode size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                Schema Workflow Response JSON
              </span>
              <button className="modal__close" onClick={() => setShowJsonModal(false)}>
                <IconX size={18} />
              </button>
            </div>
            <div className="modal__body">
              <pre className="json-preview" style={{ maxHeight: '60vh' }}>
                {JSON.stringify(activeRawData, null, 2)}
              </pre>
            </div>
            <div className="modal__footer">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(activeRawData, null, 2));
                }}
              >
                Copy to Clipboard
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setShowJsonModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
