import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap radius-field font-semibold transition-colors transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:icon-sm [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'shadow-raised border border-transparent bg-primary-70 text-white-100 hover:bg-primary-80',
        destructive:
          'shadow-raised border border-transparent bg-destructive text-white-100 hover:bg-destructive/90',
        outline:
          'shadow-soft border border-border bg-card text-foreground hover:bg-secondary-10',
        secondary:
          'shadow-soft border border-transparent bg-secondary-20 text-secondary-90 hover:bg-secondary-30',
        ghost:
          'bg-transparent text-muted-foreground hover:bg-secondary-10 hover:text-foreground',
        link: 'rounded-sm border-0 bg-transparent p-0 text-primary-70 transition-colors hover:text-primary-80',
        shadow:
          'shadow-raised border border-border bg-card text-foreground hover:bg-popover',
        pill: 'shadow-commit radius-pill border border-transparent bg-primary-70 px-6 text-white-100 hover:bg-primary-80',
      },
      size: {
        default: 'h-11 px-5 py-2 type-caption',
        sm: 'h-9 px-4 type-caption-sm',
        lg: 'h-12 px-6 type-body',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = ({
  asChild = false,
  className,
  size,
  variant,
  ref,
  ...props
}: ButtonProps) => {
  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  );
};

Button.displayName = 'Button';
