import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// width-agnostic base; consumers set their own max-width.
export const flashCardPanelClassName =
  'radius-section shadow-raised mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden border border-border bg-card';

const flashCardFooterBaseClassName = 'bg-card px-4 py-3 sm:px-5';

export const flashCardFooterClassName = `border-t border-border ${flashCardFooterBaseClassName}`;

interface FlashCardFrameProps {
  eyebrow?: string;
  title?: ReactNode;
  description?: string;
  headerAccessory?: ReactNode;
  footer?: ReactNode;
  desktopExpanded?: boolean;
  /**
   * Skip the built-in editorial header. Operation exercises relocate the
   * eyebrow + prompt into a left "brief" rail alongside the work surface,
   * so they render headerless and own that composition themselves.
   */
  headerless?: boolean;
  /**
   * Stretch the body column instead of centring it. Operation cards fill the
   * card so their work surface meets the footer; passive surfaces keep the
   * centred shrink-wrap.
   */
  bodyFill?: boolean;
  /** Let long operation content grow the page instead of nesting a mobile scroll area. */
  naturalHeightOnMobile?: boolean;
  hasFooterDivider?: boolean;
  className?: string;
  bodyClassName?: string;
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
  className,
  bodyClassName,
  children,
}: FlashCardFrameProps) {
  return (
    <div
      className={cn(
        'radius-section shadow-raised mx-auto flex w-full flex-col overflow-hidden border border-border bg-card',
        naturalHeightOnMobile
          ? 'h-auto min-h-max sm:h-full sm:min-h-0'
          : 'h-full min-h-0',
        desktopExpanded ? 'max-w-4xl' : 'max-w-panel',
        className,
      )}
    >
      {/* Editorial prompt header: display eyebrow + large prompt */}
      {headerless ? null : (
        <div className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-text">
              {eyebrow ? (
                <p className="font-display type-label leading-flat text-muted-foreground">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="font-display text-prompt font-semibold leading-prompt text-foreground">
                {title}
              </h2>
              {description ? (
                <p className="type-caption mt-1.5 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {headerAccessory ? (
              <div className="shrink-0">{headerAccessory}</div>
            ) : null}
          </div>
        </div>
      )}

      {/*
        Body: a scroll container wrapping a my-auto centering column.
        Short content shrink-wraps and centers vertically via auto
        margins (no bottom void, no overflow clipping); tall content
        grows past the viewport and scrolls. Using my-auto instead of
        justify-center avoids the flexbox overflow-clipping bug where
        the top of tall content becomes unreachable.
      */}
      <div
        className={cn(
          naturalHeightOnMobile
            ? 'flex flex-none flex-col overflow-visible px-4 py-4 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:px-5 sm:py-5'
            : 'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5 sm:py-5',
          bodyClassName,
        )}
      >
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
            hasFooterDivider && 'border-t border-border',
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
