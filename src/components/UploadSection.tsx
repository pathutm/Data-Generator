import { useRef, useState, useCallback } from 'react';
import type { UploadedFile } from '../types';
import { isValidZip, formatFileSize } from '../utils/zipExtractor';
import { MAX_UPLOAD_FILES, MAX_ARCHIVE_SIZE } from '../config';
import { IconUpload, IconFile, IconX, IconTrash } from './Icons';

interface UploadSectionProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onProcess: () => void;
  isProcessing: boolean;
  hasResults: boolean;
  processedZipNames?: Set<string>;
}

let nextId = 1;
function generateId(): string {
  return `file-${nextId++}-${Date.now()}`;
}

/**
 * Build a fingerprint for duplicate detection.
 * Uses name + size + lastModified for reliability.
 */
function fileFingerprint(f: File): string {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

export function UploadSection({
  files,
  onFilesChange,
  onProcess,
  isProcessing,
  hasResults,
  processedZipNames,
}: UploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const existingFingerprints = new Set(
        files.map((f) => fileFingerprint(f.file))
      );

      const filesToAdd: UploadedFile[] = [];

      for (const file of Array.from(newFiles)) {
        const fp = fileFingerprint(file);

        // Duplicate check
        if (existingFingerprints.has(fp)) {
          continue; // Skip duplicates silently
        }

        // Limit check
        if (files.length + filesToAdd.length >= MAX_UPLOAD_FILES) {
          break;
        }

        const uploadedFile: UploadedFile = {
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          status: 'pending',
        };

        // Extension check
        if (!file.name.toLowerCase().endsWith('.zip')) {
          uploadedFile.status = 'invalid';
          uploadedFile.validationError = `"${file.name}" is not a ZIP file. Only .zip files are supported.`;
          filesToAdd.push(uploadedFile);
          existingFingerprints.add(fp);
          continue;
        }

        // Size check
        if (file.size > MAX_ARCHIVE_SIZE) {
          uploadedFile.status = 'invalid';
          uploadedFile.validationError = `File exceeds the maximum archive size of ${(MAX_ARCHIVE_SIZE / 1024 / 1024).toFixed(0)} MB.`;
          filesToAdd.push(uploadedFile);
          existingFingerprints.add(fp);
          continue;
        }

        // Empty file check
        if (file.size === 0) {
          uploadedFile.status = 'invalid';
          uploadedFile.validationError = 'File is empty (0 bytes).';
          filesToAdd.push(uploadedFile);
          existingFingerprints.add(fp);
          continue;
        }

        // ZIP magic number check
        const isZip = await isValidZip(file);
        if (!isZip) {
          uploadedFile.status = 'invalid';
          uploadedFile.validationError =
            'File does not contain valid ZIP data. The file header does not match the ZIP format.';
          filesToAdd.push(uploadedFile);
          existingFingerprints.add(fp);
          continue;
        }

        uploadedFile.status = 'valid';
        filesToAdd.push(uploadedFile);
        existingFingerprints.add(fp);
      }

      if (filesToAdd.length > 0) {
        onFilesChange([...files, ...filesToAdd]);
      }
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [addFiles]
  );

  const removeFile = useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange]
  );

  const clearAll = useCallback(() => {
    onFilesChange([]);
  }, [onFilesChange]);

  const validFiles = files.filter((f) => f.status === 'valid');
  const unprocessedFiles = validFiles.filter(
    (f) => !processedZipNames?.has(f.name)
  );
  const canProcess = validFiles.length > 0 && !isProcessing;

  return (
    <section className="section" id="upload-section">
      <div className="section__header">
        <h2 className="section__title">
          <IconUpload className="section__title-icon" size={20} />
          Upload ZIP Archives
        </h2>
      </div>
      <p className="section__description">
        Select or drag-and-drop up to {MAX_UPLOAD_FILES} ZIP archives containing
        CSV datasets. Each archive will be extracted and its CSV tables
        inspected.
      </p>

      {/* Dropzone */}
      <div
        className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Upload ZIP files"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <IconUpload className="dropzone__icon" size={40} />
        <p className="dropzone__text">
          <strong>Click to browse</strong> or drag and drop ZIP files here
        </p>
        <p className="dropzone__hint">
          Accepts .zip files up to{' '}
          {(MAX_ARCHIVE_SIZE / 1024 / 1024).toFixed(0)} MB each (up to {MAX_UPLOAD_FILES} archives)
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
        id="zip-file-input"
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list__header">
            <span className="file-list__count">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
              {validFiles.length !== files.length && (
                <> ({validFiles.length} valid)</>
              )}
            </span>
          </div>

          {files.map((f) => {
            const isAlreadyProcessed = processedZipNames?.has(f.name);
            return (
              <div
                key={f.id}
                className={`file-item ${f.status === 'invalid' ? 'file-item--invalid' : ''}`}
              >
                <IconFile
                  className="file-item__icon"
                  size={18}
                />
                <div className="file-item__info">
                  <div className="file-item__name">
                    {f.name}
                    {isAlreadyProcessed && (
                      <span className="dataset-card__badge badge--success" style={{ marginLeft: 8, fontSize: 10 }}>
                        ✓ Inspected
                      </span>
                    )}
                  </div>
                  <div className="file-item__size">{formatFileSize(f.size)}</div>
                  {f.validationError && (
                    <div className="file-item__error">{f.validationError}</div>
                  )}
                </div>
                <button
                  className="file-item__remove"
                  onClick={() => removeFile(f.id)}
                  title="Remove file"
                  aria-label={`Remove ${f.name}`}
                  disabled={isProcessing}
                >
                  <IconX size={16} />
                </button>
              </div>
            );
          })}

          <div className="actions-row">
            <div className="btn-group">
              <button
                className="btn btn--secondary btn--sm"
                onClick={clearAll}
                disabled={isProcessing}
              >
                <IconTrash size={14} />
                Clear All
              </button>
            </div>
            <button
              className="btn btn--primary btn--lg"
              onClick={onProcess}
              disabled={!canProcess}
              id="process-button"
            >
              {isProcessing ? (
                <>
                  <span className="progress-message__spinner" />
                  Processing…
                </>
              ) : unprocessedFiles.length > 0 ? (
                hasResults ? (
                  `Inspect ${unprocessedFiles.length} New Archive${unprocessedFiles.length !== 1 ? 's' : ''}`
                ) : (
                  `Inspect ${validFiles.length} Archive${validFiles.length !== 1 ? 's' : ''}`
                )
              ) : (
                'Reprocess All Archives'
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
