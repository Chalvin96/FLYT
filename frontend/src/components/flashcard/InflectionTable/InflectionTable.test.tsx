import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InflectionTable } from './InflectionTable';
import {
  buildNounTableModel,
  detectInflectionKind,
  normalizePos,
} from './utils';

describe('InflectionTable', () => {
  it('test_inflection_table_given_noun_forms_expect_gender_groups', () => {
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

    expect(container.textContent).toContain('stikkrenne');
    expect(container.textContent).toContain('stikkrenna');

    expect(container.textContent).toContain('Entall');
    expect(container.textContent).toContain('Flertall');

    const labelCells = screen.getAllByRole('columnheader');
    expect(labelCells.length).toBeGreaterThan(0);
  });

  it('test_inflection_table_given_dual_gender_noun_expect_both_genders', () => {
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

    expect(container.textContent).toContain('stikkrenne');
    expect(container.textContent).toContain('stikkrenna');
    expect(container.textContent).toContain('stikkrennen');
    expect(container.textContent).toContain('Hankjønn');
    expect(container.textContent).toContain('Hunkjønn');
  });

  it('test_inflection_table_given_noun_forms_expect_sentence_case_number_sections', () => {
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

    expect(container.textContent).toContain('Entall');
    expect(container.textContent).toContain('Flertall');

    expect(container.textContent).toContain('Ubest.');
    expect(container.textContent).toContain('Bestemt form');

    expect(container.textContent).toContain('bil');
    expect(container.textContent).toContain('bilen');
    expect(container.textContent).toContain('biler');
    expect(container.textContent).toContain('bilene');
  });

  it('test_inflection_table_given_empty_forms_expect_no_number_sections', () => {
    render(<InflectionTable wordForms={[]} />);
    expect(screen.queryByText('Entall')).not.toBeInTheDocument();
  });

  it('test_inflection_table_given_positive_adjective_expect_sentence_case_columns', () => {
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

    expect(container.textContent).toContain('Positiv');
    expect(container.textContent).toContain('Hank. / hunk.');
    expect(container.textContent).toContain('Intetkjønn');
    expect(container.textContent).toContain('Flt. / best.');

    expect(container.textContent).toContain('usaklig');
    expect(container.textContent).toContain('usaklige');
  });

  it('test_inflection_table_given_graded_adjective_expect_sentence_case_rows', () => {
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

    expect(container.textContent).toContain('Komparativ');
    expect(container.textContent).toContain('usakligere');

    expect(container.textContent).toContain('Sup. ubest.');
    expect(container.textContent).toContain('usakligst');

    expect(container.textContent).toContain('Sup. best.');
    expect(container.textContent).toContain('usakligste');
  });

  it('test_inflection_table_given_adjective_forms_expect_adjective_table', () => {
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

    expect(container.textContent).toContain('Positiv');
    expect(container.textContent).toContain('Hank. / hunk.');
    expect(container.textContent).not.toContain('Ubest.');
  });

  it('test_inflection_table_given_graded_adverb_expect_adverb_table', () => {
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

    expect(container.textContent).toContain('Positiv');
    expect(container.textContent).toContain('lenge');
    expect(container.textContent).toContain('Komparativ');
    expect(container.textContent).toContain('lenger');
    expect(container.textContent).toContain('Superlativ');
    expect(container.textContent).toContain('lengst');
  });

  it('test_inflection_table_given_adverb_and_adjective_expect_distinct_tables', () => {
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
    expect(adjContainer.textContent).toContain('Positiv');
    expect(adjContainer.textContent).toContain('Hank. / hunk.');

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
    expect(advContainer.textContent).toContain('Positiv');
    expect(advContainer.textContent).not.toContain('Hank. / hunk.');
    expect(advContainer.textContent).toContain('fort');
  });

  it('test_inflection_table_given_verb_forms_expect_sentence_case_headers', () => {
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

    expect(container.textContent).toContain('Infinitiv');
    expect(container.textContent).toContain('kaste');
    expect(container.textContent).toContain('Presens');
    expect(container.textContent).toContain('kaster');
    expect(container.textContent).toContain('Preteritum');
    expect(container.textContent).toContain('kastet');
    expect(container.textContent).toContain('Pres. perf.');
    expect(container.textContent).toContain('kastet');
    expect(container.textContent).toContain('Imperativ');
    expect(container.textContent).toContain('kast');
  });

  it('test_inflection_table_given_verb_tags_without_pos_expect_verb_table', () => {
    const wordForms = [
      {
        id: 1,
        form: 'kaste',
        tags_json: ['Inf'],
        ipa: null,
        audio_url: null,
        ipa_approximate: false,
      },
    ];
    const { container } = render(<InflectionTable wordForms={wordForms} />);

    expect(container.textContent).toContain('Infinitiv');
    expect(container.textContent).toContain('kaste');
  });

  it('test_inflection_table_given_auto_layout_expect_mobile_wrapper', () => {
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

  it('test_normalize_pos_given_canonical_values_expect_normalized_pos', () => {
    expect(normalizePos('noun')).toBe('noun');
    expect(normalizePos('adjective')).toBe('adjective');
    expect(normalizePos('verb')).toBe('verb');
    expect(normalizePos('adverb')).toBe('adverb');
  });

  it('test_noun_table_model_given_multiple_genders_expect_sorted_genders', () => {
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

  it('test_inflection_kind_given_determiner_gender_tag_expect_no_noun_table', () => {
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
