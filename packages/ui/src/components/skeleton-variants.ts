import { cva } from 'class-variance-authority';

export const skeletonVariants = cva(
  'motion-safe:animate-pulse bg-brand-subtle',
  {
    variants: {
      variant: {
        text: 'rounded-[var(--radius-sm)]',
        heading: 'rounded-[var(--radius-sm)]',
        // Radius lives here, not in the compounds below, so a caller's explicit
        // `shape` is emitted afterwards and wins.
        control: 'w-full radius-field',
        block: 'size-full',
      },
      size: {
        sm: '',
        md: '',
        lg: '',
        xl: '',
        '2xl': '',
        '3xl': '',
      },
      length: {
        short: 'w-[var(--skeleton-length-short)] max-w-full',
        medium: 'w-[var(--skeleton-length-medium)] max-w-full',
        long: 'w-[var(--skeleton-length-long)] max-w-full',
        full: 'w-full',
      },
      shape: {
        rounded: 'rounded-[var(--radius-sm)]',
        field: 'radius-field',
        section: 'radius-section',
        pill: 'rounded-full',
      },
    },
    compoundVariants: [
      { variant: 'block', size: 'sm', class: 'h-16' },
      { variant: 'block', size: 'md', class: 'h-20' },
      { variant: 'block', size: 'lg', class: 'h-40' },
      { variant: 'block', size: 'xl', class: 'h-44' },
      { variant: 'block', size: '2xl', class: 'h-48' },
      { variant: 'block', size: '3xl', class: 'h-72' },
      { variant: 'text', size: 'sm', class: 'h-[var(--skeleton-text-sm)]' },
      { variant: 'text', size: 'md', class: 'h-[var(--skeleton-text-md)]' },
      {
        variant: 'heading',
        size: 'sm',
        class: 'h-[var(--skeleton-heading-sm)]',
      },
      {
        variant: 'heading',
        size: 'md',
        class: 'h-[var(--skeleton-heading-md)]',
      },
      {
        variant: 'heading',
        size: 'lg',
        class: 'h-[var(--skeleton-heading-lg)]',
      },
      {
        variant: 'control',
        size: 'sm',
        class: 'h-[var(--skeleton-control-sm)]',
      },
      {
        variant: 'control',
        size: 'md',
        class: 'h-[var(--skeleton-control-md)]',
      },
    ],
    defaultVariants: { variant: 'text', size: 'md', length: 'full' },
  },
);
