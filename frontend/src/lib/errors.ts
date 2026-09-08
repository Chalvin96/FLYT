import * as Sentry from '@sentry/react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';

function toError(message: string, error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error(message, { cause: error });
}

/**
 * Build a PII-safe Sentry payload for an AxiosError.
 *
 * AxiosError is an Error subclass, so forwarding it to Sentry verbatim would
 * serialize `error.config` (request headers, auth tokens, request/response
 * bodies). Instead we construct a fresh Error carrying only the original
 * message and attach a small, safe set of fields as Sentry context.
 */
function toSafeSentryPayload(
  message: string,
  error: unknown,
): {
  error: Error;
  tags: {
    http_status?: number;
    api_code?: string;
    http_method?: string;
  };
  extra: { url?: string };
} {
  const normalizedMessage = toError(message, error).message;

  if (isAxiosError(error)) {
    const safeError = new Error(normalizedMessage);
    const response = error.response;
    const responseData = response?.data;
    const detail = responseData?.detail;
    const apiCode =
      typeof detail === 'object' && detail !== null
        ? (detail.code as string | undefined)
        : undefined;

    // Strip query string and fragment from the URL: those can carry OAuth
    // `?code=...`, tokens, or other PII that we just spent effort removing
    // from the Sentry payload.
    const rawUrl = error.config?.url;
    const url = rawUrl ? rawUrl.split(/[?#]/)[0] : undefined;

    return {
      error: safeError,
      tags: {
        http_status: response?.status,
        api_code: apiCode,
        http_method: error.config?.method,
      },
      extra: { url },
    };
  }

  return {
    error: toError(message, error),
    tags: {},
    extra: {},
  };
}

export function logClientError(message: string, error: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedError = toError(message, error);

  if (Sentry.getClient()) {
    // Build the sanitized payload BEFORE the console.error call: Sentry's
    // default console-breadcrumb integration can attach logged objects to the
    // event, which would re-leak config/headers/body that we just stripped.
    const payload = toSafeSentryPayload(message, error);

    // Always log to the console first so local repro works even when the
    // Sentry path takes over. Log the sanitized error so breadcrumbs stay
    // PII-safe.
    console.error(message, payload.error);

    Sentry.captureException(payload.error, {
      tags: payload.tags,
      extra: payload.extra,
    });
    return;
  }

  const reportError = (
    window as Window & { reportError?: (value: Error) => void }
  ).reportError;

  if (typeof reportError === 'function') {
    reportError(normalizedError);
    return;
  }

  console.error(message, normalizedError);
}

export function showApiError(error: unknown) {
  const line1 = 'Something went wrong. Please try again.';
  let line2: string | undefined =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : undefined;
  let code: string | undefined;

  if (isAxiosError(error)) {
    const responseData = error.response?.data;
    const detail = responseData?.detail;
    code = detail?.code;

    if (error.response?.status === 422 && Array.isArray(responseData?.detail)) {
      const firstError = responseData.detail[0]?.msg;
      if (firstError) {
        line2 = firstError;
      }
    } else {
      if (typeof detail === 'string') {
        line2 = detail;
      } else {
        const message = detail?.message;
        if (message) {
          line2 = message;
        }
      }
    }
  }

  toast.error(line1, {
    description: line2,
  });

  if (code) {
    logClientError(`API error code: ${code}`, error);
  }
}
