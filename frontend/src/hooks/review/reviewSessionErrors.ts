import { isAxiosError } from 'axios';

import type { ApiErrorResponse } from '@/types/api';

const K_REVIEW_ERROR_FALLBACK = 'Please try again.';

function getText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getReviewErrorToastMessage(error: unknown): string {
  if (typeof error === 'string') {
    return getText(error) ?? K_REVIEW_ERROR_FALLBACK;
  }

  if (!isAxiosError<ApiErrorResponse>(error)) {
    return error instanceof Error
      ? (getText(error.message) ?? K_REVIEW_ERROR_FALLBACK)
      : K_REVIEW_ERROR_FALLBACK;
  }

  const detail = error.response?.data?.detail;
  const code = getText(detail?.code);
  if (error.response?.status === 409 && code === 'REVIEW_STALE') {
    return 'This card was already answered in another tab. Reload to continue.';
  }
  const message =
    getText(detail?.message) ??
    getText(detail?.error) ??
    K_REVIEW_ERROR_FALLBACK;

  return code ? `${code} - ${message}` : message;
}
