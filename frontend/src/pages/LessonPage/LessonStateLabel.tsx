import { Heading } from '@flyt/ui';

import { cn } from '@/lib/utils';
import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_STATE } from './constants';

type LessonStateLabelProps = {
  state: LessonSummaryRead['state'];
  className?: string;
};

function getStateText(state: LessonSummaryRead['state']) {
  switch (state) {
    case K_LESSON_STATE.COMPLETED:
      return 'Completed';
    case K_LESSON_STATE.IN_PROGRESS:
      return 'In progress';
    case K_LESSON_STATE.NOT_STARTED:
      return 'Not started';
  }
}

function getStateToneClassName(state: LessonSummaryRead['state']) {
  switch (state) {
    case K_LESSON_STATE.COMPLETED:
      return 'bg-neutral-pressed text-default';
    case K_LESSON_STATE.IN_PROGRESS:
      return 'bg-selected-hovered text-selected';
    case K_LESSON_STATE.NOT_STARTED:
      return 'bg-disabled text-disabled';
  }
}

export function LessonStateLabel({ state, className }: LessonStateLabelProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5',
        getStateToneClassName(state),
        className,
      )}
    >
      <Heading as="span" size="xxsmall">
        {getStateText(state)}
      </Heading>
    </span>
  );
}
