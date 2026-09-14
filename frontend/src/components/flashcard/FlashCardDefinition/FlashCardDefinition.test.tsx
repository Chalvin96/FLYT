import { render, screen, waitFor } from '@testing-library/react';
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
    expect(frontWord).toHaveClass('font-display');
  });

  it('test_expression_card_given_snapshot_forms_expect_primary_front_and_alternatives_on_answer', async () => {
    const expressionCard = {
      ...mockCard,
      card: {
        ...mockCard.card,
        payload: {
          ...(mockCard.card.payload as DefinitionPayload),
          word: 'få [stelle|lage] i stand',
          pos: 'expression' as const,
          primary_display_form: 'få i stand',
          alternative_forms: ['stelle i stand'],
        },
      },
    } as UserCard;

    render(<FlashCardDefinition card={expressionCard} />);
    expect(
      screen
        .getAllByText('få i stand')
        .some((element) => element.tagName === 'H2'),
    ).toBe(true);
    expect(screen.queryByText('få [stelle|lage] i stand')).toBeNull();

    await flipCard();

    const otherFormsLabel = screen.getByText('Other forms');
    expect(otherFormsLabel).toBeInTheDocument();
    expect(screen.getByTestId('flashcard-answer-header')).not.toHaveTextContent(
      'Other forms',
    );
    expect(screen.getByText('stelle i stand')).toBeInTheDocument();
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

    const contextDisclosure = screen.getByText('Saved context');
    expect(contextDisclosure).toBeInTheDocument();
    const answerBody = screen.getByTestId('flashcard-answer-body');
    expect(answerBody.textContent?.indexOf('dog (animal')).toBeLessThan(
      answerBody.textContent?.indexOf('Saved context') ?? -1,
    );
    expect(screen.queryByText('Jeg lærer norsk hver dag.')).not.toBeVisible();
    await userEvent.click(contextDisclosure);
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
    // Sense 1 restates the headline translation, so the answer absorbs it: the
    // English shows once and the Norwegian gloss sits beneath it.
    const answerBody = screen.getByTestId('flashcard-answer-body');
    expect(answerBody).toHaveTextContent(
      'dog (animal with four legs that barks)',
    );
    expect(answerBody).toHaveTextContent('dyr med fire ben som bjeff');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('test_answer_face_given_translation_matching_first_sense_expect_english_rendered_once', async () => {
    render(<FlashCardDefinition card={mockCard} />);
    await flipCard();

    const answerBody = screen.getByTestId('flashcard-answer-body');
    const occurrences = answerBody.textContent?.split(
      'dog (animal with four legs that barks)',
    ).length;
    expect(occurrences).toBe(2); // one split point => one occurrence
  });

  it('test_answer_face_given_first_sense_absorbed_expect_its_example_visible', async () => {
    const card = makeDefinitionCard({
      primary_translation: 'dog',
      definitions: [
        {
          uuid: 'def-1',
          definition: 'et kjæledyr',
          translation: 'dog',
          examples_json: [
            { no: 'Jeg har en liten hund.', en: 'I have a small dog.' },
          ],
        },
      ],
    });

    render(<FlashCardDefinition card={card} />);
    await flipCard();

    expect(screen.getByText('Jeg har en liten hund.')).toBeVisible();
    expect(screen.getByText('I have a small dog.')).toBeVisible();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('test_answer_face_given_extra_senses_expect_remaining_meanings_numbered_from_two', async () => {
    const card = makeDefinitionCard({
      primary_translation: 'dog (animal with four legs that barks)',
      definitions: [
        {
          uuid: 'def-1',
          definition: 'dyr med fire ben som bjeff',
          translation: 'dog (animal with four legs that barks)',
          examples_json: [],
        },
        {
          uuid: 'def-2',
          definition: 'usympatisk person',
          translation: 'scoundrel',
          examples_json: [],
        },
      ],
    });

    render(<FlashCardDefinition card={card} />);
    await flipCard();

    expect(
      screen.getByRole('heading', { name: 'Other meanings' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Other meanings' })).toHaveClass(
      'type-label-sm',
    );
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('start', '2');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('scoundrel')).toBeInTheDocument();
  });

  it('test_additional_meanings_given_more_than_three_definitions_expect_show_more_reveals_all', async () => {
    const card = makeDefinitionCard({
      definitions: [1, 2, 3, 4].map((index) => ({
        uuid: `def-${index}`,
        definition: `Norwegian gloss ${index}`,
        translation: `meaning ${index}`,
        examples_json: [],
      })),
    });

    render(<FlashCardDefinition card={card} />);
    await flipCard();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const showMore = screen.getByRole('button', {
      name: 'Show 1 more meaning',
    });
    expect(screen.queryByText('meaning 4')).toBeNull();
    await userEvent.click(showMore);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('meaning 4')).toBeInTheDocument();
  });

  it('test_option_c_header_given_pronunciation_metadata_expect_ordered_accessible_marker', async () => {
    const card = makeDefinitionCard({
      word: 'gå',
      pos: 'verb',
      ipa: 'ɡoː',
      ipa_approximate: true,
      intonation: '2',
      audio_url: 'https://example.com/gå.mp3',
    });

    render(<FlashCardDefinition card={card} />);
    await flipCard();

    const header = screen.getByTestId('flashcard-answer-header');
    expect(header).toHaveTextContent('verb');
    const heading = screen.getByRole('heading', { name: 'gå' });
    expect(header).toContainElement(heading);
    const audioButton = screen.getByRole('button', {
      name: /play pronunciation/i,
    });
    expect(audioButton).toBeInTheDocument();
    const ipaText = screen.getByText('/ɡoː/');
    expect(ipaText).toBeInTheDocument();
    const approximationMarker = screen.getByRole('img', {
      name: 'Pronunciation generated automatically.',
    });
    const toneChip = screen.getByRole('img', { name: 'Tone 2' });
    expect(
      Boolean(
        ipaText.compareDocumentPosition(approximationMarker) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        approximationMarker.compareDocumentPosition(toneChip) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        toneChip.compareDocumentPosition(audioButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('test_eyebrow_given_noun_gender_word_forms_expect_pos_and_gender_metadata', async () => {
    const card = makeDefinitionCard({
      word: 'hus',
      pos: 'noun',
      ipa: 'hʉːs',
      intonation: '1',
      audio_url: 'https://example.com/hus.mp3',
    });

    render(
      <FlashCardDefinition
        card={card}
        wordForms={[
          {
            id: 1,
            form: 'hus',
            tags_json: ['Neuter', 'Sing', 'Ind'],
            ipa: null,
            audio_url: null,
            ipa_approximate: false,
          },
        ]}
      />,
    );
    await flipCard();

    const eyebrow = screen.getByTestId('flashcard-answer-eyebrow');
    expect(eyebrow).toHaveTextContent('noun');
    expect(eyebrow).toHaveTextContent('Neuter');
    const ipaText = screen.getByText('/hʉːs/');
    const toneBadge = screen.getByRole('img', { name: 'Tone 1' });
    expect(eyebrow).not.toContainElement(toneBadge);
    expect(
      Boolean(
        ipaText.compareDocumentPosition(toneBadge) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('test_expression_card_given_word_form_audio_expect_no_inferred_pronunciation', async () => {
    const expressionCard = makeDefinitionCard({
      word: 'ta vare på',
      pos: 'expression',
      alternative_forms: ['passe på'],
    });

    render(
      <FlashCardDefinition
        card={expressionCard}
        wordForms={[
          {
            id: 99,
            form: 'ta vare på',
            tags_json: [],
            ipa: 'taː',
            audio_url: 'https://example.com/expression.mp3',
            ipa_approximate: false,
          },
        ]}
      />,
    );
    await flipCard();

    expect(screen.getByText('Other forms')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /play pronunciation/i }),
    ).toBeNull();
    expect(screen.queryByText('/taː/')).toBeNull();
  });

  it('test_answer_face_given_question_revealed_expect_focus_moves_and_question_inert', async () => {
    render(<FlashCardDefinition card={mockCard} />);
    await flipCard();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'hund' })).toHaveFocus(),
    );
    expect(screen.getByTestId('flashcard-question-face')).toHaveAttribute(
      'inert',
    );
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

  it('test_answer_body_given_inflection_word_forms_expect_reference_rail', async () => {
    render(
      <FlashCardDefinition
        card={makeDefinitionCard({ word: 'hus', pos: 'noun' })}
        wordForms={[
          {
            id: 1,
            form: 'hus',
            tags_json: ['Neuter', 'Sing', 'Ind'],
            ipa: null,
            audio_url: null,
            ipa_approximate: false,
          },
          {
            id: 2,
            form: 'huset',
            tags_json: ['Neuter', 'Sing', 'Def'],
            ipa: null,
            audio_url: null,
            ipa_approximate: false,
          },
        ]}
      />,
    );
    await flipCard();

    const reference = screen.getByTestId('flashcard-answer-reference');
    expect(reference).toContainElement(screen.getByText('Bøying'));
  });

  it('test_answer_body_given_no_reference_material_expect_no_rail', async () => {
    render(
      <FlashCardDefinition
        card={{
          ...makeDefinitionCard({ word: 'ta', pos: 'verb' }),
          context: {
            source_sentence: 'Kan du ta med boka?',
            source_title: 'Saved reading',
          },
        }}
      />,
    );
    await flipCard();

    expect(
      screen.queryByTestId('flashcard-answer-reference'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('saved-context-disclosure')).toBeInTheDocument();
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
