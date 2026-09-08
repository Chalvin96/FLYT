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
    expect(translation).toHaveClass('min-w-0', 'break-words');
  });

  it('renders examples', () => {
    render(<DefinitionView definition={mockDefinition} />);
    expect(screen.getByText('Jeg har en liten hund.')).toBeInTheDocument();
  });

  it('renders the tap-to-reveal affordance for translated examples only', () => {
    render(<DefinitionView definition={mockDefinition} />);
    // translated example -> button with the Norwegian sentence as accessible name
    expect(
      screen.getByRole('button', { name: /Hunden løper raskt/ }),
    ).toBeInTheDocument();
    // untranslated example (en: null) -> plain text, no button affordance
    expect(
      screen.queryByRole('button', { name: /Jeg har en liten hund/ }),
    ).not.toBeInTheDocument();
  });

  it('reveals the English translation on tap and hides it again', async () => {
    render(<DefinitionView definition={mockDefinition} />);

    // English is hidden (hidden attr: not visible + leaves a11y tree) until tapped
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

    expect(toggle).toHaveClass(
      'w-full',
      'whitespace-normal',
      'text-left',
      'type-caption',
    );

    await userEvent.click(toggle);

    expect(screen.getByText(/dyr med fire ben/)).toBeInTheDocument();
  });

  it('shows "Translation not available" when translation is empty', () => {
    render(<DefinitionView definition={mockDefinitionNoTranslation} />);
    expect(screen.getByText(/Translation not available/)).toBeInTheDocument();
  });

  it('renders inflection slot when wordForms and inflection are provided', () => {
    const wordForms = [
      { id: 1, form: 'hund', tags_json: ['Masc', 'Sing', 'Ind'] },
      { id: 2, form: 'hunden', tags_json: ['Masc', 'Sing', 'Def'] },
      { id: 3, form: 'hunder', tags_json: ['Masc', 'Plur', 'Ind'] },
      { id: 4, form: 'hundene', tags_json: ['Masc', 'Plur', 'Def'] },
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

  it('uses stacked mobile classes and horizontal desktop classes for inflection container', () => {
    const wordForms = [
      { id: 1, form: 'hund', tags_json: ['Masc', 'Sing', 'Ind'] },
      { id: 2, form: 'hunden', tags_json: ['Masc', 'Sing', 'Def'] },
      { id: 3, form: 'hunder', tags_json: ['Masc', 'Plur', 'Ind'] },
      { id: 4, form: 'hundene', tags_json: ['Masc', 'Plur', 'Def'] },
    ];

    render(
      <DefinitionView
        definition={mockDefinition}
        wordForms={wordForms}
        variant="flashcard"
        inflection={<div data-testid="mock-inflection" />}
      />,
    );
    expect(screen.getByTestId('inflection-section')).toHaveClass(
      'flex-col',
      'md:flex-row',
    );
  });

  it('hides examples on mobile when variant is flashcard', () => {
    const definitionWithExamples: DefinitionRead = {
      ...mockDefinition,
      examples_json: [{ no: 'Jeg har en liten hund.', en: null }],
    };

    render(
      <DefinitionView
        definition={definitionWithExamples}
        variant="flashcard"
      />,
    );

    const examplesContainer = screen.getByTestId('definition-examples');
    expect(examplesContainer).toHaveClass('hidden', 'md:block');
  });

  it('shows examples on all screen sizes when variant is lexicon', () => {
    const definitionWithExamples: DefinitionRead = {
      ...mockDefinition,
      examples_json: [{ no: 'Jeg har en liten hund.', en: null }],
    };

    render(
      <DefinitionView definition={definitionWithExamples} variant="lexicon" />,
    );

    const examplesContainer = screen.getByTestId('definition-examples');
    expect(examplesContainer).not.toHaveClass('hidden', 'md:block');
  });
});
