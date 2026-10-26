import { Heading, Text } from '@flyt/ui';
import { cva } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ExercisePrompt } from './ExercisePrompt';

// width-agnostic base; consumers set their own max-width.
export const flashCardPanelClassName =
  'radius-section shadow-raised mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden border border-default bg-raised';

const flashCardFooterBaseClassName = 'bg-raised px-4 py-3 sm:px-5';

export const flashCardFooterClassName = `border-t border-default ${flashCardFooterBaseClassName}`;

export type FlashCardFrameLayout = 'default' | 'fill';

const flashCardFrameVariants = cva(
  'radius-section shadow-raised mx-auto flex w-full flex-col overflow-hidden border border-default bg-raised',
  {
    variants: {
      height: {
        contained: 'h-full min-h-0',
        naturalMobile: 'h-auto min-h-max sm:h-full sm:min-h-0',
      },
      width: {
        panel: 'max-w-panel',
        expanded: 'max-w-4xl',
      },
      layout: {
        default: null,
        fill: 'flex-1',
      },
    },
    defaultVariants: {
      height: 'contained',
      width: 'panel',
      layout: 'default',
    },
  },
);

const flashCardBodyVariants = cva('flex flex-col px-4 py-4 sm:px-5 sm:py-5', {
  variants: {
    height: {
      contained: 'min-h-0 flex-1 overflow-y-auto',
      naturalMobile:
        'flex-none overflow-visible sm:min-h-0 sm:flex-1 sm:overflow-y-auto',
    },
  },
  defaultVariants: {
    height: 'contained',
  },
});

export interface FlashCardFrameProps extends Omit<
  ComponentProps<'div'>,
  'className' | 'style' | 'title'
> {
  eyebrow?: string;
  title?: ReactNode;
  description?: string;
  headerAccessory?: ReactNode;
  footer?: ReactNode;
  desktopExpanded?: boolean;
  headerless?: boolean;
  bodyFill?: boolean;
  /** Let long operation content grow the page instead of nesting a mobile scroll area. */
  naturalHeightOnMobile?: boolean;
  hasFooterDivider?: boolean;
  layout?: FlashCardFrameLayout;
  children: ReactNode;
}

export function FlashCardFrame({
  eyebrow,
  title,
  description,
  headerAccessory,
  footer,
  desktopExpanded = false,
  headerless = false,
  bodyFill = false,
  naturalHeightOnMobile = false,
  hasFooterDivider = true,
  layout,
  children,
  ...rootProps
}: FlashCardFrameProps) {
  const height = naturalHeightOnMobile ? 'naturalMobile' : 'contained';

  return (
    <div
      {...rootProps}
      className={cn(
        flashCardFrameVariants({
          height,
          width: desktopExpanded ? 'expanded' : 'panel',
          layout,
        }),
      )}
      style={undefined}
    >
      {headerless ? null : (
        <div className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-text">
              {eyebrow ? (
                <Heading as="div" size="xxsmall" tone="subtle">
                  {eyebrow}
                </Heading>
              ) : null}
              <ExercisePrompt>{title}</ExercisePrompt>
              {description ? (
                <div className="mt-1.5">
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
      )}

      {/* Centre with my-auto, not justify-center: flexbox clips the top of
          overflowing content and makes it unreachable. */}
      <div className={cn(flashCardBodyVariants({ height }))}>
        <div
          className={cn(
            'flex w-full flex-col gap-4',
            naturalHeightOnMobile
              ? 'min-h-max flex-none sm:min-h-0 sm:flex-1'
              : bodyFill
                ? 'min-h-0 flex-1'
                : 'my-auto',
          )}
        >
          {children}
        </div>
      </div>

      {footer ? (
        <div
          data-testid="flashcard-footer-bar"
          className={cn(
            flashCardFooterBaseClassName,
            hasFooterDivider && 'border-t border-default',
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
