import type {
  DatasetInfo,
  SubmissionPayload,
  PayloadDataset,
  PayloadTable,
  UserRequirements,
} from '../types';

/**
 * Build the submission payload from approved datasets.
 * Only includes datasets and tables that are not excluded.
 * Validates all counts match actual content.
 */
export function buildPayload(
  datasets: DatasetInfo[],
  userRequirements?: UserRequirements
): SubmissionPayload {
  // Only include datasets that are explicitly selected (!excluded) and completed
  const approvedDatasets = datasets.filter(
    (d) => !d.excluded && d.processing_status === 'complete'
  );

  const payloadDatasets: PayloadDataset[] = [];

  for (const ds of approvedDatasets) {
    // Only include tables that are not excluded
    const approvedTables = ds.tables.filter((t) => !t.excluded);
    if (approvedTables.length === 0) continue;

    const payloadTables: PayloadTable[] = approvedTables.map((t) => {
      const pt: PayloadTable = {
        table_name: t.table_name,
        original_filename: t.original_filename,
        relative_path: t.relative_path,
        column_count: t.column_count,
        columns: [...t.columns],
        header_row: [...t.header_row],
        sample_rows: t.sample_rows,
        total_data_rows: t.total_data_rows,
        parse_status: t.parse_status,
        warnings: [...t.warnings],
      };
      if (t.sample_row_representation) {
        pt.sample_row_representation = t.sample_row_representation;
      }
      return pt;
    });

    payloadDatasets.push({
      dataset_name: ds.dataset_name,
      original_zip_filename: ds.original_zip_filename,
      table_count: payloadTables.length,
      tables: payloadTables,
    });
  }

  const totalTableCount = payloadDatasets.reduce(
    (sum, ds) => sum + ds.table_count,
    0
  );

  const activeRequirement = userRequirements?.active_requirement?.trim() || '';

  return {
    datasets: payloadDatasets,
    summary: {
      dataset_count: payloadDatasets.length,
      total_table_count: totalTableCount,
    },
    user_requirement: activeRequirement,
    user_requirements: userRequirements || {
      messages: [],
      active_requirement: '',
    },
  };
}

/**
 * Validate payload consistency.
 * Returns array of validation error messages (empty if valid).
 */
export function validatePayload(payload: SubmissionPayload): string[] {
  const errors: string[] = [];

  if (payload.summary.dataset_count !== payload.datasets.length) {
    errors.push(
      `Summary dataset_count (${payload.summary.dataset_count}) does not match actual dataset count (${payload.datasets.length}).`
    );
  }

  let actualTotalTables = 0;
  for (const ds of payload.datasets) {
    if (ds.table_count !== ds.tables.length) {
      errors.push(
        `Dataset "${ds.dataset_name}" table_count (${ds.table_count}) does not match actual table count (${ds.tables.length}).`
      );
    }
    actualTotalTables += ds.tables.length;

    for (const t of ds.tables) {
      if (t.column_count !== t.columns.length) {
        errors.push(
          `Table "${t.table_name}" column_count (${t.column_count}) does not match actual column count (${t.columns.length}).`
        );
      }
      if (t.header_row.length !== t.columns.length) {
        errors.push(
          `Table "${t.table_name}" header_row length (${t.header_row.length}) does not match columns length (${t.columns.length}).`
        );
      }
    }
  }

  if (payload.summary.total_table_count !== actualTotalTables) {
    errors.push(
      `Summary total_table_count (${payload.summary.total_table_count}) does not match actual total (${actualTotalTables}).`
    );
  }

  if (payload.datasets.length === 0) {
    errors.push('Payload contains no datasets.');
  }

  // Check JSON serializability
  try {
    JSON.stringify(payload);
  } catch {
    errors.push('Payload is not JSON-serializable.');
  }

  return errors;
}
