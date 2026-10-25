import { cva } from 'class-variance-authority';

import { HEADING_SIZE, TEXT_SIZE, TEXT_WEIGHT } from './text-variants';

export const EYEBROW_BADGE_CLASS = `inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full border border-default bg-overlay px-2.5 whitespace-nowrap text-subtle ${HEADING_SIZE.xxsmall}`;

export const badgeVariants = cva(
  `inline-flex shrink-0 items-center gap-1.5 border ${TEXT_WEIGHT.semibold} whitespace-nowrap`,
  {
    variants: {
      tone: {
        neutral: 'border-default bg-neutral-subtle text-default',
        brand: 'border-brand-subtle bg-brand-subtle text-selected',
        success: 'border-success-subtle bg-success-subtle text-success',
        warning: 'border-warning-subtle bg-warning-subtle text-warning',
        danger: 'border-danger-subtle bg-danger-subtle text-danger',
      },
      size: {
        sm: `px-2 py-0.5 ${TEXT_SIZE.xs}`,
        md: `px-2.5 py-0.5 ${TEXT_SIZE.sm}`,
      },
      shape: {
        rounded: 'rounded-[var(--radius-sm)]',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'sm',
      shape: 'rounded',
    },
  },
);
