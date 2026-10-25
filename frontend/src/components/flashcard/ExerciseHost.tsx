import type { ExerciseOutcome } from '@/lib/operationResult';
import { FlashCardType } from '@/types/api';
import {
  SUPPORTED_LESSON_PACKET_SCHEMA_VERSIONS,
  type Exercise,
  type WriteExercise,
} from '@/types/lesson-contracts';

import type { ExerciseHostAdapter } from './exerciseAdapter';
import { FlashCardBuild } from './FlashCardBuild/FlashCardBuild';
import { FlashCardCategorize } from './FlashCardCategorize/FlashCardCategorize';
import { FlashCardChoose } from './FlashCardChoose/FlashCardChoose';
import { FlashCardDefinition } from './FlashCardDefinition/FlashCardDefinition';
import { FlashCardFindFix } from './FlashCardFindFix/FlashCardFindFix';
import { FlashCardJudge } from './FlashCardJudge/FlashCardJudge';
import { FlashCardMatch } from './FlashCardMatch/FlashCardMatch';
import { FlashCardRecallFill } from './FlashCardRecallFill/FlashCardRecallFill';
import { FlashCardWrite } from './FlashCardWrite/FlashCardWrite';
import type { FinishHandler } from './operationTypes';
import { UnsupportedFlashcardCard } from './UnsupportedFlashcardCard';

type ExerciseHostProps = {
  adapter: ExerciseHostAdapter;
  className?: string;
  desktopExpanded?: boolean;
  isSubmitting?: boolean;
  onFinished?: FinishHandler<ExerciseOutcome>;
};

function isSupportedSchemaVersion(version: string | null): boolean {
  return SUPPORTED_LESSON_PACKET_SCHEMA_VERSIONS.some(
    (supportedVersion) => supportedVersion === version,
  );
}

function isSupportedExercise(
  exercise: Exercise,
  schemaVersion: string | null,
): boolean {
  return (
    isSupportedSchemaVersion(schemaVersion) &&
    exercise?.kind === 'exercise' &&
    Object.values(FlashCardType).some(
      (type) =>
        type !== FlashCardType.DEFINITION && type === exercise.operation,
    )
  );
}

function renderUnsupportedExercise(
  adapter: ExerciseHostAdapter,
  isSubmitting: boolean | undefined,
) {
  const supportedSchema = isSupportedSchemaVersion(adapter.schemaVersion);
  return (
    <UnsupportedFlashcardCard
      cardType={
        supportedSchema
          ? adapter.cardType
          : `${adapter.cardType} (schema ${adapter.schemaVersion})`
      }
      isSubmitting={Boolean(isSubmitting)}
      onContinue={adapter.onUnsupported}
    />
  );
}

export function ExerciseHost({
  adapter,
  className = 'w-full',
  desktopExpanded,
  isSubmitting,
  onFinished,
}: ExerciseHostProps) {
  let exercise: Exercise;
  const { source } = adapter;

  if ('card' in source) {
    if (source.card.type === FlashCardType.DEFINITION) {
      return (
        <FlashCardDefinition
          allowRetry={adapter.allowRetry}
          card={source}
          className={className}
          desktopExpanded={desktopExpanded}
          isSubmitting={isSubmitting}
          onFinished={onFinished}
          wordForms={source.word_forms}
        />
      );
    }
    exercise = source.card.payload;
  } else {
    exercise = source;
  }

  if (!isSupportedExercise(exercise, adapter.schemaVersion)) {
    return renderUnsupportedExercise(adapter, isSubmitting);
  }

  return (
    <HostedExercise
      adapter={adapter}
      desktopExpanded={desktopExpanded}
      exercise={exercise}
      isSubmitting={isSubmitting}
      onFinished={onFinished}
    />
  );
}

type HostedExerciseProps = Omit<ExerciseHostProps, 'className'> & {
  exercise: Exercise;
};

function HostedExercise({
  adapter,
  desktopExpanded,
  exercise,
  isSubmitting,
  onFinished,
}: HostedExerciseProps) {
  const sharedProps = {
    allowRetry: adapter.allowRetry,
    desktopExpanded,
    isSubmitting,
    onFinished,
  };

  switch (exercise.operation) {
    case 'choose':
      return <FlashCardChoose {...sharedProps} exercise={exercise} />;
    case 'recall_fill':
      return <FlashCardRecallFill {...sharedProps} exercise={exercise} />;
    case 'match_pairs':
      return <FlashCardMatch {...sharedProps} exercise={exercise} />;
    case 'build':
      return <FlashCardBuild {...sharedProps} exercise={exercise} />;
    case 'judge':
      return <FlashCardJudge {...sharedProps} exercise={exercise} />;
    case 'find_fix':
      return <FlashCardFindFix {...sharedProps} exercise={exercise} />;
    case 'categorize':
      return <FlashCardCategorize {...sharedProps} exercise={exercise} />;
    case 'write':
      return (
        <HostedWrite {...sharedProps} adapter={adapter} exercise={exercise} />
      );
    default:
      return renderUnsupportedExercise(adapter, isSubmitting);
  }
}

function HostedWrite({
  adapter,
  allowRetry,
  desktopExpanded,
  exercise,
  isSubmitting,
  onFinished,
}: Omit<HostedExerciseProps, 'exercise'> & {
  exercise: WriteExercise;
  allowRetry: boolean;
}) {
  return (
    <FlashCardWrite
      allowRetry={allowRetry}
      desktopExpanded={desktopExpanded}
      draftOwnerKey={adapter.draftOwnerKey}
      exercise={exercise}
      isSubmitting={isSubmitting}
      judgeWrite={adapter.findWriteJudge(exercise)}
      legacyDraftOwnerKey={adapter.legacyDraftOwnerKey}
      onFinished={onFinished}
    />
  );
}
