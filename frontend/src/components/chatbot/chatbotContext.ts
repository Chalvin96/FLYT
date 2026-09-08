import type { FlytChatbotContext, FlytChatbotContextKind } from './types';

export const hasAttachedSource = (
  context: FlytChatbotContext | null | undefined,
) => Boolean(context) && context?.kind !== 'general';

export const contextKindLabel: Record<FlytChatbotContextKind, string> = {
  general: 'Current screen',
  lesson: 'Lesson',
  reading: 'Reading',
  selection: 'Selected text',
};
