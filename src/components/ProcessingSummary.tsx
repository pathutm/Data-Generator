import type { DatasetInfo } from '../types';
import { IconDatabase, IconTable, IconCheck, IconWarning } from './Icons';

interface ProcessingSummaryProps {
  datasets: DatasetInfo[];
}

export function ProcessingSummary({ datasets }: ProcessingSummaryProps) {
  if (datasets.length === 0) return null;

  const totalDatasets = datasets.length;
  const selectedDatasets = datasets.filter((d) => !d.excluded);
  const selectedDatasetsCount = selectedDatasets.length;

  const allTablesCount = datasets.reduce(
    (sum, ds) => sum + ds.tables.length,
    0
  );

  const selectedTablesCount = selectedDatasets.reduce(
    (sum, ds) => sum + ds.tables.filter((t) => !t.excluded).length,
    0
  );

  const successTables = datasets.reduce(
    (sum, ds) =>
      sum +
      ds.tables.filter((t) => t.parse_status === 'success')
        .length,
    0
  );
  const warningTables = datasets.reduce(
    (sum, ds) =>
      sum +
      ds.tables.filter((t) => t.parse_status === 'warning')
        .length,
    0
  );
  const errorTables = datasets.reduce(
    (sum, ds) =>
      sum +
      ds.tables.filter((t) => t.parse_status === 'error')
        .length,
    0
  );

  return (
    <section className="section" id="summary-section">
      <div className="section__header">
        <h2 className="section__title">
          <IconDatabase className="section__title-icon" size={20} />
          Processing Summary
        </h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__value">
            {selectedDatasetsCount}{' '}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#718096' }}>
              / {totalDatasets}
            </span>
          </div>
          <div className="stat-card__label">
            Selected Dataset{totalDatasets !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__value">
            {selectedTablesCount}{' '}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#718096' }}>
              / {allTablesCount}
            </span>
          </div>
          <div className="stat-card__label">
            Approved Table{allTablesCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__value">{successTables}</div>
          <div className="stat-card__label">
            <IconCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            Parsed OK
          </div>
        </div>

        {warningTables > 0 && (
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: '#d97706' }}>
              {warningTables}
            </div>
            <div className="stat-card__label">
              <IconWarning size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              With Warnings
            </div>
          </div>
        )}

        {errorTables > 0 && (
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: '#dc2626' }}>
              {errorTables}
            </div>
            <div className="stat-card__label">Parse Errors</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#718096', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        <IconTable size={14} />
        {datasets.map((ds, i) => {
          const isSelected = !ds.excluded;
          const activeCount = ds.tables.filter((t) => !t.excluded).length;
          return (
            <span
              key={ds.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                opacity: isSelected ? 1 : 0.6,
                textDecoration: isSelected ? 'none' : 'line-through',
              }}
            >
              <strong>{ds.dataset_name}</strong> ({activeCount}/{ds.tables.length} tables {isSelected ? 'selected' : 'excluded'})
              {i < datasets.length - 1 && <span style={{ textDecoration: 'none', marginLeft: 4 }}>·</span>}
            </span>
          );
        })}
      </div>
    </section>
  );
}
