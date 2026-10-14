// ─── Centralized Supabase REST Client ──────────────────────────────
// Uses standard PostgREST REST API endpoints without heavy external dependencies.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export interface DatasetSourceRow {
  id: string | number;
  collection_run_id?: string;
  request_topic?: string;
  platform?: string;
  dataset_name?: string;
  source_url?: string;
  download_url?: string;
  file_name?: string;
  file_type?: string;
  collected_at?: string;
  [key: string]: unknown;
}

export interface DataGenConversation {
  id: string;
  user_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DataGenMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  request_id?: string;
  collection_run_id?: string;
  created_at: string;
}

export interface SchemaRunRecord {
  id: string;
  user_id?: string;
  request_id?: string;
  schema_name: string;
  user_requirement?: string;
  source_dataset_names: string[];
  source_table_count: number;
  consolidated_entity_count: number;
  column_count: number;
  relationship_count: number;
  schema_json: unknown;
  status: 'success' | 'failed';
  error_message?: string;
  created_at: string;
}

// ─── Local Storage Session Fallback (when Supabase anon key not set) ──
const STORAGE_PREFIX = 'dc_agent_ui_';
const ANON_KEY_STORAGE_KEY = 'dc_agent_supabase_anon_key';

export function getSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ANON_KEY_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  }
  return (SUPABASE_ANON_KEY || '').trim();
}

export function setSupabaseAnonKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem(ANON_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(ANON_KEY_STORAGE_KEY);
    }
  }
}

function getLocalData<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export const isSupabaseConfigured = (): boolean => {
  return Boolean(SUPABASE_URL?.trim() && getSupabaseAnonKey().trim());
};

// ─── Supabase PostgREST Helpers ─────────────────────────────────────
async function postgrestRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase URL or Anon Key is not configured' };
  }

  const cleanUrl = SUPABASE_URL.replace(/\/+$/, '');
  const url = `${cleanUrl}/rest/v1/${endpoint}`;
  const anonKey = getSupabaseAnonKey();

  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errText = await res.text();
      return { data: null, error: `HTTP ${res.status}: ${errText || res.statusText}` };
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return { data: json as T, error: null };
    }
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error communicating with Supabase',
    };
  }
}

export function normalizeDatasetRow(
  raw: Record<string, unknown>,
  defaultPlatform?: string
): DatasetSourceRow {
  const datasetName = String(
    raw.dataset_name ||
    raw['Dataset Name'] ||
    raw.dataset_title ||
    raw.title ||
    raw.name ||
    raw.repository ||
    raw.dataset_id ||
    ''
  ).trim();

  let platform = String(
    raw.platform ||
    raw['Platform'] ||
    ''
  ).trim();

  if (!platform && defaultPlatform) {
    platform = defaultPlatform;
  }

  const sourceUrl = String(
    raw.source_url ||
    raw['Source URL'] ||
    raw.url ||
    ''
  ).trim();

  const downloadUrl = String(
    raw.download_url ||
    raw['Download URL'] ||
    raw.file_url ||
    ''
  ).trim();

  const fileName = String(
    raw.file_name ||
    raw['File Name'] ||
    raw.filename ||
    ''
  ).trim();

  const fileType = String(
    raw.file_type ||
    raw['File Type'] ||
    (fileName ? fileName.split('.').pop() : '') ||
    ''
  ).trim();

  const requestTopic = String(
    raw.request_topic ||
    raw['Request/Topic'] ||
    raw.topic ||
    ''
  ).trim();

  const collectionRunId = String(
    raw.collection_run_id ||
    raw['collection_run_id'] ||
    ''
  ).trim();

  const collectedAt = String(
    raw.collected_at ||
    raw.created_at ||
    ''
  ).trim();

  return {
    ...raw,
    id: (raw.id as string | number) || `row-${Math.random().toString(36).substring(2, 9)}`,
    dataset_name: datasetName,
    platform: platform,
    source_url: sourceUrl,
    download_url: downloadUrl,
    file_name: fileName,
    file_type: fileType,
    request_topic: requestTopic,
    collection_run_id: collectionRunId,
    collected_at: collectedAt,
  };
}

// ─── 1. Collected Datasets API ───────────────────────────────────────
const TABLE_DEFAULT_PLATFORMS: Record<string, string> = {
  dataset_sources: 'Kaggle',
  dataset_sources_huggingface: 'Hugging Face',
  github_dataset_sources: 'GitHub',
  zenodo_dataset_sources: 'Zenodo',
};

export function deduplicateDatasetRows(rows: DatasetSourceRow[]): DatasetSourceRow[] {
  const seen = new Set<string>();
  return rows.filter((r, idx) => {
    // Prefer stable database ID combined with platform to avoid collisions across tables
    const plat = (r.platform || 'source').toLowerCase().trim();
    const idStr = r.id !== undefined && r.id !== null ? String(r.id).trim() : '';
    const key = idStr
      ? `${plat}:${idStr}`
      : `sig:${plat}|${r.dataset_name || ''}|${r.file_name || ''}|${r.download_url || r.source_url || ''}|${idx}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const REAL_TABLE_COLUMNS =
  'id,dataset_name,platform,source_url,download_url,file_name,file_type,request_topic,collected_at';

export async function fetchDatasetSources(
  tableName: 'dataset_sources' | 'dataset_sources_huggingface' | 'github_dataset_sources' | 'zenodo_dataset_sources',
  topicFilter?: string
): Promise<{ data: DatasetSourceRow[]; error: string | null; matchedByTopic?: boolean }> {
  const defaultPlat = TABLE_DEFAULT_PLATFORMS[tableName] || 'Dataset Source';

  if (!isSupabaseConfigured()) {
    // Return sample local records if available
    const local = getLocalData<Record<string, unknown>>(tableName).map((r) =>
      normalizeDatasetRow(r, defaultPlat)
    );
    if (topicFilter && topicFilter.trim()) {
      const topicFiltered = local.filter((r) =>
        r.request_topic?.toLowerCase().includes(topicFilter.toLowerCase())
      );
      if (topicFiltered.length > 0) {
        return { data: deduplicateDatasetRows(topicFiltered), error: null, matchedByTopic: true };
      }
    }
    return { data: deduplicateDatasetRows(local), error: null, matchedByTopic: false };
  }

  // 1. If topic filter is provided, query using real column request_topic
  if (topicFilter && topicFilter.trim()) {
    const cleanFilter = topicFilter.trim().replace(/…$/, '');
    const topicRes = await postgrestRequest<Record<string, unknown>[]>(
      `${tableName}?select=${REAL_TABLE_COLUMNS}&request_topic=ilike.*${encodeURIComponent(cleanFilter)}*&order=collected_at.desc.nullslast`
    );

    if (topicRes.data && topicRes.data.length > 0) {
      const normalized = deduplicateDatasetRows(topicRes.data.map((r) => normalizeDatasetRow(r, defaultPlat)));
      return { data: normalized, error: null, matchedByTopic: true };
    }
  }

  // 2. Resilient fallback: Always query all real columns from the table ordered by collected_at
  const allRes = await postgrestRequest<Record<string, unknown>[]>(
    `${tableName}?select=${REAL_TABLE_COLUMNS}&order=collected_at.desc.nullslast`
  );

  if (allRes.data && allRes.data.length > 0) {
    const normalized = deduplicateDatasetRows(allRes.data.map((r) => normalizeDatasetRow(r, defaultPlat)));
    return {
      data: normalized,
      error: null,
      matchedByTopic: false,
    };
  }

  // Return any database error encountered so the UI displays the true reason
  return {
    data: [],
    error: allRes.error,
    matchedByTopic: false,
  };
}

export async function fetchAllDatasetSources(
  topicFilter?: string
): Promise<{
  kaggle: DatasetSourceRow[];
  huggingface: DatasetSourceRow[];
  github: DatasetSourceRow[];
  zenodo: DatasetSourceRow[];
  error: string | null;
  matchedByTopic: boolean;
}> {
  const [kaggleRes, hfRes, githubRes, zenodoRes] = await Promise.all([
    fetchDatasetSources('dataset_sources', topicFilter),
    fetchDatasetSources('dataset_sources_huggingface', topicFilter),
    fetchDatasetSources('github_dataset_sources', topicFilter),
    fetchDatasetSources('zenodo_dataset_sources', topicFilter),
  ]);

  const anyError = kaggleRes.error || hfRes.error || githubRes.error || zenodoRes.error;
  const anyMatched = Boolean(
    kaggleRes.matchedByTopic ||
    hfRes.matchedByTopic ||
    githubRes.matchedByTopic ||
    zenodoRes.matchedByTopic
  );

  return {
    kaggle: deduplicateDatasetRows(kaggleRes.data || []),
    huggingface: deduplicateDatasetRows(hfRes.data || []),
    github: deduplicateDatasetRows(githubRes.data || []),
    zenodo: deduplicateDatasetRows(zenodoRes.data || []),
    error: anyError,
    matchedByTopic: anyMatched,
  };
}

/**
 * Persist dataset sources to Supabase and local cache, tagging each with collectionRunId.
 */
export async function saveDatasetSources(
  records: DatasetSourceRow[],
  tableName: 'dataset_sources' | 'dataset_sources_huggingface' | 'github_dataset_sources' | 'zenodo_dataset_sources',
  collectionRunId?: string
): Promise<void> {
  if (!records || records.length === 0) return;

  const tagged = records.map((r) => ({
    ...r,
    collection_run_id: collectionRunId || r.collection_run_id,
  }));

  // Update local storage cache
  const existing = getLocalData<DatasetSourceRow>(tableName);
  setLocalData(tableName, [...tagged, ...existing]);

  // Persist to Supabase if connected
  if (isSupabaseConfigured()) {
    await postgrestRequest(tableName, {
      method: 'POST',
      body: JSON.stringify(tagged),
    });
  }
}

// ─── 2. Data Generation Conversations API ───────────────────────────
export async function fetchConversations(): Promise<DataGenConversation[]> {
  if (!isSupabaseConfigured()) {
    return getLocalData<DataGenConversation>('conversations').sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  const res = await postgrestRequest<DataGenConversation[]>(
    'data_generation_conversations?select=*&order=updated_at.desc'
  );
  if (res.data) {
    return res.data;
  }
  // Fall back to local if table doesn't exist yet
  return getLocalData<DataGenConversation>('conversations');
}

export async function saveConversation(
  conversation: DataGenConversation
): Promise<DataGenConversation> {
  const existingLocal = getLocalData<DataGenConversation>('conversations');
  const filtered = existingLocal.filter((c) => c.id !== conversation.id);
  setLocalData('conversations', [conversation, ...filtered]);

  if (isSupabaseConfigured()) {
    await postgrestRequest<DataGenConversation>('data_generation_conversations', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(conversation),
    });
  }

  return conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  const existingLocal = getLocalData<DataGenConversation>('conversations');
  setLocalData('conversations', existingLocal.filter((c) => c.id !== id));

  const existingMsgs = getLocalData<DataGenMessage>('messages');
  setLocalData('messages', existingMsgs.filter((m) => m.conversation_id !== id));

  if (isSupabaseConfigured()) {
    await postgrestRequest(`data_generation_conversations?id=eq.${id}`, {
      method: 'DELETE',
    });
    await postgrestRequest(`data_generation_messages?conversation_id=eq.${id}`, {
      method: 'DELETE',
    });
  }
}

// ─── 3. Data Generation Messages API ────────────────────────────────
export async function fetchMessages(conversationId: string): Promise<DataGenMessage[]> {
  if (!isSupabaseConfigured()) {
    return getLocalData<DataGenMessage>('messages')
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  const res = await postgrestRequest<DataGenMessage[]>(
    `data_generation_messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`
  );
  if (res.data && res.data.length > 0) {
    return res.data;
  }
  return getLocalData<DataGenMessage>('messages')
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function saveMessage(msg: DataGenMessage): Promise<DataGenMessage> {
  const existingLocal = getLocalData<DataGenMessage>('messages');
  setLocalData('messages', [...existingLocal, msg]);

  if (isSupabaseConfigured()) {
    await postgrestRequest<DataGenMessage>('data_generation_messages', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(msg),
    });
  }

  return msg;
}

/**
 * Fetches the most recent user-submitted message from the Data Collector Agent.
 * If runId / collection_run_id is provided, specifically returns the user message
 * associated with that collection run.
 * Handles missing state explicitly: returns null if no matching message exists (never falls back to an older run).
 */
export async function getLatestUserMessageForRun(runId?: string): Promise<DataGenMessage | null> {
  const targetRun = runId?.trim();

  if (targetRun) {
    if (isSupabaseConfigured()) {
      const res = await postgrestRequest<DataGenMessage[]>(
        `data_generation_messages?role=eq.user&or=(request_id.eq.${encodeURIComponent(targetRun)},collection_run_id.eq.${encodeURIComponent(targetRun)})&order=created_at.desc&limit=1`
      );
      if (res.data && res.data.length > 0) {
        return res.data[0];
      }
    }
    const local = getLocalData<DataGenMessage>('messages')
      .filter(
        (m) =>
          m.role === 'user' &&
          (m.request_id === targetRun ||
            (m as unknown as { collection_run_id?: string }).collection_run_id === targetRun)
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return local[0] || null;
  }

  // If no specific runId is requested, fetch the globally most recent user message from the Data Collector Agent
  if (isSupabaseConfigured()) {
    const res = await postgrestRequest<DataGenMessage[]>(
      `data_generation_messages?role=eq.user&order=created_at.desc&limit=1`
    );
    if (res.data && res.data.length > 0) {
      return res.data[0];
    }
  }

  const allLocal = getLocalData<DataGenMessage>('messages')
    .filter((m) => m.role === 'user')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return allLocal[0] || null;
}

// ─── 4. Schema Generation Runs API ──────────────────────────────────
export async function fetchSchemaRuns(): Promise<SchemaRunRecord[]> {
  if (!isSupabaseConfigured()) {
    return getLocalData<SchemaRunRecord>('schema_runs').sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const res = await postgrestRequest<SchemaRunRecord[]>(
    'schema_generation_runs?select=*&order=created_at.desc'
  );
  if (res.data && res.data.length > 0) {
    return res.data;
  }
  return getLocalData<SchemaRunRecord>('schema_runs');
}

export async function saveSchemaRun(run: SchemaRunRecord): Promise<SchemaRunRecord> {
  const existingLocal = getLocalData<SchemaRunRecord>('schema_runs');
  setLocalData('schema_runs', [run, ...existingLocal.filter((r) => r.id !== run.id)]);

  if (isSupabaseConfigured()) {
    await postgrestRequest<SchemaRunRecord>('schema_generation_runs', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(run),
    });
  }

  return run;
}
