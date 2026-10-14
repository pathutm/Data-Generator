import type { SchemaSummary } from '../types/schema';
import { IconDatabase, IconTable, IconLink, IconCheck, IconWarning } from './Icons';

interface SchemaSummaryCardsProps {
  summary: SchemaSummary;
}

export function SchemaSummaryCards({ summary }: SchemaSummaryCardsProps) {
  return (
    <div className="summary-grid" style={{ marginBottom: 24 }}>
      <div className="metric-card">
        <div className="metric-card__header">
          <span className="metric-card__label">Consolidated Entities</span>
          <div className="metric-card__icon metric-card__icon--primary">
            <IconDatabase size={18} />
          </div>
        </div>
        <div className="metric-card__value">{summary.total_entities}</div>
        <div className="metric-card__subtext">Target schema tables</div>
      </div>

      <div className="metric-card">
        <div className="metric-card__header">
          <span className="metric-card__label">Total Columns</span>
          <div className="metric-card__icon metric-card__icon--info">
            <IconTable size={18} />
          </div>
        </div>
        <div className="metric-card__value">{summary.total_columns}</div>
        <div className="metric-card__subtext">Consolidated attributes</div>
      </div>

      <div className="metric-card">
        <div className="metric-card__header">
          <span className="metric-card__label">Total Relationships</span>
          <div className="metric-card__icon metric-card__icon--accent">
            <IconLink size={18} />
          </div>
        </div>
        <div className="metric-card__value">{summary.total_relationships}</div>
        <div className="metric-card__subtext">Inter-entity connections</div>
      </div>

      <div className="metric-card">
        <div className="metric-card__header">
          <span className="metric-card__label">Confirmed Relationships</span>
          <div className="metric-card__icon metric-card__icon--success">
            <IconCheck size={18} />
          </div>
        </div>
        <div className="metric-card__value" style={{ color: 'var(--color-success)' }}>
          {summary.confirmed_relationships}
        </div>
        <div className="metric-card__subtext">
          {summary.total_relationships > 0
            ? `${Math.round((summary.confirmed_relationships / summary.total_relationships) * 100)}% verified`
            : 'Verified connections'}
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-card__header">
          <span className="metric-card__label">Uncertain Mappings</span>
          <div className="metric-card__icon metric-card__icon--warning">
            <IconWarning size={18} />
          </div>
        </div>
        <div
          className="metric-card__value"
          style={{ color: summary.uncertain_mappings > 0 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}
        >
          {summary.uncertain_mappings}
        </div>
        <div className="metric-card__subtext">
          {summary.uncertain_mappings > 0 ? 'Require human verification' : 'None flagged'}
        </div>
      </div>
    </div>
  );
}
