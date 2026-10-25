import { cva } from 'class-variance-authority';

/** Declaration order is load-bearing: `cn` keeps the last of two conflicting
 *  utilities, so each variant must be able to override the base. */
export const inputVariants = cva(
  [
    'flex w-full radius-field border border-strong-hovered bg-transparent px-3 py-1 text-base transition-colors',
    'file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-default placeholder:text-subtle',
    'outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[var(--border-focused)]',
    'disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled',
    'md:text-sm',
  ],
  {
    variants: {
      size: {
        md: 'h-9',
        lg: 'h-11',
      },
      presentation: {
        default: 'shadow-[var(--control-shadow-resting)]',
        solid: 'bg-overlay shadow-[var(--control-shadow-resting)]',
        quiet:
          'cursor-default border-default bg-neutral shadow-none focus-visible:border-default focus-visible:ring-0',
      },
      /** Room for a leading search glyph and a trailing clear or reveal control. */
      adornments: {
        none: '',
        leading: 'pl-9',
        both: 'pl-9 pr-12',
      },
    },
    defaultVariants: {
      size: 'md',
      presentation: 'default',
      adornments: 'none',
    },
  },
);
