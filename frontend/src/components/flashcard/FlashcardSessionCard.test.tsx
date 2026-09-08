import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FlashcardSessionCard } from './FlashcardSessionCard';

function makeCard(schemaVersion: string) {
  return {
    id: 1,
    user_id: 7,
    card: {
      id: 11,
      deck_id: null,
      type: 'choose' as const,
      schema_version: schemaVersion,
      payload: {
        kind: 'exercise' as const,
        id: 'choose-1',
        operation: 'choose' as const,
        objective_id: 'objective-1',
        prompt: [{ kind: 'text' as const, value: 'Choose one.' }],
        explanation: null,
        payload: {
          options: [
            { option_id: 'one', text: 'One' },
            { option_id: 'two', text: 'Two' },
          ],
          answer_id: 'one',
        },
      },
    },
  };
}

describe('FlashcardSessionCard', () => {
  it('test_unsupported_schema_given_operation_card_expect_unsupported_step', () => {
    render(
      <FlashcardSessionCard
        card={makeCard('3.0')}
        isSubmitting={false}
        onFinished={vi.fn()}
      />,
    );

    expect(screen.getByText('Unsupported lesson step')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});
