import { describe, expect, it } from 'vitest';

import { buildChatbotHistory } from './buildChatbotHistory';
import type { FlytChatbotMessage } from './types';

const turn = (
  id: string,
  role: FlytChatbotMessage['role'],
  content: FlytChatbotMessage['content'],
): FlytChatbotMessage => ({ id, role, content });

describe('buildChatbotHistory', () => {
  it('test_build_chatbot_history_given_turn_over_4000_characters_expect_turn_trimmed_to_4000', () => {
    const history = buildChatbotHistory(
      [turn('a', 'user', 'u'.repeat(4_100))],
      'q',
      null,
    );

    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toHaveLength(4_000);
  });

  it('test_build_chatbot_history_given_history_exceeds_48000_budget_expect_newest_turns_backfilled_and_oldest_trimmed', () => {
    const contents = Array.from(
      { length: 12 },
      (_, index) => String(index).padStart(4, '0') + 'x'.repeat(3_996),
    );
    const messages = contents.map((content, index) =>
      turn(`turn-${index}`, index % 2 === 0 ? 'user' : 'chatbot', content),
    );

    const history = buildChatbotHistory(messages, 'q', null);

    expect(history).toHaveLength(12);
    expect(
      history.reduce((total, bounded) => total + bounded.content.length, 0),
    ).toBe(47_999);
    expect(history[0]?.content).toBe(contents[0]?.slice(0, 3_999));
    expect(history.map((bounded) => bounded.role)).toEqual(
      messages.map((message) => message.role),
    );
  });

  it('test_build_chatbot_history_given_message_consumes_budget_expect_single_truncated_newest_turn', () => {
    const messages = [
      turn('old', 'user', 'o'.repeat(4_000)),
      turn('new', 'chatbot', 'c'.repeat(4_000)),
    ];

    const history = buildChatbotHistory(messages, 'q'.repeat(47_000), null);

    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe('chatbot');
    expect(history[0]?.content).toBe('c'.repeat(1_000));
  });

  it('test_build_chatbot_history_given_context_characters_expect_counted_against_budget', () => {
    const context = {
      kind: 'lesson' as const,
      label: 'L'.repeat(100),
      detail: 'D'.repeat(50),
    };

    const history = buildChatbotHistory(
      [turn('a', 'chatbot', 'c'.repeat(4_000))],
      'q'.repeat(44_001),
      context,
    );

    expect(history[0]?.content).toHaveLength(3_849);
  });

  it('test_build_chatbot_history_given_notes_and_nonstring_turns_expect_excluded_from_history', () => {
    const messages = [
      turn('note', 'note', 'Now asking about Nouns'),
      turn('rich', 'chatbot', 42),
      turn('text', 'user', 'Hei'),
    ];

    const history = buildChatbotHistory(messages, 'q', null);

    expect(history).toEqual([{ role: 'user', content: 'Hei' }]);
  });

  it('test_build_chatbot_history_given_more_than_12_turns_expect_only_newest_12_eligible', () => {
    const messages = Array.from({ length: 13 }, (_, index) =>
      turn(`turn-${index}`, 'user', `message ${index}`),
    );

    const history = buildChatbotHistory(messages, 'q', null);

    expect(history).toHaveLength(12);
    expect(history[0]?.content).toBe('message 1');
    expect(history.at(-1)?.content).toBe('message 12');
  });

  it('test_build_chatbot_history_given_no_remaining_budget_expect_empty_history', () => {
    const history = buildChatbotHistory(
      [turn('a', 'user', 'hello')],
      'q'.repeat(48_000),
      null,
    );

    expect(history).toEqual([]);
  });
});
