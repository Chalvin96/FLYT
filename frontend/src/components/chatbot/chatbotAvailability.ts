import {
  CHATBOT_MODEL_ACTIONS,
  CHATBOT_MODEL_IDS,
  CHATBOT_MODEL_REASONS,
} from '@/api/chatbot';
import { ACCOUNT_PAGE_ANCHORS } from '@/components/nav/accountNavigation';

import type {
  ChatbotAvailabilityStatus,
  ChatbotModelSetupGuidance,
  FlytChatbotModel,
} from './types';
import { CHATBOT_AVAILABILITY_STATUSES, CHATBOT_SETUP_TARGETS } from './types';

export function buildModelSetupGuidance(
  model: FlytChatbotModel,
  {
    action,
    reason,
    status,
  }: {
    action: string | null | undefined;
    reason: string | null | undefined;
    status: ChatbotAvailabilityStatus;
  },
): ChatbotModelSetupGuidance {
  if (status === CHATBOT_AVAILABILITY_STATUSES.LOADING) {
    return {
      message: 'Checking whether this model is available…',
      ctaLabel: null,
      target: null,
    };
  }

  if (status === CHATBOT_AVAILABILITY_STATUSES.ERROR) {
    return {
      message: 'Flyt could not check which models you can use.',
      ctaLabel: 'Try again',
      target: CHATBOT_SETUP_TARGETS.RETRY,
    };
  }

  if (model === CHATBOT_MODEL_IDS.CHATGPT) {
    if (
      action === CHATBOT_MODEL_ACTIONS.RELINK_ACCOUNT ||
      reason === CHATBOT_MODEL_REASONS.RELINK_ACCOUNT
    ) {
      return {
        message:
          'Your ChatGPT connection stopped working. Reconnect it to keep using this model.',
        ctaLabel: 'Reconnect in Account settings',
        target: ACCOUNT_PAGE_ANCHORS.CHATGPT,
      };
    }
    return {
      message: 'Connect your ChatGPT account to ask questions with it.',
      ctaLabel: 'Connect in Account settings',
      target: ACCOUNT_PAGE_ANCHORS.CHATGPT,
    };
  }

  if (model === CHATBOT_MODEL_IDS.DEEPSEEK || model === CHATBOT_MODEL_IDS.GLM) {
    return {
      message: 'DeepSeek and z.ai need your own provider key.',
      ctaLabel: 'Add key in Account settings',
      target: ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY,
    };
  }

  if (model === CHATBOT_MODEL_IDS.FLYT) {
    return {
      message:
        'Flyt cannot answer right now. Pick another model and try again.',
      ctaLabel: null,
      target: null,
    };
  }

  return {
    message: 'This model is not connected.',
    ctaLabel: null,
    target: null,
  };
}
