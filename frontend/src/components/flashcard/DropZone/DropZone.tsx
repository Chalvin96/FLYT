import { useDroppable } from '@dnd-kit/core';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { verdictDropTargetClass } from '../answerVerdict';

export interface DropZoneProps extends Omit<
  React.ComponentProps<'div'>,
  'id' | 'children' | 'className' | 'ref'
> {
  /** dnd-kit droppable identifier. Must be unique within the DndContext. */
  id: string;
  /**
   * Optional override for the drag-over highlight. When provided, takes
   * precedence over the hook-computed `isOver` value. Used by tap-to-place
   * callers to visually highlight a target when a chip is armed.
   */
  isOver?: boolean;
  /** Dropped chips / content rendered inside the zone. */
  children?: React.ReactNode;
  /** Optional className for layout overrides. */
  className?: string;
  /**
   * Optional accessible label (rendered as aria-label). Falls back to the
   * consumer-supplied aria-label from ...props if not set.
   */
  label?: string;
  /** `target` marks an empty placement slot. */
  tone?: 'default' | 'target';
}

export function DropZone({
  id,
  label,
  isOver,
  children,
  className,
  tone = 'default',
  ...props
}: DropZoneProps) {
  const { setNodeRef, isOver: isOverFromHook } = useDroppable({ id });
  const highlighted = isOver ?? isOverFromHook;
  const interactive = typeof props.onClick === 'function';

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || !interactive) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid="drop-zone"
      data-over={highlighted}
      data-dropzone-id={id}
      aria-label={label}
      role={interactive ? 'button' : props.role}
      tabIndex={interactive ? 0 : props.tabIndex}
      className={cn(
        'radius-field flex min-h-[3rem] min-w-0 flex-wrap items-start gap-2 border border-dashed border-default bg-raised p-3 transition-colors',
        interactive && 'cursor-pointer',
        className,
        tone === 'target' && !highlighted && 'bg-neutral-subtle',
        highlighted && verdictDropTargetClass,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
}

DropZone.displayName = 'DropZone';
