import type { FlytChatbotMessage, FlytChatbotModel } from './types';

export const MODEL_ORDER: readonly FlytChatbotModel[] = [
  'flyt',
  'chatgpt',
  'deepseek',
  'glm',
];

export const modelLabel: Record<FlytChatbotModel, string> = {
  flyt: 'Flyt',
  chatgpt: 'ChatGPT',
  deepseek: 'DeepSeek',
  glm: 'z.ai',
};

export const modelDetail: Partial<Record<FlytChatbotModel, string>> = {
  chatgpt: 'powered by Luna',
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
  if (modelReasons[model] === 'openrouter_key_required') {
    return 'set up a provider key in Account settings';
  }
  if (modelActions[model] === 'link_account') {
    return 'link your ChatGPT account';
  }
  if (modelActions[model] === 'relink_account') {
    return 'reconnect your ChatGPT account';
  }
  if (model === 'flyt') {
    return 'not available right now';
  }
  return 'not connected';
}
