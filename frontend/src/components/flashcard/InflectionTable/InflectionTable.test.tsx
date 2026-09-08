import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InflectionTable } from './InflectionTable';
import {
  buildNounTableModel,
  detectInflectionKind,
  normalizePos,
} from './utils';

describe('InflectionTable', () => {
  // --- NOUN TESTS ---

  it('should display word forms grouped by gender', () => {
    const wordForms = [
      {
        id: 1,
        form: 'stikkrenne',
        tags_json: ['Fem', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'stikkrenna',
        tags_json: ['Fem', 'Sing', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'stikkrenner',
        tags_json: ['Fem', 'Plur', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'stikkrennene',
        tags_json: ['Fem', 'Plur', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];

    const { container } = render(<InflectionTable wordForms={wordForms} />);

    // Verify word forms
    expect(container.textContent).toContain('stikkrenne');
    expect(container.textContent).toContain('stikkrenna');

    // Verify labels
    expect(container.textContent).toContain('entall');
    expect(container.textContent).toContain('flertall');
  });

  it('should display dual-gender noun correctly', () => {
    const wordForms = [
      {
        id: 1,
        form: 'stikkrenne',
        tags_json: ['Fem', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'stikkrenna',
        tags_json: ['Fem', 'Sing', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'stikkrenne',
        tags_json: ['Masc', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'stikkrennen',
        tags_json: ['Masc', 'Sing', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];

    const { container } = render(<InflectionTable wordForms={wordForms} />);

    // Verify both feminine and masculine forms are rendered
    expect(container.textContent).toContain('stikkrenne');
    expect(container.textContent).toContain('stikkrenna');
    expect(container.textContent).toContain('stikkrennen');
    expect(container.textContent).toContain('hankjønn');
    expect(container.textContent).toContain('hunkjønn');
  });

  it('should render noun table with singular and plural sections (responsive check)', () => {
    const wordForms = [
      {
        id: 1,
        form: 'bil',
        tags_json: ['Masc', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'bilen',
        tags_json: ['Masc', 'Sing', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'biler',
        tags_json: ['Masc', 'Plur', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'bilene',
        tags_json: ['Masc', 'Plur', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    // Check for section headers which are used in the mobile view
    expect(container.textContent).toContain('entall');
    expect(container.textContent).toContain('flertall');

    // Check for row labels
    expect(container.textContent).toContain('ubest.');
    expect(container.textContent).toContain('bestemt form');

    // Check for forms
    expect(container.textContent).toContain('bil');
    expect(container.textContent).toContain('bilen');
    expect(container.textContent).toContain('biler');
    expect(container.textContent).toContain('bilene');
  });

  it('should handle empty word forms', () => {
    render(<InflectionTable wordForms={[]} />);
    expect(screen.queryByText('entall')).not.toBeInTheDocument();
  });

  // --- ADJECTIVE TESTS ---

  it('should render adjective positive forms (Masc/Fem, Neuter, Plural/Def columns)', () => {
    const wordForms = [
      {
        id: 1,
        form: 'usaklig',
        tags_json: ['Pos', 'Masc/Fem', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'usaklig',
        tags_json: ['Pos', 'Neuter', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'usaklige',
        tags_json: ['Pos', 'Plur'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'usaklige',
        tags_json: ['Pos', 'Def', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    expect(container.textContent).toContain('positiv');
    expect(container.textContent).toContain('hank. / hunk.');
    expect(container.textContent).toContain('intetkjønn');
    expect(container.textContent).toContain('flt. / best.');

    expect(container.textContent).toContain('usaklig');
    expect(container.textContent).toContain('usaklige');
  });

  it('should render adjective comparative and superlative rows', () => {
    const wordForms = [
      {
        id: 1,
        form: 'usaklig',
        tags_json: ['Pos', 'Masc/Fem', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'usaklig',
        tags_json: ['Pos', 'Neuter', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'usaklige',
        tags_json: ['Pos', 'Plur'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'usaklige',
        tags_json: ['Pos', 'Def', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 5,
        form: 'usakligere',
        tags_json: ['Cmp'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 6,
        form: 'usakligst',
        tags_json: ['Sup', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 7,
        form: 'usakligste',
        tags_json: ['Sup', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    expect(container.textContent).toContain('komparativ');
    expect(container.textContent).toContain('usakligere');

    expect(container.textContent).toContain('ubest.');
    expect(container.textContent).toContain('usakligst');

    expect(container.textContent).toContain('bestemt form');
    expect(container.textContent).toContain('usakligste');
  });

  it('should NOT route adjective forms through noun table', () => {
    const wordForms = [
      {
        id: 1,
        form: 'dialektal',
        tags_json: ['Pos', 'Masc/Fem', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'dialektalt',
        tags_json: ['Pos', 'Neuter', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'dialektale',
        tags_json: ['Pos', 'Plur'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    expect(container.textContent).toContain('positiv');
    // Adjective table should use adjective-specific labels (not noun row labels)
    expect(container.textContent).toContain('hank. / hunk.');
    expect(container.textContent).not.toContain('ubest.');
  });

  // --- ADVERB TESTS ---

  it('should render adverb table for degree-inflected adverbs', () => {
    const wordForms = [
      {
        id: 1,
        form: 'lenge',
        tags_json: ['Pos'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'lenger',
        tags_json: ['Cmp'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'lengst',
        tags_json: ['Sup'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    expect(container.textContent).toContain('positiv');
    expect(container.textContent).toContain('lenge');
    expect(container.textContent).toContain('komparativ');
    expect(container.textContent).toContain('lenger');
    expect(container.textContent).toContain('superlativ');
    expect(container.textContent).toContain('lengst');
  });

  it('should distinguish adverbs from adjectives (adverbs have no gender/number tags)', () => {
    // Adjective: has gender/number tags
    const adjForms = [
      {
        id: 1,
        form: 'fin',
        tags_json: ['Pos', 'Masc/Fem', 'Ind', 'Sing'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container: adjContainer } = render(
      <InflectionTable wordForms={adjForms} />,
    );
    expect(adjContainer.textContent).toContain('positiv');
    expect(adjContainer.textContent).toContain('hank. / hunk.'); // Adjective column

    // Adverb: only degree tags
    const advForms = [
      {
        id: 1,
        form: 'fort',
        tags_json: ['Pos'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container: advContainer } = render(
      <InflectionTable wordForms={advForms} />,
    );
    expect(advContainer.textContent).toContain('positiv');
    expect(advContainer.textContent).not.toContain('hank. / hunk.'); // No adjective columns
    expect(advContainer.textContent).toContain('fort');
  });

  // --- VERB TESTS ---

  it('should render verb table with core forms', () => {
    const wordForms = [
      {
        id: 1,
        form: 'kaste',
        tags_json: ['Inf'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'kaster',
        tags_json: ['Pres'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'kastet',
        tags_json: ['Past'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 4,
        form: 'kastet',
        tags_json: ['<PerfPart>'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 5,
        form: 'kast',
        tags_json: ['Imp'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(
      <InflectionTable wordForms={wordForms} pos="verb" />,
    );

    expect(container.textContent).toContain('infinitiv');
    expect(container.textContent).toContain('kaste');
    expect(container.textContent).toContain('presens');
    expect(container.textContent).toContain('kaster');
    expect(container.textContent).toContain('preteritum');
    expect(container.textContent).toContain('kastet');
    expect(container.textContent).toContain('pres. perf.');
    expect(container.textContent).toContain('kastet');
    expect(container.textContent).toContain('imperativ');
    expect(container.textContent).toContain('kast');
  });

  it('should detect verb by tags if pos is not provided', () => {
    const wordForms = [
      {
        id: 1,
        form: 'kaste',
        tags_json: ['Inf'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      }, // 'Inf' tag triggers verb detection
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    expect(container.textContent).toContain('infinitiv');
    expect(container.textContent).toContain('kaste');
  });

  it('renders vertical wrapper in auto mode for mobile classes', () => {
    const nounForms = [
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
    ];
    render(<InflectionTable wordForms={nounForms} layout="auto" />);
    expect(screen.getByTestId('inflection-mobile')).toBeInTheDocument();
  });

  it('normalizes canonical parts of speech', () => {
    expect(normalizePos('noun')).toBe('noun');
    expect(normalizePos('adjective')).toBe('adjective');
    expect(normalizePos('verb')).toBe('verb');
    expect(normalizePos('adverb')).toBe('adverb');
  });

  it('builds noun table model with sorted genders', () => {
    const model = buildNounTableModel([
      {
        id: 1,
        form: 'stol',
        tags_json: ['Masc', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 2,
        form: 'stolen',
        tags_json: ['Masc', 'Sing', 'Def'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
      {
        id: 3,
        form: 'bord',
        tags_json: ['Neuter', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ]);

    expect(model.sortedGenders).toContain('Masc');
    expect(model.sortedGenders).toContain('Neuter');
    expect(model.data.Masc.Singular.Indefinite).toBe('stol');
  });

  it('detectInflectionKind given a determiner with a gender tag expect no noun table', () => {
    // "det" is a determiner whose forms carry a Neuter gender tag. Without an
    // explicit-POS guard it would be misdetected as a noun and render an empty
    // entall/flertall grid.
    const detForms = [
      {
        id: 1,
        form: 'det',
        tags_json: ['Neuter', 'Sing', 'Ind'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const kind = detectInflectionKind(detForms, 'determiner');
    expect(kind).toEqual({
      isNoun: false,
      isAdjective: false,
      isAdverb: false,
      isVerb: false,
    });

    render(<InflectionTable wordForms={detForms} pos="determiner" />);
    expect(screen.queryByTestId('inflection-mobile')).not.toBeInTheDocument();
  });
});
