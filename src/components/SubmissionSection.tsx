import { useState, useCallback, useMemo, useEffect } from 'react';
import type { DatasetInfo, SubmissionPayload, SubmissionResult, UserRequirements } from '../types';
import { buildPayload, validatePayload } from '../utils/payloadBuilder';
import { submitPayload } from '../utils/webhookClient';
import { WEBHOOK_URL, WEBHOOK_TEST_URL, WEBHOOK_TIMEOUT_MS, resolveWebhookUrl } from '../config';
import { IconSend, IconEye, IconCode, IconX, IconWarning, IconCheck, IconRefresh } from './Icons';

interface SubmissionSectionProps {
  datasets: DatasetInfo[];
  userRequirements: UserRequirements;
  onSubmissionStart?: () => void;
  onSubmissionComplete?: (result: SubmissionResult) => void;
}

type WebhookMode = 'test' | 'production';

export function SubmissionSection({
  datasets,
  userRequirements,
  onSubmissionStart,
  onSubmissionComplete,
}: SubmissionSectionProps) {
  const [webhookMode, setWebhookMode] = useState<WebhookMode>('test');
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);
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

  const selectedDatasets = datasets.filter(
    (d) => !d.excluded && d.processing_status === 'complete'
  );

  const selectedTablesCount = selectedDatasets.reduce(
    (sum, ds) => sum + ds.tables.filter((t) => !t.excluded).length,
    0
  );

  const rawWebhookUrl = webhookMode === 'test' ? WEBHOOK_TEST_URL : WEBHOOK_URL;
  const webhookUrl = resolveWebhookUrl(rawWebhookUrl);
  const hasWebhookUrl = webhookUrl.trim() !== '';

  const payload: SubmissionPayload = useMemo(
    () => buildPayload(datasets, userRequirements),
    [datasets, userRequirements]
  );
  const validationErrors = useMemo(() => validatePayload(payload), [payload]);
  const isValid = validationErrors.length === 0;

  const hasErrorTables = selectedDatasets.some((ds) =>
    ds.tables.some((t) => !t.excluded && t.parse_status === 'error')
  );

  const hasSelection = selectedDatasets.length > 0 && selectedTablesCount > 0;

  const canSubmit =
    hasSelection &&
    isValid &&
    hasWebhookUrl &&
    !isSubmitting &&
    !hasErrorTables;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setResult(null);
    onSubmissionStart?.();

    try {
      const submissionResult = await submitPayload(payload, webhookUrl);
      setResult(submissionResult);
      setHasSubmittedOnce(true);
      onSubmissionComplete?.(submissionResult);
    } catch {
      const errResult: SubmissionResult = {
        status: 'error',
        errorMessage: 'An unexpected error occurred during submission.',
      };
      setResult(errResult);
      onSubmissionComplete?.(errResult);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, payload, webhookUrl, onSubmissionStart, onSubmissionComplete]);

  if (datasets.length === 0) {
    return null;
  }

  return (
    <section className="section" id="submission-section">
      <div className="section__header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="section__title">
            <IconSend className="section__title-icon" size={20} />
            Submit to Workflow
          </h2>
          <p className="section__description" style={{ marginBottom: 0 }}>
            {hasSelection ? (
              <>
                Ready to submit <strong>{payload.summary.dataset_count} dataset{payload.summary.dataset_count !== 1 ? 's' : ''}</strong> with{' '}
                <strong>{payload.summary.total_table_count} table{payload.summary.total_table_count !== 1 ? 's' : ''}</strong> to the schema-generation workflow.
              </>
            ) : (
              <span style={{ color: '#dc2626' }}>
                No datasets or tables are selected for submission.
              </span>
            )}
          </p>
        </div>

        {/* Selected Counter Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={`dataset-card__badge ${hasSelection ? 'badge--info' : 'badge--warning'}`}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            {selectedDatasets.length} Dataset{selectedDatasets.length !== 1 ? 's' : ''} · {selectedTablesCount} Table{selectedTablesCount !== 1 ? 's' : ''} Selected
          </span>
        </div>
      </div>

      {/* Webhook configuration */}
      <div className="submission-config" style={{ marginTop: 16 }}>
        <div className="webhook-select">
          <span className="webhook-select__label">Webhook endpoint:</span>
          <div className="webhook-select__group">
            <button
              className={`webhook-select__btn ${webhookMode === 'test' ? 'webhook-select__btn--active' : ''}`}
              onClick={() => {
                setWebhookMode('test');
                setResult(null);
              }}
            >
              Test
            </button>
            <button
              className={`webhook-select__btn ${webhookMode === 'production' ? 'webhook-select__btn--active' : ''}`}
              onClick={() => {
                setWebhookMode('production');
                setResult(null);
              }}
            >
              Production
            </button>
          </div>
        </div>

        {hasWebhookUrl ? (
          <div className="webhook-url-display">{webhookUrl}</div>
        ) : (
          <div className="webhook-url-display webhook-url-display--empty">
            No {webhookMode} webhook URL configured. Set{' '}
            {webhookMode === 'test'
              ? 'VITE_SCHEMA_WORKFLOW_WEBHOOK_TEST_URL'
              : 'VITE_SCHEMA_WORKFLOW_WEBHOOK_URL'}{' '}
            in your .env file.
          </div>
        )}

        <div style={{ fontSize: 12, color: '#718096' }}>
          Timeout: {WEBHOOK_TIMEOUT_MS / 1000}s
          {hasSubmittedOnce && result?.status === 'success' && (
            <span style={{ marginLeft: 12, color: '#d97706' }}>
              ⚠ A submission was already sent. Resubmitting may cause duplicate
              processing.
            </span>
          )}
        </div>
      </div>

      {/* Validation warning if no datasets/tables selected */}
      {!hasSelection && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 12, marginBottom: 12 }}>
          <IconWarning className="info-banner__icon" size={16} />
          <div>
            <strong>No content selected for submission:</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>
              Please select at least one dataset and approved table in the preview above to enable workflow submission.
            </p>
          </div>
        </div>
      )}

      {/* Payload Validation errors */}
      {hasSelection && !isValid && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 12, marginBottom: 12 }}>
          <IconWarning className="info-banner__icon" size={16} />
          <div>
            <strong>Payload validation issues:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {validationErrors.map((err, i) => (
                <li key={i} style={{ fontSize: 12 }}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {hasErrorTables && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 12, marginBottom: 12 }}>
          <IconWarning className="info-banner__icon" size={16} />
          <span>
            Some selected tables have parsing errors. Exclude them or resolve the errors
            before submitting.
          </span>
        </div>
      )}

      {/* Active Schema Requirement Preview */}
      <div className="submission-requirement-preview" style={{ marginTop: 16 }}>
        <div className="submission-requirement-preview__header">
          <span className="submission-requirement-preview__label">
            Schema Requirement Guidance:
          </span>
          {userRequirements.active_requirement?.trim() ? (
            <span className="dataset-card__badge badge--success" style={{ fontSize: 11, padding: '2px 8px' }}>
              <IconCheck size={10} style={{ display: 'inline', marginRight: 4 }} />
              Custom Requirement Active
            </span>
          ) : (
            <span className="dataset-card__badge badge--neutral" style={{ fontSize: 11, padding: '2px 8px' }}>
              Default Consolidation (No Custom Prompt)
            </span>
          )}
        </div>
        <div className="submission-requirement-preview__text">
          {userRequirements.active_requirement?.trim() ? (
            <>
              <div style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 13 }}>
                &ldquo;{userRequirements.active_requirement}&rdquo;
              </div>
              <div style={{ fontSize: 11, color: '#718096', marginTop: 4 }}>
                Transmitted via <code>payload.user_requirement</code> to guide entity consolidation in the Schema Generation workflow.
              </div>
            </>
          ) : (
            <div style={{ color: '#718096', fontStyle: 'italic', fontSize: 12 }}>
              No custom requirement selected above. The workflow will apply default heuristics to cluster tables and infer entity relationships.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="btn-group" style={{ marginTop: 16 }}>
        <button
          className="btn btn--secondary"
          onClick={() => setShowPayloadModal(true)}
          id="preview-payload-button"
          disabled={!hasSelection}
        >
          <IconEye size={14} />
          Preview Selected Payload
        </button>
        <button
          className="btn btn--primary btn--lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          id="submit-button"
        >
          {isSubmitting ? (
            <>
              <span className="progress-message__spinner" />
              Submitting… ({elapsedSeconds}s)
            </>
          ) : hasSubmittedOnce && result?.status === 'success' ? (
            <>
              <IconRefresh size={14} />
              Resubmit ({selectedDatasets.length} Dataset{selectedDatasets.length !== 1 ? 's' : ''})
            </>
          ) : (
            <>
              <IconSend size={14} />
              Submit to Workflow ({selectedDatasets.length} Dataset{selectedDatasets.length !== 1 ? 's' : ''})
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {result && result.status === 'success' && (
        <div className="result-box result-box--success" style={{ marginTop: 16 }}>
          <div className="result-box__title">
            <IconCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Submission Successful
          </div>
          <div className="result-box__detail">
            HTTP {result.httpStatus} · Submitted {payload.summary.dataset_count} dataset(s) ({payload.summary.total_table_count} table(s)) at {result.submittedAt}
          </div>
          {payload.user_requirements.active_requirement && (
            <div className="result-box__detail" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
              Guidance Used: &ldquo;{payload.user_requirements.active_requirement}&rdquo;
            </div>
          )}
          {result.executionId && (
            <div className="result-box__detail">
              Execution ID: <code>{result.executionId}</code>
            </div>
          )}
          {result.responseBody !== undefined && (
            <div className="result-box__response">
              {typeof result.responseBody === 'string'
                ? result.responseBody
                : JSON.stringify(result.responseBody, null, 2)}
            </div>
          )}
        </div>
      )}

      {result && result.status === 'error' && (
        <div className="result-box result-box--error" style={{ marginTop: 16 }}>
          <div className="result-box__title">Submission Failed</div>
          <div className="result-box__detail">{result.errorMessage}</div>
          {result.httpStatus && (
            <div className="result-box__detail">HTTP Status: {result.httpStatus}</div>
          )}
          {result.responseBody !== undefined && (
            <div className="result-box__response">
              {typeof result.responseBody === 'string'
                ? result.responseBody
                : JSON.stringify(result.responseBody, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* Payload Preview Modal */}
      {showPayloadModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPayloadModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">
                <IconCode size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                JSON Payload Preview ({payload.summary.dataset_count} dataset{payload.summary.dataset_count !== 1 ? 's' : ''}, {payload.summary.total_table_count} table{payload.summary.total_table_count !== 1 ? 's' : ''})
              </span>
              <button
                className="modal__close"
                onClick={() => setShowPayloadModal(false)}
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="modal__body">
              <pre className="json-preview">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
            <div className="modal__footer">
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(payload, null, 2)
                  );
                }}
              >
                Copy to Clipboard
              </button>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => setShowPayloadModal(false)}
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
