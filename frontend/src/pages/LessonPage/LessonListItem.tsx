import { Heading, Text } from '@flyt/ui';
import { Clock } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { cn, stripInlineMarkdown } from '@/lib/utils';
import type { LessonSummaryRead } from '@/types/api';

import { LessonStateLabel } from './LessonStateLabel';
import { getLessonStateMeta } from './LessonStateMeta';

export function LessonListItem({ lesson }: { lesson: LessonSummaryRead }) {
  const stateMeta = getLessonStateMeta(lesson.state);
  const Icon = stateMeta.icon;
  const hasEstimate =
    lesson.estimated_minutes != null && lesson.estimated_minutes > 0;

  return (
    <Link
      to="/lesson/$lessonId"
      params={{ lessonId: String(lesson.id) }}
      className="flex w-full flex-wrap items-start gap-3 px-5 py-5 transition-colors hover:bg-neutral-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--border-focused)] sm:flex-nowrap"
    >
      <span
        className={cn(
          'mt-1 flex size-10 shrink-0 items-center justify-center rounded-full',
          stateMeta.toneClassName,
        )}
      >
        <Icon className="icon-md" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-subtle/80">
          <Heading as="span" size="xxsmall">
            Lesson {lesson.order}
          </Heading>
        </p>
        <Heading as="h3" size="small" tone="default">
          {lesson.title}
        </Heading>
        {lesson.goal && (
          <div className="mt-2">
            <Text size="medium" tone="subtle">
              {stripInlineMarkdown(lesson.goal)}
            </Text>
          </div>
        )}
        {hasEstimate && (
          <p className="mt-2 inline-flex items-center gap-1">
            <Clock aria-hidden className="icon-sm text-subtle" />
            <Text as="span" size="medium" tone="subtle">
              ~{lesson.estimated_minutes} min
            </Text>
          </p>
        )}
      </div>

      <div className="ml-13 flex basis-full sm:ml-0 sm:basis-auto">
        <LessonStateLabel state={lesson.state} />
      </div>
    </Link>
  );
}
