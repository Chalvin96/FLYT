import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import {
  rowVariants,
  type RowLayout,
  type RowSize,
  type RowSurface,
} from './row-variants';

export type { RowLayout, RowSize, RowState, RowSurface } from './row-variants';

export type RowProps = Omit<ClosedProps<'button'>, 'type' | 'data-state'> & {
  /** Renders the caller's element as the row, the way `Button` composes with `Link`. */
  asChild?: boolean;
  layout?: RowLayout;
  size?: RowSize;
  surface?: RowSurface;
  selected?: boolean;
  insetFocusRing?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

function buildRowLabel(
  asChild: boolean,
  children: React.ReactNode,
): React.ReactNode {
  if (!asChild || !React.isValidElement(children)) {
    return children;
  }
  return (children.props as { children?: React.ReactNode }).children;
}

const Row = ({
  asChild = false,
  leading,
  insetFocusRing,
  layout,
  selected,
  size,
  surface,
  trailing,
  ...props
}: RowProps) => {
  const Component = asChild ? Slot : 'button';
  const content = (
    <>
      {leading === undefined ? null : (
        <span className="flex shrink-0 items-center">{leading}</span>
      )}
      <span className="min-w-0 flex-1">
        {buildRowLabel(asChild, props.children)}
      </span>
      {trailing === undefined ? null : (
        <span className="flex shrink-0 items-center gap-2">{trailing}</span>
      )}
    </>
  );

  const renderedChildren =
    asChild && React.isValidElement(props.children)
      ? React.cloneElement(
          props.children as React.ReactElement<Record<string, unknown>>,
          { className: undefined, style: undefined },
          content,
        )
      : content;

  return (
    <Component
      type={asChild ? undefined : 'button'}
      {...(selected === undefined
        ? {}
        : { 'data-state': selected ? 'selected' : 'idle' })}
      {...props}
      className={cn(
        rowVariants({ layout, size, surface, selected, insetFocusRing }),
      )}
      style={undefined}
    >
      {renderedChildren}
    </Component>
  );
};
Row.displayName = 'Row';

export { Row };
