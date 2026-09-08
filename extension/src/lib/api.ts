// Backend calls. Runs in the SERVICE WORKER. Auth = the web-session JWT read fresh from
// the app's cookie (lib/auth) and sent as a Bearer header - so SameSite never applies.

import { openLogin, readSessionToken } from './auth';
import { HTTP_401_UNAUTHORIZED } from './http';
import type { LemmaContext, TranslationResponse } from './messages';
import type {
  LemmaDefinitionsResponse,
  LemmaState,
  ResolveCandidate,
  ResolveResponse,
  ResolveState,
} from './resolve-types';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8000';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message?: string, code?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ImportPagePayload = {
  title: string;
  source_url: string;
  text: string;
};

type ErrorDetail = {
  code?: unknown;
  message?: unknown;
};

const ALLOWED_STATES = new Set<ResolveState>(['new', 'learning', 'known']);
const ALLOWED_DETAIL_STATES = new Set<LemmaState>([
  'new',
  'learning',
  'mastered',
]);

// Read-only, anonymous: /lexicons/resolve is a pure GET with no Bearer token. Detail is
// optional-auth; user-scoped mutations read the cookie only for their own request.
export async function resolveWord(word: string): Promise<ResolveResponse> {
  const res = await fetch(`${API_ORIGIN}/lexicons/resolve?word=${encodeURIComponent(word)}`);
  if (!res.ok) throw new ApiError(res.status, 'resolve failed');
  const data = (await res.json()) as ResolveResponse;
  // Sanitize state at the API boundary - drop any value outside the allowed set.
  return {
    ...data,
    candidates: data.candidates.map((c) =>
      c.state !== undefined && !ALLOWED_STATES.has(c.state)
        ? { ...c, state: undefined }
        : c,
    ),
  };
}

export async function getLemmaDefinitions(
  lemmaUuid: string,
): Promise<LemmaDefinitionsResponse> {
  const token = await readSessionToken();
  const init: RequestInit | undefined = token
    ? { headers: { Authorization: 'Bearer ' + token } }
    : undefined;
  const res = await fetch(
    API_ORIGIN +
      '/lexicons/lemmas/' +
      encodeURIComponent(lemmaUuid) +
      '/definitions',
    init,
  );
  if (!res.ok) throw new ApiError(res.status, 'lemma detail failed');
  const data = (await res.json()) as LemmaDefinitionsResponse;
  return {
    ...data,
    definitions: data.definitions.map((definition) => ({
      ...definition,
      userState: ALLOWED_DETAIL_STATES.has(definition.userState)
        ? definition.userState
        : 'new',
    })),
  };
}

// Read-only, anonymous typeahead: GET /lexicons/suggestions?query= -> ranked headword
// labels (backend requires query length >= 2; caller guards before sending). Returns the
// plain label strings the popup feeds to its suggestion list.
export async function searchSuggestions(query: string): Promise<string[]> {
  const res = await fetch(`${API_ORIGIN}/lexicons/suggestions?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new ApiError(res.status, 'suggestions failed');
  const data = (await res.json()) as { suggestions: { label: string }[] };
  return data.suggestions.map((s) => s.label);
}

// Mutation: needs auth. Missing cookie and 401 are treated identically -> caller opens login.
export async function addToDeck(
  lemmaUuid: string,
  context?: LemmaContext,
): Promise<void> {
  const token = await readSessionToken();
  if (!token) throw new ApiError(HTTP_401_UNAUTHORIZED, 'no session');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = {
    method: 'POST',
    headers,
  };
  if (context) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(context);
  }
  const res = await fetch(`${API_ORIGIN}/me/cards/lemmas/${encodeURIComponent(lemmaUuid)}/add-to-deck`, {
    ...init,
  });
  if (!res.ok && res.status !== 409) throw new ApiError(res.status, 'add-to-deck failed');
}

export async function translateSelection(text: string): Promise<TranslationResponse> {
  const token = await readSessionToken();
  if (!token) throw new ApiError(HTTP_401_UNAUTHORIZED, 'no session');
  const res = await fetch(`${API_ORIGIN}/extension/translate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    const code = typeof detail?.code === 'string' ? detail.code : undefined;
    throw new ApiError(res.status, 'translation failed', code);
  }
  const data = (await res.json()) as TranslationResponse;
  if (
    typeof data.source_text !== 'string' ||
    typeof data.translated_text !== 'string' ||
    typeof data.source_language !== 'string' ||
    typeof data.target_language !== 'string'
  ) {
    throw new ApiError(502, 'translation response invalid');
  }
  return data;
}

export async function markLemmaKnown(lemmaUuid: string): Promise<void> {
  const token = await readSessionToken();
  if (!token) throw new ApiError(HTTP_401_UNAUTHORIZED, 'no session');
  const res = await fetch(
    API_ORIGIN +
      '/lexicons/lemmas/' +
      encodeURIComponent(lemmaUuid) +
      '/mark-known',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    },
  );
  if (!res.ok) throw new ApiError(res.status, 'mark-known failed');
}

async function readErrorDetail(res: Response): Promise<ErrorDetail | undefined> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'object' && body.detail !== null) {
      return body.detail as ErrorDetail;
    }
  } catch {
    // The status remains authoritative when a proxy or network boundary returns
    // a non-JSON response instead of the canonical API error envelope.
  }
  return undefined;
}

// Mutation: page extraction has already happened in the content script. The service
// worker only submits the resulting text; it never fetches source_url.
export async function importPage(payload: ImportPagePayload): Promise<void> {
  const token = await readSessionToken();
  if (!token) {
    await openLogin();
    throw new ApiError(HTTP_401_UNAUTHORIZED, 'Sign in to import this page.');
  }

  const res = await fetch(`${API_ORIGIN}/imports/extension`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) return;

  const detail = await readErrorDetail(res);
  const code = typeof detail?.code === 'string' ? detail.code : undefined;

  if (res.status === HTTP_401_UNAUTHORIZED) {
    await openLogin();
    throw new ApiError(
      HTTP_401_UNAUTHORIZED,
      'Sign in to import this page.',
      code,
    );
  }

  // The popup derives user-facing copy from the error code/status (see
  // classify + importErrorMessage), so the message here is diagnostic only.
  const apiMessage = typeof detail?.message === 'string' ? detail.message : undefined;
  throw new ApiError(res.status, apiMessage ?? 'Page import failed.', code);
}

export type {
  LemmaDefinitionsResponse,
  ResolveCandidate,
  ResolveResponse,
};
