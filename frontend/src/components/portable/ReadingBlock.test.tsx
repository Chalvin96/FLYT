import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ReadingBlock as ReadingBlockData } from '@/types/lesson-contracts';

import { ReadingBlock } from './ReadingBlock';

const block: ReadingBlockData = {
  kind: 'reading',
  id: 'reading-001',
  spans: [{ kind: 'text', value: 'Hvor er holdeplassen?' }],
  translation: 'Where is the bus stop?',
};

describe('ReadingBlock', () => {
  it('test_reading_translation_given_collapsed_expect_definition_style_disclosure', () => {
    render(<ReadingBlock block={block} />);

    const trigger = screen.getByRole('button', { name: 'Show translation' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('▶');
    expect(screen.getByText(block.translation)).not.toBeVisible();
    expect(trigger).not.toHaveClass('underline');
  });

  it('test_reading_translation_given_toggle_expect_reveal_and_hide', async () => {
    const user = userEvent.setup();
    render(<ReadingBlock block={block} />);

    await user.click(screen.getByRole('button', { name: 'Show translation' }));

    const hideTrigger = screen.getByRole('button', {
      name: 'Hide translation',
    });
    expect(hideTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(hideTrigger).toHaveTextContent('▼');
    expect(screen.getByText(block.translation)).toBeVisible();

    await user.click(hideTrigger);

    expect(
      screen.getByRole('button', { name: 'Show translation' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(block.translation)).not.toBeVisible();
  });
});
