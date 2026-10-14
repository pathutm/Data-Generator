// ─── Core Data Types ─────────────────────────────────────────────

export interface TableInfo {
  table_name: string;
  original_filename: string;
  relative_path: string;
  column_count: number;
  columns: string[];
  header_row: string[];
  sample_rows: Record<string, string>[] | string[][];
  sample_row_representation?: 'object' | 'array';
  total_data_rows: number;
  parse_status: 'success' | 'warning' | 'error';
  warnings: string[];
  excluded: boolean;
  detected_delimiter: string;
  has_duplicate_headers: boolean;
  duplicate_header_names: string[];
}

export interface DatasetInfo {
  id: string;
  dataset_name: string;
  original_zip_filename: string;
  table_count: number;
  tables: TableInfo[];
  skipped_files: SkippedFileInfo[];
  nested_archives: string[];
  processing_status: ProcessingStatus;
  processing_error?: string;
  excluded: boolean;
}

export interface SkippedFileInfo {
  path: string;
  reason: string;
}

// ─── Processing Status ──────────────────────────────────────────

export type ProcessingStatus =
  | 'pending'
  | 'extracting'
  | 'parsing'
  | 'complete'
  | 'error'
  | 'cancelled';

// ─── Upload ─────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  validationError?: string;
  status: 'pending' | 'valid' | 'invalid';
}

// ─── Submission ─────────────────────────────────────────────────

export type SubmissionStatus =
  | 'idle'
  | 'previewing'
  | 'submitting'
  | 'success'
  | 'error';

export interface SubmissionResult {
  status: SubmissionStatus;
  httpStatus?: number;
  responseBody?: unknown;
  executionId?: string;
  errorMessage?: string;
  submittedAt?: string;
}

// ─── Payload (matches Section 8 of spec) ────────────────────────

export interface PayloadTable {
  table_name: string;
  original_filename: string;
  relative_path: string;
  column_count: number;
  columns: string[];
  header_row: string[];
  sample_rows: Record<string, string>[] | string[][];
  sample_row_representation?: 'object' | 'array';
  total_data_rows: number;
  parse_status: string;
  warnings: string[];
}

export interface PayloadDataset {
  dataset_name: string;
  original_zip_filename: string;
  table_count: number;
  tables: PayloadTable[];
}

export interface PayloadSummary {
  dataset_count: number;
  total_table_count: number;
}

export interface UserRequirementMessage {
  id: string;
  role: 'user';
  content: string;
  timestamp: string;
}

export interface UserRequirements {
  messages: UserRequirementMessage[];
  active_requirement: string;
}

export interface SubmissionPayload {
  datasets: PayloadDataset[];
  summary: PayloadSummary;
  user_requirement?: string;
  user_requirements: UserRequirements;
}

export interface CollectionRunContext {
  runId: string;
  topic?: string;
  requestText?: string;
  timestamp?: string;
}

