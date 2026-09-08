import { client } from './client';

export const CHATGPT_LINK_ERROR = {
  DISABLED: 'CHATGPT_LINK_DISABLED',
  INELIGIBLE: 'CHATGPT_LINK_INELIGIBLE',
  MODEL_UNAVAILABLE: 'CHATGPT_LINK_MODEL_UNAVAILABLE',
  NO_PENDING: 'CHATGPT_LINK_NO_PENDING',
  TRANSIENT: 'CHATGPT_LINK_TRANSIENT',
} as const;

export interface PendingChatGPTAuthorization {
  user_code: string;
  expires_at: string;
}

export interface ChatGPTLink {
  state: 'absent' | 'working' | 'broken';
  broken_reason: string | null;
  connected_at: string | null;
  pending: PendingChatGPTAuthorization | null;
  model: string | null;
  available_models: string[];
}

export interface ChatGPTLinkStart {
  user_code: string;
  verification_url: string;
  expires_at: string;
}

export interface ChatGPTLinkPoll {
  status: 'pending' | 'linked';
}

export async function getChatGPTLink(): Promise<ChatGPTLink> {
  return (await client.get<ChatGPTLink>('/chatgpt/link')).data;
}

export async function startChatGPTLink(): Promise<ChatGPTLinkStart> {
  return (await client.post<ChatGPTLinkStart>('/chatgpt/link/start')).data;
}

export async function pollChatGPTLink(): Promise<ChatGPTLinkPoll> {
  return (await client.post<ChatGPTLinkPoll>('/chatgpt/link/poll')).data;
}

export async function deleteChatGPTLink(): Promise<void> {
  await client.delete('/chatgpt/link');
}
