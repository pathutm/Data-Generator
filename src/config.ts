// ─── Configurable application limits ────────────────────────────
// All values can be overridden via VITE_ environment variables.

function envInt(key: string, fallback: number): number {
  const v = import.meta.env[key];
  if (v !== undefined && v !== '') {
    const parsed = parseInt(v, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function envString(key: string, fallback: string): string {
  const v = import.meta.env[key];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

/** Maximum number of ZIP files that can be uploaded in one session. */
export const MAX_UPLOAD_FILES = envInt('VITE_MAX_UPLOAD_FILES', 100);

/** Maximum size of a single archive in bytes. Default: 200 MB. */
export const MAX_ARCHIVE_SIZE = envInt('VITE_MAX_ARCHIVE_SIZE_MB', 200) * 1024 * 1024;

/** Maximum total extracted size in bytes. Default: 500 MB. */
export const MAX_EXTRACTED_SIZE = envInt('VITE_MAX_EXTRACTED_SIZE_MB', 500) * 1024 * 1024;

/** Maximum number of files extracted from a single archive. */
export const MAX_EXTRACTED_FILES = envInt('VITE_MAX_EXTRACTED_FILES', 500);

/** Maximum compression ratio before flagging as potential ZIP bomb. */
export const MAX_COMPRESSION_RATIO = envInt('VITE_MAX_COMPRESSION_RATIO', 100);

/** Maximum nested ZIP depth (0 = don't recurse). */
export const MAX_NESTING_DEPTH = 0; // nested zips listed as unsupported

/** Number of sample data rows to retain per table. */
export const SAMPLE_ROW_COUNT = 3;

/** Supabase project URL */
export const SUPABASE_URL = envString(
  'VITE_SUPABASE_URL',
  'https://cdmzouvvhfahvkbihrph.supabase.co'
);

/** Supabase anon/public key */
export const SUPABASE_ANON_KEY = envString(
  'VITE_SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbXpvdXZ2aGZhaHZrYmlocnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDA3NTEsImV4cCI6MjEwNzAxNjc1MX0.rA_p8ClOcbS_ymNJvdeEMcvPT-fTuyfRR61T0uShikk'
);

/** Data Collector Agent Webhook URL */
export const DATA_COLLECTOR_WEBHOOK_URL = envString(
  'VITE_DATA_COLLECTOR_WEBHOOK_URL',
  'https://api.agents.snsihub.ai/webhook/cd87e46f-40fa-484d-8e2d-c1b212278a3f'
);

/** Data Collector Agent Test Webhook URL */
export const DATA_COLLECTOR_WEBHOOK_TEST_URL = envString(
  'VITE_DATA_COLLECTOR_WEBHOOK_TEST_URL',
  'https://api.agents.snsihub.ai/webhook-test/cd87e46f-40fa-484d-8e2d-c1b212278a3f'
);

/** Schema Generation Webhook URL (aliases VITE_SCHEMA_GENERATION_WEBHOOK_URL or VITE_SCHEMA_WORKFLOW_WEBHOOK_URL) */
export const WEBHOOK_URL = envString(
  'VITE_SCHEMA_GENERATION_WEBHOOK_URL',
  envString('VITE_SCHEMA_WORKFLOW_WEBHOOK_URL', '')
);

/** Test webhook URL. */
export const WEBHOOK_TEST_URL = envString(
  'VITE_SCHEMA_WORKFLOW_WEBHOOK_TEST_URL',
  ''
);

/** Webhook request timeout in milliseconds. Default: 900 s (15 min, max supported). */
export const WEBHOOK_TIMEOUT_MS = envInt('VITE_WEBHOOK_TIMEOUT_MS', 900000);

/**
 * Resolves a webhook URL, routing through the Vite dev proxy if running locally
 * to eliminate CORS errors and enable 15-minute execution timeouts.
 */
export function resolveWebhookUrl(url: string): string {
  if (!url) return '';
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    if (url.startsWith('https://api.agents.snsihub.ai')) {
      return url.replace('https://api.agents.snsihub.ai', '/api-agents');
    }
  }
  return url;
}

/** Supported CSV file extensions (lowercase). */
export const CSV_EXTENSIONS = new Set(['.csv']);

/** File extensions known to be non-CSV and should be skipped silently. */
export const KNOWN_SKIP_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.md', '.log', '.json', '.xml', '.yaml', '.yml',
  '.html', '.htm', '.css', '.js', '.ts',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.license', '.licence',
]);
