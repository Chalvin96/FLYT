import { Button, Heading, Text } from '@flyt/ui';
import { Trophy } from 'lucide-react';
import type { ReactNode } from 'react';

import { ExerciseSheet } from '@/components/flashcard/ExerciseSheet';
import { cn, pluralize } from '@/lib/utils';

export interface FlashCardLessonEndProps {
  onPrimaryAction?: () => void;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  completedCount?: number;
  hasReviewCards?: boolean;
  primaryActionLabel?: string;
  secondaryAction?: ReactNode;
  errorMessage?: string;
}

export function FlashCardLessonEnd({
  onPrimaryAction,
  isSubmitting = false,
  className,
  desktopExpanded = false,
  completedCount,
  hasReviewCards = false,
  primaryActionLabel = 'Done',
  secondaryAction,
  errorMessage,
}: FlashCardLessonEndProps) {
  return (
    <ExerciseSheet
      desktopExpanded={desktopExpanded}
      className={cn('h-full', className)}
      footer={
        onPrimaryAction ? (
          <div
            className={cn(
              'mx-auto flex w-full flex-col items-center gap-3',
              desktopExpanded ? 'max-w-xl' : 'max-w-md',
            )}
          >
            {errorMessage ? (
              <div role="alert">
                <Text size="medium" tone="danger">
                  {errorMessage}
                </Text>
              </div>
            ) : null}
            <Button
              width="full"
              onClick={onPrimaryAction}
              disabled={isSubmitting}
              size="lg"
            >
              {primaryActionLabel}
            </Button>
            {secondaryAction}
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
          <span className="flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
            <Trophy className="icon-xl" />
          </span>
          <div className="space-y-2">
            <Heading as="h2" size="xlarge">
              Lesson complete!
            </Heading>
            <Text size="medium" smSize="large" tone="subtle">
              {completedCount && completedCount > 0
                ? `Nice work — you finished ${pluralize(completedCount, 'exercise')}.`
                : "You've finished all the cards in this lesson."}
              {hasReviewCards ? " They're now in your review queue." : null}
            </Text>
          </div>
        </div>
      </div>
    </ExerciseSheet>
  );
}
