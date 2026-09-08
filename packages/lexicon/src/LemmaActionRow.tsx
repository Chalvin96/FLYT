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
  const {
    showStateLabels = true,
    disableKnowWhenLearning = true,
    disableAddWhenLearning = true,
    disableAddWhenMastered = true,
    disableOtherActionWhilePending = false,
  } = behavior ?? {};
  const knowPending = isSubmitting || pendingAction === 'know';
  const addPending = isSubmitting || pendingAction === 'add';
  const knowLabel =
    pendingAction === 'know'
      ? 'Saving...'
      : showStateLabels && state === 'mastered'
        ? 'Known'
        : (knowLabelProp ?? 'I know this');
  const addLabel =
    pendingAction === 'add'
      ? 'Saving...'
      : showStateLabels && state === 'learning'
        ? 'Added'
        : (addLabelProp ?? '+ Add');

  const knowDisabled =
    knowPending ||
    (disableOtherActionWhilePending && pendingAction !== undefined) ||
    state === 'mastered' ||
    (disableKnowWhenLearning && state === 'learning');
  const addDisabled =
    addPending ||
    (disableOtherActionWhilePending && pendingAction !== undefined) ||
    (disableAddWhenMastered && state === 'mastered') ||
    (state === 'learning' && (disableAddWhenLearning || !showStateLabels));

  return (
    <div className={className ?? 'grid grid-cols-2 gap-3'}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={knowDisabled}
        onClick={onMarkKnown}
      >
        {knowLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={addDisabled}
        onClick={onAddToReview}
      >
        {addLabel}
      </Button>
    </div>
  );
}
