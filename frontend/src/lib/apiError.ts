import { isAxiosError } from 'axios';

/** Extract the canonical Flyt `detail.code` from an API error, if present. */
export function getApiErrorCode(error: unknown): string | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === 'object' && detail !== null) {
    const code = detail.code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'object' && detail !== null) {
      if (typeof detail.message === 'string') return detail.message;
      if (typeof detail.msg === 'string') return detail.msg;
    }
    if (typeof detail === 'string') return detail;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Something went wrong. Please try again.';
}
