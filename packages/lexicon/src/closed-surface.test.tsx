import { cleanup, render, screen } from '@testing-library/react';
import { cloneElement, type ComponentProps, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CLOSED_COMPONENTS } from '../../../eslint.config.js';
import { CandidateList } from './CandidateList';
import { DefinitionView } from './DefinitionView';
import { GenderBadge } from './GenderBadge';
import { LemmaActionRow } from './LemmaActionRow';
import { LemmaCardView } from './LemmaCardView';
import { LemmaHeader } from './LemmaHeader';
import { PronunciationRow } from './PronunciationRow';
import { SearchBar } from './SearchBar';
import { WordFormChip } from './WordFormChip';
import * as Lexicon from './index';
import type { DefinitionRead, LemmaCardData } from './types';

const definition: DefinitionRead = {
  uuid: 'definition-1',
  id: 1,
  definition: 'dyr med fire ben',
  translation: 'dog',
  translation_source: null,
  examples_json: [],
};

const lemma: LemmaCardData = {
  uuid: 'lemma-1',
  word: 'hund',
  pos: 'noun',
  definitions: [definition],
};

interface ClosedSurfaceEntry {
  component: string;
  element: ReactElement;
  query: () => HTMLElement;
}

const ENTRIES: ClosedSurfaceEntry[] = [
  {
    component: 'CandidateList',
    element: (
      <CandidateList
        candidates={[
          {
            lemmaUuid: 'lemma-1',
            word: 'hund',
            definition,
          },
        ]}
        onAdd={vi.fn()}
      />
    ),
    query: () => screen.getByTestId('definition-item-root'),
  },
  {
    component: 'DefinitionView',
    element: (
      <DefinitionView
        data-testid="closed-definition-view"
        definition={definition}
      />
    ),
    query: () => screen.getByTestId('closed-definition-view'),
  },
  {
    component: 'GenderBadge',
    element: <GenderBadge gender="Masc" />,
    query: () => screen.getByText('en'),
  },
  {
    component: 'LemmaActionRow',
    element: (
      <LemmaActionRow
        state="new"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />
    ),
    query: () =>
      screen.getByRole('button', { name: 'I know this' })
        .parentElement as HTMLElement,
  },
  {
    component: 'LemmaCardView',
    element: (
      <LemmaCardView
        data-testid="closed-lemma-card-view"
        lemma={lemma}
        state="new"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />
    ),
    query: () => screen.getByTestId('closed-lemma-card-view'),
  },
  {
    component: 'LemmaHeader',
    element: (
      <LemmaHeader data-testid="closed-lemma-header" word="hund" pos="noun" />
    ),
    query: () => screen.getByTestId('closed-lemma-header'),
  },
  {
    component: 'PronunciationRow',
    element: <PronunciationRow ipa="hʊn" />,
    query: () => screen.getByText(/hʊn/),
  },
  {
    component: 'SearchBar',
    element: <SearchBar value="" onChange={vi.fn()} onSearch={vi.fn()} />,
    query: () => screen.getByRole('textbox'),
  },
  {
    component: 'WordFormChip',
    element: <WordFormChip form="hunden" tags={['Masc', 'Sing', 'Def']} />,
    query: () => screen.getByTitle('Masc, Sing, Def'),
  },
];

const injectedClass = { className: 'INJECTED' } as ComponentProps<'div'>;
const injectedStyle = { style: { color: 'red' } } as ComponentProps<'div'>;

const CAPITALISED = /^[A-Z]/;

// A closed surface is what it renders, not the recipe that paints it: a prop the
// surface does not accept must leave the markup identical. `cleanup` runs
// between the two captures so the second render starts from an empty document.
function capturedEntryHtml(
  entry: ClosedSurfaceEntry,
  props: ComponentProps<'div'>,
) {
  render(cloneElement(entry.element, props));
  const html = entry.query().outerHTML;
  cleanup();
  return html;
}

function capturedActionRow(props: ComponentProps<'div'>) {
  const { container } = render(
    <LemmaActionRow
      {...props}
      state="new"
      onMarkKnown={vi.fn()}
      onAddToReview={vi.fn()}
    />,
  );
  const html = (container.firstElementChild as HTMLElement).outerHTML;
  cleanup();
  return html;
}

function isExportedComponent(name: string, value: unknown) {
  if (CAPITALISED.exec(name) === null) return false;
  if (typeof value === 'function') {
    return !Function.prototype.toString
      .call(value)
      .trimStart()
      .startsWith('class');
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { $$typeof?: symbol }).$$typeof === 'symbol'
  );
}

function exportedComponents() {
  return Object.entries(Lexicon).filter(([name, value]) =>
    isExportedComponent(name, value),
  );
}

describe('lexicon closed surfaces', () => {
  it.each(ENTRIES)(
    'test_closed_surface_given_injected_class_expect_rejected',
    (entry) => {
      expect(capturedEntryHtml(entry, injectedClass)).toBe(
        capturedEntryHtml(entry, {}),
      );
    },
  );

  it.each(ENTRIES)(
    'test_closed_surface_given_injected_style_expect_rejected',
    (entry) => {
      expect(capturedEntryHtml(entry, injectedStyle)).toBe(
        capturedEntryHtml(entry, {}),
      );
    },
  );

  it('test_lemma_action_row_given_cast_and_spread_expect_injected_surface_rejected', () => {
    const injectedHtml = capturedActionRow({
      className: 'INJECTED',
      style: { color: 'red' },
    });
    const cleanHtml = capturedActionRow({});

    expect(injectedHtml).toBe(cleanHtml);
  });

  it('test_lemma_card_given_action_state_expect_data_state_exposed', () => {
    render(
      <LemmaCardView
        data-testid="lemma-card"
        lemma={lemma}
        state="learning"
        onMarkKnown={vi.fn()}
        onAddToReview={vi.fn()}
      />,
    );

    expect(screen.getByTestId('lemma-card')).toHaveAttribute(
      'data-state',
      'learning',
    );
  });

  it('test_lemma_header_given_canonical_bracket_headword_expect_presented_alternatives_with_canonical_accessible_name', () => {
    const canonical = 'få [stelle|lage] i stand';
    render(<LemmaHeader word={canonical} pos="expression" />);

    const heading = screen.getByRole('heading', { name: canonical });
    expect(heading).toHaveTextContent('få [stelle / lage] i stand');
    expect(heading).not.toHaveTextContent(canonical);
  });

  it('test_lemma_header_given_verified_display_form_expect_natural_accessible_name', () => {
    render(
      <LemmaHeader
        word="få [stelle|lage] i stand"
        primaryDisplayForm="få i stand"
        pos="expression"
      />,
    );

    const heading = screen.getByRole('heading', { name: 'få i stand' });
    expect(heading).toHaveTextContent('få i stand');
  });

  it('test_closed_surface_given_closed_exported_component_expect_listed_in_render_list', () => {
    const exercised = new Set(ENTRIES.map((entry) => entry.component));
    const missing = exportedComponents()
      .map(([name]) => name)
      .filter((name) => CLOSED_COMPONENTS.includes(name))
      .filter((name) => !exercised.has(name));

    expect(
      missing,
      'Every closed component @flyt/lexicon exports must be exercised by the render list.',
    ).toEqual([]);
  });

  it('test_closed_surface_given_exported_component_expect_guarded_by_the_rule', () => {
    const unguarded = exportedComponents()
      .map(([name]) => name)
      .filter((name) => !CLOSED_COMPONENTS.includes(name));

    expect(
      unguarded,
      'Every component @flyt/lexicon exports is a closed surface the rule must guard.',
    ).toEqual([]);
  });
});
