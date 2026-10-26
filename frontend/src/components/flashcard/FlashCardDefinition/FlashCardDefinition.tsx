import { Button } from '@flyt/ui';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { FlashcardActionFooter } from '@/components/flashcard/FlashcardActionFooter';
import {
  flashCardFooterClassName,
  flashCardPanelClassName,
} from '@/components/flashcard/FlashCardFrame';
import { RatingButtons } from '@/components/flashcard/RatingButtons/RatingButtons';
import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import type { ExerciseOutcome } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type {
  DefinitionRead,
  FlashCardRenderable,
  LemmaContextRead,
  LemmaPos,
  WordFormRead,
} from '@/types/api';

import type { FinishHandler } from '../operationTypes';
import { buildDefinitionCardView } from './definitionCardView';
import { FlashCardDefinitionBack } from './FlashCardDefinitionBack';
import { FlashCardDefinitionFront } from './FlashCardDefinitionFront';

export interface FlashCardDefinitionProps {
  card: FlashCardRenderable;
  allowRetry: boolean;
  wordForms?: WordFormRead[];
  onFinished?: FinishHandler<ExerciseOutcome>;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  context?: LemmaContextRead | null;
}

const EMPTY_WORD_FORMS: WordFormRead[] = [];

export const FlashCardDefinition = ({
  card,
  allowRetry,
  wordForms = EMPTY_WORD_FORMS,
  onFinished,
  isSubmitting = false,
  className = '',
  context: contextProp,
}: FlashCardDefinitionProps) => {
  const context = contextProp ?? card.context ?? null;
  const [isFlipped, setIsFlipped] = useState(false);
  const { finishRating } = useExerciseAttempt({ allowRetry, onFinished });
  const backHeadingRef = useRef<HTMLHeadingElement>(null);
  const view = buildDefinitionCardView(card, wordForms);

  const handleFlip = () => setIsFlipped(true);

  useEffect(() => {
    if (isFlipped) backHeadingRef.current?.focus();
  }, [isFlipped]);

  if (!view) {
    return null;
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 w-full self-stretch">
          <DefinitionFrontLayer
            audioUrl={view.audioUrl}
            isFlipped={isFlipped}
            isSubmitting={isSubmitting}
            senseCue={view.senseCue}
            word={view.primaryDisplayForm ?? view.word}
            onFlip={handleFlip}
          />

          <div
            aria-hidden={!isFlipped}
            data-testid="flashcard-answer-face"
            className={cn(
              flashCardPanelClassName,
              '@container absolute inset-0 overflow-hidden transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none',
              !isFlipped && 'pointer-events-none',
            )}
            inert={!isFlipped}
            style={{
              opacity: isFlipped ? 1 : 0,
              visibility: isFlipped ? 'visible' : 'hidden',
            }}
          >
            <DefinitionBackLayer
              audioUrl={view.audioUrl}
              card={card}
              context={context}
              definitions={view.definitions}
              gender={view.gender}
              inflectionClass={view.inflectionClass}
              intonation={view.intonation}
              ipa={view.ipa}
              ipaApproximate={view.ipaApproximate}
              isSubmitting={isSubmitting}
              isVerb={view.isVerb}
              showRatings={Boolean(onFinished)}
              onRate={finishRating}
              pos={view.pos}
              primaryTranslation={view.primaryTranslation}
              primaryDisplayForm={view.primaryDisplayForm}
              alternativeForms={view.alternativeForms}
              word={view.word}
              wordForms={wordForms}
              headingRef={backHeadingRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function DefinitionFrontLayer({
  audioUrl,
  isFlipped,
  isSubmitting,
  senseCue,
  word,
  onFlip,
}: {
  audioUrl: string | null;
  isFlipped: boolean;
  isSubmitting: boolean;
  senseCue: string | null | undefined;
  word: string;
  onFlip: () => void;
}) {
  return (
    <div
      aria-hidden={isFlipped}
      data-testid="flashcard-question-face"
      className={cn(
        flashCardPanelClassName,
        'absolute inset-0 overflow-hidden transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none',
        isFlipped && 'pointer-events-none',
      )}
      inert={isFlipped}
      style={{
        opacity: isFlipped ? 0 : 1,
        visibility: isFlipped ? 'hidden' : 'visible',
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <FlashCardDefinitionFront
          audioUrl={audioUrl}
          senseCue={senseCue}
          word={word}
        />
        <div className={flashCardFooterClassName}>
          <FlashcardActionFooter>
            <Button
              width="full"
              disabled={isFlipped || isSubmitting}
              onClick={onFlip}
              type="button"
            >
              Check answer
            </Button>
          </FlashcardActionFooter>
        </div>
      </div>
    </div>
  );
}

function DefinitionBackLayer({
  audioUrl,
  card,
  context,
  definitions,
  gender,
  inflectionClass,
  intonation,
  ipa,
  ipaApproximate,
  isSubmitting,
  isVerb,
  showRatings,
  onRate,
  pos,
  primaryTranslation,
  primaryDisplayForm,
  alternativeForms,
  word,
  wordForms,
  headingRef,
}: {
  audioUrl: string | null;
  card: FlashCardRenderable;
  context: LemmaContextRead | null;
  definitions: DefinitionRead[];
  gender: string | null;
  inflectionClass: string | null;
  intonation: string | null;
  ipa: string | null;
  ipaApproximate: boolean;
  isSubmitting: boolean;
  isVerb: boolean;
  showRatings: boolean;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  pos: LemmaPos | undefined;
  primaryTranslation: string;
  primaryDisplayForm: string | null;
  alternativeForms: string[];
  word: string;
  wordForms: WordFormRead[];
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FlashCardDefinitionBack
          audioUrl={audioUrl}
          context={context}
          definitions={definitions}
          gender={gender}
          inflectionClass={inflectionClass}
          intonation={intonation}
          ipa={ipa}
          ipaApproximate={ipaApproximate}
          isVerb={isVerb}
          pos={pos}
          primaryTranslation={primaryTranslation}
          primaryDisplayForm={primaryDisplayForm}
          alternativeForms={alternativeForms}
          word={word}
          wordForms={wordForms}
          headingRef={headingRef}
        />
      </div>
      {showRatings ? (
        <div className={cn(flashCardFooterClassName, 'sticky bottom-0 z-10')}>
          <RatingButtons
            disabled={isSubmitting}
            onRate={onRate}
            previews={card.rating_previews}
          />
        </div>
      ) : null}
    </>
  );
}
