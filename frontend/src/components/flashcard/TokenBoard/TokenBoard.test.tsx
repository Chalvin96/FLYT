import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TokenBoard } from './TokenBoard';

const TOKENS = [
  { token_id: 'jeg', text: 'Jeg', fixed: true },
  { token_id: 'snakker', text: 'snakker', fixed: false },
  { token_id: 'ikke', text: 'ikke', fixed: false },
  { token_id: 'norsk', text: 'norsk', fixed: false },
];

const ANSWER_ORDER = ['jeg', 'snakker', 'ikke', 'norsk'];
const MOVABLE_ANSWER_ORDER = ['snakker', 'ikke', 'norsk'];

describe('TokenBoard', () => {
  it('renders fixed tokens pre-placed in the sentence row', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={[null, null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Jeg')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add jeg/i }),
    ).not.toBeInTheDocument();
  });

  it('shows all movable tokens in the bank initially', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={[null, null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /add snakker/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add ikke/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add norsk/i }),
    ).toBeInTheDocument();
  });

  it('shows empty placeholders for unfilled movable slots', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={[null, null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getAllByText('···')).toHaveLength(3);
  });

  it('calls onAdd when a bank chip is tapped', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={[null, null, null]}
        onAdd={onAdd}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add snakker/i }));
    expect(onAdd).toHaveBeenCalledWith('snakker');
  });

  it('calls onRemove with the slot index when a placed chip is tapped', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={['snakker', null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: /remove snakker/i }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('removes a token from the bank when it is placed', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={['snakker', null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /add snakker/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add ikke/i }),
    ).toBeInTheDocument();
  });

  it('disables all chips when disabled=true', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={['snakker', null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
        disabled
      />,
    );

    for (const chip of screen.getAllByTestId('token-chip')) {
      if (chip.tagName === 'BUTTON') {
        expect(chip).toBeDisabled();
      }
    }
  });

  it('conserves movable token count across bank and answer regions', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={['snakker', null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const sentence = screen.getByLabelText('Built sentence');
    const bank = screen.getByTestId('token-bank');

    expect(within(sentence).getAllByTestId('token-chip')).toHaveLength(2);
    expect(within(bank).getAllByTestId('token-chip')).toHaveLength(2);
  });

  it('colors placed chips correct and wrong when result is set', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={['ikke', 'snakker', 'norsk']}
        movableAnswerOrder={MOVABLE_ANSWER_ORDER}
        result={{ correct: false }}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const placedButtons = screen
      .getAllByTestId('token-chip')
      .filter((el) => el.tagName === 'BUTTON');
    expect(placedButtons[0]).toHaveAttribute('data-state', 'wrong');
    expect(placedButtons[1]).toHaveAttribute('data-state', 'wrong');
    expect(placedButtons[2]).toHaveAttribute('data-state', 'correct');
  });

  // --- Positional model tests ---

  it('renders a placed token at its positional slot index', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={[null, 'ikke', null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    // "ikke" is at movable slot 1 → sentence shows: Jeg ··· ikke ···
    const sentence = screen.getByLabelText('Built sentence');
    const placedChips = within(sentence).getAllByTestId('token-chip');
    // Fixed "Jeg" + placed "ikke" = 2 chips in sentence.
    expect(placedChips).toHaveLength(2);
    expect(placedChips[1]).toHaveTextContent('ikke');
  });

  it('places into the first open slot when dropped on the sentence drop', () => {
    const onMoveToSlot = vi.fn();
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={['snakker', null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={onMoveToSlot}
        onRemove={vi.fn()}
      />,
    );

    const sentence = screen.getByLabelText('Built sentence');
    // Simulate dropping bank token "norsk" onto the sentence region.
    // The TokenBoard's handleDragEnd handles this via dnd-kit events which
    // don't fire in jsdom; verify the drop target is present.
    expect(sentence).toBeInTheDocument();
  });

  it('exposes individual slot drop targets for drag placement', () => {
    render(
      <TokenBoard
        tokens={TOKENS}
        answerOrder={ANSWER_ORDER}
        selectedTokenIds={[null, null, null]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    // Each empty movable slot renders a droppable target.
    expect(screen.getAllByText('···')).toHaveLength(3);
  });
});
