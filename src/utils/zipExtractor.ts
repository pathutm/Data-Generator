import JSZip from 'jszip';
import type { SkippedFileInfo } from '../types';
import {
  MAX_ARCHIVE_SIZE,
  MAX_EXTRACTED_SIZE,
  MAX_EXTRACTED_FILES,
  MAX_COMPRESSION_RATIO,
  CSV_EXTENSIONS,
} from '../config';

// ─── Types ──────────────────────────────────────────────────────

export interface ExtractedFile {
  relativePath: string;
  filename: string;
  content: Uint8Array;
}

export interface ExtractionResult {
  csvFiles: ExtractedFile[];
  skippedFiles: SkippedFileInfo[];
  nestedArchives: string[];
  totalFilesInArchive: number;
}

// ─── ZIP Magic Number Check ─────────────────────────────────────

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

export async function isValidZip(file: File): Promise<boolean> {
  if (file.size < 4) return false;
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return ZIP_MAGIC.every((b, i) => header[i] === b);
}

// ─── Extract ZIP ────────────────────────────────────────────────

export async function extractZip(
  file: File,
  onProgress?: (msg: string) => void,
  abortSignal?: AbortSignal
): Promise<ExtractionResult> {
  // Size check
  if (file.size > MAX_ARCHIVE_SIZE) {
    throw new Error(
      `Archive "${file.name}" exceeds the maximum allowed size of ${(MAX_ARCHIVE_SIZE / 1024 / 1024).toFixed(0)} MB.`
    );
  }

  // Validate ZIP signature
  if (!(await isValidZip(file))) {
    throw new Error(
      `"${file.name}" is not a valid ZIP archive. The file header does not match the ZIP format.`
    );
  }

  onProgress?.(`Loading archive "${file.name}"…`);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error(
      `Failed to read "${file.name}". The archive may be corrupted or in an unsupported format.`
    );
  }

  const entries = Object.entries(zip.files);
  const totalFilesInArchive = entries.length;

  if (totalFilesInArchive === 0) {
    throw new Error(`"${file.name}" is an empty archive with no entries.`);
  }

  const csvFiles: ExtractedFile[] = [];
  const skippedFiles: SkippedFileInfo[] = [];
  const nestedArchives: string[] = [];
  let totalExtractedBytes = 0;
  let extractedFileCount = 0;

  for (const [path, entry] of entries) {
    // Check cancellation
    if (abortSignal?.aborted) {
      throw new Error('Processing cancelled by user.');
    }

    // Skip directory entries
    if (entry.dir) continue;

    // Skip macOS resource forks and hidden files
    if (path.startsWith('__MACOSX/') || path.includes('/._') || path.startsWith('._')) {
      skippedFiles.push({ path, reason: 'macOS resource fork' });
      continue;
    }

    const filename = path.split('/').pop() || path;
    const ext = filename.includes('.')
      ? '.' + filename.split('.').pop()!.toLowerCase()
      : '';

    // Check for nested ZIP archives
    if (ext === '.zip') {
      nestedArchives.push(path);
      skippedFiles.push({ path, reason: 'Nested ZIP archive (not recursively inspected)' });
      continue;
    }

    // Check if CSV
    if (!CSV_EXTENSIONS.has(ext)) {
      skippedFiles.push({ path, reason: `Unsupported file type: ${ext || 'no extension'}` });
      continue;
    }

    // File count limit
    extractedFileCount++;
    if (extractedFileCount > MAX_EXTRACTED_FILES) {
      throw new Error(
        `Archive "${file.name}" contains more than ${MAX_EXTRACTED_FILES} extractable files. Processing stopped for safety.`
      );
    }

    onProgress?.(`Extracting ${path}…`);

    let content: Uint8Array;
    try {
      content = await entry.async('uint8array');
    } catch {
      skippedFiles.push({ path, reason: 'Failed to decompress file' });
      continue;
    }

    // Extracted size limit
    totalExtractedBytes += content.byteLength;
    if (totalExtractedBytes > MAX_EXTRACTED_SIZE) {
      throw new Error(
        `Total extracted size exceeds the ${(MAX_EXTRACTED_SIZE / 1024 / 1024).toFixed(0)} MB safety limit. Processing stopped.`
      );
    }

    // Compression ratio check: if any single extracted file is suspiciously large
    // relative to the entire archive, it may indicate a ZIP bomb.
    if (file.size > 0 && content.byteLength / file.size > MAX_COMPRESSION_RATIO) {
      throw new Error(
        `File "${path}" has a suspicious compression ratio (${(content.byteLength / file.size).toFixed(0)}:1). This may indicate a ZIP bomb. Processing stopped.`
      );
    }

    csvFiles.push({
      relativePath: path,
      filename,
      content,
    });
  }

  return {
    csvFiles,
    skippedFiles,
    nestedArchives,
    totalFilesInArchive,
  };
}

// ─── Format file size ───────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
