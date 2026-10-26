import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findTokenDoc, readTokenSource, type TokenDoc } from './token-source';
import { ALL_TOKEN_DOCS, COMPONENT_TOKEN_PREFIXES } from './token-docs';

const SAMPLE_SOURCE = `
@theme inline {
  --color-sample: var(--sample-ink);
}

/* A comment { with braces } */
@theme {
  --text-caption: 0.875rem;
  --text-caption--line-height: 1.25rem;
}

:root,
:host {
  --sample-ink: var(--sample-70);
  --progress-locked: color-mix(
    in srgb,
    var(--sample-muted) 55%,
    transparent
  );
}

@layer base {
  * {
    @apply border-default;
  }
}

@utility radius-field {
  border-radius: var(--radius-field);
}
`;

const SAMPLE_DOCS: TokenDoc[] = [
  { name: '--sample', useWhen: 'a resting sample' },
  { name: '--sample-correct', useWhen: 'a sample revealed as right' },
  { family: 'sample', useWhen: 'sample hue' },
];

describe('readTokenSource', () => {
  it('test_read_token_source_given_theme_and_root_blocks_expect_their_declarations_only', () => {
    const tokens = readTokenSource(SAMPLE_SOURCE);

    expect(tokens.map((token) => token.name)).toEqual([
      '--text-caption',
      '--text-caption--line-height',
      '--sample-ink',
      '--progress-locked',
    ]);
  });

  it('test_read_token_source_given_multiline_value_expect_value_on_one_line', () => {
    const tokens = readTokenSource(SAMPLE_SOURCE);

    expect(tokens.find((token) => token.name === '--progress-locked')).toEqual({
      name: '--progress-locked',
      source: 'color-mix( in srgb, var(--sample-muted) 55%, transparent )',
    });
  });
});

describe('findTokenDoc', () => {
  it('test_find_token_doc_given_nested_names_expect_most_specific_entry', () => {
    expect(findTokenDoc('--sample-surface-hover', SAMPLE_DOCS)?.useWhen).toBe(
      'a resting sample',
    );
    expect(
      findTokenDoc('--sample-correct-marker-text', SAMPLE_DOCS)?.useWhen,
    ).toBe('a sample revealed as right');
  });

  it('test_find_token_doc_given_palette_step_expect_family_entry', () => {
    expect(findTokenDoc('--sample-70', SAMPLE_DOCS)?.useWhen).toBe(
      'sample hue',
    );
  });

  it('test_find_token_doc_given_name_sharing_only_a_prefix_expect_no_entry', () => {
    expect(findTokenDoc('--samples', SAMPLE_DOCS)).toBeUndefined();
  });
});

describe('shared token documentation', () => {
  const SHARED_SHEETS = ['palette.css', 'theme-light.css', 'tokens.css'];

  async function readSharedTokenNames() {
    const stylesDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../styles',
    );
    const sheets = await Promise.all(
      SHARED_SHEETS.map((sheet) =>
        readFile(path.join(stylesDirectory, sheet), 'utf8'),
      ),
    );
    return readTokenSource(sheets.join('\n')).map((token) => token.name);
  }

  function isComponentToken(name: string) {
    return COMPONENT_TOKEN_PREFIXES.some((prefix) => name.startsWith(prefix));
  }

  function findDocumentedToken(name: string) {
    return findTokenDoc(name, ALL_TOKEN_DOCS, COMPONENT_TOKEN_PREFIXES);
  }

  it('test_token_docs_given_shared_stylesheet_expect_every_token_documented_or_component_namespaced', async () => {
    const unowned = (await readSharedTokenNames()).filter(
      (name) => !findDocumentedToken(name) && !isComponentToken(name),
    );

    expect(unowned).toEqual([]);
  });

  it('test_token_docs_given_shared_stylesheet_expect_no_token_both_documented_and_component_namespaced', async () => {
    const both = (await readSharedTokenNames()).filter(
      (name) => findDocumentedToken(name) && isComponentToken(name),
    );

    expect(both).toEqual([]);
  });

  it('test_token_docs_given_shared_stylesheet_expect_every_entry_to_own_a_token', async () => {
    const names = await readSharedTokenNames();
    const shadowed = ALL_TOKEN_DOCS.filter(
      (doc) => !names.some((name) => findDocumentedToken(name) === doc),
    );

    expect(shadowed).toEqual([]);
  });

  it('test_token_docs_given_the_entries_expect_every_use_when_a_single_line', () => {
    const invalid = ALL_TOKEN_DOCS.filter(
      (doc) => doc.useWhen.trim() === '' || doc.useWhen.includes('\n'),
    );

    expect(invalid).toEqual([]);
  });
});
