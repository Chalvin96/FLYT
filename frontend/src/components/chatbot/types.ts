import type { ReactNode } from 'react';

export type FlytChatbotContextKind =
  'general' | 'lesson' | 'reading' | 'selection';

export interface FlytChatbotContext {
  kind: FlytChatbotContextKind;
  label: string;
  detail?: string;
}

export type FlytChatbotModel = 'flyt' | 'chatgpt' | 'deepseek' | 'glm';
export type FlytChatbotSurface = 'card' | 'pane';

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
  onSend?: (message: string, model: FlytChatbotModel) => void;
  onStarterSelect?: (prompt: string) => void;
  onFollowUpSelect?: (prompt: string) => void;
}
