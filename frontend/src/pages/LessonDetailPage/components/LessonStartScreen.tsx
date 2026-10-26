import { Button, Heading, Text } from '@flyt/ui';
import { Clock } from 'lucide-react';

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
              width="full"
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
              <Heading as="div" size="xxsmall" tone="subtle">
                Lesson
              </Heading>
              {lesson.cefr_level ? (
                <span className="inline-flex rounded-full border border-selected/40 bg-brand-subtle px-2 py-1">
                  <Text
                    as="span"
                    size="medium"
                    weight="semibold"
                    tone="default"
                  >
                    {lesson.cefr_level}
                  </Text>
                </span>
              ) : null}
            </div>
            <div className="mt-1">
              <Heading as="h1" size="xlarge">
                {lesson.title}
              </Heading>
            </div>
            {lesson.estimated_minutes ? (
              <p className="mt-3 inline-flex items-center gap-1">
                <Clock aria-hidden className="icon-sm" />
                <Text as="span" size="medium" tone="subtle">
                  ~{lesson.estimated_minutes} min
                </Text>
              </p>
            ) : null}
            {lesson.goal && (
              <div className="mt-3">
                <Text as="p" size="medium" smSize="large" tone="subtle">
                  {lesson.goal}
                </Text>
              </div>
            )}
          </div>
        </div>
      </ExerciseSheet>
    </div>
  );
}
