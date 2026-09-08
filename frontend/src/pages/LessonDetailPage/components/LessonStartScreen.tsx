import { Clock } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';
import { ExerciseSheet } from '@/components/flashcard/ExerciseSheet';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { cn } from '@/lib/utils';
import type { LessonDetailRead } from '@/types/api';

type LessonStartScreenProps = {
  lesson: LessonDetailRead;
  isSubmitting: boolean;
  onStart: () => void;
};

export function LessonStartScreen({
  lesson,
  isSubmitting,
  onStart,
}: LessonStartScreenProps) {
  const isDesktop = useIsDesktop();
  const footerClassName = isDesktop ? 'max-w-xl' : 'max-w-md';
  const contentClassName = isDesktop ? 'max-w-3xl' : 'max-w-md';

  return (
    <div className="container-max mx-auto flex h-full w-full flex-col pb-4">
      <ExerciseSheet
        desktopExpanded={isDesktop}
        bodyClassName="overflow-y-auto"
        footer={
          <div className={cn('mx-auto w-full', footerClassName)}>
            <Button
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
              onClick={onStart}
              size="lg"
            >
              {isSubmitting ? 'Starting…' : 'Start lesson'}
            </Button>
          </div>
        }
      >
        <div
          className={cn(
            'mx-auto flex min-h-full w-full flex-col justify-center gap-4 sm:gap-6',
            contentClassName,
          )}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="type-label text-muted-foreground">Lesson</p>
              {lesson.cefr_level ? (
                <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-1 type-caption font-semibold text-foreground">
                  {lesson.cefr_level}
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 type-title-lg font-semibold text-foreground">
              {lesson.title}
            </h1>
            {lesson.estimated_minutes ? (
              <p className="mt-3 inline-flex items-center gap-1 type-caption text-muted-foreground">
                <Clock aria-hidden className="icon-sm" />
                <span>~{lesson.estimated_minutes} min</span>
              </p>
            ) : null}
            {lesson.goal && (
              <p className="mt-3 type-caption leading-6 text-muted-foreground sm:type-body">
                {lesson.goal}
              </p>
            )}
          </div>
        </div>
      </ExerciseSheet>
    </div>
  );
}
