import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { clickCardRating, flipCard } from '@/test/helpers';
import { FlashCardType } from '@/types/api';
import type { DefinitionPayload, UserCard } from '@/types/api';

import { FlashCardDefinition } from './FlashCardDefinition';

const mockCard: UserCard = {
  id: 1,
  user_id: 1,
  pool_id: 1,
  card: {
    id: 1,
    type: 'definition',
    deck_id: null,
    payload: {
      lemma_uuid: 'definition-uuid-1',
      word: 'hund',
      pos: 'noun',
      primary_translation: 'dog (animal with four legs that barks)',
      definitions: [
        {
          uuid: 'def-hund-1',
          definition: 'dyr med fire ben som bjeff',
          translation: 'dog (animal with four legs that barks)',
          examples_json: [],
        },
      ],
      source_article_id: null,
      source_lemma_id: null,
      hgno: null,
      is_sub_article: null,
    },
  },
  fsrs_stability: null,
  fsrs_difficulty: null,
  fsrs_step: null,
  last_review_at: null,
  due_at: '2026-02-20T10:00:00Z',
  state: 'review',
};

describe('FlashCardDefinition', () => {
  it('renders Norwegian word on the front', () => {
    render(<FlashCardDefinition card={mockCard} />);
    const frontWord = screen
      .getAllByText('hund')
      .find((el) => el.tagName === 'H2');
    expect(frontWord).toBeInTheDocument();
  });

  const makeDefinitionCard = (payload: Partial<DefinitionPayload>): UserCard =>
    ({
      ...mockCard,
      card: {
        ...mockCard.card,
        payload: {
          ...(mockCard.card.payload as DefinitionPayload),
          ...payload,
        },
      },
    }) as UserCard;

  it('shows the Norwegian sense cue on the front when the payload provides one', () => {
    render(
      <FlashCardDefinition
        card={makeDefinitionCard({
          word: 'pose',
          sense_cue: 'stilling, holdning',
        })}
      />,
    );
    expect(screen.getByText('stilling, holdning')).toBeInTheDocument();
  });

  it('renders no sense cue when the payload has none', () => {
    render(<FlashCardDefinition card={mockCard} />);
    // mockCard has no sense_cue; none should render on the front. (The
    // Norwegian definition gloss now renders on the hidden back face.)
    expect(screen.queryByText('stilling, holdning')).not.toBeInTheDocument();
  });

  it('test_flash_card_definition_given_saved_sentence_context_expect_context_on_answer_face', async () => {
    render(
      <FlashCardDefinition
        card={{
          ...mockCard,
          context: {
            source_sentence: 'Jeg lærer norsk hver dag.',
            source_title: 'A Norwegian lesson',
          },
        }}
      />,
    );

    await flipCard();

    expect(screen.getByText('From this sentence')).toBeInTheDocument();
    expect(screen.getByText('Jeg lærer norsk hver dag.')).toBeInTheDocument();
    expect(screen.getByText('A Norwegian lesson')).toBeInTheDocument();
  });

  it('FlashCardDefinitionBack given a Norwegian definition expect gloss hidden until flipped', () => {
    render(<FlashCardDefinition card={mockCard} />);
    // The Norwegian definition lives on the answer face and must not be
    // visible before the card is flipped (it renders in the hidden back).
    const gloss = screen.queryByText('dyr med fire ben som bjeff');
    expect(gloss).not.toBeNull();
    expect(gloss).not.toBeVisible();
  });

  it('shows definition on back when flipped', async () => {
    render(<FlashCardDefinition card={mockCard} />);
    await flipCard();
    // The back renders the primary translation boldly and the top meanings as
    // English translations, each with its Norwegian gloss beneath — each
    // meaning is a list item.
    const meaningItems = screen.getAllByRole('listitem');
    expect(
      meaningItems.some((li) =>
        li.textContent?.includes('dog (animal with four legs that barks)'),
      ),
    ).toBe(true);
    expect(
      meaningItems.some((li) =>
        li.textContent?.includes('dyr med fire ben som bjeff'),
      ),
    ).toBe(true);
  });

  it('reveals back only when check button is pressed', async () => {
    render(<FlashCardDefinition card={mockCard} />);

    const frontWord = screen
      .getAllByText('hund')
      .find((el) => el.tagName === 'H2');
    const checkButton = screen.getByRole('button', {
      name: /^(show|check) answer$/i,
    });
    expect(frontWord).toBeInTheDocument();
    expect(checkButton).toBeEnabled();

    await userEvent.click(frontWord!);
    expect(checkButton).toBeEnabled();

    await userEvent.click(checkButton);
    expect(checkButton).toBeDisabled();
  });

  it('supports keyboard flip through the check answer button', async () => {
    render(<FlashCardDefinition card={mockCard} />);

    const checkButton = screen.getByRole('button', {
      name: /^(show|check) answer$/i,
    });

    await userEvent.tab();
    expect(checkButton).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(checkButton).toBeDisabled();
  });

  it('calls onFinished when rating selected', async () => {
    const onFinished = vi.fn();
    render(<FlashCardDefinition card={mockCard} onFinished={onFinished} />);
    await flipCard();
    await clickCardRating('good');
    expect(onFinished).toHaveBeenCalledWith(3);
  });

  it('renders nothing for non-definition card payload', () => {
    const nonDefinitionCard: UserCard = {
      ...mockCard,
      card: {
        id: 2,
        type: FlashCardType.CHOOSE,
        schema_version: '4.0',
        deck_id: null,
        payload: {
          kind: 'exercise',
          id: 'choose-1',
          operation: 'choose',
          objective_id: 'obj-1',
          prompt: [{ kind: 'text', value: 'Pick the article.' }],
          explanation: null,
          payload: {
            options: [
              { option_id: 'o1', text: 'en bok' },
              { option_id: 'o2', text: 'et bok' },
            ],
            answer_id: 'o1',
          },
        },
      },
    };
    const { container } = render(
      <FlashCardDefinition card={nonDefinitionCard} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
