import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  addToDeck,
  getLemmaDefinitions,
  importPage,
  markLemmaKnown,
  resolveWord,
  searchSuggestions,
  translateSelection,
} from './api';


const { openLogin, readSessionToken } = vi.hoisted(() => ({
  openLogin: vi.fn(),
  readSessionToken: vi.fn(),
}));

vi.mock('./auth', () => ({ openLogin, readSessionToken }));

const ORIGIN = 'http://localhost:8000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchMock() {
  const mock = vi.fn();
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
  openLogin.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolveWord', () => {
  it('test_resolve_word_given_query_expect_anonymous_get_with_encoded_word', async () => {
    const fetch = fetchMock();
    fetch.mockResolvedValue(jsonResponse({ query: 'sjø', candidates: [] }));

    await resolveWord('sjø mat');

    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/lexicons/resolve?word=sj%C3%B8%20mat`,
    );
    // No Bearer token on the read path — resolve must stay anonymous.
    expect(fetch.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('test_resolve_word_given_unknown_state_expect_state_dropped', async () => {
    const fetch = fetchMock();
    fetch.mockResolvedValue(
      jsonResponse({
        query: 'sjø',
        candidates: [
          { lemma_uuid: 'a', word: 'sjø', state: 'mastered' },
          { lemma_uuid: 'b', word: 'sjø', state: 'learning' },
          { lemma_uuid: 'c', word: 'sjø' },
        ],
      }),
    );

    const result = await resolveWord('sjø');

    expect(result.candidates.map((c) => c.state)).toEqual([
      undefined,
      'learning',
      undefined,
    ]);
  });

  it('test_resolve_word_given_error_status_expect_api_error_with_status', async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(resolveWord('sjø')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    });
  });
});

describe('searchSuggestions', () => {
  it('test_search_suggestions_given_results_expect_labels_only', async () => {
    const fetch = fetchMock();
    fetch.mockResolvedValue(
      jsonResponse({ suggestions: [{ label: 'sjø' }, { label: 'sjømat' }] }),
    );

    await expect(searchSuggestions('sjø')).resolves.toEqual(['sjø', 'sjømat']);
    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/lexicons/suggestions?query=sj%C3%B8`,
    );
  });

  it('test_search_suggestions_given_error_status_expect_api_error', async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 500 }));

    await expect(searchSuggestions('sjø')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getLemmaDefinitions', () => {
  const detail = {
    lemma_uuid: 'lemma-1',
    word: 'mote',
    pos: 'verb',
    primary_translation: 'meet / encounter',
    definitions: [
      {
        uuid: 'definition-1',
        definition: 'Norwegian definition',
        translation: 'meet',
        translation_source: null,
        examples: [],
        userState: 'unknown',
      },
    ],
  };

  it('test_detail_given_no_session_expect_anonymous_request_and_new_state', async () => {
    readSessionToken.mockResolvedValue(null);
    const fetch = fetchMock();
    fetch.mockResolvedValue(jsonResponse(detail));

    const result = await getLemmaDefinitions('lemma/1');

    expect(result.definitions[0]?.userState).toBe('new');
    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/lexicons/lemmas/lemma%2F1/definitions`,
      undefined,
    );
  });

  it('test_detail_given_session_expect_bearer_request', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    const fetch = fetchMock();
    fetch.mockResolvedValue(jsonResponse({ ...detail, definitions: [] }));

    await getLemmaDefinitions('lemma-1');

    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/lexicons/lemmas/lemma-1/definitions`,
      { headers: { Authorization: 'Bearer jwt-123' } },
    );
  });
});

describe('markLemmaKnown', () => {
  it('test_mark_known_given_session_expect_authenticated_post', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    const fetch = fetchMock();
    fetch.mockResolvedValue(new Response(null, { status: 204 }));

    await markLemmaKnown('lemma-1');

    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/lexicons/lemmas/lemma-1/mark-known`,
      { method: 'POST', headers: { Authorization: 'Bearer jwt-123' } },
    );
  });

  it('test_mark_known_given_no_session_expect_401_without_request', async () => {
    readSessionToken.mockResolvedValue(null);
    const fetch = fetchMock();

    await expect(markLemmaKnown('lemma-1')).rejects.toMatchObject({
      status: 401,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('addToDeck', () => {
  it('test_add_to_deck_given_session_token_expect_bearer_header', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    const fetch = fetchMock();
    fetch.mockResolvedValue(new Response(null, { status: 200 }));

    await addToDeck('uuid-1');

    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/me/cards/lemmas/uuid-1/add-to-deck`,
      { method: 'POST', headers: { Authorization: 'Bearer jwt-123' } },
    );
  });

  it('test_add_to_deck_given_no_session_expect_401_without_request', async () => {
    readSessionToken.mockResolvedValue(null);
    const fetch = fetchMock();

    await expect(addToDeck('uuid-1')).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('test_add_to_deck_given_409_conflict_expect_success', async () => {
    // Already in the deck is the user's desired end state, not a failure.
    readSessionToken.mockResolvedValue('jwt-123');
    fetchMock().mockResolvedValue(new Response(null, { status: 409 }));

    await expect(addToDeck('uuid-1')).resolves.toBeUndefined();
  });

  it('test_add_to_deck_given_server_error_expect_api_error', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    fetchMock().mockResolvedValue(new Response(null, { status: 500 }));

    await expect(addToDeck('uuid-1')).rejects.toMatchObject({ status: 500 });
  });

  it('test_add_to_deck_given_context_expect_json_post_with_context', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    const fetch = fetchMock();
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    const context = {
      source_sentence: 'Jeg lærer norsk.',
      source_title: 'Lesson',
    };

    await addToDeck('uuid-1', context);

    expect(fetch).toHaveBeenCalledWith(
      `${ORIGIN}/me/cards/lemmas/uuid-1/add-to-deck`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer jwt-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context),
      },
    );
  });
});

describe('translateSelection', () => {
  const translation = {
    source_text: 'Jeg lærer norsk.',
    translated_text: 'I am learning Norwegian.',
    source_language: 'no',
    target_language: 'en',
  };

  it('test_translate_selection_given_session_expect_authenticated_json_post', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    const fetch = fetchMock();
    fetch.mockResolvedValue(jsonResponse(translation));

    await expect(translateSelection('Jeg lærer norsk.')).resolves.toEqual(
      translation,
    );
    expect(fetch).toHaveBeenCalledWith(`${ORIGIN}/extension/translate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer jwt-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Jeg lærer norsk.' }),
    });
  });

  it('test_translate_selection_given_no_session_expect_401_without_request', async () => {
    readSessionToken.mockResolvedValue(null);
    const fetch = fetchMock();

    await expect(translateSelection('Jeg lærer norsk.')).rejects.toMatchObject({
      status: 401,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('test_translate_selection_given_quota_error_expect_code_carried_on_error', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    fetchMock().mockResolvedValue(
      jsonResponse(
        {
          detail: {
            code: 'EXTENSION_TRANSLATION_QUOTA_EXCEEDED',
            message: 'Limit hit.',
          },
        },
        429,
      ),
    );

    await expect(translateSelection('Jeg lærer norsk.')).rejects.toMatchObject({
      status: 429,
      code: 'EXTENSION_TRANSLATION_QUOTA_EXCEEDED',
    });
  });
});

describe('importPage', () => {
  const payload = {
    title: 'Artikkel',
    source_url: 'https://nrk.no/a',
    text: 'Norsk tekst.',
  };

  it('test_import_page_given_session_token_expect_json_post_with_bearer', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    const fetch = fetchMock();
    fetch.mockResolvedValue(new Response(null, { status: 202 }));

    await importPage(payload);

    expect(fetch).toHaveBeenCalledWith(`${ORIGIN}/imports/extension`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer jwt-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  });

  it('test_import_page_given_no_session_expect_login_opened_and_401', async () => {
    readSessionToken.mockResolvedValue(null);
    const fetch = fetchMock();

    await expect(importPage(payload)).rejects.toMatchObject({ status: 401 });
    expect(openLogin).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('test_import_page_given_expired_token_expect_login_opened_and_401', async () => {
    readSessionToken.mockResolvedValue('stale-jwt');
    fetchMock().mockResolvedValue(
      jsonResponse({ detail: { code: 'NOT_AUTHENTICATED' } }, 401),
    );

    await expect(importPage(payload)).rejects.toMatchObject({
      status: 401,
      code: 'NOT_AUTHENTICATED',
    });
    expect(openLogin).toHaveBeenCalled();
  });

  it('test_import_page_given_error_envelope_expect_code_carried_on_error', async () => {
    readSessionToken.mockResolvedValue('jwt-123');
    fetchMock().mockResolvedValue(
      jsonResponse(
        { detail: { code: 'IMPORT_QUOTA_EXCEEDED', message: 'Limit hit.' } },
        429,
      ),
    );

    await expect(importPage(payload)).rejects.toMatchObject({
      status: 429,
      code: 'IMPORT_QUOTA_EXCEEDED',
      message: 'Limit hit.',
    });
  });

  it('test_import_page_given_non_json_body_expect_status_preserved', async () => {
    // A proxy or gateway can answer with HTML; the status stays authoritative.
    readSessionToken.mockResolvedValue('jwt-123');
    fetchMock().mockResolvedValue(
      new Response('<html>502</html>', { status: 502 }),
    );

    await expect(importPage(payload)).rejects.toMatchObject({
      status: 502,
      code: undefined,
    });
    expect(openLogin).not.toHaveBeenCalled();
  });
});
