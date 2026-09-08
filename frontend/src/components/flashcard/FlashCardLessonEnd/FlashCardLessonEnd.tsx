import { Trophy } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';
import { ExerciseSheet } from '@/components/flashcard/ExerciseSheet';
import { cn, pluralize } from '@/lib/utils';

export interface FlashCardLessonEndProps {
  onFinished?: () => void;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  completedCount?: number;
}

export function FlashCardLessonEnd({
  onFinished,
  isSubmitting = false,
  className,
  desktopExpanded = false,
  completedCount,
}: FlashCardLessonEndProps) {
  return (
    <ExerciseSheet
      desktopExpanded={desktopExpanded}
      className={cn('h-full', className)}
      footer={
        onFinished ? (
          <div
            className={cn(
              'mx-auto w-full',
              desktopExpanded ? 'max-w-xl' : 'max-w-md',
            )}
          >
            <Button
              className="w-full"
              onClick={onFinished}
              disabled={isSubmitting}
              size="lg"
            >
              Finish
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className={cn(
            'mx-auto flex flex-col items-center gap-4 text-center sm:gap-6',
            desktopExpanded ? 'max-w-2xl' : 'max-w-md',
          )}
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-accent-10 text-accent-90">
            <Trophy className="icon-xl" />
          </span>
          <div className="space-y-2">
            <h2 className="type-title-lg font-semibold text-foreground">
              Lesson complete!
            </h2>
            <p className="type-caption leading-6 text-muted-foreground sm:type-body">
              {completedCount && completedCount > 0
                ? `Nice work — you finished ${pluralize(completedCount, 'exercise')}. They're now in your review queue.`
                : "You've finished all the cards in this lesson. They're now in your review queue."}
            </p>
          </div>
        </div>
      </div>
    </ExerciseSheet>
  );
}
