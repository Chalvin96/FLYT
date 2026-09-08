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
        toneClassName: 'bg-secondary-20 text-secondary-90',
      };
    case K_LESSON_STATE.IN_PROGRESS:
      return {
        icon: PlayCircle,
        toneClassName: 'bg-primary-20 text-primary-90',
      };
    case K_LESSON_STATE.NOT_STARTED:
      return {
        icon: Circle,
        toneClassName: 'bg-black-10 text-black-50',
      };
  }

  return assertNever(state);
}
