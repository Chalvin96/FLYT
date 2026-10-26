import { CheckCircle2, Circle, PlayCircle } from 'lucide-react';

import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_STATE } from './constants';

function assertNever(value: never): never {
  throw new Error(`Unknown lesson state: ${String(value)}`);
}

export function getLessonStateMeta(state: LessonSummaryRead['state']) {
  switch (state) {
    case K_LESSON_STATE.COMPLETED:
      return {
        icon: CheckCircle2,
        toneClassName: 'bg-neutral-pressed text-default',
      };
    case K_LESSON_STATE.IN_PROGRESS:
      return {
        icon: PlayCircle,
        toneClassName: 'bg-selected-hovered text-selected',
      };
    case K_LESSON_STATE.NOT_STARTED:
      return {
        icon: Circle,
        toneClassName: 'bg-disabled text-disabled',
      };
  }

  return assertNever(state);
}
