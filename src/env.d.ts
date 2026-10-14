/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCHEMA_WORKFLOW_WEBHOOK_URL: string;
  readonly VITE_SCHEMA_WORKFLOW_WEBHOOK_TEST_URL: string;
  readonly VITE_WEBHOOK_TIMEOUT_MS: string;
  readonly VITE_MAX_ARCHIVE_SIZE_MB: string;
  readonly VITE_MAX_EXTRACTED_SIZE_MB: string;
  readonly VITE_MAX_EXTRACTED_FILES: string;
  readonly VITE_MAX_COMPRESSION_RATIO: string;
  readonly VITE_MAX_UPLOAD_FILES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
