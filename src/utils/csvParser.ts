import Papa from 'papaparse';
import type { TableInfo } from '../types';
import type { ExtractedFile } from './zipExtractor';
import { SAMPLE_ROW_COUNT } from '../config';

// ─── BOM Detection ──────────────────────────────────────────────

function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

// ─── Decode Uint8Array to string ────────────────────────────────

function decodeContent(content: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return stripBOM(decoder.decode(content));
}

// ─── Delimiter Detection ────────────────────────────────────────

const COMMON_DELIMITERS = [',', '\t', ';', '|'];

function detectDelimiter(text: string): string {
  // Use a sample of the first few lines for detection
  const sample = text.slice(0, 8192);
  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delim of COMMON_DELIMITERS) {
    // Count occurrences in the first line
    const firstLine = sample.split('\n')[0] || '';
    const count = firstLine.split(delim).length - 1;
    if (count > bestScore) {
      bestScore = count;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

// ─── Parse a single CSV file ────────────────────────────────────

export function parseCsvFile(extractedFile: ExtractedFile): TableInfo {
  const { relativePath, filename } = extractedFile;

  // Derive table name from filename (without .csv extension)
  const tableName = filename.replace(/\.csv$/i, '');

  const text = decodeContent(extractedFile.content);
  const warnings: string[] = [];

  // Handle empty files
  if (text.trim().length === 0) {
    return {
      table_name: tableName,
      original_filename: filename,
      relative_path: relativePath,
      column_count: 0,
      columns: [],
      header_row: [],
      sample_rows: [],
      total_data_rows: 0,
      parse_status: 'warning',
      warnings: ['File is empty — no headers or data found.'],
      excluded: false,
      detected_delimiter: ',',
      has_duplicate_headers: false,
      duplicate_header_names: [],
    };
  }

  // Detect delimiter
  const detectedDelimiter = detectDelimiter(text);

  // Parse with Papa Parse
  const parseResult = Papa.parse(text, {
    delimiter: detectedDelimiter,
    header: false, // We'll handle headers manually to preserve duplicates
    skipEmptyLines: false,
    quoteChar: '"',
    escapeChar: '"',
    preview: 0, // parse all to get total count but we limit memory usage below
  });

  // Report parse errors
  if (parseResult.errors && parseResult.errors.length > 0) {
    for (const err of parseResult.errors) {
      const loc = err.row !== undefined ? ` (row ${err.row + 1})` : '';
      warnings.push(`${err.type}: ${err.message}${loc}`);
    }
  }

  const allRows = parseResult.data as string[][];

  // Filter out completely empty trailing rows
  while (allRows.length > 0) {
    const lastRow = allRows[allRows.length - 1];
    if (lastRow.every((cell) => cell === '')) {
      allRows.pop();
    } else {
      break;
    }
  }

  if (allRows.length === 0) {
    return {
      table_name: tableName,
      original_filename: filename,
      relative_path: relativePath,
      column_count: 0,
      columns: [],
      header_row: [],
      sample_rows: [],
      total_data_rows: 0,
      parse_status: 'warning',
      warnings: ['File contains no parseable data.'],
      excluded: false,
      detected_delimiter: detectedDelimiter,
      has_duplicate_headers: false,
      duplicate_header_names: [],
    };
  }

  // First row is the header
  const headerRow = allRows[0];
  const columns = [...headerRow];
  const columnCount = columns.length;

  // Detect duplicate headers
  const headerCounts = new Map<string, number>();
  const duplicateHeaderNames: string[] = [];
  for (const col of columns) {
    const count = (headerCounts.get(col) || 0) + 1;
    headerCounts.set(col, count);
    if (count === 2) {
      duplicateHeaderNames.push(col);
    }
  }
  const hasDuplicateHeaders = duplicateHeaderNames.length > 0;
  if (hasDuplicateHeaders) {
    warnings.push(
      `Duplicate header names detected: ${duplicateHeaderNames.map((n) => `"${n}"`).join(', ')}. Sample rows will use array representation to avoid ambiguity.`
    );
  }

  // Data rows (everything after header)
  const dataRows = allRows.slice(1);
  const totalDataRows = dataRows.length;

  // Check for mismatched column counts in data rows
  const mismatchedRows: number[] = [];
  for (let i = 0; i < Math.min(dataRows.length, 100); i++) {
    if (dataRows[i].length !== columnCount) {
      mismatchedRows.push(i + 2); // 1-indexed, +1 for header
    }
  }
  if (mismatchedRows.length > 0) {
    const shown = mismatchedRows.slice(0, 5).join(', ');
    const more = mismatchedRows.length > 5 ? ` and ${mismatchedRows.length - 5} more` : '';
    warnings.push(
      `${mismatchedRows.length} row(s) have a different column count than the header (${columnCount} columns). Affected rows: ${shown}${more}.`
    );
  }

  // Sample rows: first SAMPLE_ROW_COUNT data rows
  const sampleDataRows = dataRows.slice(0, SAMPLE_ROW_COUNT);

  let sampleRows: Record<string, string>[] | string[][];
  let sampleRowRepresentation: 'object' | 'array' | undefined;

  if (hasDuplicateHeaders) {
    // Use array representation for tables with duplicate headers
    sampleRows = sampleDataRows.map((row) => {
      // Pad or trim row to match header length
      const normalizedRow = [...row];
      while (normalizedRow.length < columnCount) normalizedRow.push('');
      return normalizedRow.slice(0, columnCount);
    });
    sampleRowRepresentation = 'array';
  } else {
    // Use object representation with column names as keys
    sampleRows = sampleDataRows.map((row) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < columnCount; i++) {
        obj[columns[i]] = row[i] !== undefined ? row[i] : '';
      }
      return obj;
    });
    sampleRowRepresentation = 'object';
  }

  const parseStatus =
    warnings.length > 0
      ? hasDuplicateHeaders || mismatchedRows.length > 10
        ? 'warning'
        : 'warning'
      : 'success';

  return {
    table_name: tableName,
    original_filename: filename,
    relative_path: relativePath,
    column_count: columnCount,
    columns,
    header_row: [...headerRow],
    sample_rows: sampleRows,
    sample_row_representation: sampleRowRepresentation,
    total_data_rows: totalDataRows,
    parse_status: parseStatus as 'success' | 'warning' | 'error',
    warnings,
    excluded: false,
    detected_delimiter: detectedDelimiter,
    has_duplicate_headers: hasDuplicateHeaders,
    duplicate_header_names: duplicateHeaderNames,
  };
}
