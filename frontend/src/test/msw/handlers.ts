import { http, HttpResponse } from 'msw/http';

import {
  CHATBOT_MODEL_ACTIONS,
  CHATBOT_MODEL_IDS,
  CHATBOT_MODEL_REASONS,
} from '@/api/chatbot';
import type { ImportItem, ImportListResponse } from '@/types/api';

// Happy-path defaults only; handlers never reproduce server-side validation.
export function buildImportItem(
  overrides: Partial<ImportItem> = {},
): ImportItem {
  return {
    id: 'import-1',
    storyUuid: 'story-1',
    title: 'Et importert dokument',
    sourceUrl: null,
    status: 'ready',
    errorCode: null,
    errorMessage: null,
    pageCount: 1,
    wordCount: 120,
    createdAt: '2026-07-24T10:00:00Z',
    ...overrides,
  };
}

export function buildImportList(
  items: ImportItem[] = [buildImportItem()],
  overrides: Partial<ImportListResponse> = {},
): ImportListResponse {
  return {
    items,
    nextCursor: null,
    // Deliberately not the real IMPORT_LIMIT, which would be another copy of it.
    quota: { used: items.length, limit: 7 },
    ...overrides,
  };
}

export const handlers = [
  http.get('*/chatgpt/link', () =>
    HttpResponse.json({
      state: 'absent',
      broken_reason: null,
      connected_at: null,
      pending: null,
      model: 'gpt-5.6-luna',
      available_models: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'],
    }),
  ),
  http.get('*/chatbot', () =>
    HttpResponse.json({
      models: [
        {
          id: CHATBOT_MODEL_IDS.FLYT,
          label: 'Flyt',
          detail: 'GLM 5.3 Flash',
          model: 'z-ai/glm-5.3-flash',
          available: true,
          reason: null,
          action: null,
          requiresOpenRouterKey: false,
        },
        {
          id: CHATBOT_MODEL_IDS.CHATGPT,
          label: 'ChatGPT',
          detail: 'powered by Luna',
          model: 'gpt-5.6-luna',
          available: false,
          reason: CHATBOT_MODEL_REASONS.NOT_LINKED,
          action: CHATBOT_MODEL_ACTIONS.LINK_ACCOUNT,
          requiresOpenRouterKey: false,
        },
        {
          id: CHATBOT_MODEL_IDS.DEEPSEEK,
          label: 'DeepSeek',
          detail: 'via OpenRouter',
          model: 'deepseek/deepseek-v4-flash-0731',
          available: false,
          reason: CHATBOT_MODEL_REASONS.OPENROUTER_KEY_REQUIRED,
          action: CHATBOT_MODEL_ACTIONS.ADD_OPENROUTER_KEY,
          requiresOpenRouterKey: true,
        },
        {
          id: CHATBOT_MODEL_IDS.GLM,
          label: 'GLM 5.3 Flash',
          detail: 'via OpenRouter',
          model: 'z-ai/glm-5.3-flash',
          available: false,
          reason: CHATBOT_MODEL_REASONS.OPENROUTER_KEY_REQUIRED,
          action: CHATBOT_MODEL_ACTIONS.ADD_OPENROUTER_KEY,
          requiresOpenRouterKey: true,
        },
      ],
      openrouterKeyConfigured: false,
    }),
  ),
  http.put('*/chatbot/openrouter-key', () =>
    HttpResponse.json({
      openrouterKeyConfigured: true,
    }),
  ),
  http.delete(
    '*/chatbot/openrouter-key',
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get('*/imports', () => HttpResponse.json(buildImportList())),
  http.post('*/imports', () =>
    HttpResponse.json(buildImportItem({ status: 'pending' }), { status: 201 }),
  ),
  http.post(
    '*/imports/:id/retry',
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.delete('*/imports/:id', () => new HttpResponse(null, { status: 204 })),
];
