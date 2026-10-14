import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  fetchAllDatasetSources,
  isSupabaseConfigured,
  setSupabaseAnonKey,
  deduplicateDatasetRows,
  type DatasetSourceRow,
} from '../utils/supabaseClient';
import type { CollectionRunContext } from '../types';
import {
  IconFolder,
  IconSearch,
  IconRefresh,
  IconDownload,
  IconExternalLink,
  IconFilter,
  IconWarning,
  IconCheck,
} from './Icons';

interface CollectedDatasetsPageProps {
  initialTopicFilter?: string;
  onClearTopicFilter?: () => void;
  activeRunContext?: CollectionRunContext | null;
  onClearRunContext?: () => void;
}

type PlatformTab = 'all' | 'kaggle' | 'huggingface' | 'github' | 'zenodo';

interface DownloadNoticeState {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface ResolvedDownload {
  /** The direct downloadable file URL or best accessible URL */
  url: string;
  /** Suggested download filename */
  fileName: string;
  /** File format / extension */
  fileType: string;
  /** Resolved platform label */
  platform: string;
  /** True if this is a direct downloadable binary / file endpoint */
  isDirectFile: boolean;
  /** True if the platform requires a user session / login in the browser (e.g. Kaggle API) */
  requiresSessionAuth: boolean;
  /** Dedicated landing page / source repository fallback URL */
  sourcePageUrl: string;
  /** User-facing explanation */
  noticeMessage?: string;
}

/**
 * Resolves the actual direct downloadable file URL according to each provider's
 * real download endpoint structure (GitHub, Hugging Face, Kaggle, Zenodo).
 */
export function resolveDirectDownload(item: DatasetSourceRow): ResolvedDownload {
  const directUrl = (item.download_url || '').trim();
  const sourceUrl = (item.source_url || '').trim();
  const rawPlatform = (item.platform || '').trim();
  const rawName = (item.dataset_name || item.file_name || 'dataset').trim();

  // Determine normalized platform
  let platform = 'Source';
  if (rawPlatform.toLowerCase().includes('kaggle') || directUrl.includes('kaggle.com') || sourceUrl.includes('kaggle.com')) {
    platform = 'Kaggle';
  } else if (rawPlatform.toLowerCase().includes('hugging') || directUrl.includes('huggingface.co') || sourceUrl.includes('huggingface.co')) {
    platform = 'Hugging Face';
  } else if (rawPlatform.toLowerCase().includes('github') || directUrl.includes('github') || sourceUrl.includes('github')) {
    platform = 'GitHub';
  } else if (rawPlatform.toLowerCase().includes('zenodo') || directUrl.includes('zenodo') || sourceUrl.includes('zenodo')) {
    platform = 'Zenodo';
  }

  // Derive suggested file name & extension
  let ext = (item.file_type || '').trim().toLowerCase().replace(/^\./, '');
  let fileName = (item.file_name || '').trim();

  if (!fileName) {
    fileName = ext ? `${rawName.replace(/[/\\?%*:|"<>]/g, '_')}.${ext}` : `${rawName}.zip`;
  }
  if (!ext && fileName.includes('.')) {
    ext = fileName.split('.').pop()?.toLowerCase() || '';
  }

  const sourcePageUrl = sourceUrl || (directUrl.startsWith('http') ? directUrl : '');

  // ─── 1. GitHub Direct Download ───────────────────────────────────────
  if (platform === 'GitHub') {
    const candidateUrl = directUrl || sourceUrl;
    if (candidateUrl) {
      // 1a. Raw GitHub content URL (already direct)
      if (candidateUrl.includes('raw.githubusercontent.com')) {
        return {
          url: candidateUrl,
          fileName,
          fileType: ext || 'csv',
          platform: 'GitHub',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 1b. Convert GitHub web blob view to raw direct file
      // e.g. https://github.com/owner/repo/blob/branch/data/sample.csv -> https://raw.githubusercontent.com/owner/repo/branch/data/sample.csv
      const blobMatch = candidateUrl.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/i);
      if (blobMatch) {
        const rawDirectUrl = `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}/${blobMatch[4]}`;
        return {
          url: rawDirectUrl,
          fileName: fileName || blobMatch[4].split('/').pop() || 'dataset.csv',
          fileType: ext || 'csv',
          platform: 'GitHub',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 1c. GitHub release assets (already direct binary download)
      if (candidateUrl.includes('/releases/download/')) {
        return {
          url: candidateUrl,
          fileName,
          fileType: ext || 'zip',
          platform: 'GitHub',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 1d. Repository root or tree -> direct ZIP archive of main branch
      const repoMatch = candidateUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
      if (repoMatch) {
        const repoArchiveUrl = `https://github.com/${repoMatch[1]}/${repoMatch[2]}/archive/refs/heads/main.zip`;
        return {
          url: repoArchiveUrl,
          fileName: `${repoMatch[2]}-main.zip`,
          fileType: 'zip',
          platform: 'GitHub',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }
    }
  }

  // ─── 2. Hugging Face Direct Download ─────────────────────────────────
  if (platform === 'Hugging Face') {
    const candidateUrl = directUrl || sourceUrl;
    if (candidateUrl) {
      // 2a. Hugging Face resolve URL
      if (candidateUrl.includes('/resolve/') || candidateUrl.includes('?download=true')) {
        const urlWithDownload = candidateUrl.includes('?download=true')
          ? candidateUrl
          : `${candidateUrl}${candidateUrl.includes('?') ? '&' : '?'}download=true`;
        return {
          url: urlWithDownload,
          fileName,
          fileType: ext || 'parquet',
          platform: 'Hugging Face',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 2b. Convert Hugging Face blob URL to resolve URL
      // e.g. https://huggingface.co/datasets/owner/repo/blob/main/data.csv -> resolve/main/data.csv?download=true
      if (candidateUrl.includes('/blob/')) {
        const resolveUrl = candidateUrl.replace('/blob/', '/resolve/') + (candidateUrl.includes('?') ? '&download=true' : '?download=true');
        return {
          url: resolveUrl,
          fileName,
          fileType: ext || 'csv',
          platform: 'Hugging Face',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 2c. Dataset repository page with specific filename provided
      const hfDatasetMatch = candidateUrl.match(/huggingface\.co\/datasets\/([^/]+\/[^/?#]+)/i);
      if (hfDatasetMatch && item.file_name) {
        const directHfUrl = `https://huggingface.co/datasets/${hfDatasetMatch[1]}/resolve/main/${encodeURIComponent(item.file_name.trim())}?download=true`;
        return {
          url: directHfUrl,
          fileName,
          fileType: ext || 'parquet',
          platform: 'Hugging Face',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }
    }
  }

  // ─── 3. Zenodo Direct Download ───────────────────────────────────────
  if (platform === 'Zenodo') {
    const candidateUrl = directUrl || sourceUrl;
    if (candidateUrl) {
      // 3a. Record files download endpoint with ?download=1
      if (candidateUrl.includes('/files/')) {
        const zenodoUrl = candidateUrl.includes('download=1')
          ? candidateUrl
          : `${candidateUrl}${candidateUrl.includes('?') ? '&' : '?'}download=1`;
        return {
          url: zenodoUrl,
          fileName,
          fileType: ext || 'zip',
          platform: 'Zenodo',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 3b. Zenodo API direct file endpoint
      if (candidateUrl.includes('zenodo.org/api/files/')) {
        return {
          url: candidateUrl,
          fileName,
          fileType: ext || 'zip',
          platform: 'Zenodo',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }

      // 3c. Zenodo record landing page with filename available
      const zenodoRecordMatch = candidateUrl.match(/zenodo\.org\/records?\/(\d+)/i);
      if (zenodoRecordMatch && item.file_name) {
        const zenodoFileUrl = `https://zenodo.org/records/${zenodoRecordMatch[1]}/files/${encodeURIComponent(item.file_name.trim())}?download=1`;
        return {
          url: zenodoFileUrl,
          fileName,
          fileType: ext || 'zip',
          platform: 'Zenodo',
          isDirectFile: true,
          requiresSessionAuth: false,
          sourcePageUrl,
        };
      }
    }
  }

  // ─── 4. Kaggle Direct Download ───────────────────────────────────────
  if (platform === 'Kaggle') {
    const candidateUrl = directUrl || sourceUrl;
    // 4a. Official Kaggle dataset download API endpoint
    if (candidateUrl && candidateUrl.includes('/api/v1/datasets/download/')) {
      return {
        url: candidateUrl,
        fileName: fileName.endsWith('.zip') ? fileName : `${fileName}.zip`,
        fileType: 'zip',
        platform: 'Kaggle',
        isDirectFile: true,
        requiresSessionAuth: true,
        sourcePageUrl,
        noticeMessage:
          'Kaggle dataset download initiated. Kaggle requires an active browser session on kaggle.com. If unauthenticated, Kaggle will prompt you to sign in.',
      };
    }

    // 4b. Kaggle dataset URL -> build direct Kaggle API download endpoint
    const kaggleRefMatch = (candidateUrl || '').match(/kaggle\.com\/datasets\/([^/?#]+\/[^/?#]+)/i);
    if (kaggleRefMatch) {
      const kaggleRef = kaggleRefMatch[1];
      const kaggleApiUrl = `https://www.kaggle.com/api/v1/datasets/download/${kaggleRef}`;
      return {
        url: kaggleApiUrl,
        fileName: `${kaggleRef.replace('/', '_')}.zip`,
        fileType: 'zip',
        platform: 'Kaggle',
        isDirectFile: true,
        requiresSessionAuth: true,
        sourcePageUrl,
        noticeMessage:
          'Kaggle dataset download initiated. Note: Kaggle API requires an active Kaggle browser session; if unauthenticated, Kaggle will require login.',
      };
    }
  }

  // ─── 5. Direct Static File Extensions ────────────────────────────────
  const cleanCandidate = (directUrl || sourceUrl).split('?')[0].toLowerCase();
  if (/\.(csv|tsv|parquet|json|jsonl|zip|tar\.gz|tgz|gz|arrow|xlsx|xls|sqlite|db)$/i.test(cleanCandidate)) {
    return {
      url: directUrl || sourceUrl,
      fileName,
      fileType: ext || cleanCandidate.split('.').pop() || 'data',
      platform,
      isDirectFile: true,
      requiresSessionAuth: false,
      sourcePageUrl,
    };
  }

  // ─── 6. Fallback: Landing Page / Source Webpage Only ─────────────────
  return {
    url: sourcePageUrl,
    fileName,
    fileType: ext || 'dataset',
    platform,
    isDirectFile: false,
    requiresSessionAuth: false,
    sourcePageUrl,
    noticeMessage:
      `Direct file download link is not available from ${platform} for "${rawName}". Opening repository landing page.`,
  };
}

export function isDirectFileDownload(item: DatasetSourceRow): boolean {
  return resolveDirectDownload(item).isDirectFile;
}

export function CollectedDatasetsPage({
  initialTopicFilter = '',
  onClearTopicFilter,
  activeRunContext,
  onClearRunContext,
}: CollectedDatasetsPageProps) {
  const [activeTab, setActiveTab] = useState<PlatformTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState(initialTopicFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [isLivePolling, setIsLivePolling] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchedByTopic, setMatchedByTopic] = useState(false);
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNoticeState | null>(null);

  const [datasetsByPlatform, setDatasetsByPlatform] = useState<{
    kaggle: DatasetSourceRow[];
    huggingface: DatasetSourceRow[];
    github: DatasetSourceRow[];
    zenodo: DatasetSourceRow[];
  }>({
    kaggle: [],
    huggingface: [],
    github: [],
    zenodo: [],
  });

  // Track initial load state to prevent jarring spinners during subsequent polling ticks
  const isInitialLoadRef = useRef(true);

  // Sync initial topic filter if changed externally
  useEffect(() => {
    if (initialTopicFilter) {
      setTopicFilter(initialTopicFilter);
    }
  }, [initialTopicFilter]);

  /**
   * Main data fetcher. When silent=true, performs background polling
   * without blocking UI with a loading spinner.
   */
  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      setIsSyncing(true);
      setError(null);

      try {
        // Fetch all stored dataset sources across all four tables unconditionally
        const res = await fetchAllDatasetSources();

        setDatasetsByPlatform((prev) => {
          // Merge incoming records with existing to preserve progressive stream
          const mergeCategory = (existing: DatasetSourceRow[], incoming: DatasetSourceRow[]) => {
            const combined = [...incoming, ...existing];
            return deduplicateDatasetRows(combined);
          };

          return {
            kaggle: mergeCategory(prev.kaggle, res.kaggle),
            huggingface: mergeCategory(prev.huggingface, res.huggingface),
            github: mergeCategory(prev.github, res.github),
            zenodo: mergeCategory(prev.zenodo, res.zenodo),
          };
        });

        setMatchedByTopic(res.matchedByTopic);
        setLastSyncedTime(new Date());

        if (res.error) {
          setError(res.error);
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Failed to query Supabase tables');
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
        setIsSyncing(false);
        isInitialLoadRef.current = false;
      }
    },
    []
  );

  // Initial fetch on mount
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Progressive live updates: poll Supabase every 2.5 seconds
  useEffect(() => {
    if (!isLivePolling) return;

    const timer = setInterval(() => {
      loadData(true);
    }, 2500);

    return () => clearInterval(timer);
  }, [isLivePolling, loadData]);

  // Combine and filter by active platform tab, optional topic filter & search query
  const displayedDatasets = useMemo(() => {
    let list: (DatasetSourceRow & { detectedPlatform: string })[] = [];

    if (activeTab === 'all' || activeTab === 'kaggle') {
      list = list.concat(
        datasetsByPlatform.kaggle.map((d) => ({
          ...d,
          detectedPlatform: d.platform || 'Kaggle',
        }))
      );
    }
    if (activeTab === 'all' || activeTab === 'huggingface') {
      list = list.concat(
        datasetsByPlatform.huggingface.map((d) => ({
          ...d,
          detectedPlatform: d.platform || 'Hugging Face',
        }))
      );
    }
    if (activeTab === 'all' || activeTab === 'github') {
      list = list.concat(
        datasetsByPlatform.github.map((d) => ({
          ...d,
          detectedPlatform: d.platform || 'GitHub',
        }))
      );
    }
    if (activeTab === 'all' || activeTab === 'zenodo') {
      list = list.concat(
        datasetsByPlatform.zenodo.map((d) => ({
          ...d,
          detectedPlatform: d.platform || 'Zenodo',
        }))
      );
    }

    // Optional topic filtering (UI filter only, does not hide records from main repository)
    if (topicFilter.trim()) {
      const tf = topicFilter.toLowerCase();
      list = list.filter((d) => d.request_topic?.toLowerCase().includes(tf));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.dataset_name?.toLowerCase().includes(q) ||
          d.file_name?.toLowerCase().includes(q) ||
          d.request_topic?.toLowerCase().includes(q) ||
          d.source_url?.toLowerCase().includes(q) ||
          (d.collection_run_id && String(d.collection_run_id).toLowerCase().includes(q))
      );
    }

    // Sort all datasets by actual collected_at timestamp, newest first
    list.sort((a, b) => {
      const timeA = a.collected_at ? new Date(a.collected_at).getTime() : 0;
      const timeB = b.collected_at ? new Date(b.collected_at).getTime() : 0;
      const validA = !isNaN(timeA) && timeA > 0;
      const validB = !isNaN(timeB) && timeB > 0;
      if (validA && validB) return timeB - timeA;
      if (validA) return -1;
      if (validB) return 1;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    return list;
  }, [activeTab, datasetsByPlatform, topicFilter, searchQuery]);

  // Unique request topics found across all datasets
  const allTopics = useMemo(() => {
    const set = new Set<string>();
    [
      ...datasetsByPlatform.kaggle,
      ...datasetsByPlatform.huggingface,
      ...datasetsByPlatform.github,
      ...datasetsByPlatform.zenodo,
    ].forEach((d) => {
      if (d.request_topic) set.add(d.request_topic.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [datasetsByPlatform]);

  const totalCount =
    datasetsByPlatform.kaggle.length +
    datasetsByPlatform.huggingface.length +
    datasetsByPlatform.github.length +
    datasetsByPlatform.zenodo.length;

  /**
   * Triggers actual direct file download to user's device.
   * Handles direct files, provider API streams, and handles unresolvable files honestly.
   */
  const handleDownload = (item: DatasetSourceRow) => {
    const resolved = resolveDirectDownload(item);

    if (resolved.isDirectFile && resolved.url) {
      // Trigger native browser download stream direct to device disk
      try {
        const link = document.createElement('a');
        link.href = resolved.url;
        link.setAttribute('download', resolved.fileName);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        window.open(resolved.url, '_blank', 'noopener,noreferrer');
      }

      if (resolved.requiresSessionAuth) {
        setDownloadNotice({
          type: 'info',
          message:
            resolved.noticeMessage ||
            `Triggered ${resolved.platform} download for "${resolved.fileName}". Note: ${resolved.platform} requires an active browser session on their website.`,
          actionUrl: resolved.sourcePageUrl,
          actionLabel: `Open ${resolved.platform} Page`,
        });
      } else {
        setDownloadNotice({
          type: 'success',
          message: `Initiated direct download for "${resolved.fileName}" (${resolved.platform}). The file is downloading to your device.`,
          actionUrl: resolved.sourcePageUrl,
          actionLabel: 'View Source Repository',
        });
      }
      return;
    }

    // Direct file URL could not be automatically resolved
    if (resolved.sourcePageUrl) {
      setDownloadNotice({
        type: 'warning',
        message:
          resolved.noticeMessage ||
          `A direct downloadable file URL is not available from ${resolved.platform} for "${item.dataset_name || 'this dataset'}". Opening repository landing page.`,
        actionUrl: resolved.sourcePageUrl,
        actionLabel: 'Open Dataset Page',
      });
      window.open(resolved.sourcePageUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setDownloadNotice({
      type: 'error',
      message: `No downloadable URL or source link was recorded for "${item.dataset_name || 'this dataset'}".`,
    });
  };

  /**
   * Opens the original landing page / source repository separately
   */
  const handleOpenLandingPage = (item: DatasetSourceRow) => {
    const resolved = resolveDirectDownload(item);
    const url = resolved.sourcePageUrl || item.source_url?.trim() || item.download_url?.trim();
    if (!url) {
      setDownloadNotice({
        type: 'error',
        message: `No repository or landing page URL was recorded for "${item.dataset_name || 'this dataset'}".`,
      });
      return;
    }
    setDownloadNotice({
      type: 'info',
      message: `Opened repository / landing page for "${item.dataset_name || 'dataset'}".`,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveAnonKey = () => {
    if (!anonKeyInput.trim()) return;
    setSupabaseAnonKey(anonKeyInput.trim());
    setShowKeyInput(false);
    loadData(false);
  };

  return (
    <div className="section" style={{ padding: '24px' }}>
      {/* ─── Header ─── */}
      <div className="section__header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="section__title">
            <IconFolder className="section__title-icon" size={20} />
            Collected Datasets Repository
          </h2>
          <p className="section__description" style={{ marginBottom: 0 }}>
            Real dataset records collected by the Data Collector Agent across Kaggle, Hugging Face, GitHub, and Zenodo.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Live Sync Status Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: '20px',
              background: isLivePolling ? 'rgba(34, 197, 94, 0.12)' : 'rgba(156, 163, 175, 0.12)',
              border: `1px solid ${isLivePolling ? 'rgba(34, 197, 94, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`,
              fontSize: 12,
              fontWeight: 500,
              color: isLivePolling ? '#15803d' : '#6b7280',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isLivePolling ? '#22c55e' : '#9ca3af',
                display: 'inline-block',
                boxShadow: isLivePolling ? '0 0 6px #22c55e' : 'none',
              }}
            />
            <span>{isLivePolling ? (isSyncing ? 'Syncing Supabase…' : 'Live Sync Active') : 'Live Sync Paused'}</span>
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setIsLivePolling((prev) => !prev)}
            title={isLivePolling ? 'Pause background polling' : 'Resume live background polling'}
          >
            {isLivePolling ? 'Pause Sync' : 'Resume Sync'}
          </button>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => loadData(false)}
            disabled={isLoading}
            title="Force immediate query of all 4 Supabase tables"
          >
            <IconRefresh size={14} className={isLoading || isSyncing ? 'spin' : ''} />
            Refresh
          </button>

          <span className="dataset-card__badge badge--info" style={{ fontSize: 12, padding: '4px 12px' }}>
            {totalCount} Total Records
          </span>
        </div>
      </div>

      {/* ─── Active Collection Run Banner ─── */}
      {activeRunContext && (
        <div
          className="collection-run-banner"
          style={{
            marginTop: 16,
            padding: '14px 18px',
            background: matchedByTopic ? '#f0fdf4' : '#fefce8',
            border: `1px solid ${matchedByTopic ? '#bbf7d0' : '#fde047'}`,
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={`dataset-card__badge ${matchedByTopic ? 'badge--success' : 'badge--info'}`} style={{ fontSize: 11 }}>
                <IconCheck size={10} style={{ display: 'inline', marginRight: 4 }} />
                {matchedByTopic ? `Matched by Topic: "${activeRunContext.topic || topicFilter}"` : 'Active Collection Request'}
              </span>
              <code style={{ fontSize: 12, fontWeight: 600 }}>{activeRunContext.runId}</code>
              <span className="dataset-card__badge badge--primary" style={{ fontSize: 11 }}>
                {totalCount} record{totalCount !== 1 ? 's' : ''} available
              </span>
              {isSyncing && (
                <span style={{ fontSize: 11, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="progress-message__spinner" style={{ width: 10, height: 10 }} />
                  Checking for new inserts…
                </span>
              )}
            </div>

            {activeRunContext.requestText && (
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginTop: 6 }}>
                <strong>User Request:</strong> &ldquo;{activeRunContext.requestText}&rdquo;
              </div>
            )}

            {activeRunContext.topic && (
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                Filtered by topic: <code>{activeRunContext.topic}</code>
              </div>
            )}
            {lastSyncedTime && (
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                Last checked: {lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Monitoring Kaggle, Hugging Face, GitHub &amp; Zenodo
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={() => {
              onClearRunContext?.();
              onClearTopicFilter?.();
              setTopicFilter('');
            }}
          >
            Clear Run Scope (View All Datasets)
          </button>
        </div>
      )}

      {/* ─── Download Notice Banner ─── */}
      {downloadNotice && (
        <div
          className={`info-banner info-banner--${downloadNotice.type === 'error' ? 'warning' : downloadNotice.type === 'warning' ? 'warning' : 'info'}`}
          style={{
            marginTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{downloadNotice.message}</span>
            {downloadNotice.actionUrl && (
              <a
                href={downloadNotice.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary btn--xs"
                style={{ marginLeft: 6 }}
              >
                <IconExternalLink size={12} />
                {downloadNotice.actionLabel || 'Open Link'}
              </a>
            )}
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={() => setDownloadNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Supabase Status Banner ─── */}
      {!isSupabaseConfigured() && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 16 }}>
          <IconWarning size={16} />
          <div style={{ flex: 1 }}>
            <strong>Supabase Anon Key is missing:</strong> Set <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file to query live rows from <code>https://cdmzouvvhfahvkbihrph.supabase.co</code>.
            <div style={{ marginTop: 8 }}>
              {!showKeyInput ? (
                <button
                  type="button"
                  className="btn btn--primary btn--xs"
                  onClick={() => setShowKeyInput(true)}
                >
                  Enter Anon Key Directly
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input
                    type="password"
                    className="datasets-search-input"
                    placeholder="Paste Supabase anon key here…"
                    value={anonKeyInput}
                    onChange={(e) => setAnonKeyInput(e.target.value)}
                    style={{ maxWidth: 380 }}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--xs"
                    onClick={handleSaveAnonKey}
                  >
                    Save &amp; Connect
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--xs"
                    onClick={() => setShowKeyInput(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && isSupabaseConfigured() && (
        <div className="info-banner info-banner--warning" style={{ marginTop: 16 }}>
          <IconWarning size={16} />
          <div>
            <strong>Query Error:</strong> {error}
          </div>
        </div>
      )}

      {/* ─── Filters Bar ─── */}
      <div className="datasets-filter-bar" style={{ marginTop: 20 }}>
        {/* Search */}
        <div className="datasets-search-wrapper">
          <IconSearch size={14} className="datasets-search-icon" />
          <input
            type="text"
            className="datasets-search-input"
            placeholder="Search by dataset name, file name, platform, or topic…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Topic filter */}
        <div className="datasets-topic-select-wrapper">
          <IconFilter size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <select
            className="datasets-topic-select"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
          >
            <option value="">All Topics ({allTopics.length})</option>
            {allTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {topicFilter && (
            <button
              type="button"
              className="btn btn--secondary btn--xs"
              onClick={() => {
                setTopicFilter('');
                onClearTopicFilter?.();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Platform Tabs with Live Database Counts ─── */}
      <div className="datasets-platform-tabs" style={{ marginTop: 16 }}>
        <button
          type="button"
          className={`platform-tab-btn ${activeTab === 'all' ? 'platform-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Sources ({totalCount})
        </button>
        <button
          type="button"
          className={`platform-tab-btn ${activeTab === 'kaggle' ? 'platform-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('kaggle')}
        >
          Kaggle ({datasetsByPlatform.kaggle.length})
        </button>
        <button
          type="button"
          className={`platform-tab-btn ${activeTab === 'huggingface' ? 'platform-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('huggingface')}
        >
          Hugging Face ({datasetsByPlatform.huggingface.length})
        </button>
        <button
          type="button"
          className={`platform-tab-btn ${activeTab === 'github' ? 'platform-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('github')}
        >
          GitHub ({datasetsByPlatform.github.length})
        </button>
        <button
          type="button"
          className={`platform-tab-btn ${activeTab === 'zenodo' ? 'platform-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('zenodo')}
        >
          Zenodo ({datasetsByPlatform.zenodo.length})
        </button>
      </div>

      {/* ─── Datasets Table / Progressive Stream ─── */}
      <div className="datasets-table-container" style={{ marginTop: 16 }}>
        {isLoading && totalCount === 0 ? (
          <div className="datasets-loading-state">
            <span className="progress-message__spinner" />
            <span>Fetching real dataset records from Supabase tables…</span>
          </div>
        ) : displayedDatasets.length === 0 ? (
          <div className="datasets-empty-state">
            {error ? (
              <>
                <IconWarning size={36} className="datasets-empty-icon" style={{ color: '#ef4444' }} />
                <h4 className="datasets-empty-title" style={{ color: '#b91c1c' }}>Database Access Error</h4>
                <p className="datasets-empty-desc">
                  Failed to fetch dataset sources from Supabase: <code>{error}</code>.
                </p>
              </>
            ) : activeRunContext ? (
              <>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                  <IconFolder size={42} className="datasets-empty-icon" />
                  <span
                    className="progress-message__spinner"
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      width: 18,
                      height: 18,
                      borderWidth: 2,
                    }}
                  />
                </div>
                <h4 className="datasets-empty-title">Waiting for incoming datasets…</h4>
                <p className="datasets-empty-desc" style={{ maxWidth: 540 }}>
                  The Data Collector workflow is currently searching public repositories across Kaggle, Hugging Face, GitHub, and Zenodo.
                  As each dataset record is registered in Supabase under run <code>{activeRunContext.runId}</code>, it will appear here automatically.
                </p>
                <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="dataset-card__badge badge--info" style={{ fontSize: 12 }}>
                    🟢 Live polling active every 2.5s
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--xs"
                    onClick={() => {
                      onClearRunContext?.();
                      onClearTopicFilter?.();
                      setTopicFilter('');
                    }}
                  >
                    Clear Filter (View All Datasets)
                  </button>
                </div>
              </>
            ) : (
              <>
                <IconFolder size={36} className="datasets-empty-icon" />
                <h4 className="datasets-empty-title">No datasets found in Supabase</h4>
                <p className="datasets-empty-desc" style={{ maxWidth: 560 }}>
                  {topicFilter
                    ? `No records found under topic "${topicFilter}". Try clearing your filter or running a query in the chat.`
                    : 'The database returned 0 dataset records for the public anon role. If records were inserted by your workflow, verify that Row Level Security (RLS) allows SELECT for the anon role in Supabase.'}
                </p>
                {isSupabaseConfigured() && (
                  <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--color-bg-secondary)', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'left', maxWidth: 560, margin: '14px auto 0' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      💡 Supabase Row-Level Security (RLS) Tip:
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      To allow the web application to read collected datasets securely while preserving Row Level Security, run this policy in your <strong>Supabase SQL Editor</strong>:
                    </div>
                    <pre style={{ fontSize: 10, background: 'var(--color-bg-tertiary)', padding: '6px 10px', borderRadius: 4, marginTop: 6, overflowX: 'auto' }}>
                      {`CREATE POLICY "Allow anon read" ON public.dataset_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon read" ON public.dataset_sources_huggingface FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon read" ON public.github_dataset_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow anon read" ON public.zenodo_dataset_sources FOR SELECT TO anon, authenticated USING (true);`}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Dataset &amp; Source</th>
                  <th style={{ width: '12%' }}>Platform</th>
                  <th style={{ width: '18%' }}>Request Topic / Run</th>
                  <th style={{ width: '18%' }}>File Name &amp; Type</th>
                  <th style={{ width: '11%' }}>Collected At</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedDatasets.map((item, index) => {
                  const resolved = resolveDirectDownload(item);
                  const hasSourceUrl = Boolean(resolved.sourcePageUrl);

                  return (
                    <tr key={`${item.id}-${index}`}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {item.dataset_name || item.file_name || 'Unnamed Dataset'}
                        </div>
                        {hasSourceUrl && (
                          <a
                            href={resolved.sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-link"
                            title="Open original repository or dataset landing page in a new tab"
                          >
                            <span>Source Repository</span>
                            <IconExternalLink size={10} />
                          </a>
                        )}
                      </td>
                      <td>
                        <span className="platform-badge platform-badge--generic">
                          {resolved.platform}
                        </span>
                      </td>
                      <td>
                        {item.request_topic ? (
                          <span className="topic-badge" title={item.request_topic}>
                            {item.request_topic}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-disabled)', fontSize: 12 }}>Unassociated</span>
                        )}
                        {item.collection_run_id && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                            Run: <code>{item.collection_run_id}</code>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, wordBreak: 'break-all' }}>
                          <code>{resolved.fileName}</code>
                        </div>
                        {resolved.fileType && (
                          <span className="file-type-pill" style={{ marginTop: 2, display: 'inline-block' }}>
                            {resolved.fileType.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                        {item.collected_at && !isNaN(new Date(item.collected_at).getTime()) ? (
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                              {new Date(item.collected_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', opacity: 0.85, marginTop: 1 }}>
                              {new Date(item.collected_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* Real Download Button when direct downloadable file exists */}
                          {resolved.isDirectFile ? (
                            <button
                              type="button"
                              className="btn btn--primary btn--xs"
                              onClick={() => handleDownload(item)}
                              title={`Download dataset file "${resolved.fileName}" directly to your device`}
                            >
                              <IconDownload size={12} />
                              Download
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--secondary btn--xs"
                              onClick={() => handleOpenLandingPage(item)}
                              title="Direct file download not provided; open repository landing page"
                            >
                              <IconExternalLink size={12} />
                              Source Page Only
                            </button>
                          )}

                          {/* Separate Source Page Button */}
                          {resolved.isDirectFile && hasSourceUrl && (
                            <button
                              type="button"
                              className="btn btn--secondary btn--xs"
                              onClick={() => handleOpenLandingPage(item)}
                              title="Open original repository or dataset source page"
                            >
                              <IconExternalLink size={12} />
                              Source Page
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
