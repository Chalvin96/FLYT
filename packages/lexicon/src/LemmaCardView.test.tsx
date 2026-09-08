import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LemmaActionRow } from './LemmaActionRow';
import { LemmaCardView } from './LemmaCardView';
import type { DefinitionRead, LemmaCardData } from './types';

function definition(index: number): DefinitionRead {
  return {
    uuid: 'definition-' + index,
    id: index,
    definition: 'Norwegian definition ' + index,
    translation: 'translation ' + index,
    translation_source: null,
    examples_json: [{ no: 'Eksempel ' + index, en: 'Example ' + index }],
  };
}

const lemma: LemmaCardData = {
  uuid: 'lemma-1',
  word: 'mote',
  pos: 'verb',
  primary_translation: 'meet / encounter',
  ipa: 'mote',
  intonation: null,
  audio_url: null,
  see_also: [
    {
      article_id: 1,
      word: 'treffe',
      relation: 'see',
      target_lemma_uuid: 'lemma-2',
    },
  ],
  definitions: [definition(1), definition(2), definition(3), definition(4)],
};

afterEach(() => cleanup());

describe('LemmaCardView', () => {
  it('test_card_given_complete_lemma_expect_content_and_one_action_row', () => {
    render(
      <LemmaCardView
        lemma={lemma}
        state="new"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
        onSelectRelated={vi.fn()}
        knowLabel="I already know this"
        addLabel="Add to review"
      />,
    );

    expect(screen.getByRole('heading', { name: 'mote' })).not.toBeNull();
    expect(screen.getByText('meet')).not.toBeNull();
    expect(screen.getByText('encounter')).not.toBeNull();
    expect(screen.getByText('translation 3')).not.toBeNull();
    expect(screen.queryByText('translation 4')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Show 1 more meaning' }),
    ).not.toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'I already know this' }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Add to review' }),
    ).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'See treffe' })).not.toBeNull();
  });

  it('test_card_given_more_than_three_senses_expect_disclosure_reveals_rest', async () => {
    render(
      <LemmaCardView
        lemma={lemma}
        state="new"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Show 1 more meaning' }),
    );
    expect(screen.getByText('translation 4')).not.toBeNull();
  });

  it('test_card_given_missing_optional_content_expect_safe_omissions', () => {
    render(
      <LemmaCardView
        lemma={{
          ...lemma,
          primary_translation: null,
          ipa: null,
          audio_url: null,
          see_also: [],
          definitions: [],
        }}
        state="new"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />,
    );

    expect(screen.getByTestId('lemma-card-view')).not.toBeNull();
    expect(screen.queryByText('Related:')).toBeNull();
    expect(screen.queryByText('translation 1')).toBeNull();
    expect(screen.queryByRole('button', { name: /more meaning/i })).toBeNull();
  });
});

describe('LemmaActionRow', () => {
  it('test_actions_given_add_pending_expect_other_action_remains_truthful', () => {
    render(
      <LemmaActionRow
        state="new"
        pendingAction="add"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'I know this' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('test_actions_given_add_pending_and_serial_behavior_expect_both_disabled', () => {
    render(
      <LemmaActionRow
        state="new"
        pendingAction="add"
        behavior={{ disableOtherActionWhilePending: true }}
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'I know this' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('test_actions_given_learning_state_expect_added_label', () => {
    render(
      <LemmaActionRow
        state="learning"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole('button', { name: 'Added' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
