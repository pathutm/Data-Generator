import { useState, useCallback } from 'react';
import type { DatasetInfo } from '../types';
import { TablePanel } from './TablePanel';
import {
  IconChevronRight,
  IconFolder,
  IconWarning,
  IconEdit,
  IconCheck,
  IconTrash,
  IconInfo,
} from './Icons';

interface DatasetCardProps {
  dataset: DatasetInfo;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onToggleSelect: (id: string) => void;
  onUpdateDataset: (id: string, updates: Partial<DatasetInfo>) => void;
  onToggleTableExclude: (datasetId: string, relativePath: string) => void;
  onRemoveDataset: (id: string) => void;
}

export function DatasetCard({
  dataset,
  isExpanded,
  onToggleExpand,
  onToggleSelect,
  onUpdateDataset,
  onToggleTableExclude,
  onRemoveDataset,
}: DatasetCardProps) {
  // If isExpanded is controlled from parent, use it; otherwise use local state
  const [localIsOpen, setLocalIsOpen] = useState(true);
  const isOpen = isExpanded !== undefined ? isExpanded : localIsOpen;

  const toggleOpen = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalIsOpen((prev) => !prev);
    }
  }, [onToggleExpand]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(dataset.dataset_name);

  const activeTables = dataset.tables.filter((t) => !t.excluded);
  const warningCount = activeTables.filter(
    (t) => t.parse_status === 'warning'
  ).length;
  const errorCount = activeTables.filter(
    (t) => t.parse_status === 'error'
  ).length;

  const handleSaveName = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed) {
      onUpdateDataset(dataset.id, { dataset_name: trimmed });
    } else {
      setEditName(dataset.dataset_name);
    }
    setIsEditing(false);
  }, [editName, dataset.id, dataset.dataset_name, onUpdateDataset]);

  const handleToggleExclude = useCallback(
    (relativePath: string) => {
      onToggleTableExclude(dataset.id, relativePath);
    },
    [dataset.id, onToggleTableExclude]
  );

  const isSelected = !dataset.excluded;

  const statusBadge =
    dataset.processing_status === 'complete' ? (
      errorCount > 0 ? (
        <span className="dataset-card__badge badge--error">
          {errorCount} error{errorCount !== 1 ? 's' : ''}
        </span>
      ) : warningCount > 0 ? (
        <span className="dataset-card__badge badge--warning">
          <IconWarning size={10} /> {warningCount} warning
          {warningCount !== 1 ? 's' : ''}
        </span>
      ) : (
        <span className="dataset-card__badge badge--success">
          <IconCheck size={10} /> All OK
        </span>
      )
    ) : dataset.processing_status === 'error' ? (
      <span className="dataset-card__badge badge--error">Error</span>
    ) : null;

  return (
    <div
      className={`dataset-card ${!isSelected ? 'dataset-card--excluded' : ''}`}
      id={`dataset-${dataset.id}`}
    >
      {/* Header */}
      <div
        className="dataset-card__header"
        onClick={toggleOpen}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={`Dataset: ${dataset.dataset_name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        <IconChevronRight
          className={`dataset-card__chevron ${isOpen ? 'dataset-card__chevron--open' : ''}`}
          size={18}
        />

        {/* Submission Selection Checkbox */}
        <div
          className="dataset-card__select-box"
          onClick={(e) => e.stopPropagation()}
          title={isSelected ? 'Selected for submission (click to exclude)' : 'Excluded from submission (click to include)'}
        >
          <label className="checkbox-label" style={{ margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(dataset.id);
              }}
              aria-label={`Select ${dataset.dataset_name} for workflow submission`}
            />
            <span
              className={`dataset-card__badge ${isSelected ? 'badge--info' : ''}`}
              style={{
                fontSize: 11,
                cursor: 'pointer',
                border: isSelected ? '1px solid rgba(6, 78, 227, 0.2)' : '1px solid #cbd5e0',
                background: isSelected ? 'var(--color-primary-light)' : '#f7fafc',
                color: isSelected ? 'var(--color-primary)' : '#718096',
                fontWeight: 600,
              }}
            >
              {isSelected ? '✓ Selected' : 'Excluded'}
            </span>
          </label>
        </div>

        <div className="dataset-card__title-area">
          <div className="dataset-card__name">
            <IconFolder size={16} />
            {isEditing ? (
              <input
                className="dataset-card__name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setEditName(dataset.dataset_name);
                    setIsEditing(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              dataset.dataset_name
            )}
            {statusBadge}
          </div>
          <div className="dataset-card__meta">
            <span>{dataset.original_zip_filename}</span>
            <span>
              {activeTables.length} of {dataset.tables.length} table{dataset.tables.length !== 1 ? 's' : ''} approved
            </span>
          </div>
        </div>

        <div className="dataset-card__actions">
          <button
            className="btn btn--ghost btn--sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditName(dataset.dataset_name);
            }}
            title="Edit dataset name"
            aria-label="Edit dataset name"
          >
            <IconEdit size={14} />
          </button>
          <button
            className="btn btn--danger btn--sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveDataset(dataset.id);
            }}
            title="Remove dataset"
            aria-label="Remove dataset"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="dataset-card__body">
          {/* Processing error */}
          {dataset.processing_error && (
            <div className="info-banner info-banner--warning">
              <IconWarning className="info-banner__icon" size={16} />
              <span>{dataset.processing_error}</span>
            </div>
          )}

          {/* Skipped files */}
          {dataset.skipped_files.length > 0 && (
            <div className="info-banner info-banner--info">
              <IconInfo className="info-banner__icon" size={16} />
              <span>
                {dataset.skipped_files.length} file
                {dataset.skipped_files.length !== 1 ? 's' : ''} skipped (not
                CSV):
                {dataset.skipped_files.length <= 5
                  ? ' ' + dataset.skipped_files.map((f) => f.path).join(', ')
                  : ` ${dataset.skipped_files
                      .slice(0, 3)
                      .map((f) => f.path)
                      .join(', ')} and ${dataset.skipped_files.length - 3} more`}
              </span>
            </div>
          )}

          {/* Nested archives */}
          {dataset.nested_archives.length > 0 && (
            <div className="info-banner info-banner--warning">
              <IconWarning className="info-banner__icon" size={16} />
              <span>
                {dataset.nested_archives.length} nested ZIP archive
                {dataset.nested_archives.length !== 1 ? 's' : ''} found but not
                recursively inspected:{' '}
                {dataset.nested_archives.join(', ')}
              </span>
            </div>
          )}

          {/* No tables */}
          {dataset.tables.length === 0 && !dataset.processing_error && (
            <div className="info-banner info-banner--warning">
              <IconWarning className="info-banner__icon" size={16} />
              <span>No supported CSV tables were found in this archive.</span>
            </div>
          )}

          {/* Tables list */}
          {dataset.tables.map((table) => (
            <TablePanel
              key={table.relative_path}
              table={table}
              onToggleExclude={handleToggleExclude}
            />
          ))}

          {/* Dataset-level include/exclude toggle */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="checkbox-label" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(dataset.id)}
              />
              Include entire <strong>{dataset.dataset_name}</strong> dataset in submission
            </label>
            <span style={{ fontSize: 12, color: '#718096' }}>
              {activeTables.length} table{activeTables.length !== 1 ? 's' : ''} currently approved
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
