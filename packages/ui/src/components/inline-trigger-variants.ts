import { cva } from 'class-variance-authority';

export const inlineTriggerVariants = cva(
  [
    'cursor-pointer radius-sm p-0 text-left decoration-dotted underline-offset-4 hover:underline focus-visible:underline',
    '[font:inherit] text-inherit',
    'transition-colors',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
  ],
  {
    variants: {
      current: {
        false: '',
        true: 'bg-selected text-selected',
      },
    },
    defaultVariants: { current: false },
  },
);
