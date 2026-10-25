import { describe, expect, it } from 'vitest';

import {
  TEXT_BODY_SIZE,
  TEXT_SIZE,
  TEXT_SIZE_CONTAINER,
  TEXT_SIZE_SM,
  textVariants,
  type TextVariants,
} from './text-variants';

const BASE_SIZE_CLASSES: Record<string, string> = {
  ...TEXT_SIZE,
  ...TEXT_BODY_SIZE,
};

const PREFIXED_RECORDS = [
  { variant: 'sm', record: TEXT_SIZE_SM as Record<string, string> },
  { variant: '@2xl', record: TEXT_SIZE_CONTAINER as Record<string, string> },
];

function expectStepToReplaceLiteral(
  site: string,
  variants: TextVariants,
  literal: string,
  added: string[] = [],
  dropped: string[] = [],
): void {
  const emitted = textVariants(variants).split(' ');
  const replaced = literal.split(' ');

  expect(
    {
      site,
      added: emitted.filter((entry) => !replaced.includes(entry)),
      dropped: replaced.filter((entry) => !emitted.includes(entry)),
    },
    `${site} must emit the step that replaced its literal, and nothing else`,
  ).toEqual({ site, added, dropped });
}

describe('responsive type steps', () => {
  it('test_prefixed_records_given_a_step_it_names_expect_the_scale_prefixed', () => {
    for (const { variant, record } of PREFIXED_RECORDS) {
      for (const [size, prefixed] of Object.entries(record)) {
        expect(prefixed, `${variant} ${size}`).toBe(
          BASE_SIZE_CLASSES[size]
            .split(' ')
            .map((entry) => `${variant}:${entry}`)
            .join(' '),
        );
      }
    }
  });

  it('test_prefixed_records_given_the_fluid_sizes_expect_no_step_to_pair', () => {
    for (const { variant, record } of PREFIXED_RECORDS) {
      expect(Object.keys(record), variant).not.toContain('fluid');
      expect(Object.keys(record), variant).not.toContain('prompt');
      expect(Object.keys(record), variant).not.toContain('prompt-roomy');
    }
  });

  it('test_converted_sites_given_the_literal_they_replaced_expect_the_same_classes', () => {
    expectStepToReplaceLiteral(
      'OperationShellBody.tsx',
      { size: 'medium', smSize: 'large' },
      'text-body-medium sm:text-body-large',
    );
    expectStepToReplaceLiteral(
      'FlashCardWriteEditor.tsx',
      { size: 'medium', smSize: 'large' },
      'text-body-medium sm:text-body-large',
    );
    expectStepToReplaceLiteral(
      'LearningLoop.tsx',
      { size: 'large', smSize: 'xl', tone: 'subtle' },
      'text-body-large text-subtle sm:text-xl sm:leading-normal',
    );
    expectStepToReplaceLiteral(
      'LandingHero.tsx',
      { size: 'large', smSize: 'xl', tone: 'subtle' },
      'text-body-large text-subtle sm:text-xl sm:leading-normal',
    );
    expectStepToReplaceLiteral(
      'ClosingSection.tsx',
      { size: 'large', tone: 'inverse-subtle' },
      'text-body-large text-inverse-subtle',
    );
    expectStepToReplaceLiteral(
      'FlashCardDefinitionBack.tsx',
      {
        containerSize: '3xl',
        size: '2xl',
        tone: 'default',
        weight: 'bold',
      },
      'text-2xl leading-tight font-bold text-default @2xl:text-3xl @2xl:leading-none',
    );
  });
});
