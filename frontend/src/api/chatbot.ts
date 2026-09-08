import { client } from './client';

export type ChatbotModel = 'flyt' | 'chatgpt' | 'deepseek' | 'glm';
export type ChatbotContextKind = 'general' | 'lesson' | 'reading' | 'selection';

export interface ChatbotContext {
  kind: ChatbotContextKind;
  label: string;
  detail?: string;
}

export interface ChatbotTurn {
  role: 'user' | 'chatbot';
  content: string;
}

export interface ChatbotMessageRequest {
  model: ChatbotModel;
  message: string;
  context?: ChatbotContext | null;
  history: ChatbotTurn[];
}

export interface ChatbotModelAvailability {
  id: ChatbotModel;
  label: string;
  detail: string;
  model: string;
  available: boolean;
  reason: string | null;
  action: string | null;
  requiresOpenRouterKey: boolean;
  remainingPercent?: number | null;
}

export interface ChatbotSurface {
  models: ChatbotModelAvailability[];
  openrouterKeyConfigured: boolean;
}

export interface ChatbotMessageResponse {
  model: ChatbotModel;
  content: string;
}

export interface OpenRouterKeyStatus {
  openrouterKeyConfigured: boolean;
}

export async function getChatbotSurface(): Promise<ChatbotSurface> {
  return (await client.get<ChatbotSurface>('/chatbot')).data;
}

export async function sendChatbotMessage(
  payload: ChatbotMessageRequest,
): Promise<ChatbotMessageResponse> {
  return (
    await client.post<ChatbotMessageResponse>('/chatbot/messages', payload)
  ).data;
}

export async function replaceOpenRouterKey(
  apiKey: string,
): Promise<OpenRouterKeyStatus> {
  return (
    await client.put<OpenRouterKeyStatus>('/chatbot/openrouter-key', {
      apiKey,
    })
  ).data;
}

export async function deleteOpenRouterKey(): Promise<void> {
  await client.delete('/chatbot/openrouter-key');
}
