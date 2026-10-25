import { cva } from 'class-variance-authority';

export type RowLayout = 'row' | 'inline';
export type RowSize = 'sm' | 'md' | 'lg';
export type RowSurface = 'plain' | 'framed' | 'outline';
export type RowState = 'idle' | 'selected';

/** Declaration order is load-bearing: geometry, then surface, then state. */
export const rowVariants = cva(
  [
    'group flex cursor-pointer items-center text-left transition-colors',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
    'aria-disabled:border-default aria-disabled:bg-neutral aria-disabled:text-subtle',
    'aria-disabled:hover:border-default aria-disabled:hover:bg-neutral',
    'aria-busy:cursor-wait aria-busy:bg-neutral-subtle aria-busy:text-subtle',
  ],
  {
    variants: {
      layout: {
        row: 'w-full',
        inline: 'w-auto shrink-0',
      },
      size: {
        sm: 'gap-3 rounded-[var(--radius-field)] px-3 py-2.5',
        md: 'min-h-20 gap-3 rounded-[var(--radius-section)] px-4 py-3',
        lg: 'gap-3 px-5 py-4',
      },
      surface: {
        plain: 'hover:bg-neutral',
        framed:
          'border border-default bg-raised shadow-soft hover:border-hovered hover:bg-neutral',
        outline: 'border border-default',
      },
      selected: {
        true: '',
        false: '',
      },
      insetFocusRing: {
        true: 'focus-visible:ring-inset focus-visible:ring-offset-0',
        false: '',
      },
    },
    compoundVariants: [
      {
        surface: 'plain',
        selected: true,
        class: 'bg-neutral-subtle text-default hover:bg-neutral-subtle',
      },
      {
        surface: 'outline',
        selected: true,
        class: 'border-selected bg-selected text-selected',
      },
    ],
    defaultVariants: {
      layout: 'row',
      size: 'lg',
      surface: 'plain',
      selected: false,
      insetFocusRing: false,
    },
  },
);
