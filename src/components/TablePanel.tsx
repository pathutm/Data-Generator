import { useState } from 'react';
import type { TableInfo } from '../types';
import {
  IconChevronRight,
  IconWarning,
  IconCheck,
} from './Icons';

interface TablePanelProps {
  table: TableInfo;
  onToggleExclude: (relativePath: string) => void;
}

export function TablePanel({ table, onToggleExclude }: TablePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const statusBadge =
    table.parse_status === 'success' ? (
      <span className="dataset-card__badge badge--success">
        <IconCheck size={10} /> OK
      </span>
    ) : table.parse_status === 'warning' ? (
      <span className="dataset-card__badge badge--warning">
        <IconWarning size={10} /> Warning
      </span>
    ) : (
      <span className="dataset-card__badge badge--error">Error</span>
    );

  // Render sample data rows
  const renderSampleTable = () => {
    if (table.column_count === 0) {
      return (
        <div className="sample-table__empty">No headers found in this file.</div>
      );
    }

    const sampleRows = table.sample_rows;
    const isArrayMode = table.has_duplicate_headers;

    return (
      <div className="sample-table-wrapper">
        <table className="sample-table">
          <thead>
            <tr>
              {table.header_row.map((col, i) => (
                <th key={i}>{col || <em>(empty)</em>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.column_count}
                  style={{ textAlign: 'center', fontStyle: 'italic', color: '#718096' }}
                >
                  No data rows found.
                </td>
              </tr>
            ) : isArrayMode ? (
              (sampleRows as string[][]).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              (sampleRows as Record<string, string>[]).map((row, ri) => (
                <tr key={ri}>
                  {table.columns.map((col, ci) => (
                    <td key={ci}>{row[col] ?? ''}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className={`table-panel ${table.excluded ? 'table-panel--excluded' : ''}`}
    >
      <div
        className="table-panel__header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={`Table: ${table.table_name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <IconChevronRight
          className={`table-panel__chevron ${isOpen ? 'table-panel__chevron--open' : ''}`}
          size={14}
        />
        <span className="table-panel__title">{table.table_name}</span>
        <div className="table-panel__info">
          <span className="table-panel__chip">
            {table.column_count} col{table.column_count !== 1 ? 's' : ''}
          </span>
          <span className="table-panel__chip">
            {table.total_data_rows} row{table.total_data_rows !== 1 ? 's' : ''}
          </span>
          {statusBadge}
        </div>
      </div>

      {isOpen && (
        <div className="table-panel__body">
          {/* Table metadata */}
          <div className="table-detail__row">
            <span className="table-detail__label">Filename:</span>
            <span className="table-detail__value">{table.original_filename}</span>
          </div>
          <div className="table-detail__row">
            <span className="table-detail__label">Path:</span>
            <span className="table-detail__value">{table.relative_path}</span>
          </div>
          <div className="table-detail__row">
            <span className="table-detail__label">Delimiter:</span>
            <span className="table-detail__value">
              {table.detected_delimiter === ',' ? 'Comma (,)' :
               table.detected_delimiter === '\t' ? 'Tab' :
               table.detected_delimiter === ';' ? 'Semicolon (;)' :
               table.detected_delimiter === '|' ? 'Pipe (|)' :
               `"${table.detected_delimiter}"`}
            </span>
          </div>
          <div className="table-detail__row">
            <span className="table-detail__label">Columns:</span>
            <span className="table-detail__value">{table.column_count}</span>
          </div>

          {/* Column tags */}
          {table.columns.length > 0 && (
            <div className="columns-list">
              {table.columns.map((col, i) => (
                <span key={i} className="column-tag">
                  {col || <em>(empty)</em>}
                </span>
              ))}
            </div>
          )}

          {/* Warnings */}
          {table.warnings.length > 0 && (
            <div className="warnings-list">
              {table.warnings.map((w, i) => (
                <div key={i} className="warning-item">
                  <IconWarning className="warning-item__icon" size={14} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sample data */}
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: '#4a5568', marginBottom: 6 }}>
            Sample Data (first {Math.min(table.total_data_rows, 3)} of {table.total_data_rows} rows)
          </div>
          {renderSampleTable()}

          {/* Exclude toggle */}
          <div style={{ marginTop: 12 }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={table.excluded}
                onChange={() => onToggleExclude(table.relative_path)}
              />
              Exclude this table from submission
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
