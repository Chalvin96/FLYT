import type { ReactNode } from 'react';

import type { ChatbotModel } from '@/api/chatbot';
import type { AccountPageAnchor } from '@/components/nav/accountNavigation';

export const CHATBOT_OPEN_STATES = {
  AUTO: 'auto',
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export type ChatbotOpenState =
  (typeof CHATBOT_OPEN_STATES)[keyof typeof CHATBOT_OPEN_STATES];

export const CHATBOT_AVAILABILITY_STATUSES = {
  LOADING: 'loading',
  ERROR: 'error',
  READY: 'ready',
} as const;

export type ChatbotAvailabilityStatus =
  (typeof CHATBOT_AVAILABILITY_STATUSES)[keyof typeof CHATBOT_AVAILABILITY_STATUSES];

export const CHATBOT_ERROR_SOURCES = {
  REQUEST: 'request',
  AVAILABILITY: 'availability',
} as const;

export type ChatbotErrorSource =
  (typeof CHATBOT_ERROR_SOURCES)[keyof typeof CHATBOT_ERROR_SOURCES];

export const CHATBOT_MODEL_PILL_STATES = {
  LOADING: CHATBOT_AVAILABILITY_STATUSES.LOADING,
  LOCKED: 'locked',
  READY: CHATBOT_AVAILABILITY_STATUSES.READY,
} as const;

export const CHATBOT_SETUP_TARGETS = {
  RETRY: 'retry',
} as const;

export type FlytChatbotContextKind =
  'general' | 'lesson' | 'reading' | 'selection';

export interface FlytChatbotContext {
  kind: FlytChatbotContextKind;
  label: string;
  detail?: string;
}

export type FlytChatbotModel = ChatbotModel;
export type FlytChatbotSurface = 'card' | 'pane';
export type ChatbotSetupTarget =
  | AccountPageAnchor
  | (typeof CHATBOT_SETUP_TARGETS)[keyof typeof CHATBOT_SETUP_TARGETS];

export interface ChatbotModelSetupGuidance {
  message: string;
  ctaLabel: string | null;
  target: ChatbotSetupTarget | null;
}

export interface FlytChatbotMessage {
  id: string;
  role: 'chatbot' | 'user' | 'note';
  content: ReactNode;
  model?: FlytChatbotModel;
}

export interface FlytChatbotPanelProps {
  context?: FlytChatbotContext | null;
  messages?: readonly FlytChatbotMessage[];
  defaultModel?: FlytChatbotModel;
  selectedModel?: FlytChatbotModel;
  onSelectedModelChange?: (model: FlytChatbotModel) => void;
  draft?: string;
  onDraftChange?: (draft: string) => void;
  surface?: FlytChatbotSurface;
  unavailableModels?: readonly FlytChatbotModel[];
  modelReasons?: Partial<Record<FlytChatbotModel, string | null>>;
  modelActions?: Partial<Record<FlytChatbotModel, string | null>>;
  availabilityStatus?: ChatbotAvailabilityStatus;
  flytRemainingPercent?: number | null;
  starterPrompts?: readonly string[];
  followUpPrompts?: readonly string[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onClose?: () => void;
  onContextRemove?: (context: FlytChatbotContext) => void;
  onErrorDismiss?: () => void;
  onErrorRetry?: () => void;
  onModelChange?: (model: FlytChatbotModel) => void;
  onNewConversation?: () => void;
  onOpenAccountSettings?: (anchor: AccountPageAnchor) => void;
  onRetryAvailability?: () => void;
  onSend?: (message: string, model: FlytChatbotModel) => void;
  onStarterSelect?: (prompt: string) => void;
  onFollowUpSelect?: (prompt: string) => void;
}
