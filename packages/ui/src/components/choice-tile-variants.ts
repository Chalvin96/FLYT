import { cva } from 'class-variance-authority';

import { TEXT_SIZE, TEXT_WEIGHT } from './text-variants';

/** Declaration order is load-bearing: resting, then selected, then unavailable. */
export const choiceTileVariants = cva(
  [
    'flex w-full cursor-pointer border transition-[background-color,border-color,color] duration-150 ease-out',
    'radius-field bg-raised text-default border-default',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
    'hover:border-hovered hover:bg-neutral-subtle',
    'aria-checked:border-selected aria-checked:bg-selected aria-checked:text-selected',
    'aria-pressed:border-selected aria-pressed:bg-selected aria-pressed:text-selected',
    'aria-disabled:cursor-not-allowed aria-disabled:border-default aria-disabled:bg-neutral aria-disabled:text-subtle',
    'aria-disabled:hover:border-default aria-disabled:hover:bg-neutral',
    'disabled:cursor-not-allowed disabled:border-default disabled:bg-neutral disabled:text-subtle',
  ],
  {
    variants: {
      layout: {
        /** Centred stat tile: icon over label over supporting lines. */
        stack: 'flex-col items-center gap-2 p-5 text-center',
        /** List row: label and description left-aligned, badge to the end. */
        row: 'flex-col gap-1 px-3 py-3 text-left',
        /** Segmented option in a single-line group. */
        inline: `min-h-11 flex-1 items-center justify-center px-3 text-center ${TEXT_SIZE.sm} ${TEXT_WEIGHT.semibold}`,
      },
    },
    defaultVariants: { layout: 'stack' },
  },
);
