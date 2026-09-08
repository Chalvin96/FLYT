import { ApiError } from './api';
import {
  HTTP_401_UNAUTHORIZED,
  HTTP_413_REQUEST_ENTITY_TOO_LARGE,
  HTTP_422_UNPROCESSABLE_ENTITY,
  HTTP_429_TOO_MANY_REQUESTS,
} from './http';
import type { MsgResult } from './messages';

// Map an import/lookup failure to a stable popup error kind, by the backend's
// canonical error code first, HTTP status only as a fallback. A non-ApiError
// (fetch threw) is a real network failure.
export function classify(e: unknown): MsgResult {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'IMPORT_TOO_LARGE':
        return { ok: false, error: 'too-large' };
      case 'IMPORT_INVALID_SOURCE_URL':
      case 'IMPORT_EMPTY':
        return { ok: false, error: 'invalid-page' };
      case 'IMPORT_QUOTA_EXCEEDED':
      case 'EXTENSION_TRANSLATION_QUOTA_EXCEEDED':
        return { ok: false, error: 'quota-reached' };
    }
    if (e.status === HTTP_401_UNAUTHORIZED)
      return { ok: false, error: 'unauthorized' };
    if (e.status === HTTP_413_REQUEST_ENTITY_TOO_LARGE)
      return { ok: false, error: 'too-large' };
    if (e.status === HTTP_422_UNPROCESSABLE_ENTITY)
      return { ok: false, error: 'invalid-page' };
    if (e.status === HTTP_429_TOO_MANY_REQUESTS)
      return { ok: false, error: 'quota-reached' };
    return { ok: false, error: 'unknown' };
  }
  return { ok: false, error: 'network' };
}
