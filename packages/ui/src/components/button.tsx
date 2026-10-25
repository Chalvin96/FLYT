import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { buttonVariants } from './button-variants';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'inverse' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
export type ButtonShape = 'rounded' | 'pill';
export type ButtonWidth = 'auto' | 'full' | 'full-on-mobile';
export type ButtonAlign = 'center' | 'start';

export type ButtonProps = ClosedProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  width?: ButtonWidth;
  align?: ButtonAlign;
  asChild?: boolean;
};

const Button = ({
  align,
  asChild = false,
  shape,
  size,
  variant,
  width,
  ...props
}: ButtonProps) => {
  const Component = asChild ? Slot : 'button';
  // Slot merges a child's className and style onto the surface, so strip them;
  // cloneElement merges rather than replaces, hence the explicit undefined.
  const content =
    asChild && React.isValidElement(props.children)
      ? React.cloneElement(
          props.children as React.ReactElement<Record<string, unknown>>,
          { className: undefined, style: undefined },
        )
      : props.children;

  return (
    // Order is load-bearing: props spread first so the recipe below always wins.
    <Component
      {...props}
      className={cn(buttonVariants({ variant, size, shape, width, align }))}
      style={undefined}
    >
      {content}
    </Component>
  );
};
Button.displayName = 'Button';

export { Button };
