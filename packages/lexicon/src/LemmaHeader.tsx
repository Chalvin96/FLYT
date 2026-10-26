import { Badge, Text, textVariants } from '@flyt/ui';
import type { ClosedProps } from '@flyt/ui';
import { cn, sentenceCaseLabel } from '@flyt/ui/lib/utils';
import type { ReactNode, Ref } from 'react';
import { Fragment } from 'react';

import { buildHeadwordForms, formatPos } from './grammar';
import { PronunciationRow } from './PronunciationRow';
import type { LemmaPos } from './types';

export type LemmaHeadingTypography =
  'default' | 'compact' | 'flashcard' | 'extension';

const LEMMA_HEADER_PRESENTATION: Record<'default' | 'flashcard', string> = {
  default: 'space-y-1.5',
  flashcard:
    '-mx-4 shrink-0 border-b border-default bg-neutral-subtle px-4 pb-4 pt-3 sm:-mx-5 sm:px-5 @2xl:-mx-8 @2xl:px-8 @2xl:pb-5 @2xl:pt-4',
};

const LEMMA_HEADING_BASE = `min-w-0 max-w-full break-words ${textVariants({ tone: 'default' })}`;

const LEMMA_HEADING_ROW_PRESENTATION: Record<'default' | 'flashcard', string> =
  {
    default: 'flex min-w-0 flex-wrap items-start gap-3',
    flashcard: '@2xl:flex @2xl:flex-wrap @2xl:items-baseline @2xl:gap-x-5',
  };

const LEMMA_HEADING_TYPOGRAPHY: Record<LemmaHeadingTypography, string> = {
  default: textVariants({ size: '4xl-none' }),
  compact: textVariants({ size: '3xl' }),
  flashcard: textVariants({ size: '4xl', weight: 'semibold' }),
  extension: textVariants({ size: '2xl-none', font: 'serif', weight: 'bold' }),
};

export interface LemmaHeaderProps extends ClosedProps<'header'> {
  word: string;
  pos: LemmaPos;
  primaryDisplayForm?: string | null;
  alternativeForms?: string[] | null;
  ipa?: string | null;
  ipaApproximate?: boolean;
  intonation?: string | null;
  audioUrl?: string | null;
  headingAs?: 'h2' | 'h3';
  headingTypography?: LemmaHeadingTypography;
  /** Presentation used by the answer face's layered header band. */
  presentation?: 'default' | 'flashcard';
  grammarMetadata?: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
}

function EyebrowChip({ children }: { children: ReactNode }) {
  return <Badge eyebrow>{children}</Badge>;
}

export function LemmaHeader({
  word,
  pos,
  primaryDisplayForm,
  alternativeForms,
  ipa,
  ipaApproximate = false,
  intonation,
  audioUrl,
  headingAs: Tag = 'h3',
  headingTypography,
  presentation = 'default',
  grammarMetadata,
  headingRef,
  ...headerProps
}: LemmaHeaderProps) {
  const forms = primaryDisplayForm
    ? { canonical: primaryDisplayForm, display: primaryDisplayForm }
    : buildHeadwordForms(word);
  const otherForms = alternativeForms?.filter(Boolean) ?? [];
  const isFlashcard = presentation === 'flashcard';
  const posText = sentenceCaseLabel(formatPos(pos));
  const showEyebrow =
    isFlashcard && (pos !== 'unknown' || Boolean(grammarMetadata));
  const resolvedHeadingTypography =
    headingTypography ?? (isFlashcard ? 'flashcard' : 'default');

  const pronunciation = (
    <PronunciationRow
      ipa={ipa}
      ipaApproximate={ipaApproximate}
      intonation={intonation}
      audioUrl={audioUrl}
      presentation={isFlashcard ? 'flashcard' : 'default'}
    />
  );

  return (
    <header
      data-testid={isFlashcard ? 'flashcard-answer-header' : undefined}
      {...headerProps}
      className={LEMMA_HEADER_PRESENTATION[presentation]}
      style={undefined}
    >
      {showEyebrow ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-2"
          data-testid="flashcard-answer-eyebrow"
        >
          {pos !== 'unknown' ? <EyebrowChip>{posText}</EyebrowChip> : null}
          {grammarMetadata ? (
            <EyebrowChip>{sentenceCaseLabel(grammarMetadata)}</EyebrowChip>
          ) : null}
        </div>
      ) : null}
      <div className={LEMMA_HEADING_ROW_PRESENTATION[presentation]}>
        <Tag
          ref={headingRef}
          className={cn(
            LEMMA_HEADING_BASE,
            LEMMA_HEADING_TYPOGRAPHY[resolvedHeadingTypography],
            !isFlashcard && 'flex-1',
          )}
          aria-label={forms.canonical}
          tabIndex={isFlashcard ? -1 : undefined}
        >
          {forms.display}
        </Tag>
        {isFlashcard ? (
          <span className="mt-2.5 flex min-w-0 @2xl:mt-0">{pronunciation}</span>
        ) : (
          <EyebrowChip>{posText}</EyebrowChip>
        )}
      </div>
      {isFlashcard ? null : pronunciation}
      {!isFlashcard && otherForms.length > 0 && (
        <Text as="p" size="medium" tone="subtle">
          <Text as="span" weight="semibold">
            Other forms
          </Text>{' '}
          {otherForms.map((form, index) => (
            <Fragment key={form}>
              {index > 0 && (
                <Text as="span" tone="subtle">
                  {' · '}
                </Text>
              )}
              <span>{form}</span>
            </Fragment>
          ))}
        </Text>
      )}
    </header>
  );
}
