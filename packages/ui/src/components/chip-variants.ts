import { cva } from 'class-variance-authority';

import { TEXT_SIZE, TEXT_WEIGHT } from './text-variants';

export const chipVariants = cva(
  [
    `inline-flex h-8 max-w-full shrink-0 cursor-pointer items-center gap-1.5 border px-3 ${TEXT_WEIGHT.semibold}`,
    `rounded-[var(--control-radius-pill)] ${TEXT_SIZE['xs-none']}`,
    'transition-[background-color,border-color,color] duration-150 ease-out',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
    'disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled',
    '[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        filter: [
          'border-strong bg-raised text-default',
          'hover:border-strong-hovered hover:bg-neutral-subtle active:bg-neutral-pressed',
          'aria-pressed:border-transparent aria-pressed:bg-neutral-bold aria-pressed:text-inverse',
          'aria-pressed:hover:bg-neutral-bold-hovered',
        ],
        suggestion: [
          'border-dashed border-strong bg-transparent text-subtle',
          'hover:border-selected hover:bg-neutral-subtle hover:text-default active:bg-neutral-pressed',
        ],
      },
    },
    defaultVariants: { variant: 'filter' },
  },
);
