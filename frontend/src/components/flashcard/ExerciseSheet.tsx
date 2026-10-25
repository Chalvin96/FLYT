import { Text } from '@flyt/ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ExercisePrompt } from './ExercisePrompt';

export const exerciseSheetFooterClassName = 'border-t border-default pt-5';

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
        'shadow-raised radius-section mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden border border-default bg-raised px-4 sm:px-5',
        maxWidthClassName ?? (desktopExpanded ? 'max-w-4xl' : 'max-w-panel'),
        className,
      )}
    >
      {hasHeader ? (
        <div className="border-b border-default pb-5 pt-4 sm:pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-text">
              {title ? <ExercisePrompt>{title}</ExercisePrompt> : null}
              {description ? (
                <div className="mt-2.5">
                  <Text as="p" size="medium" tone="subtle">
                    {description}
                  </Text>
                </div>
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
