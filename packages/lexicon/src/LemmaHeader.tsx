import { Badge } from '@flyt/ui';
import type { ReactNode, Ref } from 'react';
import { Fragment } from 'react';

import { formatLookupLabel, formatPos, posLabel } from './grammar';
import type { LemmaPos } from './types';
import { PronunciationRow } from './PronunciationRow';

export interface LemmaHeaderProps {
  word: string;
  pos: LemmaPos;
  primaryDisplayForm?: string | null;
  alternativeForms?: string[] | null;
  ipa?: string | null;
  ipaApproximate?: boolean;
  intonation?: string | null;
  audioUrl?: string | null;
  headingAs?: 'h2' | 'h3';
  headingClassName?: string;
  /** Presentation used by the answer face's layered header band. */
  presentation?: 'default' | 'flashcard';
  grammarMetadata?: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
}

function EyebrowChip({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="h-5.5 rounded-full border-secondary-20 bg-white-100 px-2.5 type-label-sm font-bold tracking-label-tight text-secondary-70"
    >
      {children}
    </Badge>
  );
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
  headingClassName = 'font-display text-4xl leading-none text-secondary-90',
  presentation = 'default',
  grammarMetadata,
  headingRef,
}: LemmaHeaderProps) {
  const displayWord = primaryDisplayForm || formatLookupLabel(word);
  const otherForms = alternativeForms?.filter(Boolean) ?? [];
  const isFlashcard = presentation === 'flashcard';
  const posText = posLabel(pos);
  const showEyebrow =
    isFlashcard && (pos !== 'unknown' || Boolean(grammarMetadata));

  const pronunciation = (
    <PronunciationRow
      ipa={ipa}
      ipaApproximate={ipaApproximate}
      intonation={intonation}
      audioUrl={audioUrl}
      className={isFlashcard ? 'mt-2.5 @2xl:mt-0' : ''}
      audioClassName={isFlashcard ? '-m-2' : ''}
      audioPosition={isFlashcard ? 'trailing' : 'leading'}
      audioAppearance={isFlashcard ? 'quiet' : 'default'}
    />
  );

  return (
    <header
      data-testid={isFlashcard ? 'flashcard-answer-header' : undefined}
      className={
        isFlashcard
          ? '-mx-4 shrink-0 border-b border-secondary-20 bg-secondary-10 px-4 pb-4 pt-3 sm:-mx-5 sm:px-5 @2xl:-mx-8 @2xl:px-8 @2xl:pb-5 @2xl:pt-4'
          : 'space-y-1.5'
      }
    >
      {showEyebrow ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-2"
          data-testid="flashcard-answer-eyebrow"
        >
          {pos !== 'unknown' ? (
            <EyebrowChip>{formatPos(pos)}</EyebrowChip>
          ) : null}
          {grammarMetadata ? (
            <EyebrowChip>{grammarMetadata}</EyebrowChip>
          ) : null}
        </div>
      ) : null}
      <div
        className={
          isFlashcard
            ? '@2xl:flex @2xl:flex-wrap @2xl:items-baseline @2xl:gap-x-5'
            : 'flex min-w-0 flex-wrap items-start gap-3'
        }
      >
        <Tag
          ref={headingRef}
          className={`${headingClassName} min-w-0 max-w-full break-words ${isFlashcard ? '' : 'flex-1'}`}
          aria-label={displayWord}
          tabIndex={isFlashcard ? -1 : undefined}
        >
          {displayWord}
        </Tag>
        {isFlashcard ? (
          pronunciation
        ) : (
          <span className="type-label-sm radius-sm border border-secondary-30 bg-secondary-0 px-2 py-0.5 text-secondary-70">
            {posText}
          </span>
        )}
      </div>
      {isFlashcard ? null : pronunciation}
      {!isFlashcard && otherForms.length > 0 && (
        <p className="type-caption text-secondary-70">
          <span className="font-semibold">Other forms</span>{' '}
          {otherForms.map((form, index) => (
            <Fragment key={form}>
              {index > 0 && <span className="text-secondary-40"> · </span>}
              <span>{form}</span>
            </Fragment>
          ))}
        </p>
      )}
    </header>
  );
}
