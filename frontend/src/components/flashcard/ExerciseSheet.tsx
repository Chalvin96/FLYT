import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const exerciseSheetFooterClassName = 'border-t border-border pt-5';

interface ExerciseSheetProps {
  title?: string;
  description?: string;
  headerAccessory?: ReactNode;
  footer?: ReactNode;
  desktopExpanded?: boolean;
  className?: string;
  bodyClassName?: string;
  maxWidthClassName?: string;
  children: ReactNode;
}

export function ExerciseSheet({
  title,
  description,
  headerAccessory,
  footer,
  desktopExpanded = false,
  className,
  bodyClassName,
  maxWidthClassName,
  children,
}: ExerciseSheetProps) {
  const hasHeader = Boolean(title || description || headerAccessory);

  return (
    <section
      className={cn(
        'shadow-raised radius-section mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden border border-border bg-card px-4 sm:px-5',
        maxWidthClassName ?? (desktopExpanded ? 'max-w-4xl' : 'max-w-panel'),
        className,
      )}
    >
      {hasHeader ? (
        <div className="border-b border-border pb-5 pt-4 sm:pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-text">
              {title ? (
                <h2 className="text-prompt font-medium leading-prompt text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="type-caption mt-2.5 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {headerAccessory ? (
              <div className="shrink-0">{headerAccessory}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn('flex min-h-0 flex-1 flex-col py-5', bodyClassName)}>
        {children}
      </div>

      {footer ? (
        <div className={cn(exerciseSheetFooterClassName, 'pb-4 sm:pb-5')}>
          {footer}
        </div>
      ) : null}
    </section>
  );
}
