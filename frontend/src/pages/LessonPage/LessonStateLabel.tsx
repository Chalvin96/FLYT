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
      return 'bg-secondary-20 text-secondary-90';
    case K_LESSON_STATE.IN_PROGRESS:
      return 'bg-primary-20 text-primary-90';
    case K_LESSON_STATE.NOT_STARTED:
      return 'bg-black-10 text-black-50';
  }
}

export function LessonStateLabel({ state, className }: LessonStateLabelProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full type-label-sm',
        'px-2 py-0.5',
        getStateToneClassName(state),
        className,
      )}
    >
      {getStateText(state)}
    </span>
  );
}
