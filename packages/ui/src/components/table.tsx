import * as React from 'react';

import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import {
  HEADING_SIZE,
  TEXT_SIZE,
  TEXT_TONE,
  TEXT_WEIGHT,
} from './text-variants';

export type TableVariant = 'default' | 'reference';
export type TableAlign = 'start' | 'center' | 'end';

/** `reference` is read from context, so a caller sets it once on `Table`. */
const TableVariantContext = React.createContext<TableVariant>('default');

const ALIGN: Record<TableAlign, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

const TABLE_ROOT: Record<TableVariant, string> = {
  default: '',
  reference: 'min-w-max border-collapse',
};

const TABLE_HEADER: Record<TableVariant, string> = {
  default: '[&_tr]:border-b',
  reference: '[&_tr]:border-0',
};

const TABLE_ROW: Record<TableVariant, string> = {
  default:
    'border-b transition-colors hover:bg-neutral-subtle/50 data-[state=selected]:bg-neutral-subtle',
  reference: 'border-0',
};

const DEFAULT_HEAD_ALIGN: Record<TableVariant, TableAlign> = {
  default: 'start',
  reference: 'center',
};

const TABLE_HEAD: Record<TableVariant, string> = {
  default: `h-10 px-2 align-middle ${TEXT_WEIGHT.semibold} ${TEXT_TONE.subtle} [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,
  reference: `border border-default px-3 py-2 ${HEADING_SIZE.xxsmall} bg-neutral-subtle text-subtle`,
};

const TABLE_CELL: Record<TableVariant, string> = {
  default:
    'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
  reference: `border border-default px-3 py-2 ${TEXT_SIZE.sm} ${TEXT_WEIGHT.semibold} ${TEXT_TONE.default}`,
};

export type TableProps = ClosedProps<'table'> & { variant?: TableVariant };

const Table = ({ ref, variant = 'default', ...props }: TableProps) => (
  <TableVariantContext.Provider value={variant}>
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        {...props}
        className={cn(
          `w-full caption-bottom ${TEXT_SIZE.sm}`,
          TABLE_ROOT[variant],
        )}
        style={undefined}
      />
    </div>
  </TableVariantContext.Provider>
);
Table.displayName = 'Table';

const TableHeader = ({ ref, ...props }: ClosedProps<'thead'>) => {
  const variant = React.useContext(TableVariantContext);
  return (
    <thead
      ref={ref}
      {...props}
      className={TABLE_HEADER[variant]}
      style={undefined}
    />
  );
};
TableHeader.displayName = 'TableHeader';

const TableBody = ({ ref, ...props }: ClosedProps<'tbody'>) => (
  <tbody
    ref={ref}
    {...props}
    className="[&_tr:last-child]:border-0"
    style={undefined}
  />
);
TableBody.displayName = 'TableBody';

const TableFooter = ({ ref, ...props }: ClosedProps<'tfoot'>) => (
  <tfoot
    ref={ref}
    {...props}
    className={`border-t bg-neutral-subtle/50 ${TEXT_WEIGHT.semibold} [&>tr]:last:border-b-0`}
    style={undefined}
  />
);
TableFooter.displayName = 'TableFooter';

const TableRow = ({ ref, ...props }: ClosedProps<'tr'>) => {
  const variant = React.useContext(TableVariantContext);
  return (
    <tr ref={ref} {...props} className={TABLE_ROW[variant]} style={undefined} />
  );
};
TableRow.displayName = 'TableRow';

// `align` is also a deprecated HTML attribute on th/td, so the prop replaces it.
export type TableHeadProps = Omit<ClosedProps<'th'>, 'align'> & {
  align?: TableAlign;
};

const TableHead = ({ align, ref, ...props }: TableHeadProps) => {
  const variant = React.useContext(TableVariantContext);
  const resolvedAlign = align ?? DEFAULT_HEAD_ALIGN[variant];
  return (
    <th
      ref={ref}
      {...props}
      className={cn(TABLE_HEAD[variant], ALIGN[resolvedAlign])}
      style={undefined}
    />
  );
};
TableHead.displayName = 'TableHead';

export type TableCellProps = Omit<ClosedProps<'td'>, 'align'> & {
  align?: TableAlign;
};

const TableCell = ({ align = 'start', ref, ...props }: TableCellProps) => {
  const variant = React.useContext(TableVariantContext);
  return (
    <td
      ref={ref}
      {...props}
      className={cn(TABLE_CELL[variant], ALIGN[align])}
      style={undefined}
    />
  );
};
TableCell.displayName = 'TableCell';

const TableCaption = ({ ref, ...props }: ClosedProps<'caption'>) => (
  <caption
    ref={ref}
    {...props}
    className={`mt-4 ${TEXT_SIZE.sm} ${TEXT_TONE.subtle}`}
    style={undefined}
  />
);
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
