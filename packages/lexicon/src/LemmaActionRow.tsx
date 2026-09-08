import { Button } from '@flyt/ui';

import type { LemmaAction, LemmaActionState } from './types';

export interface LemmaActionBehavior {
  showStateLabels?: boolean;
  disableKnowWhenLearning?: boolean;
  disableAddWhenLearning?: boolean;
  disableAddWhenMastered?: boolean;
  disableOtherActionWhilePending?: boolean;
}

export interface LemmaActionRowProps {
  state: LemmaActionState;
  onMarkKnown: () => void | Promise<void>;
  onAddToReview: () => void | Promise<void>;
  isSubmitting?: boolean;
  pendingAction?: LemmaAction;
  behavior?: LemmaActionBehavior;
  knowLabel?: string;
  addLabel?: string;
  className?: string;
}

function resolveLabels(
  state: LemmaActionState,
  pendingAction: LemmaAction | undefined,
  showStateLabels: boolean,
  knowLabel: string | undefined,
  addLabel: string | undefined,
) {
  if (pendingAction === 'know')
    return { know: 'Saving...', add: addLabel ?? '+ Add' };
  if (pendingAction === 'add')
    return { know: knowLabel ?? 'I know this', add: 'Saving...' };
  return {
    know:
      showStateLabels && state === 'mastered'
        ? 'Known'
        : (knowLabel ?? 'I know this'),
    add:
      showStateLabels && state === 'learning' ? 'Added' : (addLabel ?? '+ Add'),
  };
}

function resolveDisabled(
  state: LemmaActionState,
  pendingAction: LemmaAction | undefined,
  isSubmitting: boolean,
  behavior: Required<LemmaActionBehavior>,
) {
  const otherActionPending =
    behavior.disableOtherActionWhilePending && pendingAction !== undefined;
  return {
    know:
      isSubmitting ||
      pendingAction === 'know' ||
      otherActionPending ||
      state === 'mastered' ||
      (behavior.disableKnowWhenLearning && state === 'learning'),
    add:
      isSubmitting ||
      pendingAction === 'add' ||
      otherActionPending ||
      (behavior.disableAddWhenMastered && state === 'mastered') ||
      (state === 'learning' &&
        (behavior.disableAddWhenLearning || !behavior.showStateLabels)),
  };
}

export function LemmaActionRow({
  state,
  onMarkKnown,
  onAddToReview,
  isSubmitting = false,
  pendingAction,
  behavior,
  knowLabel: knowLabelProp,
  addLabel: addLabelProp,
  className,
}: LemmaActionRowProps) {
  const resolvedBehavior: Required<LemmaActionBehavior> = {
    showStateLabels: behavior?.showStateLabels ?? true,
    disableKnowWhenLearning: behavior?.disableKnowWhenLearning ?? true,
    disableAddWhenLearning: behavior?.disableAddWhenLearning ?? true,
    disableAddWhenMastered: behavior?.disableAddWhenMastered ?? true,
    disableOtherActionWhilePending:
      behavior?.disableOtherActionWhilePending ?? false,
  };
  const labels = resolveLabels(
    state,
    pendingAction,
    resolvedBehavior.showStateLabels,
    knowLabelProp,
    addLabelProp,
  );
  const disabled = resolveDisabled(
    state,
    pendingAction,
    isSubmitting,
    resolvedBehavior,
  );

  return (
    <div className={className ?? 'grid grid-cols-2 gap-3'}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled.know}
        onClick={onMarkKnown}
      >
        {labels.know}
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={disabled.add}
        onClick={onAddToReview}
      >
        {labels.add}
      </Button>
    </div>
  );
}
