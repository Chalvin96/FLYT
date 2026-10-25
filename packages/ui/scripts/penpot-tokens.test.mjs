import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import {
  colorValue,
  compareTokenFiles,
  generateTokens,
  lengthInPixels,
  readCssDeclarations,
} from './penpot-tokens.mjs';

test('test_css_parser_given_nested_declarations_expect_source_values', () => {
  const css = `
    @theme inline {
      --radius-md: calc(var(--radius) - 2px);
    }
    :root, :host {
      --radius: 0.75rem;
      --background-success: color-mix(
        in oklab,
        var(--accent-10) 45%,
        var(--secondary-0)
      );
    }
  `;
  const declarations = readCssDeclarations(css);

  assert.equal(declarations.get('--radius-md'), 'calc(var(--radius) - 2px)');
  assert.equal(
    lengthInPixels(declarations.get('--radius-md'), declarations),
    10,
  );
  assert.equal(
    declarations.get('--background-success'),
    'color-mix(\n        in oklab,\n        var(--accent-10) 45%,\n        var(--secondary-0)\n      )',
  );
});

test('test_color_value_given_reference_and_computed_color_expect_penpot_styles', () => {
  const declarations = new Map([
    ['--primary-10', '#f0ebff'],
    ['--white-100', 'rgba(255, 255, 255, 1)'],
  ]);
  const references = new Map([['--primary-10', 'color.primary.10']]);

  assert.equal(
    colorValue('var(--primary-10)', declarations, references),
    '{color.primary.10}',
  );
  assert.equal(
    colorValue('rgba(255, 255, 255, 1)', declarations, references),
    '#ffffff',
  );
  assert.equal(colorValue('#ABCDEF', declarations, references), '#abcdef');
  assert.equal(
    colorValue('oklch(20% 0.04 220 / 0.12)', declarations, references),
    'rgba(0, 26, 34, 0.12)',
  );
  assert.throws(
    () => colorValue('var(--white-100)', declarations, references),
    /Unmapped CSS colour reference: var\(--white-100\)/,
  );
  assert.throws(
    () => colorValue('not-a-color', declarations, references),
    /Unsupported CSS colour: not-a-color/,
  );
});

test('test_generator_given_repository_css_expect_canonical_tokens_and_only_fluid_omissions', async () => {
  const { tokens, omitted } = await generateTokens();

  assert.deepEqual(omitted, [
    '--text-body-fluid: Unsupported CSS length: clamp(1.25rem, 1.0833rem + 0.8333vw, 1.75rem)',
    '--text-heading-fluid: Unsupported CSS length: clamp(1.25rem, 1.0833rem + 0.8333vw, 1.75rem)',
  ]);
  assert.deepEqual(tokens.primitives.color.primary['20'], {
    $value: '#ebe7ff',
    $type: 'color',
    $description: '',
  });
  assert.equal(tokens.primitives.color.white['100'].$value, '#ffffff');
  assert.equal(
    tokens['modes/light'].color['background-brand-bold'].$value,
    '{color.primary.80}',
  );
  assert.equal(
    tokens['modes/light'].color['shadow-color-tile-1'].$description,
    'Use when: the ink the elevation shadows are drawn in',
  );
  assert.equal(
    tokens.semantic.font.size['text-body-medium'].$description,
    'Use when: default interface text',
  );
  assert.equal(tokens.semantic.spacing['4'].$description, '');
  assert.equal(Object.hasOwn(tokens.$themes[0], 'id'), false);
});

test('test_generate_tokens_given_repository_css_expect_one_radius_token_per_value', async () => {
  const { tokens } = await generateTokens();
  const values = Object.values(tokens.semantic.radius).map(
    (radius) => radius.$value,
  );

  assert.deepEqual(values, [...new Set(values)]);
});

test('test_generate_tokens_given_repository_css_expect_spacing_without_primitive_mirror', async () => {
  const { tokens } = await generateTokens();

  assert.equal(tokens.primitives.scale.spacing, undefined);
  assert.equal(tokens.semantic.spacing['4'].$value, '16');
});

test('test_penpot_token_baseline_given_repository_css_expect_committed_tokens', async () => {
  const committedTokens = JSON.parse(
    await readFile(new URL('../penpot-tokens.json', import.meta.url), 'utf8'),
  );
  const { tokens } = await generateTokens();
  const differences = compareTokenFiles(committedTokens, tokens).map(
    (difference) =>
      difference
        .replace(/^EXTRA /, 'ADDED ')
        .replace(/^MISSING /, 'REMOVED ')
        .replace(/ generated(?=[=(])/, ' committed')
        .replace(/ export(?=[=(])/, ' current'),
  );

  assert.ok(
    isDeepStrictEqual(committedTokens, tokens),
    `Penpot token baseline differs from generated tokens:\n${differences.length ? differences.join('\n') : 'Non-token JSON changed.'}\nRun pnpm --filter @flyt/ui tokens:generate and justify each new token in the PR.`,
  );
});

test('test_drift_check_given_penpot_theme_id_expect_no_token_difference', async () => {
  const { tokens } = await generateTokens();
  const exported = structuredClone(tokens);
  exported.$themes[0].id = 'penpot-assigned-id';

  assert.deepEqual(compareTokenFiles(tokens, exported), []);
  exported.$themes[0].name = 'Dark';
  assert.match(compareTokenFiles(tokens, exported)[0], /^CHANGED \$themes /);
});

test('test_drift_check_given_missing_extra_and_changed_tokens_expect_every_difference', () => {
  const generated = {
    primitives: {
      color: {
        primary: {
          10: { $value: '#f0ebff', $type: 'color', $description: '' },
        },
      },
    },
    'modes/light': {
      color: {
        'text-default': {
          $value: '{color.primary.10}',
          $type: 'color',
          $description: 'Use when: default text',
        },
      },
    },
    semantic: {
      size: {
        icon: { xs: { $value: '12', $type: 'sizing', $description: '' } },
      },
    },
    'app/light': {},
    $themes: [],
    $metadata: { activeSets: [] },
  };
  const exported = structuredClone(generated);
  delete exported.primitives.color.primary[10];
  exported.primitives.color.primary[20] = {
    $value: '#ebe7ff',
    $type: 'color',
    $description: '',
  };
  exported['modes/light'].color['text-default'].$value = '#f0ebff';
  exported.semantic.size.icon.xs.$type = 'spacing';

  assert.deepEqual(compareTokenFiles(generated, exported), [
    'MISSING primitives color.primary.10 type="color" value="#f0ebff" description=""',
    'EXTRA primitives color.primary.20 type="color" value="#ebe7ff" description=""',
    'CHANGED modes/light color.text-default generated(type="color" value="{color.primary.10}" description="Use when: default text") export(type="color" value="#f0ebff" description="Use when: default text")',
    'CHANGED semantic size.icon.xs generated(type="sizing" value="12" description="") export(type="spacing" value="12" description="")',
  ]);
  assert.deepEqual(
    compareTokenFiles(generated, structuredClone(generated)),
    [],
  );
});
