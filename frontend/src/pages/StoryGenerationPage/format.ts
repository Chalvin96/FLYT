import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError';
import type { StoryGenerationProvider } from '@/types/api';

import { REQUEST_REFUSAL_CODES } from './constants';

export function formatRemainingPercent(
  remainingPercent: number | null | undefined,
): string | null {
  if (remainingPercent === null || remainingPercent === undefined) return null;
  return `${remainingPercent}% left`;
}

export function getProviderAvailabilityMessage(
  provider: StoryGenerationProvider,
): string {
  if (provider.action === 'link_account') {
    return 'Connect your ChatGPT account to enable this provider.';
  }
  if (provider.action === 'relink_account') {
    return 'Reconnect your ChatGPT account to enable this provider.';
  }
  return 'This provider is unavailable right now.';
}

export function getRequestRefusal(error: unknown): string | null {
  const code = getApiErrorCode(error);
  if (!code || !REQUEST_REFUSAL_CODES.has(code)) return null;
  return getApiErrorMessage(error);
}
