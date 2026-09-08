import type { ChatbotTurn } from '@/api/chatbot';

import type { FlytChatbotContext, FlytChatbotMessage } from './types';

const CHATBOT_HISTORY_MAX_TURNS = 12;
const CHATBOT_HISTORY_MESSAGE_MAX_CHARACTERS = 4_000;
const CHATBOT_INPUT_MAX_CHARACTERS = 48_000;

export function buildChatbotHistory(
  messages: readonly FlytChatbotMessage[],
  message: string,
  context: FlytChatbotContext | null,
): ChatbotTurn[] {
  const historyBudget = Math.max(
    0,
    CHATBOT_INPUT_MAX_CHARACTERS -
      message.length -
      (context?.label.length ?? 0) -
      (context?.detail?.length ?? 0),
  );
  const turns = messages
    .flatMap((message) => {
      if (message.role === 'note' || typeof message.content !== 'string') {
        return [];
      }
      return [
        {
          role: message.role,
          content: message.content.slice(
            0,
            CHATBOT_HISTORY_MESSAGE_MAX_CHARACTERS,
          ),
        },
      ];
    })
    .slice(-CHATBOT_HISTORY_MAX_TURNS);

  const boundedTurns: ChatbotTurn[] = [];
  let remainingCharacters = historyBudget;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (remainingCharacters === 0) break;
    const turn = turns[index];
    const content = turn.content.slice(0, remainingCharacters);
    if (!content) continue;
    boundedTurns.unshift({ role: turn.role, content });
    remainingCharacters -= content.length;
  }
  return boundedTurns;
}
