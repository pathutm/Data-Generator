import { useState, useEffect, useCallback } from 'react';
import type { UploadedFile, DatasetInfo, SubmissionResult, UserRequirements } from '../types';
import { fetchConversations, fetchMessages } from '../utils/supabaseClient';
import { UploadSection } from './UploadSection';
import { ProcessingSummary } from './ProcessingSummary';
import { DatasetPreview } from './DatasetPreview';
import { SubmissionSection } from './SubmissionSection';
import { IconLayers, IconCheck, IconSparkles, IconX, IconInfo } from './Icons';

interface SchemaUploadPageProps {
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onProcess: () => void;
  isProcessing: boolean;
  processingMessage?: string;
  processingProgress?: number;
  onCancel?: () => void;
  hasResults: boolean;
  processedZipNames: Set<string>;
  datasets: DatasetInfo[];
  onToggleDatasetSelect: (id: string) => void;
  onSelectAllDatasets: () => void;
  onDeselectAllDatasets: () => void;
  onUpdateDataset: (id: string, updates: Partial<DatasetInfo>) => void;
  onToggleTableExclude: (datasetId: string, relativePath: string) => void;
  onRemoveDataset: (id: string) => void;
  userRequirements: UserRequirements;
  onRequirementsChange: (req: UserRequirements) => void;
  onSubmissionStart: () => void;
  onSubmissionComplete: (result: SubmissionResult) => void;
  submissionResult: SubmissionResult | null;
  onNavigateToVisualisation: () => void;
}

interface DataGenRequestOption {
  id: string;
  conversationId: string;
  conversationTitle: string;
  text: string;
  date: string;
}

export function SchemaUploadPage({
  uploadedFiles,
  onFilesChange,
  onProcess,
  isProcessing,
  processingMessage = '',
  processingProgress = 0,
  onCancel,
  hasResults,
  processedZipNames,
  datasets,
  onToggleDatasetSelect,
  onSelectAllDatasets,
  onDeselectAllDatasets,
  onUpdateDataset,
  onToggleTableExclude,
  onRemoveDataset,
  userRequirements,
  onRequirementsChange,
  onSubmissionStart,
  onSubmissionComplete,
  submissionResult,
  onNavigateToVisualisation,
}: SchemaUploadPageProps) {
  const [dataGenRequests, setDataGenRequests] = useState<DataGenRequestOption[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Load prior Data Generation conversations & user messages
  useEffect(() => {
    let isMounted = true;
    async function loadPriorRequests() {
      setIsLoadingRequests(true);
      try {
        const convs = await fetchConversations();
        const allUserMsgs: DataGenRequestOption[] = [];
        for (const c of convs) {
          const msgs = await fetchMessages(c.id);
          msgs
            .filter((m) => m.role === 'user')
            .forEach((m) => {
              allUserMsgs.push({
                id: m.id,
                conversationId: c.id,
                conversationTitle: c.title || 'Untitled Request',
                text: m.content,
                date: new Date(m.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              });
            });
        }
        if (isMounted) {
          setDataGenRequests(allUserMsgs);
        }
      } catch {
        // Ignored
      } finally {
        if (isMounted) {
          setIsLoadingRequests(false);
        }
      }
    }
    loadPriorRequests();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectRequirement = useCallback(
    (reqText: string) => {
      onRequirementsChange({
        messages: reqText
          ? [
              {
                id: `req-datagen-${Date.now()}`,
                role: 'user',
                content: reqText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]
          : [],
        active_requirement: reqText,
      });
    },
    [onRequirementsChange]
  );

  const handleClearRequirement = useCallback(() => {
    onRequirementsChange({
      messages: [],
      active_requirement: '',
    });
  }, [onRequirementsChange]);

  const activeRequirementText = userRequirements.active_requirement?.trim() || '';
  const selectedRequestMeta = dataGenRequests.find(
    (r) => r.text.trim() === activeRequirementText
  );

  return (
    <div className="schema-upload-page">
      {/* ─── Success Floating Banner if schema was generated ─── */}
      {submissionResult && submissionResult.status === 'success' && (
        <div className="schema-success-banner" style={{ marginBottom: 20 }}>
          <div className="schema-success-banner__content">
            <div className="schema-success-banner__title">
              <IconCheck size={16} />
              <span>Consolidated Schema Successfully Generated!</span>
            </div>
            <p className="schema-success-banner__desc">
              Your datasets were processed by the Schema Generation workflow. You can explore the full ER diagram, columns, evidence relationships, and source lineage in the dedicated Visualisation page.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={onNavigateToVisualisation}
            id="btn-goto-visualisation"
          >
            <IconLayers size={16} />
            Open Full-Page Visualisation ➔
          </button>
        </div>
      )}

      {/* ─── 1. Upload Section ─── */}
      <UploadSection
        files={uploadedFiles}
        onFilesChange={onFilesChange}
        onProcess={onProcess}
        isProcessing={isProcessing}
        hasResults={hasResults}
        processedZipNames={processedZipNames}
      />

      {/* Processing Progress */}
      {isProcessing && (
        <section className="section" id="progress-section" style={{ marginTop: 20 }}>
          <div className="progress-message">
            <span className="progress-message__spinner" />
            {processingMessage}
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          <div className="actions-row">
            <span style={{ fontSize: 12, color: '#718096' }}>
              {Math.round(processingProgress)}% complete
            </span>
            {onCancel && (
              <button className="btn btn--danger btn--sm" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </section>
      )}

      {/* ─── 2. Processing Summary ─── */}
      {hasResults && !isProcessing && (
        <div style={{ marginTop: 24 }}>
          <ProcessingSummary datasets={datasets} />
        </div>
      )}

      {/* ─── 3. Dataset & Table Inspection ─── */}
      {hasResults && (
        <div style={{ marginTop: 24 }}>
          <DatasetPreview
            datasets={datasets}
            onToggleDatasetSelect={onToggleDatasetSelect}
            onSelectAllDatasets={onSelectAllDatasets}
            onDeselectAllDatasets={onDeselectAllDatasets}
            onUpdateDataset={onUpdateDataset}
            onToggleTableExclude={onToggleTableExclude}
            onRemoveDataset={onRemoveDataset}
          />
        </div>
      )}

      {/* ─── 4. Schema Requirement Selector (Captured from Data Generation Agent) ─── */}
      {hasResults && !isProcessing && (
        <section className="section" id="schema-requirement-selector" style={{ marginTop: 24 }}>
          <div className="section__header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="section__title">
                <IconSparkles className="section__title-icon" size={20} style={{ color: 'var(--color-primary)' }} />
                Schema Consolidation Requirement (from Data Generation Agent)
              </h2>
              <p className="section__description" style={{ marginBottom: 0 }}>
                Select an original business goal from your Data Generation chat history to guide how entities are named, grouped, and related. Your uploaded datasets, tables, and columns remain strictly preserved.
              </p>
            </div>
            {activeRequirementText && (
              <span className="badge badge--info" style={{ fontSize: 12, padding: '4px 10px' }}>
                Requirement Active
              </span>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            {/* Dropdown selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                htmlFor="data-gen-req-select"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}
              >
                Choose original Data Generation request:
              </label>

              <select
                id="data-gen-req-select"
                value={activeRequirementText}
                onChange={(e) => handleSelectRequirement(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">
                  None — Standard consolidation (no specific user requirement)
                </option>
                {dataGenRequests.map((req) => (
                  <option key={req.id} value={req.text}>
                    {req.conversationTitle}: &ldquo;{req.text.length > 70 ? req.text.substring(0, 70) + '…' : req.text}&rdquo; ({req.date})
                  </option>
                ))}
              </select>
            </div>

            {/* Active requirement display card */}
            {activeRequirementText ? (
              <div
                style={{
                  marginTop: 14,
                  padding: '14px 18px',
                  background: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                      }}
                    >
                      Applied Goal:
                    </span>
                    {selectedRequestMeta && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        from &ldquo;{selectedRequestMeta.conversationTitle}&rdquo; ({selectedRequestMeta.date})
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: 'var(--color-text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    &ldquo;{activeRequirementText}&rdquo;
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                    This goal will be included in the webhook payload (<code>user_requirement</code>) to guide entity consolidation in the Schema Generation workflow.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--secondary btn--xs"
                  onClick={handleClearRequirement}
                  style={{ flexShrink: 0 }}
                  title="Clear this requirement and use default consolidation"
                >
                  <IconX size={12} />
                  Clear
                </button>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  background: 'var(--color-bg-light)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--color-text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <IconInfo size={14} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
                <span>
                  No requirement selected. Schema will be generated using standard consolidation heuristics based solely on source tables and column names.
                </span>
              </div>
            )}

            {/* Quick-pick chips for recent requests */}
            {!activeRequirementText && dataGenRequests.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginRight: 8 }}>
                  Recent requests:
                </span>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {dataGenRequests.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="chat-chip-btn"
                      onClick={() => handleSelectRequirement(r.text)}
                      title="Use this request as the schema consolidation requirement"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      &ldquo;{r.text.length > 40 ? r.text.substring(0, 40) + '…' : r.text}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoadingRequests && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                Loading prior requests…
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── 5. Submit to Workflow Section ─── */}
      {hasResults && !isProcessing && (
        <div style={{ marginTop: 24 }}>
          <SubmissionSection
            datasets={datasets}
            userRequirements={userRequirements}
            onSubmissionStart={onSubmissionStart}
            onSubmissionComplete={onSubmissionComplete}
          />
        </div>
      )}
    </div>
  );
}
