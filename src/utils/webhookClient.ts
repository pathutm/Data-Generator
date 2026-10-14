import type { SubmissionPayload, SubmissionResult } from '../types';
import { WEBHOOK_TIMEOUT_MS } from '../config';

/**
 * Submit the dataset summary payload to the configured webhook.
 * Returns the full submission result including HTTP status and parsed response.
 */
export async function submitPayload(
  payload: SubmissionPayload,
  webhookUrl: string,
  abortSignal?: AbortSignal
): Promise<SubmissionResult> {
  if (!webhookUrl || webhookUrl.trim() === '') {
    return {
      status: 'error',
      errorMessage:
        'No webhook URL configured. Set VITE_SCHEMA_WORKFLOW_WEBHOOK_URL or VITE_SCHEMA_WORKFLOW_WEBHOOK_TEST_URL in your .env file.',
    };
  }

  const controller = new AbortController();
  const combinedSignal = abortSignal
    ? AbortSignal.any([controller.signal, abortSignal])
    : controller.signal;

  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    let responseBody: unknown;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }
    } else {
      responseBody = await response.text();
    }

    if (!response.ok) {
      return {
        status: 'error',
        httpStatus: response.status,
        responseBody,
        errorMessage: `Server returned HTTP ${response.status}: ${response.statusText}`,
        submittedAt: new Date().toISOString(),
      };
    }

    // Try to extract execution ID from response if it's JSON
    let executionId: string | undefined;
    if (responseBody && typeof responseBody === 'object') {
      const body = responseBody as Record<string, unknown>;
      // Check common execution ID field names
      executionId =
        (body.executionId as string) ||
        (body.execution_id as string) ||
        (body.id as string) ||
        (body.workflowExecutionId as string) ||
        undefined;
    }

    return {
      status: 'success',
      httpStatus: response.status,
      responseBody,
      executionId,
      submittedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        if (abortSignal?.aborted) {
          return {
            status: 'error',
            errorMessage: 'Submission cancelled by user.',
          };
        }
        return {
          status: 'error',
          errorMessage: `Request timed out after ${WEBHOOK_TIMEOUT_MS / 1000} seconds. The server may still be processing the request.`,
        };
      }
      return {
        status: 'error',
        errorMessage: `Network error: ${err.message}`,
      };
    }

    return {
      status: 'error',
      errorMessage: 'An unexpected error occurred during submission.',
    };
  }
}
