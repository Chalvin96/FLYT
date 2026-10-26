import { Glyph, Heading, Text } from '@flyt/ui';
import type { ReactNode } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { cn, sentenceCaseLabel } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import type { BannerVerdict } from './answerVerdict';
import { answerVerdictStatusText, verdictBannerClass } from './answerVerdict';
import { ExercisePrompt } from './ExercisePrompt';

function PromptHeading({ exercise }: { exercise: Exercise }) {
  return (
    <div className="text-balance">
      <ExercisePrompt data-testid="exercise-prompt">
        <SpanView spans={exercise.prompt} />
      </ExercisePrompt>
    </div>
  );
}

export function OperationTitle({ exercise }: { exercise: Exercise }) {
  return (
    <div className="text-balance">
      <ExercisePrompt>
        {sentenceCaseLabel(exercise.operation, 'slug')}
      </ExercisePrompt>
    </div>
  );
}

function OperationLabel({ exercise }: { exercise: Exercise }) {
  return (
    <Heading as="div" size="xxsmall" tone="subtle">
      {sentenceCaseLabel(exercise.operation, 'slug')}
    </Heading>
  );
}

export function OperationHeader({
  exercise,
  instruction,
}: {
  exercise: Exercise;
  instruction?: ReactNode;
}) {
  const hasPrompt = exercise.prompt.length > 0;

  return (
    <div className="mb-4 flex flex-col gap-3" data-testid="operation-header">
      <div className="flex flex-col gap-1">
        {!hasPrompt ? (
          <OperationTitle exercise={exercise} />
        ) : (
          <>
            <OperationLabel exercise={exercise} />
            <PromptHeading exercise={exercise} />
          </>
        )}
      </div>
      <OperationInstruction>{instruction}</OperationInstruction>
    </div>
  );
}

export function OperationInstruction({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-brand-subtle bg-brand-subtle text-selected italic"
      >
        <Glyph font="serif" size="2xs" weight="semibold">
          i
        </Glyph>
      </span>
      <Text size="medium" tone="subtle">
        {children}
      </Text>
    </div>
  );
}

export function OperationBannerSlot({
  bannerVerdict,
  hasBanner,
  reserved,
  resultHint,
}: {
  bannerVerdict: BannerVerdict | null;
  hasBanner: boolean;
  reserved: boolean;
  resultHint: ReactNode;
}) {
  if (!hasBanner && !reserved) {
    return null;
  }

  const isAnnouncedBanner =
    bannerVerdict === 'revealed' ||
    bannerVerdict === 'correct' ||
    bannerVerdict === 'incorrect';

  return (
    <div
      {...(isAnnouncedBanner ? { role: 'status' } : {})}
      aria-hidden={!hasBanner}
      className={cn(
        'radius-field border p-3',
        bannerVerdict === null
          ? 'invisible'
          : verdictBannerClass[bannerVerdict],
      )}
      data-testid="operation-banner"
    >
      <Text as="div" size="medium">
        <BannerContent
          bannerVerdict={bannerVerdict}
          hasBanner={hasBanner}
          resultHint={resultHint}
        />
      </Text>
    </div>
  );
}

function BannerContent({
  bannerVerdict,
  hasBanner,
  resultHint,
}: {
  bannerVerdict: BannerVerdict | null;
  hasBanner: boolean;
  resultHint: ReactNode;
}) {
  if (bannerVerdict === 'wrong-flash') {
    return <>{answerVerdictStatusText['wrong-flash']}</>;
  }
  if (bannerVerdict === 'revealed') {
    return <>Here's the answer.</>;
  }
  if (bannerVerdict === 'correct') {
    return <>Correct</>;
  }
  if (bannerVerdict === 'incorrect') {
    return (
      <>
        Not quite
        {resultHint ? <p className="mt-1 text-default">{resultHint}</p> : null}
      </>
    );
  }
  return <>{!hasBanner && ' '}</>;
}
