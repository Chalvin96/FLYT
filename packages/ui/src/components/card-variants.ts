import { cva } from 'class-variance-authority';

export const cardVariants = cva(
  'radius-section border border-default text-default',
  {
    variants: {
      elevation: {
        flat: 'shadow-none',
        raised: 'shadow-raised',
      },
      surface: {
        default: 'bg-raised',
        solid: 'bg-overlay',
        brand: 'bg-brand-subtle',
        warning: 'border-warning-subtle bg-warning-subtle',
        danger: 'border-danger-subtle bg-danger-subtle',
      },
      padding: {
        none: 'p-0',
        compact: 'p-4 sm:p-5',
        default: 'p-5 sm:p-6',
        roomy: 'p-6 sm:p-8',
      },
      /** Answers the hover and focus of a wrapper carrying `group`. */
      groupInteractive: {
        true: 'transition-[border-color,background-color] duration-200 group-hover:border-selected group-focus-visible:ring-2 group-focus-visible:ring-[var(--border-focused)] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--background-neutral)]',
        false: '',
      },
      clipContent: { true: 'overflow-hidden', false: '' },
      fillHeight: { true: 'flex h-full min-h-0 flex-1 flex-col', false: '' },
    },
    defaultVariants: {
      elevation: 'raised',
      surface: 'default',
      padding: 'default',
      groupInteractive: false,
      clipContent: false,
      fillHeight: false,
    },
  },
);
