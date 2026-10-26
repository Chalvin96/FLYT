import { cva } from 'class-variance-authority';

export type BottomSheetAnchor = 'floating' | 'edge' | 'centered';
export type BottomSheetLayout = 'grid' | 'column';
export type BottomSheetHeight = 'default' | 'tall';
export type BottomSheetPadding = 'none' | 'roomy';

export const bottomSheetDialogVariants = cva(
  [
    'fixed z-50 gap-0 overflow-hidden border border-default bg-raised text-default shadow-lg outline-none',
    'duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10',
  ],
  {
    variants: {
      anchor: {
        floating:
          'right-4 bottom-4 left-4 radius-section sm:right-6 sm:bottom-6 sm:left-6',
        edge: 'inset-x-0 bottom-0 max-w-none rounded-t-[1.5rem] rounded-b-none border-x-0 border-b-0 sm:inset-x-0 sm:bottom-0 sm:left-0 sm:right-0 sm:rounded-b-none',
        centered:
          'right-4 bottom-4 left-4 max-w-[var(--dialog-desktop-max-width)] radius-section sm:right-auto sm:bottom-6 sm:left-1/2 sm:w-[min(var(--dialog-desktop-max-width),calc(100%-3rem))] sm:-translate-x-1/2',
      },
      layout: { grid: 'grid', column: 'flex flex-col' },
      height: {
        default: 'max-h-[var(--sheet-max-height-default)]',
        tall: 'max-h-[var(--sheet-max-height-tall)]',
      },
      padding: { none: '', roomy: 'px-5 py-5' },
    },
    defaultVariants: {
      anchor: 'floating',
      layout: 'grid',
      height: 'default',
      padding: 'none',
    },
  },
);
