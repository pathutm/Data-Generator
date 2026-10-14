import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchConversations,
  saveConversation,
  deleteConversation,
  fetchMessages,
  saveMessage,
  fetchAllDatasetSources,
  isSupabaseConfigured,
  type DataGenConversation,
  type DataGenMessage,
} from '../utils/supabaseClient';
import {
  DATA_COLLECTOR_WEBHOOK_URL,
  DATA_COLLECTOR_WEBHOOK_TEST_URL,
  WEBHOOK_TIMEOUT_MS,
  resolveWebhookUrl,
} from '../config';
import {
  extractAgentResponseText,
  formatCollectionSummary,
  isRawWebhookJsonString,
  type CollectionCounts,
} from '../utils/responseExtractor';
import {
  IconMessageSquare,
  IconSend,
  IconSparkles,
  IconTrash,
  IconClock,
  IconFolder,
  IconLayers,
  IconWarning,
} from './Icons';

/**
 * Formats message text while preserving line breaks, whitespace, and bullet-points.
 * Safely parses inline markdown bold (**bold**) and inline code (`code`).
 * Sanitizes any raw JSON webhook payloads in assistant messages into clean summaries.
 */
function renderFormattedMessage(text: string, isAssistant = false) {
  if (!text) return null;

  let cleanedText = text;
  if (isAssistant && isRawWebhookJsonString(text)) {
    cleanedText = extractAgentResponseText(text);
  }

  const parts = cleanedText.split(/(\*\*[^*]+?\*\*|`[^`]+?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

import type { CollectionRunContext } from '../types';

/**
 * Dynamically derives a concise request topic from the user message.
 * Safe fallback: never defaults an unrelated request to 'Procurement'.
 */
export function deriveTopicFromMessage(text: string): string {
  if (!text || !text.trim()) return '';
  const lower = text.toLowerCase().trim();

  // Insurance domain
  if (
    lower.includes('insurance') ||
    lower.includes('policy') ||
    lower.includes('policies') ||
    lower.includes('claim') ||
    lower.includes('claims') ||
    lower.includes('premium') ||
    lower.includes('premiums') ||
    lower.includes('underwriting') ||
    lower.includes('actuarial')
  ) {
    return 'Insurance';
  }

  // Procurement domain (only if explicitly procurement/supplier/PO related)
  if (
    lower.includes('procurement') ||
    lower.includes('purchase order') ||
    lower.includes('purchase orders') ||
    lower.includes('supplier') ||
    lower.includes('suppliers') ||
    lower.includes('vendor') ||
    lower.includes('vendors') ||
    lower.includes('rfq') ||
    lower.includes('requisition')
  ) {
    return 'Procurement';
  }

  // Supply Chain / Logistics
  if (
    lower.includes('supply chain') ||
    lower.includes('logistics') ||
    lower.includes('warehouse') ||
    lower.includes('shipment') ||
    lower.includes('inventory') ||
    lower.includes('freight')
  ) {
    return 'Supply Chain';
  }

  // Healthcare domain
  if (
    lower.includes('health') ||
    lower.includes('hospital') ||
    lower.includes('patient') ||
    lower.includes('clinical') ||
    lower.includes('medical') ||
    lower.includes('doctor')
  ) {
    return 'Healthcare';
  }

  // E-Commerce / Retail
  if (
    lower.includes('e-commerce') ||
    lower.includes('ecommerce') ||
    lower.includes('retail') ||
    lower.includes('shopping') ||
    lower.includes('cart') ||
    lower.includes('store')
  ) {
    return 'E-Commerce';
  }

  // Finance / Banking
  if (
    lower.includes('finance') ||
    lower.includes('financial') ||
    lower.includes('banking') ||
    lower.includes('accounting') ||
    lower.includes('ledger') ||
    lower.includes('revenue') ||
    lower.includes('payroll')
  ) {
    return 'Finance';
  }

  // Human Resources
  if (
    lower.includes('human resources') ||
    lower.includes('hr') ||
    lower.includes('employee') ||
    lower.includes('recruitment')
  ) {
    return 'Human Resources';
  }

  // Cybersecurity
  if (
    lower.includes('cybersecurity') ||
    lower.includes('security') ||
    lower.includes('vulnerability') ||
    lower.includes('malware') ||
    lower.includes('threat')
  ) {
    return 'Cybersecurity';
  }

  // Education
  if (
    lower.includes('education') ||
    lower.includes('student') ||
    lower.includes('school') ||
    lower.includes('university')
  ) {
    return 'Education';
  }

  // Clean domain extraction if no predefined keywords matched
  const cleaned = text
    .replace(/^find\s+(datasets?\s+(for|about|containing|with|on)\s+)?/i, '')
    .replace(/\bdatasets?\b/gi, '')
    .replace(/[.,;:!?]+$/, '')
    .trim();

  if (cleaned.length > 0) {
    const firstFewWords = cleaned.split(/\s+/).slice(0, 3).join(' ');
    return firstFewWords.charAt(0).toUpperCase() + firstFewWords.slice(1);
  }

  return '';
}

interface DataGenerationChatPageProps {
  onSelectRequirementForSchema?: (requirementText: string, runId?: string) => void;
  onNavigateToDatasets?: (context?: string | CollectionRunContext) => void;
  onNavigateToSchemaUpload?: () => void;
  onLatestMessageSubmitted?: (msg: { text: string; runId: string; timestamp: string }) => void;
}

const EXAMPLE_REQUESTS = [
  'Find procurement datasets containing purchase orders, suppliers, invoices, and payments.',
  'Find e-commerce datasets for customers, orders, products, and payments.',
  'Find finance datasets suitable for financial reporting and KPI analysis.',
];

export function DataGenerationChatPage({
  onSelectRequirementForSchema,
  onNavigateToDatasets,
  onNavigateToSchemaUpload,
  onLatestMessageSubmitted,
}: DataGenerationChatPageProps) {
  const [conversations, setConversations] = useState<DataGenConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DataGenMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [webhookMode, setWebhookMode] = useState<'production' | 'test'>('production');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRequestText, setActiveRequestText] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const webhookUrl = webhookMode === 'production' ? DATA_COLLECTOR_WEBHOOK_URL : DATA_COLLECTOR_WEBHOOK_TEST_URL;

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convs = await fetchConversations();
      setConversations(convs);
      if (convs.length > 0 && !activeConversationId) {
        setActiveConversationId(convs[0].id);
      }
    } catch {
      // Ignored
    }
  };

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(activeConversationId);
  }, [activeConversationId]);

  const loadMessages = async (convId: string) => {
    try {
      const msgs = await fetchMessages(convId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // Elapsed timer while submitting
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle New Chat
  const handleNewChat = useCallback(async () => {
    const newId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newConv: DataGenConversation = {
      id: newId,
      title: 'New Dataset Request',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveConversation(newConv);
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    setErrorBanner(null);
    setInputText('');
  }, []);

  // Handle Delete Chat
  const handleDeleteChat = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    },
    [activeConversationId, conversations]
  );

  // Send message to Data Collector Webhook
  const handleSendMessage = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    setErrorBanner(null);
    let convId = activeConversationId;

    // Create conversation if none exists
    if (!convId) {
      convId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const title = trimmed.length > 40 ? trimmed.substring(0, 40) + '…' : trimmed;
      const newConv: DataGenConversation = {
        id: convId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveConversation(newConv);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(convId);
    } else {
      // Update title if first message
      const curr = conversations.find((c) => c.id === convId);
      if (curr && curr.title === 'New Dataset Request') {
        const title = trimmed.length > 40 ? trimmed.substring(0, 40) + '…' : trimmed;
        const updated = { ...curr, title, updated_at: new Date().toISOString() };
        await saveConversation(updated);
        setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
      }
    }

    const requestId = `req-${Date.now()}`;
    const userMsg: DataGenMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: convId,
      role: 'user',
      content: trimmed,
      request_id: requestId,
      created_at: new Date().toISOString(),
    };

    // Save and render user message
    await saveMessage(userMsg);
    onLatestMessageSubmitted?.({ text: trimmed, runId: requestId, timestamp: userMsg.created_at });
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setActiveRunId(requestId);
    setActiveRequestText(trimmed);
    setLoadingStep('Dispatching query to Data Collector workflow…');

    const derivedTopic = deriveTopicFromMessage(trimmed);
    const requestPayload = {
      message: trimmed,
      query: trimmed,
      topic: derivedTopic,
      request_topic: derivedTopic,
      request_id: requestId,
      collection_run_id: requestId,
      timestamp: new Date().toISOString(),
    };

    const primaryUrl = webhookUrl;
    const alternateUrl =
      webhookMode === 'production'
        ? DATA_COLLECTOR_WEBHOOK_TEST_URL
        : DATA_COLLECTOR_WEBHOOK_URL;

    // Ordered list of resolved endpoints to attempt
    const endpointsToTry = [
      resolveWebhookUrl(primaryUrl),
      resolveWebhookUrl(alternateUrl),
      primaryUrl,
      alternateUrl,
    ].filter((u, i, arr) => Boolean(u) && arr.indexOf(u) === i);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    // Dynamic progress feedback for long-running multi-platform searches
    const progressSteps = [
      { afterMs: 0, text: 'Dispatching query to Data Collector workflow…' },
      { afterMs: 5000, text: 'Searching Kaggle, Hugging Face, GitHub & Zenodo repositories…' },
      { afterMs: 25000, text: 'Fetching dataset metadata, direct download URLs & files…' },
      { afterMs: 55000, text: 'Aggregating repository records across all 4 platforms…' },
      { afterMs: 90000, text: 'Registering dataset records in Supabase (collection_run_id active)…' },
      { afterMs: 140000, text: 'Executing deep search across public repositories (timeout: 15m)…' },
    ];

    const startTime = Date.now();
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      for (let i = progressSteps.length - 1; i >= 0; i--) {
        if (elapsed >= progressSteps[i].afterMs) {
          setLoadingStep(progressSteps[i].text);
          break;
        }
      }
    }, 3000);

    let responseBody: unknown = null;
    let executedSuccessfully = false;
    let lastFailureDetail = '';
    let usedEndpoint = '';

    try {
      endpointLoop: for (let eIdx = 0; eIdx < endpointsToTry.length; eIdx++) {
        const endpoint = endpointsToTry[eIdx];
        usedEndpoint = endpoint;
        const isFallback = eIdx > 0;
        if (isFallback) {
          setLoadingStep('Retrying with active alternate workflow endpoint…');
        }

        // Retry transient failures up to 2 attempts per endpoint
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (controller.signal.aborted) break endpointLoop;

          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestPayload),
              signal: controller.signal,
            });

            if (res.ok) {
              const rawText = await res.text();
              try {
                responseBody = JSON.parse(rawText);
              } catch {
                responseBody = rawText;
              }
              executedSuccessfully = true;
              break endpointLoop;
            }

            const errText = await res.text();
            lastFailureDetail = `HTTP ${res.status}: ${errText || res.statusText}`;

            // If 404 (webhook inactive or not found), don't retry same URL, try next endpoint
            if (res.status === 404) {
              break;
            }

            // If 502/503/504 transient error, wait 2s and retry
            if ([502, 503, 504].includes(res.status) && attempt === 1) {
              setLoadingStep(`Server transient error (${res.status}). Retrying in 2 seconds…`);
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }

            break;
          } catch (networkErr: unknown) {
            if (networkErr instanceof DOMException && networkErr.name === 'AbortError') {
              throw networkErr;
            }
            const netMsg = networkErr instanceof Error ? networkErr.message : String(networkErr);
            lastFailureDetail = `Connection error (${netMsg}) on ${endpoint}`;
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
          }
        }
      }
    } finally {
      clearInterval(progressTimer);
      clearTimeout(timeoutId);
    }

    try {
      // Dynamic verification: check actual dataset records in Supabase across all 4 tables
      let verifiedCounts: CollectionCounts | null = null;
      try {
        let check = await fetchAllDatasetSources(derivedTopic);
        let totalFound =
          check.kaggle.length + check.huggingface.length + check.github.length + check.zenodo.length;

        // If topic-specific query found no rows, query the full database repository
        if (totalFound === 0) {
          const allCheck = await fetchAllDatasetSources();
          const allTotal =
            allCheck.kaggle.length +
            allCheck.huggingface.length +
            allCheck.github.length +
            allCheck.zenodo.length;
          if (allTotal > 0) {
            check = allCheck;
            totalFound = allTotal;
          }
        }

        verifiedCounts = {
          kaggle: check.kaggle.length,
          huggingface: check.huggingface.length,
          github: check.github.length,
          zenodo: check.zenodo.length,
          total: totalFound,
          hasPlatformCounts: true,
        };

        if (check.error && totalFound === 0) {
          verifiedCounts.platformErrors = {
            kaggle: check.error,
            huggingface: check.error,
            github: check.error,
            zenodo: check.error,
          };
        }
      } catch (dbErr: unknown) {
        const errDetail = dbErr instanceof Error ? dbErr.message : String(dbErr);
        verifiedCounts = {
          kaggle: 0,
          huggingface: 0,
          github: 0,
          zenodo: 0,
          total: 0,
          hasPlatformCounts: true,
          platformErrors: {
            kaggle: errDetail,
            huggingface: errDetail,
            github: errDetail,
            zenodo: errDetail,
          },
        };
      }

      if (executedSuccessfully) {
        let assistantText = extractAgentResponseText(responseBody, verifiedCounts);
        if (!assistantText || !assistantText.trim()) {
          assistantText = verifiedCounts
            ? formatCollectionSummary(verifiedCounts)
            : formatCollectionSummary({
              kaggle: 0,
              huggingface: 0,
              github: 0,
              zenodo: 0,
              total: 0,
              hasPlatformCounts: true,
            });
        }

        const agentMsg: DataGenMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          conversation_id: convId,
          role: 'assistant',
          content: assistantText,
          request_id: requestId,
          created_at: new Date().toISOString(),
        };

        await saveMessage(agentMsg);
        setMessages((prev) => [...prev, agentMsg]);
      } else if (verifiedCounts && verifiedCounts.total > 0) {
        // Webhook response timed out or dropped, but Supabase verified dataset collection completed!
        const assistantText = formatCollectionSummary(verifiedCounts);
        const agentMsg: DataGenMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          conversation_id: convId,
          role: 'assistant',
          content: assistantText,
          request_id: requestId,
          created_at: new Date().toISOString(),
        };

        await saveMessage(agentMsg);
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        // Definite failure
        const failureMsg = lastFailureDetail || 'Could not connect to any active workflow endpoint';
        setErrorBanner(`Workflow Execution Failed: ${failureMsg}`);

        const errAgentMsg: DataGenMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          conversation_id: convId,
          role: 'assistant',
          content: `⚠ **Data Collector Error:** ${failureMsg}\n\n* **Active Endpoint Tried:** \`${usedEndpoint}\`\n* **Maximum Timeout:** ${WEBHOOK_TIMEOUT_MS / 1000}s\n* **Troubleshooting:** Ensure the Data Collector workflow is active in your agent builder, or toggle to the active Test webhook endpoint using the header toggle.`,
          request_id: requestId,
          created_at: new Date().toISOString(),
        };
        await saveMessage(errAgentMsg);
        setMessages((prev) => [...prev, errAgentMsg]);
      }
    } catch (postProcessErr: unknown) {
      const errMsg = postProcessErr instanceof Error ? postProcessErr.message : String(postProcessErr);
      setErrorBanner(`Execution Error: ${errMsg}`);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
      setActiveRunId(null);
    }
  }, [inputText, isLoading, activeConversationId, conversations, webhookUrl]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="datagen-page-layout">
      {/* ─── Left Conversations History Panel ─── */}
      <aside className="datagen-history-sidebar">
        <div className="datagen-history-header">
          <div className="datagen-history-title">
            <IconClock size={16} />
            <span>Chat History</span>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--xs"
            onClick={handleNewChat}
            id="btn-new-chat"
          >
            + New Chat
          </button>
        </div>

        <div className="datagen-history-list">
          {conversations.length === 0 ? (
            <div className="datagen-history-empty">No conversations yet</div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`datagen-history-item ${c.id === activeConversationId ? 'datagen-history-item--active' : ''}`}
                onClick={() => setActiveConversationId(c.id)}
              >
                <div className="datagen-history-item__body">
                  <span className="datagen-history-item__title">{c.title}</span>
                  <span className="datagen-history-item__date">
                    {new Date(c.updated_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className="datagen-history-delete-btn"
                  onClick={(e) => handleDeleteChat(c.id, e)}
                  title="Delete chat"
                >
                  <IconTrash size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="datagen-history-footer">
          <div className={`supabase-status-pill ${isSupabaseConfigured() ? 'supabase-status--connected' : 'supabase-status--local'}`}>
            <span className="status-dot" />
            <span>{isSupabaseConfigured() ? 'Supabase Connected' : 'Local Storage Mode'}</span>
          </div>
          {!isSupabaseConfigured() && (
            <span className="supabase-status-note">Set VITE_SUPABASE_ANON_KEY to sync across devices</span>
          )}
        </div>
      </aside>

      {/* ─── Main Chat Interface ─── */}
      <section className="datagen-chat-main">
        {/* Chat Header */}
        <div className="datagen-chat-header">
          <div>
            <h2 className="datagen-chat-title">
              <IconMessageSquare size={18} className="section__title-icon" />
              Data Generation Agent
            </h2>
            <p className="datagen-chat-subtitle">
              Describe your domain requirements. The agent will discover relevant open datasets from Kaggle, Hugging Face, GitHub &amp; Zenodo and register them in Supabase.
            </p>
          </div>

          <div className="datagen-chat-header-actions">
            <div className="webhook-mode-toggle">
              <button
                type="button"
                className={`webhook-mode-btn ${webhookMode === 'production' ? 'webhook-mode-btn--active' : ''}`}
                onClick={() => setWebhookMode('production')}
              >
                Production
              </button>
              <button
                type="button"
                className={`webhook-mode-btn ${webhookMode === 'test' ? 'webhook-mode-btn--active' : ''}`}
                onClick={() => setWebhookMode('test')}
              >
                Test
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="info-banner info-banner--warning" style={{ margin: '12px 24px 0' }}>
            <IconWarning size={16} />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Messages Thread */}
        <div className="datagen-messages-thread">
          {messages.length === 0 ? (
            <div className="datagen-empty-chat">
              <div className="datagen-empty-icon">
                <IconSparkles size={32} />
              </div>
              <h3 className="datagen-empty-title">What datasets are you looking for?</h3>
              <p className="datagen-empty-desc">
                Click a sample request below or write your custom dataset criteria:
              </p>
              <div className="datagen-example-chips">
                {EXAMPLE_REQUESTS.map((req, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="datagen-example-chip"
                    onClick={() => {
                      setInputText(req);
                      textareaRef.current?.focus();
                    }}
                  >
                    &ldquo;{req}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`datagen-message-row ${isUser ? 'datagen-message-row--user' : 'datagen-message-row--agent'}`}
                >
                  <div className="datagen-message-card">
                    <div className="datagen-message-meta">
                      <span className={`datagen-role-badge ${isUser ? 'datagen-role--user' : 'datagen-role--agent'}`}>
                        {isUser ? 'Your Request' : 'Data Collector Agent'}
                      </span>
                      <span className="datagen-message-timestamp">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="datagen-message-content">
                      {renderFormattedMessage(m.content, !isUser)}
                    </div>

                    {/* Quick action buttons for user requests or agent responses */}
                    <div className="datagen-message-actions">
                      {isUser ? (
                        <>
                          <button
                            type="button"
                            className="btn btn--secondary btn--xs"
                            onClick={() => {
                              const dynamicTopic = deriveTopicFromMessage(m.content) || currentConv?.title || '';
                              onNavigateToDatasets?.({
                                runId: m.request_id || '',
                                topic: dynamicTopic,
                                requestText: m.content,
                                timestamp: m.created_at,
                              });
                            }}
                            title="Open Collected Datasets tab to view datasets and download links for this message"
                          >
                            <IconFolder size={12} />
                            View Datasets for this Run ➔
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--xs"
                            onClick={() => {
                              onSelectRequirementForSchema?.(m.content);
                              onNavigateToSchemaUpload?.();
                            }}
                            title="Forward this request as the business requirement for Schema Generation"
                          >
                            <IconLayers size={12} />
                            Use as Schema Requirement ➔
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--secondary btn--xs"
                          onClick={() => {
                            const userMsg = messages.find(
                              (x) => x.request_id === m.request_id && x.role === 'user'
                            );
                            const dynamicTopic = deriveTopicFromMessage(userMsg?.content || '') || currentConv?.title || '';
                            onNavigateToDatasets?.({
                              runId: m.request_id || '',
                              topic: dynamicTopic,
                              requestText: userMsg?.content,
                              timestamp: m.created_at,
                            });
                          }}
                          title="Open Collected Datasets tab to view download links for this run"
                        >
                          <IconFolder size={12} />
                          View Datasets for this Run ➔
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="datagen-message-row datagen-message-row--agent">
              <div className="datagen-message-card datagen-message-card--loading">
                <div className="datagen-spinner-row">
                  <span className="progress-message__spinner" />
                  <span className="datagen-loading-step">{loadingStep}</span>
                  <span className="datagen-loading-timer">({elapsedSeconds}s)</span>
                </div>
                <div className="datagen-loading-sub">
                  Running multi-source search on Hugging Face, Kaggle, GitHub &amp; Zenodo...
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--xs"
                    onClick={() => {
                      const dynamicTopic = deriveTopicFromMessage(activeRequestText) || currentConv?.title || '';
                      onNavigateToDatasets?.({
                        runId: activeRunId || '',
                        topic: dynamicTopic,
                        requestText: activeRequestText,
                        timestamp: new Date().toISOString(),
                      });
                    }}
                    title="Switch to Collected Datasets tab to watch records stream in live from Supabase"
                  >
                    <IconFolder size={12} />
                    Watch Datasets Live in Supabase ➔
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="datagen-input-container">
          <div className="datagen-input-box">
            <textarea
              ref={textareaRef}
              className="datagen-textarea"
              rows={2}
              placeholder="E.g. Find procurement datasets with suppliers, purchase orders, invoices, and payments..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />

            <div className="datagen-input-bar">
              <span className="datagen-input-hint">
                Press <kbd>Enter</kbd> to submit · <kbd>Shift + Enter</kbd> for newline
              </span>

              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
                id="btn-send-data-gen"
              >
                {isLoading ? (
                  <>
                    <span className="progress-message__spinner" />
                    Searching…
                  </>
                ) : (
                  <>
                    <IconSend size={14} />
                    Run Collector
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
