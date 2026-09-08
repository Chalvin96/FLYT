import { transcribeSpeech } from '@/api/speech';
import { K_RATING_AGAIN } from '@/lib/fsrsRatings';
import type { ExerciseOutcome, Rating } from '@/lib/operationResult';
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

const K_UNSUPPORTED_CARD_FALLBACK_RATING = K_RATING_AGAIN;

export type SessionExerciseResult =
  | { kind: 'graded'; rating: Rating }
  | { kind: 'ungraded'; outcome: 'skipped' | 'service_unavailable' };

type FlashcardSessionCardProps = {
  card: FlashCardRenderable;
  className?: string;
  desktopExpanded?: boolean;
  isSubmitting: boolean;
  judgeWrite?: WriteJudgeFn;
  draftOwnerKey?: string;
  onFinished: FinishHandler<SessionExerciseResult>;
};

function isOperationCard(
  card: FlashCardRenderable['card'],
): card is OperationFlashCard {
  return card.type !== 'definition';
}

function isSupportedOperationCard(card: OperationFlashCard): boolean {
  return card.schema_version === LESSON_PACKET_SCHEMA_VERSION;
}

function toSessionResult(outcome: ExerciseOutcome): SessionExerciseResult {
  return outcome.kind === 'graded'
    ? { kind: 'graded', rating: outcome.rating }
    : { kind: 'ungraded', outcome: outcome.outcome };
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
          onContinue={() =>
            onFinished({
              kind: 'graded',
              rating: K_UNSUPPORTED_CARD_FALLBACK_RATING,
            })
          }
        />
      );
    }

    const exercise = card.card.payload as Exercise;
    if (exercise?.kind !== 'exercise') {
      return (
        <UnsupportedFlashcardCard
          cardType={card.card.type}
          isSubmitting={isSubmitting}
          onContinue={() =>
            onFinished({
              kind: 'graded',
              rating: K_UNSUPPORTED_CARD_FALLBACK_RATING,
            })
          }
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
          onFinished={(result) => onFinished(toSessionResult(result))}
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
        onContinue={() =>
          onFinished({
            kind: 'graded',
            rating: K_UNSUPPORTED_CARD_FALLBACK_RATING,
          })
        }
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
          onFinished({ kind: 'graded', rating: rating as Rating })
        }
        wordForms={card.word_forms}
      />
    </ExerciseModeProvider>
  );
}
