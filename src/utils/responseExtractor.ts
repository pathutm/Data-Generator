/**
 * Utility functions for extracting and parsing the generated text response
 * from the Data Collector Agent webhook HTTP response.
 */

export interface CollectionCounts {
  kaggle: number;
  huggingface: number;
  github: number;
  zenodo: number;
  total: number;
  hasPlatformCounts: boolean;
  platformErrors?: Record<string, string>;
}

/**
 * Checks if a payload is a raw webhook request/response envelope,
 * HTTP headers object, or internal workflow execution wrapper.
 */
export function isWebhookOrInternalEnvelope(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;

  // n8n / AgentBuilder trigger test mode wrapper
  if (o.mode === 'trigger-test' && o.success === true) return true;

  // Contains HTTP headers object
  if (o.headers && typeof o.headers === 'object') return true;

  // Contains typical HTTP header keys at top level
  if ('host' in o && ('user-agent' in o || 'accept' in o || 'content-type' in o)) return true;

  // Webhook receiver envelope with params/query/body
  if ('body' in o && typeof o.body === 'object' && ('params' in o || 'query' in o || 'headers' in o)) {
    return true;
  }

  // Raw execution metadata
  if ('executionId' in o && 'workflow' in o) return true;

  return false;
}

/**
 * Checks if a string looks like raw JSON containing webhook envelopes or HTTP headers.
 */
export function isRawWebhookJsonString(text: string): boolean {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    if (
      trimmed.includes('"headers":') ||
      trimmed.includes('"host":') ||
      trimmed.includes('"user-agent":') ||
      trimmed.includes('"trigger-test"') ||
      (trimmed.includes('"body":') && trimmed.includes('"message":') && trimmed.includes('"query":'))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Formats dynamic collection results into a clean, human-readable summary
 * matching Image 2 with platform-wise counts and total.
 */
export function formatCollectionSummary(counts: CollectionCounts): string {
  const kaggleText = counts.platformErrors?.kaggle
    ? `Failed (${counts.platformErrors.kaggle})`
    : `${counts.kaggle ?? 0}`;
  const hfText = counts.platformErrors?.huggingface
    ? `Failed (${counts.platformErrors.huggingface})`
    : `${counts.huggingface ?? 0}`;
  const githubText = counts.platformErrors?.github
    ? `Failed (${counts.platformErrors.github})`
    : `${counts.github ?? 0}`;
  const zenodoText = counts.platformErrors?.zenodo
    ? `Failed (${counts.platformErrors.zenodo})`
    : `${counts.zenodo ?? 0}`;

  return [
    '**The dataset collection results are now available.**',
    '',
    `- Kaggle records: ${kaggleText}`,
    `- Hugging Face records: ${hfText}`,
    `- GitHub records: ${githubText}`,
    `- Zenodo records: ${zenodoText}`,
    '',
    `**Total records collected: ${counts.total ?? 0}**`,
  ].join('\n');
}

export function extractCountsFromText(str: string): CollectionCounts | null {
  if (!str || typeof str !== 'string') return null;

  const parseNum = (regex: RegExp): number | undefined => {
    const match = str.match(regex);
    return match ? parseInt(match[1], 10) : undefined;
  };

  const kaggle =
    parseNum(/kaggle\s*(?:records?)?\s*[-:–—=]\s*(\d+)/i) ??
    parseNum(/(\d+)\s*(?:records?)?\s*(?:from\s*)?kaggle/i);

  const huggingface =
    parseNum(/hugging\s*face\s*(?:records?)?\s*[-:–—=]\s*(\d+)/i) ??
    parseNum(/hf\s*(?:records?)?\s*[-:–—=]\s*(\d+)/i) ??
    parseNum(/(\d+)\s*(?:records?)?\s*(?:from\s*)?hugging\s*face/i);

  const github =
    parseNum(/github\s*(?:records?)?\s*[-:–—=]\s*(\d+)/i) ??
    parseNum(/(\d+)\s*(?:records?)?\s*(?:from\s*)?github/i);

  const zenodo =
    parseNum(/zenodo\s*(?:records?)?\s*[-:–—=]\s*(\d+)/i) ??
    parseNum(/(\d+)\s*(?:records?)?\s*(?:from\s*)?zenodo/i);

  const total =
    parseNum(/total(?:\s*records)?(?:\s*collected)?\s*[-:–—=]\s*(\d+)/i) ??
    parseNum(/total\s*[-:–—=]\s*(\d+)/i);

  if (
    kaggle !== undefined ||
    huggingface !== undefined ||
    github !== undefined ||
    zenodo !== undefined
  ) {
    const k = kaggle ?? 0;
    const h = huggingface ?? 0;
    const g = github ?? 0;
    const z = zenodo ?? 0;
    return {
      kaggle: k,
      huggingface: h,
      github: g,
      zenodo: z,
      total: total ?? (k + h + g + z),
      hasPlatformCounts: true,
    };
  }
  return null;
}

/**
 * Safely extracts dataset counts and results from various webhook response structures.
 * Supports:
 * - Direct count fields: `kaggle_records`, `huggingface_records`, etc.
 * - Natural text / Groq Chat node summaries: "Kaggle - 4 records, Hugging Face - 15 records..."
 * - Parts and Content arrays: `parts: [{ text: "..." }]`
 * - Arrays of dataset objects (counts per platform)
 * - Platform-specific record arrays: `kaggle: [...]`, `zenodo: [...]`
 * - Nested envelopes: `json`, `data`, `result`, `output`, `response`, `body`, `items`
 */
export function extractCollectionCounts(data: unknown): CollectionCounts | null {
  if (data === null || data === undefined) return null;

  // Handle strings (JSON strings or natural language LLM text summaries)
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        const subCounts = extractCollectionCounts(parsed);
        if (subCounts) return subCounts;
      } catch {
        // Not JSON, continue to text parsing
      }
    }
    return extractCountsFromText(trimmed);
  }

  // Handle arrays of records or items
  if (Array.isArray(data)) {
    if (data.length === 0) return null;

    // Check if array of n8n wrappers [{ json: { ... } }]
    if (data.some((item) => item && typeof item === 'object' && 'json' in item)) {
      let combinedKaggle = 0;
      let combinedHf = 0;
      let combinedGithub = 0;
      let combinedZenodo = 0;
      let foundAnyPlatform = false;

      for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        const jsonPayload = (item as Record<string, unknown>).json;
        const subCounts = extractCollectionCounts(jsonPayload);
        if (subCounts) {
          foundAnyPlatform = true;
          combinedKaggle += subCounts.kaggle;
          combinedHf += subCounts.huggingface;
          combinedGithub += subCounts.github;
          combinedZenodo += subCounts.zenodo;
        }
      }

      if (foundAnyPlatform) {
        return {
          kaggle: combinedKaggle,
          huggingface: combinedHf,
          github: combinedGithub,
          zenodo: combinedZenodo,
          total: combinedKaggle + combinedHf + combinedGithub + combinedZenodo,
          hasPlatformCounts: true,
        };
      }
    }

    // Check if array of dataset records
    let kaggle = 0;
    let huggingface = 0;
    let github = 0;
    let zenodo = 0;
    let datasetItemsCount = 0;

    for (const item of data) {
      if (item && typeof item === 'object') {
        const r = item as Record<string, unknown>;
        const plat = String(r.platform || r.source || r.table || '').toLowerCase();
        const hasDatasetFields = Boolean(
          r.dataset_name ||
          r.file_name ||
          r.filename ||
          r.download_url ||
          r.source_url ||
          r.file_url ||
          r.platform ||
          r.dataset_ref ||
          r.dataset_id ||
          r.repository ||
          r.record_id
        );

        if (hasDatasetFields) {
          datasetItemsCount++;
          if (
            plat.includes('kaggle') ||
            Boolean(r.dataset_ref) ||
            String(r.api_url || '').includes('kaggle') ||
            String(r.source_url || '').includes('kaggle')
          ) {
            kaggle++;
          } else if (
            plat.includes('hugging') ||
            plat.includes('hf') ||
            Boolean(r.dataset_id) ||
            String(r.file_url || '').includes('huggingface')
          ) {
            huggingface++;
          } else if (
            plat.includes('github') ||
            plat.includes('git') ||
            Boolean(r.repository) ||
            String(r.file_url || '').includes('github')
          ) {
            github++;
          } else if (
            plat.includes('zenodo') ||
            Boolean(r.record_id) ||
            String(r.file_url || '').includes('zenodo')
          ) {
            zenodo++;
          }
        }
      }
    }

    if (datasetItemsCount > 0) {
      return {
        kaggle,
        huggingface,
        github,
        zenodo,
        total: datasetItemsCount,
        hasPlatformCounts: true,
      };
    }

    // Inspect individual items inside array
    for (const item of data) {
      const counts = extractCollectionCounts(item);
      if (counts) return counts;
    }

    return null;
  }

  // Handle objects
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;

    // Helper to extract numeric value from various naming conventions
    const getNum = (...keys: string[]): number | undefined => {
      for (const k of keys) {
        if (typeof o[k] === 'number') return o[k] as number;
        if (typeof o[k] === 'string' && /^\d+$/.test((o[k] as string).trim())) {
          return parseInt((o[k] as string).trim(), 10);
        }
      }
      return undefined;
    };

    const kaggleNum = getNum('kaggle_records', 'kaggle_count', 'kaggle_total', 'kaggle_datasets');
    const hfNum = getNum(
      'huggingface_records',
      'hugging_face_records',
      'hf_records',
      'huggingface_count',
      'huggingface_total'
    );
    const githubNum = getNum('github_records', 'github_count', 'github_total', 'github_datasets');
    const zenodoNum = getNum('zenodo_records', 'zenodo_count', 'zenodo_total', 'zenodo_datasets');
    const totalNum = getNum('total_records', 'total_count', 'total_results', 'total_files', 'total');

    if (
      kaggleNum !== undefined ||
      hfNum !== undefined ||
      githubNum !== undefined ||
      zenodoNum !== undefined
    ) {
      const kaggle = kaggleNum ?? 0;
      const huggingface = hfNum ?? 0;
      const github = githubNum ?? 0;
      const zenodo = zenodoNum ?? 0;
      const computedTotal = totalNum ?? (kaggle + huggingface + github + zenodo);

      return {
        kaggle,
        huggingface,
        github,
        zenodo,
        total: computedTotal,
        hasPlatformCounts: true,
      };
    }

    // Platform-specific arrays inside object
    if (
      Array.isArray(o.kaggle) ||
      Array.isArray(o.huggingface) ||
      Array.isArray(o.github) ||
      Array.isArray(o.zenodo)
    ) {
      const kaggle = Array.isArray(o.kaggle) ? o.kaggle.length : (getNum('kaggle') ?? 0);
      const huggingface = Array.isArray(o.huggingface)
        ? o.huggingface.length
        : (getNum('huggingface') ?? 0);
      const github = Array.isArray(o.github) ? o.github.length : (getNum('github') ?? 0);
      const zenodo = Array.isArray(o.zenodo) ? o.zenodo.length : (getNum('zenodo') ?? 0);

      return {
        kaggle,
        huggingface,
        github,
        zenodo,
        total: totalNum ?? (kaggle + huggingface + github + zenodo),
        hasPlatformCounts: true,
      };
    }

    // Parts array (from Groq / AgentBuilder Chat Text node)
    if (Array.isArray(o.parts)) {
      for (const p of o.parts) {
        if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).text === 'string') {
          const fromPart = extractCountsFromText((p as Record<string, unknown>).text as string);
          if (fromPart) return fromPart;
        }
      }
    }

    // Direct string fields that may contain Chat Text output
    for (const textField of ['text', 'message', 'summary', 'reply', 'answer', 'output']) {
      if (typeof o[textField] === 'string') {
        const fromStr = extractCountsFromText(o[textField] as string);
        if (fromStr) return fromStr;
      }
    }

    // Dataset array inside object
    for (const arrKey of ['datasets', 'results', 'records', 'items', 'sources', 'files']) {
      if (Array.isArray(o[arrKey])) {
        const counts = extractCollectionCounts(o[arrKey]);
        if (counts) return counts;
      }
    }

    // Check nested wrappers (including content, output, items, body)
    for (const wrapperKey of ['content', 'output', 'json', 'data', 'result', 'response', 'payload', 'body', 'item']) {
      if (o[wrapperKey] && typeof o[wrapperKey] === 'object') {
        const counts = extractCollectionCounts(o[wrapperKey]);
        if (counts) return counts;
      }
    }
  }

  return null;
}

/**
 * Extracts the generated response text from the HTTP response payload
 * returned by the Data Collector Agent webhook.
 *
 * Guarantees that:
 * 1. Raw HTTP headers, envelopes, and JSON payloads are NEVER rendered directly.
 * 2. Real dynamic platform counts and totals are formatted cleanly matching Image 2.
 * 3. Human-readable LLM text is preserved when present.
 */
export function extractAgentResponseText(
  responseBody: unknown,
  fallbackCounts?: CollectionCounts | null
): string {
  // 1. First, check if actual collection counts / records exist in the response
  const counts = extractCollectionCounts(responseBody);
  if (counts && (counts.total > 0 || counts.hasPlatformCounts)) {
    return formatCollectionSummary(counts);
  }

  // 2. Direct string response
  if (typeof responseBody === 'string') {
    const trimmed = responseBody.trim();
    if (!trimmed) {
      return fallbackCounts
        ? formatCollectionSummary(fallbackCounts)
        : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
    }

    // If it's a raw JSON webhook envelope, parse it or use fallback
    if (isRawWebhookJsonString(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed);
        const subCounts = extractCollectionCounts(parsed);
        if (subCounts) return formatCollectionSummary(subCounts);
      } catch {
        // Fall through
      }
      return fallbackCounts
        ? formatCollectionSummary(fallbackCounts)
        : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
    }

    // Check if string contains valid JSON object/array
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = extractAgentResponseText(parsed, fallbackCounts);
        if (extracted) return extracted;
      } catch {
        // Not JSON, return trimmed string below
      }
    }

    // Plain text from LLM node
    return trimmed;
  }

  // 3. Arrays of items
  if (Array.isArray(responseBody)) {
    if (responseBody.length === 0) {
      return fallbackCounts
        ? formatCollectionSummary(fallbackCounts)
        : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
    }

    // Array of plain strings
    if (responseBody.every((item) => typeof item === 'string')) {
      const joined = responseBody
        .map((s) => s.trim())
        .filter((s) => Boolean(s) && !isRawWebhookJsonString(s))
        .join('\n\n');
      if (joined) return joined;
    }

    // Array of objects/items
    for (const item of responseBody) {
      const extracted = extractAgentResponseText(item, fallbackCounts);
      if (extracted && !isRawWebhookJsonString(extracted)) return extracted;
    }

    return fallbackCounts
      ? formatCollectionSummary(fallbackCounts)
      : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
  }

  // 4. Objects
  if (typeof responseBody === 'object' && responseBody !== null) {
    const obj = responseBody as Record<string, unknown>;

    // If raw webhook request/response envelope is detected, do NOT dump JSON
    if (isWebhookOrInternalEnvelope(obj)) {
      // Check if wrapped body or data has counts
      if (obj.body && typeof obj.body === 'object') {
        const bodyCounts = extractCollectionCounts(obj.body);
        if (bodyCounts) return formatCollectionSummary(bodyCounts);
      }
      if (obj.output && typeof obj.output === 'object') {
        const outputCounts = extractCollectionCounts(obj.output);
        if (outputCounts) return formatCollectionSummary(outputCounts);
      }
      return fallbackCounts
        ? formatCollectionSummary(fallbackCounts)
        : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
    }

    // Unwrap common wrapper envelopes
    if (obj.json && typeof obj.json === 'object') {
      const extracted = extractAgentResponseText(obj.json, fallbackCounts);
      if (extracted) return extracted;
    }
    if (obj.data && (typeof obj.data === 'object' || typeof obj.data === 'string')) {
      const extracted = extractAgentResponseText(obj.data, fallbackCounts);
      if (extracted) return extracted;
    }
    if (obj.result && (typeof obj.result === 'object' || typeof obj.result === 'string')) {
      const extracted = extractAgentResponseText(obj.result, fallbackCounts);
      if (extracted) return extracted;
    }

    // Check direct text fields from Groq Chat / LLM node
    for (const textKey of ['text', 'message', 'output', 'response', 'content', 'summary', 'reply']) {
      if (typeof obj[textKey] === 'string' && (obj[textKey] as string).trim()) {
        const val = (obj[textKey] as string).trim();
        if (!isRawWebhookJsonString(val)) {
          return val;
        }
      }
    }

    // OpenAI / Groq standard choices
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
      const firstChoice = obj.choices[0] as Record<string, unknown>;
      if (firstChoice) {
        if (typeof firstChoice.text === 'string' && firstChoice.text.trim()) {
          return firstChoice.text.trim();
        }
        if (firstChoice.message && typeof firstChoice.message === 'object') {
          const choiceMsg = firstChoice.message as Record<string, unknown>;
          if (typeof choiceMsg.content === 'string' && choiceMsg.content.trim()) {
            return choiceMsg.content.trim();
          }
        }
      }
    }

    return fallbackCounts
      ? formatCollectionSummary(fallbackCounts)
      : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
  }

  return fallbackCounts
    ? formatCollectionSummary(fallbackCounts)
    : formatCollectionSummary({ kaggle: 0, huggingface: 0, github: 0, zenodo: 0, total: 0, hasPlatformCounts: true });
}

