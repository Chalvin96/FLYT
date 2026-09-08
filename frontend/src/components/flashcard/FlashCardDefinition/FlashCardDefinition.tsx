import { m } from 'motion/react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { FlashcardActionFooter } from '@/components/flashcard/FlashcardActionFooter';
import {
  flashCardFooterClassName,
  flashCardPanelClassName,
} from '@/components/flashcard/FlashCardFrame';
import { RatingButtons } from '@/components/flashcard/RatingButtons/RatingButtons';
import { cn } from '@/lib/utils';
import type {
  DefinitionRead,
  FlashCardRenderable,
  LemmaContextRead,
  LemmaPos,
  WordFormRead,
} from '@/types/api';

import { buildDefinitionCardView } from './definitionCardView';
import { FlashCardDefinitionBack } from './FlashCardDefinitionBack';
import { FlashCardDefinitionFront } from './FlashCardDefinitionFront';

// The definition card fills its container (full width on mobile, as wide as the
// page allows on desktop) instead of the narrow shared exercise width. The
// width-agnostic flashCardPanelClassName base is used directly here.

export interface FlashCardDefinitionProps {
  card: FlashCardRenderable;
  wordForms?: WordFormRead[];
  onFinished?: (rating: number) => void;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  context?: LemmaContextRead | null;
}

const EMPTY_WORD_FORMS: WordFormRead[] = [];

export const FlashCardDefinition = ({
  card,
  wordForms = EMPTY_WORD_FORMS,
  onFinished,
  isSubmitting = false,
  className = '',
  context: contextProp,
}: FlashCardDefinitionProps) => {
  const context = contextProp ?? card.context ?? null;
  const [isFlipped, setIsFlipped] = useState(false);
  const view = buildDefinitionCardView(card, wordForms);

  const handleFlip = () => setIsFlipped(true);

  const handleRate = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      onFinished?.(rating);
    },
    [onFinished],
  );

  if (!view) {
    return null;
  }

  // Front and back cross-fade in the same layer. We deliberately avoid a 3D
  // flip (rotateY/perspective/backface-visibility): a 3D rendering context on an
  // ancestor of the scrollable definition list traps mouse-wheel scrolling in
  // some browsers (Firefox). Opacity creates no such context.
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 w-full self-stretch">
          <DefinitionFrontLayer
            audioUrl={view.audioUrl}
            formattedPos={view.formattedPos}
            ipaApproximate={view.ipaApproximate}
            isFlipped={isFlipped}
            isSubmitting={isSubmitting}
            senseCue={view.senseCue}
            word={view.word}
            onFlip={handleFlip}
          />

          <m.div
            animate={{ opacity: isFlipped ? 1 : 0 }}
            aria-hidden={!isFlipped}
            className={cn(
              flashCardPanelClassName,
              'absolute inset-0 overflow-hidden',
              !isFlipped && 'pointer-events-none',
            )}
            initial={false}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
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
              onFinished={onFinished}
              onRate={handleRate}
              pos={view.pos}
              primaryTranslation={view.primaryTranslation}
              word={view.word}
              wordForms={wordForms}
            />
          </m.div>
        </div>
      </div>
    </div>
  );
};

function DefinitionFrontLayer({
  audioUrl,
  formattedPos,
  ipaApproximate,
  isFlipped,
  isSubmitting,
  senseCue,
  word,
  onFlip,
}: {
  audioUrl: string | null;
  formattedPos: string | null;
  ipaApproximate: boolean;
  isFlipped: boolean;
  isSubmitting: boolean;
  senseCue: string | null | undefined;
  word: string;
  onFlip: () => void;
}) {
  return (
    <m.div
      animate={{ opacity: isFlipped ? 0 : 1 }}
      aria-hidden={isFlipped}
      className={cn(
        flashCardPanelClassName,
        'absolute inset-0 overflow-hidden',
        isFlipped && 'pointer-events-none',
      )}
      initial={false}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <FlashCardDefinitionFront
          audioUrl={audioUrl}
          formattedPos={formattedPos}
          ipaApproximate={ipaApproximate}
          senseCue={senseCue}
          word={word}
        />
        <div className={flashCardFooterClassName}>
          <FlashcardActionFooter>
            <Button
              className="w-full"
              disabled={isFlipped || isSubmitting}
              onClick={onFlip}
              size="default"
              type="button"
            >
              Check answer
            </Button>
          </FlashcardActionFooter>
        </div>
      </div>
    </m.div>
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
  onFinished,
  onRate,
  pos,
  primaryTranslation,
  word,
  wordForms,
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
  onFinished?: (rating: number) => void;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  pos: LemmaPos | undefined;
  primaryTranslation: string;
  word: string;
  wordForms: WordFormRead[];
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
          word={word}
          wordForms={wordForms}
        />
      </div>
      {onFinished ? (
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
