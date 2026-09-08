import type { ReactNode } from 'react';

import { AppCard } from '@/components/common/AppCard/AppCard';

export function LessonEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AppCard className="mx-auto w-full max-w-md p-6">
      <p className="type-caption text-muted-foreground">Lessons</p>
      <h1 className="mt-2 type-title-lg font-semibold text-foreground">
        {title}
      </h1>
      <p className="mt-3 type-caption leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </AppCard>
  );
}
