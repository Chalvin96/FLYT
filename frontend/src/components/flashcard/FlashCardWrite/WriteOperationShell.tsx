import type { ReactNode } from 'react';

import { StimulusView } from '@/components/portable/StimulusView';
import type { OperationResult } from '@/lib/operationResult';
import type { WriteExercise } from '@/types/lesson-contracts';

import { FlashCardFrame, type FlashCardFrameLayout } from '../FlashCardFrame';
import { OperationFeedback } from '../OperationShell';
import { OperationInstruction, OperationTitle } from '../OperationShellBody';
import { OperationFooterBar } from '../OperationShellFooter';
import { useOperationShellState } from '../useOperationShellState';

type WriteOperationShellProps = {
  exercise: WriteExercise;
  result: OperationResult | null;
  layout?: FlashCardFrameLayout;
  desktopExpanded?: boolean;
  isSubmitting?: boolean;
  canCheck: boolean;
  statusHint?: string;
  instruction?: ReactNode;
  alternativeActions: ReactNode;
  pending: boolean;
  onCheck: () => void;
  onContinue: () => void;
  children: ReactNode;
};

export function WriteOperationShell({
  exercise,
  result,
  layout,
  desktopExpanded,
  isSubmitting,
  canCheck,
  statusHint,
  instruction,
  alternativeActions,
  pending,
  onCheck,
  onContinue,
  children,
}: WriteOperationShellProps) {
  const { view, footerView, continueRef, reducedMotion } =
    useOperationShellState({
      attempt: { kind: 'single', result },
      exercise,
      canCheck,
      isSubmitting,
      ownsResultFeedback: true,
      pending,
      pendingLabel: 'Checking…',
      statusHint,
      onCheck,
      onContinue,
    });

  return (
    <FlashCardFrame
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
          statusFirstOnMobile
          statusVerdict={view.statusVerdict}
        />
      }
      hasFooterDivider={false}
      headerless
      layout={layout}
      naturalHeightOnMobile
    >
      <div
        className="flex min-h-max flex-none flex-col sm:min-h-0 sm:flex-1"
        data-testid="operation-body"
      >
        {exercise.stimulus?.length ? (
          <div className="mb-4">
            <StimulusView blocks={exercise.stimulus} />
          </div>
        ) : null}

        <div
          className="mb-4 flex flex-col gap-3"
          data-testid="operation-header"
        >
          <div className="flex flex-col gap-1">
            <OperationTitle exercise={exercise} />
          </div>
          <OperationInstruction>{instruction}</OperationInstruction>
        </div>

        <div
          className="flex min-h-max w-full flex-1 flex-col gap-4 sm:radius-section sm:min-h-[18rem] sm:surface-mat sm:p-6"
          data-testid="work-surface"
        >
          {children}
          <OperationFeedback exercise={exercise} reserved={false} view={view} />
        </div>
      </div>
    </FlashCardFrame>
  );
}
