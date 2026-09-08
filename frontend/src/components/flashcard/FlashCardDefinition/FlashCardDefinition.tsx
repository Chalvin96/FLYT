import {
  formatPos,
  getGenderFromTags,
  getLemmaGrammarTag,
} from '@flyt/lexicon/grammar';
import { motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { FlashcardActionFooter } from '@/components/flashcard/FlashcardActionFooter';
import {
  flashCardFooterClassName,
  flashCardPanelClassName,
} from '@/components/flashcard/FlashCardFrame';
import { detectInflectionKind } from '@/components/flashcard/InflectionTable/utils';
import { RatingButtons } from '@/components/flashcard/RatingButtons/RatingButtons';
import { cn } from '@/lib/utils';
import {
  FlashCardType,
  type DefinitionEntry,
  type DefinitionRead,
  type FlashCardRenderable,
  type LemmaContextRead,
  type WordFormRead,
} from '@/types/api';

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

function buildDefinitionsFromPayload(
  definitions: DefinitionEntry[],
): DefinitionRead[] {
  return definitions.map((d, index) => ({
    uuid: d.uuid,
    id: index,
    definition: d.definition,
    translation: d.translation,
    translation_source: null,
    examples_json: d.examples_json,
  }));
}

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
  const definitionPayload =
    card.card.type === FlashCardType.DEFINITION ? card.card.payload : null;

  const definitions = definitionPayload
    ? buildDefinitionsFromPayload(definitionPayload.definitions)
    : [];

  const primaryTranslation = definitionPayload?.primary_translation ?? '';

  const pos = definitionPayload?.pos;
  const word = definitionPayload?.word;
  const inflectionClass = useMemo(
    () => (pos ? getLemmaGrammarTag(pos, wordForms) : null),
    [pos, wordForms],
  );

  const { isNoun, isVerb } = useMemo(
    () => detectInflectionKind(wordForms, pos),
    [wordForms, pos],
  );

  const gender = useMemo(
    () =>
      isNoun && wordForms[0] ? getGenderFromTags(wordForms[0].tags_json) : null,
    [isNoun, wordForms],
  );

  const formattedPos = pos ? formatPos(pos) : null;

  const ipa = definitionPayload?.ipa ?? null;
  const intonation = definitionPayload?.intonation ?? null;
  const ipaApproximate = definitionPayload?.ipa_approximate ?? false;
  const audioUrl =
    definitionPayload?.audio_url ?? wordForms[0]?.audio_url ?? null;

  const handleFlip = () => setIsFlipped(true);

  const handleRate = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      onFinished?.(rating);
    },
    [onFinished],
  );

  if (!definitionPayload || definitions.length === 0) {
    return null;
  }

  const backContents = (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FlashCardDefinitionBack
          word={word}
          primaryTranslation={primaryTranslation}
          definitions={definitions}
          gender={gender}
          inflectionClass={inflectionClass}
          isVerb={isVerb}
          wordForms={wordForms}
          pos={pos}
          ipa={ipa}
          intonation={intonation}
          ipaApproximate={ipaApproximate}
          audioUrl={audioUrl}
          context={context}
        />
      </div>
      {onFinished && (
        <div className={cn(flashCardFooterClassName, 'sticky bottom-0 z-10')}>
          <RatingButtons
            onRate={handleRate}
            previews={card.rating_previews}
            disabled={isSubmitting}
          />
        </div>
      )}
    </>
  );

  // Front and back cross-fade in the same layer. We deliberately avoid a 3D
  // flip (rotateY/perspective/backface-visibility): a 3D rendering context on an
  // ancestor of the scrollable definition list traps mouse-wheel scrolling in
  // some browsers (Firefox). Opacity creates no such context.
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="relative flex min-h-0 flex-1">
        <div className="relative w-full min-h-0 self-stretch">
          <motion.div
            className={cn(
              flashCardPanelClassName,
              'absolute inset-0 overflow-hidden',
              isFlipped && 'pointer-events-none',
            )}
            aria-hidden={isFlipped}
            initial={false}
            animate={{ opacity: isFlipped ? 0 : 1 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <FlashCardDefinitionFront
                word={word}
                senseCue={definitionPayload.sense_cue}
                formattedPos={formattedPos}
                ipaApproximate={ipaApproximate}
                audioUrl={audioUrl}
              />
              <div className={flashCardFooterClassName}>
                <FlashcardActionFooter>
                  <Button
                    type="button"
                    className="w-full"
                    size="default"
                    onClick={handleFlip}
                    disabled={isFlipped || isSubmitting}
                  >
                    Check answer
                  </Button>
                </FlashcardActionFooter>
              </div>
            </div>
          </motion.div>

          <motion.div
            className={cn(
              flashCardPanelClassName,
              'absolute inset-0 overflow-hidden',
              !isFlipped && 'pointer-events-none',
            )}
            aria-hidden={!isFlipped}
            initial={false}
            animate={{ opacity: isFlipped ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {backContents}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
