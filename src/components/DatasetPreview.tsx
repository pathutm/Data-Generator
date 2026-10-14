import { useState, useCallback } from 'react';
import type { DatasetInfo } from '../types';
import { DatasetCard } from './DatasetCard';
import { IconTable, IconCheck, IconX } from './Icons';

interface DatasetPreviewProps {
  datasets: DatasetInfo[];
  onToggleDatasetSelect: (id: string) => void;
  onSelectAllDatasets: () => void;
  onDeselectAllDatasets: () => void;
  onUpdateDataset: (id: string, updates: Partial<DatasetInfo>) => void;
  onToggleTableExclude: (datasetId: string, relativePath: string) => void;
  onRemoveDataset: (id: string) => void;
}

export function DatasetPreview({
  datasets,
  onToggleDatasetSelect,
  onSelectAllDatasets,
  onDeselectAllDatasets,
  onUpdateDataset,
  onToggleTableExclude,
  onRemoveDataset,
}: DatasetPreviewProps) {
  // Store expanded state for each dataset id so multiple datasets can remain expanded or collapsed independently
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const isExpanded = (id: string) => {
    // Default to expanded (true) if not set
    return expandedMap[id] !== undefined ? expandedMap[id] : true;
  };

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedMap((prev) => {
      const current = prev[id] !== undefined ? prev[id] : true;
      return { ...prev, [id]: !current };
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    datasets.forEach((d) => {
      next[d.id] = true;
    });
    setExpandedMap(next);
  }, [datasets]);

  const handleCollapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    datasets.forEach((d) => {
      next[d.id] = false;
    });
    setExpandedMap(next);
  }, [datasets]);

  if (datasets.length === 0) return null;

  const selectedDatasets = datasets.filter((d) => !d.excluded);
  const selectedCount = selectedDatasets.length;
  const totalCount = datasets.length;

  const totalSelectedTables = selectedDatasets.reduce(
    (sum, ds) => sum + ds.tables.filter((t) => !t.excluded).length,
    0
  );

  return (
    <section className="section" id="preview-section">
      <div className="section__header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="section__title">
            <IconTable className="section__title-icon" size={20} />
            Dataset &amp; Table Preview
          </h2>
          <p className="section__description" style={{ marginBottom: 0 }}>
            {selectedCount} of {totalCount} dataset{totalCount !== 1 ? 's' : ''} selected for submission ({totalSelectedTables} approved table{totalSelectedTables !== 1 ? 's' : ''}). Click header to expand/collapse.
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="btn-group" style={{ alignItems: 'center' }}>
          <button
            className="btn btn--secondary btn--sm"
            onClick={onSelectAllDatasets}
            title="Select all datasets for workflow submission"
            id="select-all-datasets-btn"
          >
            <IconCheck size={14} />
            Select All
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={onDeselectAllDatasets}
            title="Deselect all datasets from workflow submission"
            id="deselect-all-datasets-btn"
          >
            <IconX size={14} />
            Deselect All
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleExpandAll}
            title="Expand all dataset sections"
          >
            Expand All
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleCollapseAll}
            title="Collapse all dataset sections"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Dataset Cards Stack */}
      <div className="datasets-stack" style={{ marginTop: 16 }}>
        {datasets.map((ds) => (
          <DatasetCard
            key={ds.id}
            dataset={ds}
            isExpanded={isExpanded(ds.id)}
            onToggleExpand={() => handleToggleExpand(ds.id)}
            onToggleSelect={onToggleDatasetSelect}
            onUpdateDataset={onUpdateDataset}
            onToggleTableExclude={onToggleTableExclude}
            onRemoveDataset={onRemoveDataset}
          />
        ))}
      </div>
    </section>
  );
}
