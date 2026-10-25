import {
  CHATBOT_MODEL_ACTIONS,
  CHATBOT_MODEL_IDS,
  CHATBOT_MODEL_REASONS,
} from '@/api/chatbot';

import type { FlytChatbotMessage, FlytChatbotModel } from './types';

export const MODEL_ORDER: readonly FlytChatbotModel[] = [
  CHATBOT_MODEL_IDS.FLYT,
  CHATBOT_MODEL_IDS.CHATGPT,
  CHATBOT_MODEL_IDS.DEEPSEEK,
  CHATBOT_MODEL_IDS.GLM,
];

export const modelLabel: Record<FlytChatbotModel, string> = {
  [CHATBOT_MODEL_IDS.FLYT]: 'Flyt',
  [CHATBOT_MODEL_IDS.CHATGPT]: 'ChatGPT',
  [CHATBOT_MODEL_IDS.DEEPSEEK]: 'DeepSeek',
  [CHATBOT_MODEL_IDS.GLM]: 'z.ai',
};

export const modelDetail: Partial<Record<FlytChatbotModel, string>> = {
  [CHATBOT_MODEL_IDS.CHATGPT]: 'powered by Luna',
};

export function formatChatbotLabel(
  message: FlytChatbotMessage | undefined,
  fallbackModel: FlytChatbotModel | null,
): string {
  const model =
    message?.role === 'chatbot' && message.model
      ? message.model
      : fallbackModel;
  return model ? modelLabel[model] : 'Flyt';
}

export function formatUnavailableModelReason(
  model: FlytChatbotModel,
  modelReasons: Partial<Record<FlytChatbotModel, string | null>>,
  modelActions: Partial<Record<FlytChatbotModel, string | null>>,
): string {
  if (modelReasons[model] === CHATBOT_MODEL_REASONS.OPENROUTER_KEY_REQUIRED) {
    return 'set up a provider key in Account settings';
  }
  if (modelActions[model] === CHATBOT_MODEL_ACTIONS.LINK_ACCOUNT) {
    return 'link your ChatGPT account';
  }
  if (modelActions[model] === CHATBOT_MODEL_ACTIONS.RELINK_ACCOUNT) {
    return 'reconnect your ChatGPT account';
  }
  if (model === CHATBOT_MODEL_IDS.FLYT) {
    return 'not available right now';
  }
  return 'not connected';
}
