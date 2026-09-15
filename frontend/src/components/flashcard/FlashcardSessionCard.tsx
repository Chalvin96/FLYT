import { transcribeSpeech } from '@/api/speech';
import { K_RATING_GOOD } from '@/lib/fsrsRatings';
import {
  gradedOutcome,
  type ExerciseOutcome,
  type Rating,
} from '@/lib/operationResult';
import type {
  Exercise,
  FlashCardRenderable,
  OperationFlashCard,
} from '@/types/api';
import { LESSON_PACKET_SCHEMA_VERSION } from '@/types/lesson-contracts';

import { K_FLASHCARD_COMPONENT_MAP } from './componentMap';
import { ExerciseModeProvider } from './ExerciseModeProvider';
import { ExerciseView } from './ExerciseView';
import type { FinishHandler, WriteJudgeFn } from './operationTypes';
import { UnsupportedFlashcardCard } from './UnsupportedFlashcardCard';

type FlashcardSessionCardProps = {
  card: FlashCardRenderable;
  className?: string;
  desktopExpanded?: boolean;
  isSubmitting: boolean;
  judgeWrite?: WriteJudgeFn;
  draftOwnerKey?: string;
  onFinished: FinishHandler<ExerciseOutcome>;
};

function isOperationCard(
  card: FlashCardRenderable['card'],
): card is OperationFlashCard {
  return card.type !== 'definition';
}

function isSupportedOperationCard(card: OperationFlashCard): boolean {
  return card.schema_version === LESSON_PACKET_SCHEMA_VERSION;
}

export function FlashcardSessionCard({
  card,
  className = 'w-full',
  desktopExpanded,
  isSubmitting,
  judgeWrite,
  draftOwnerKey,
  onFinished,
}: FlashcardSessionCardProps) {
  if (isOperationCard(card.card)) {
    if (!isSupportedOperationCard(card.card)) {
      return (
        <UnsupportedFlashcardCard
          cardType={`${card.card.type} (schema ${card.card.schema_version})`}
          isSubmitting={isSubmitting}
          onContinue={() => onFinished(gradedOutcome({ correct: false }))}
        />
      );
    }

    const exercise = card.card.payload as Exercise;
    if (exercise?.kind !== 'exercise') {
      return (
        <UnsupportedFlashcardCard
          cardType={card.card.type}
          isSubmitting={isSubmitting}
          onContinue={() => onFinished(gradedOutcome({ correct: false }))}
        />
      );
    }
    return (
      <ExerciseModeProvider allowRetry={false}>
        <ExerciseView
          key={card.id}
          exercise={exercise}
          className={className}
          desktopExpanded={desktopExpanded}
          isSubmitting={isSubmitting}
          judgeWrite={judgeWrite}
          audio={card.card.audio}
          recordAndTranscribe={transcribeSpeech}
          draftOwnerKey={
            draftOwnerKey ?? `${card.user_id ?? 'anonymous'}-card-${card.id}`
          }
          onFinished={onFinished}
        />
      </ExerciseModeProvider>
    );
  }

  const FlashcardComponent = K_FLASHCARD_COMPONENT_MAP[card.card.type];

  if (!FlashcardComponent) {
    return (
      <UnsupportedFlashcardCard
        cardType={card.card.type}
        isSubmitting={isSubmitting}
        onContinue={() => onFinished(gradedOutcome({ correct: false }))}
      />
    );
  }

  return (
    <ExerciseModeProvider allowRetry={false}>
      <FlashcardComponent
        key={card.id}
        card={card}
        className={className}
        desktopExpanded={desktopExpanded}
        isSubmitting={isSubmitting}
        onFinished={(rating) =>
          onFinished({
            kind: 'graded',
            correct: rating >= K_RATING_GOOD,
            rating: rating as Rating,
          })
        }
        wordForms={card.word_forms}
      />
    </ExerciseModeProvider>
  );
}
