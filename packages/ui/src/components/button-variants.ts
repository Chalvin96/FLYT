import { cva } from 'class-variance-authority';

import { TEXT_SIZE, TEXT_WEIGHT } from './text-variants';

// Declaration order is load-bearing: `cn` keeps the last of two conflicting
// utilities, so geometry precedes `variant`, and `width`/`align` come last.
export const buttonVariants = cva(
  [
    `inline-flex shrink-0 cursor-pointer items-center gap-2 border ${TEXT_WEIGHT.semibold} whitespace-nowrap`,
    'transition-[background-color,border-color,box-shadow,color] duration-150 ease-out',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
    'disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled disabled:shadow-none',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      size: {
        sm: `h-9 px-4 ${TEXT_SIZE.xs}`,
        md: `h-11 px-5 ${TEXT_SIZE.sm}`,
        lg: `h-12 px-6 ${TEXT_SIZE.base}`,
        icon: 'size-11 p-0',
        'icon-sm':
          "relative size-8 p-0 after:absolute after:-inset-1.5 after:content-['']",
      },
      shape: {
        rounded: 'radius-field',
        pill: 'rounded-[var(--control-radius-pill)]',
      },
      variant: {
        primary:
          'border-transparent bg-brand-bold text-inverse shadow-[var(--control-shadow-raised)] hover:bg-brand-bold-hovered active:bg-brand-bold-pressed',
        secondary:
          'border-[var(--control-secondary-border)] bg-[var(--control-secondary-surface)] text-[var(--control-secondary-text)] shadow-[var(--control-shadow-resting)] hover:bg-[var(--control-secondary-surface-hover)] active:bg-[var(--control-secondary-surface-active)]',
        outline:
          'border-strong-hovered bg-raised text-default shadow-[var(--control-shadow-resting)] hover:bg-neutral-subtle active:bg-neutral-pressed',
        ghost:
          'border-transparent bg-transparent text-subtle shadow-none hover:bg-neutral-subtle hover:text-default active:bg-neutral-pressed',
        danger:
          'border-transparent bg-danger text-inverse shadow-[var(--control-shadow-raised)] hover:bg-danger-hovered active:bg-danger-pressed',
        inverse:
          'border-[var(--control-inverse-border)] bg-[var(--control-inverse-surface)] text-[var(--control-inverse-text)] shadow-[var(--control-shadow-raised)] hover:bg-[var(--control-inverse-surface-hover)] active:bg-[var(--control-inverse-surface-active)]',
        link: 'h-auto w-auto border-transparent bg-transparent px-0 py-0 text-brand underline-offset-4 shadow-none hover:underline disabled:bg-transparent disabled:shadow-none',
      },
      width: {
        // Intentionally empty: any width here would override `size="icon"`.
        auto: '',
        full: 'w-full',
        'full-on-mobile': 'w-full sm:w-auto',
      },
      align: {
        center: 'justify-center text-center',
        start: 'justify-start text-left',
      },
    },
    compoundVariants: [
      { shape: 'pill', size: 'md', class: 'px-6' },
      { shape: 'pill', size: 'lg', class: 'px-7' },
      // Must follow the pill paddings above; cva concatenates, so an earlier
      // `link` reset would be undone by them.
      { variant: 'link', class: 'px-0 py-0' },
      { align: 'start', class: 'whitespace-normal' },
      {
        width: 'full',
        size: ['sm', 'md', 'lg'],
        class: 'px-2 whitespace-normal',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'rounded',
      width: 'auto',
      align: 'center',
    },
  },
);
