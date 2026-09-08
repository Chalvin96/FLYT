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
      className="flex w-full items-start gap-3 px-5 py-5 transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
        <p className="type-label text-muted-foreground/80">
          Lesson {lesson.order}
        </p>
        <h3 className="type-body font-semibold text-foreground">
          {lesson.title}
        </h3>
        {lesson.goal && (
          <p className="mt-2 type-caption text-muted-foreground">
            {stripInlineMarkdown(lesson.goal)}
          </p>
        )}
        {hasEstimate && (
          <p className="mt-2 inline-flex items-center gap-1 type-caption text-muted-foreground">
            <Clock aria-hidden className="icon-sm" />
            <span>~{lesson.estimated_minutes} min</span>
          </p>
        )}
      </div>

      <LessonStateLabel state={lesson.state} />
    </Link>
  );
}
