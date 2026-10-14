import { useState, useMemo, useEffect } from 'react';
import type { SubmissionResult } from '../types';
import type { ConsolidatedSchema } from '../types/schema';
import { normalizeConsolidatedSchema } from '../utils/schemaNormalizer';
import { SchemaSummaryCards } from './SchemaSummaryCards';
import { SchemaDiagram } from './SchemaDiagram';
import { TablesColumnsExplorer } from './TablesColumnsExplorer';
import { MappingsAndUncertainties } from './MappingsAndUncertainties';
import { SourceLineageInspector } from './SourceLineageInspector';
import {
  IconCpu,
  IconCode,
  IconX,
  IconWarning,
  IconInfo,
} from './Icons';

interface ConsolidatedSchemaVisualizationProps {
  result: SubmissionResult | null;
  isSubmitting: boolean;
}

export function ConsolidatedSchemaVisualization({
  result,
  isSubmitting,
}: ConsolidatedSchemaVisualizationProps) {
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null);
  const [showRawJsonModal, setShowRawJsonModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isSubmitting) return;
    const start = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [isSubmitting]);

  // Normalize the webhook response
  const parsedSchema: ConsolidatedSchema | null = useMemo(() => {
    if (!result || result.status !== 'success' || !result.responseBody) {
      return null;
    }
    return normalizeConsolidatedSchema(result.responseBody, result.submittedAt);
  }, [result]);

  // Synchronized selection handlers
  const handleSelectEntity = (entityName: string) => {
    setSelectedEntityName(entityName);
    // Auto-select first column if no column selected or if column not in new entity
    if (parsedSchema) {
      const ent = parsedSchema.entities.find((e) => e.name === entityName);
      if (ent && ent.columns.length > 0) {
        if (!selectedColumnName || !ent.columns.some((c) => c.name === selectedColumnName)) {
          setSelectedColumnName(ent.columns[0].name);
        }
      } else {
        setSelectedColumnName(null);
      }
    }
  };

  const handleSelectColumn = (entityName: string, columnName: string) => {
    setSelectedEntityName(entityName);
    setSelectedColumnName(columnName);
  };

  return (
    <section className="section" id="consolidated-schema-visualization-section">
      {/* Section Header */}
      <div className="section__header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="section__title">
            <IconCpu className="section__title-icon" size={22} />
            Consolidated Schema Visualizations
          </h2>
          <p className="section__description" style={{ marginBottom: 0 }}>
            Explore the consolidated schema generated from the datasets submitted to the workflow.
          </p>
        </div>

        {/* Action buttons (Raw JSON preview, Run timestamp) */}
        {parsedSchema && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {result?.submittedAt && (
              <span className="diagram-meta-pill">
                Run: {result.submittedAt}
              </span>
            )}
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setShowRawJsonModal(true)}
              id="view-schema-raw-json-btn"
            >
              <IconCode size={14} />
              View Response JSON
            </button>
          </div>
        )}
      </div>

      {/* ─── State 1: In Progress / Loading ─── */}
      {isSubmitting && (
        <div className="schema-loading-state">
          <span className="progress-message__spinner" style={{ width: 28, height: 28 }} />
          <div style={{ marginTop: 12 }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>
              Generating Consolidated Schema… ({elapsedSeconds}s elapsed)
            </h4>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              The workflow is currently executing nodes to analyze submitted tables, reconcile entities, resolve relationships, and return the consolidated output.
            </p>
          </div>
        </div>
      )}

      {/* ─── State 2: Submission Error ─── */}
      {!isSubmitting && result && result.status === 'error' && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 16 }}>
          <IconWarning className="info-banner__icon" size={20} />
          <div>
            <strong>Workflow Execution Error:</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>
              {result.errorMessage || 'Failed to receive a valid response from the schema workflow.'}
              {result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}
            </p>
            {result.responseBody !== undefined && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-primary)' }}>
                  Show error response payload
                </summary>
                <pre className="json-preview" style={{ marginTop: 8, maxHeight: 200 }}>
                  {typeof result.responseBody === 'string'
                    ? result.responseBody
                    : JSON.stringify(result.responseBody, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ─── State 3: Success but Unrecognized Output Format ─── */}
      {!isSubmitting && result && result.status === 'success' && !parsedSchema && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 16 }}>
          <IconWarning className="info-banner__icon" size={20} />
          <div>
            <strong>Unexpected Response Format:</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>
              The workflow responded with HTTP {result.httpStatus || 200}, but the response did not contain recognized entity or relationship structures.
            </p>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => setShowRawJsonModal(true)}
              >
                <IconCode size={14} />
                Inspect Raw Response
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── State 4: Idle / No Submission Yet ─── */}
      {!isSubmitting && !result && (
        <div className="schema-idle-state">
          <IconInfo size={32} style={{ color: 'var(--color-primary)', opacity: 0.8, marginBottom: 12 }} />
          <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            No Consolidated Schema Output Yet
          </h4>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 540, margin: '8px auto 0' }}>
            Select your approved tables and click <strong>Submit to Workflow</strong> above. The workflow will generate and return the consolidated schema for interactive exploration.
          </p>
        </div>
      )}

      {/* ─── State 5: Successful Parsed Schema Visualizations ─── */}
      {!isSubmitting && parsedSchema && (
        <div className="schema-viz-container" style={{ marginTop: 20 }}>
          {/* 1. Metric Summary Cards */}
          <SchemaSummaryCards summary={parsedSchema.summary} />

          {/* 2. Interactive Schema Diagram */}
          <div style={{ marginBottom: 28 }}>
            <SchemaDiagram
              entities={parsedSchema.entities}
              relationships={parsedSchema.relationships}
              selectedEntityName={selectedEntityName || parsedSchema.entities[0]?.name || null}
              selectedColumnName={selectedColumnName}
              onSelectEntity={handleSelectEntity}
              onSelectColumn={handleSelectColumn}
            />
          </div>

          {/* 3. Tables & Columns Explorer */}
          <div style={{ marginBottom: 28 }}>
            <TablesColumnsExplorer
              entities={parsedSchema.entities}
              sourceDatasets={parsedSchema.source_datasets}
              selectedEntityName={selectedEntityName || parsedSchema.entities[0]?.name || null}
              selectedColumnName={selectedColumnName}
              onSelectEntity={handleSelectEntity}
              onSelectColumn={handleSelectColumn}
            />
          </div>

          {/* 4. Relationships, Source Mappings & Uncertainties */}
          <div style={{ marginBottom: 28 }}>
            <MappingsAndUncertainties
              relationships={parsedSchema.relationships}
              sourceMappings={parsedSchema.source_mappings}
              uncertainties={parsedSchema.uncertainties}
              onSelectEntity={handleSelectEntity}
              onSelectColumn={handleSelectColumn}
            />
          </div>

          {/* 5. Source Lineage Inspection */}
          <div>
            <SourceLineageInspector
              entities={parsedSchema.entities}
              selectedEntityName={selectedEntityName || parsedSchema.entities[0]?.name || null}
              selectedColumnName={selectedColumnName}
              onSelectEntity={handleSelectEntity}
              onSelectColumn={handleSelectColumn}
            />
          </div>
        </div>
      )}

      {/* Raw Response JSON Modal */}
      {showRawJsonModal && result && (
        <div className="modal-overlay" onClick={() => setShowRawJsonModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">
                <IconCode size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                Workflow Response Payload (HTTP {result.httpStatus || 200})
              </span>
              <button
                className="modal__close"
                onClick={() => setShowRawJsonModal(false)}
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="modal__body">
              <pre className="json-preview">
                {typeof result.responseBody === 'string'
                  ? result.responseBody
                  : JSON.stringify(result.responseBody, null, 2)}
              </pre>
            </div>
            <div className="modal__footer">
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    typeof result.responseBody === 'string'
                      ? result.responseBody
                      : JSON.stringify(result.responseBody, null, 2)
                  );
                }}
              >
                Copy JSON
              </button>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => setShowRawJsonModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
