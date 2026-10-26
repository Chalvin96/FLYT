import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DefinitionRead } from './types';
import { DefinitionView } from './DefinitionView';

const mockDefinition: DefinitionRead = {
  uuid: 'definition-1',
  id: 1,
  definition: 'dyr med fire ben som bjeff',
  examples_json: [
    { no: 'Jeg har en liten hund.', en: null },
    { no: 'Hunden løper raskt.', en: 'The dog runs fast.' },
  ],
  translation_source: '',
  translation: 'A dog (animal with four legs that barks)',
};

const mockDefinitionNoTranslation: DefinitionRead = {
  uuid: 'definition-2',
  id: 2,
  definition: 'test definisjon',
  examples_json: [],
  translation_source: '',
  translation: '',
};

describe('DefinitionView', () => {
  it('shows English translation prominently', () => {
    render(<DefinitionView definition={mockDefinition} />);
    const translation = screen.getByText(/dog \(animal with four legs/);
    expect(translation).toBeInTheDocument();
    expect(translation.tagName).toBe('P');
  });

  it('renders examples', () => {
    render(<DefinitionView definition={mockDefinition} />);
    expect(screen.getByText('Jeg har en liten hund.')).toBeInTheDocument();
  });

  it('renders the tap-to-reveal affordance for translated examples only', () => {
    render(<DefinitionView definition={mockDefinition} />);
    expect(
      screen.getByRole('button', { name: /Hunden løper raskt/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Jeg har en liten hund/ }),
    ).not.toBeInTheDocument();
  });

  it('reveals the English translation on tap and hides it again', async () => {
    render(<DefinitionView definition={mockDefinition} />);

    expect(screen.queryByText('The dog runs fast.')).not.toBeVisible();

    await userEvent.click(
      screen.getByRole('button', { name: /Hunden løper raskt/ }),
    );

    expect(screen.getByText('The dog runs fast.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Hunden løper raskt/ }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows "Add to Deck" button when not added', () => {
    render(
      <DefinitionView definition={mockDefinition} onAddToDeck={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /Add to Deck/i }),
    ).toBeInTheDocument();
  });

  it('calls onAddToDeck when button clicked', async () => {
    const onAddToDeck = vi.fn();
    render(
      <DefinitionView definition={mockDefinition} onAddToDeck={onAddToDeck} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Add to Deck/i }));
    expect(onAddToDeck).toHaveBeenCalled();
  });

  it('shows "Added" badge when isAdded is true', () => {
    render(<DefinitionView definition={mockDefinition} isAdded />);
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Add to Deck/i }),
    ).not.toBeInTheDocument();
  });

  it('shows loading state when adding', () => {
    render(
      <DefinitionView
        definition={mockDefinition}
        isAdding
        onAddToDeck={vi.fn()}
      />,
    );
    expect(screen.getByText('Adding...')).toBeInTheDocument();
  });

  it('hides Norwegian definition by default', () => {
    render(<DefinitionView definition={mockDefinition} />);
    expect(screen.queryByText(/dyr med fire ben/)).not.toBeInTheDocument();
  });

  it('expands Norwegian definition when toggle clicked', async () => {
    render(<DefinitionView definition={mockDefinition} />);

    const toggle = screen.getByRole('button', {
      name: /Show Norwegian definition/i,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(screen.getByText(/dyr med fire ben/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hide Norwegian definition/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows "Translation not available" when translation is empty', () => {
    render(<DefinitionView definition={mockDefinitionNoTranslation} />);
    expect(screen.getByText(/Translation not available/)).toBeInTheDocument();
  });

  it('renders inflection slot when wordForms and inflection are provided', () => {
    const wordForms = [
      {
        id: 1,
        form: 'hund',
        tags_json: ['Masc', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'hunden',
        tags_json: ['Masc', 'Sing', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'hunder',
        tags_json: ['Masc', 'Plur', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'hundene',
        tags_json: ['Masc', 'Plur', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];

    render(
      <DefinitionView
        definition={mockDefinition}
        wordForms={wordForms}
        inflection={<div data-testid="mock-inflection">inflection table</div>}
      />,
    );

    expect(screen.getByTestId('mock-inflection')).toBeInTheDocument();
  });

  it('does not render inflection section when wordForms is empty', () => {
    render(
      <DefinitionView
        definition={mockDefinition}
        wordForms={[]}
        inflection={<div data-testid="mock-inflection" />}
      />,
    );
    expect(screen.queryByTestId('inflection-section')).not.toBeInTheDocument();
  });

  it('test_definition_view_given_flashcard_presentation_expect_flashcard_contract', () => {
    const definitionWithExamples: DefinitionRead = {
      ...mockDefinition,
      examples_json: [{ no: 'Jeg har en liten hund.', en: null }],
    };

    render(
      <DefinitionView
        definition={definitionWithExamples}
        presentation="flashcard"
      />,
    );

    // The PR's before/after/diff triptych shows the mobile hide of the
    // examples container at 320 and 768.
    expect(screen.getByTestId('definition-item-root')).toHaveAttribute(
      'data-presentation',
      'flashcard',
    );
    expect(screen.getByTestId('definition-examples')).toBeInTheDocument();
  });

  it('test_definition_view_given_lexicon_presentation_expect_lexicon_contract', () => {
    const definitionWithExamples: DefinitionRead = {
      ...mockDefinition,
      examples_json: [{ no: 'Jeg har en liten hund.', en: null }],
    };

    render(
      <DefinitionView
        definition={definitionWithExamples}
        presentation="lexicon"
      />,
    );

    expect(screen.getByTestId('definition-item-root')).toHaveAttribute(
      'data-presentation',
      'lexicon',
    );
    expect(screen.getByTestId('definition-examples')).toBeInTheDocument();
  });
});
