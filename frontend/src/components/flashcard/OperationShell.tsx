import { Text } from '@flyt/ui';
import type { ComponentProps, ReactNode } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { StimulusView } from '@/components/portable/StimulusView';
import type { Exercise } from '@/types/lesson-contracts';

import { answerVerdictStatusText } from './answerVerdict';
import { FlashCardFrame, type FlashCardFrameLayout } from './FlashCardFrame';
import { OperationBannerSlot, OperationHeader } from './OperationShellBody';
import { OperationFooterBar } from './OperationShellFooter';
import {
  type ExerciseAttemptView,
  type OperationShellView,
} from './operationShellView';
import { useOperationShellState } from './useOperationShellState';

export const stimulusSentenceClassName =
  'radius-field border border-default bg-neutral p-4 text-balance';

type OperationShellProps = Omit<
  ComponentProps<'div'>,
  'className' | 'style'
> & {
  exercise: Exercise;
  attempt: ExerciseAttemptView;
  layout?: FlashCardFrameLayout;
  desktopExpanded?: boolean;
  isSubmitting?: boolean;
  canCheck?: boolean;
  statusHint?: string;
  instruction?: ReactNode;
  wrongHint?: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  alternativeActions?: ReactNode;
  onCheck: () => void;
  onContinue?: () => void;
  children: ReactNode;
};

export function OperationFeedback({
  exercise,
  reserved,
  view,
}: {
  exercise: Exercise;
  reserved: boolean;
  view: OperationShellView;
}) {
  return (
    <>
      <OperationBannerSlot
        bannerVerdict={view.bannerVerdict}
        hasBanner={view.hasBanner}
        reserved={reserved}
        resultHint={view.resultHint}
      />
      {view.showExplanation && exercise.explanation ? (
        <div
          className="radius-field border border-default bg-neutral p-3"
          data-testid="exercise-explanation"
        >
          <Text as="div" size="medium" tone="subtle">
            <SpanView spans={exercise.explanation} />
          </Text>
        </div>
      ) : null}
    </>
  );
}

export function OperationShell({
  attempt,
  exercise,
  layout,
  desktopExpanded,
  isSubmitting,
  canCheck = true,
  statusHint,
  instruction,
  wrongHint,
  pending = false,
  pendingLabel = 'Checking…',
  alternativeActions,
  onCheck,
  onContinue,
  children,
  ...frameProps
}: OperationShellProps) {
  const { view, footerView, continueRef, reducedMotion } =
    useOperationShellState({
      attempt,
      exercise,
      canCheck,
      isSubmitting,
      pending,
      pendingLabel,
      statusHint,
      wrongHint,
      onCheck,
      onContinue,
    });

  return (
    <FlashCardFrame
      {...frameProps}
      bodyFill
      desktopExpanded={desktopExpanded}
      footer={
        <OperationFooterBar
          ariaLive={view.ariaLive}
          continueRef={continueRef}
          alternativeActions={alternativeActions}
          footerView={footerView}
          reducedMotion={reducedMotion}
          status={view.status}
          statusFirstOnMobile={false}
          statusVerdict={view.statusVerdict}
        />
      }
      hasFooterDivider={false}
      headerless
      layout={layout}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        data-testid="operation-body"
      >
        {exercise.stimulus?.length ? (
          <div className="mb-4">
            <StimulusView blocks={exercise.stimulus} />
          </div>
        ) : null}

        <OperationHeader exercise={exercise} instruction={instruction} />

        <div
          className="flex min-h-max w-full flex-1 flex-col gap-4 sm:radius-section sm:min-h-[18rem] sm:surface-mat sm:justify-center sm:p-6"
          data-testid="work-surface"
        >
          {children}

          <OperationFeedback exercise={exercise} reserved view={view} />
        </div>

        {view.bannerVerdict === 'wrong-flash' ? (
          <p
            className="sr-only"
            key={`sr-retry-announce-${attempt.kind === 'retry' ? attempt.shakeKey : 0}`}
            role="alert"
          >
            {answerVerdictStatusText['wrong-flash']}
          </p>
        ) : null}
      </div>
    </FlashCardFrame>
  );
}
