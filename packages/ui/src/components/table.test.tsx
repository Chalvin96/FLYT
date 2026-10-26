import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

function renderTable(variant?: 'default' | 'reference') {
  render(
    <Table variant={variant}>
      <TableHeader>
        <TableRow>
          <TableHead data-testid="head">Entall</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-testid="row">
          <TableCell data-testid="cell">hunden</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe('Table', () => {
  it('test_table_given_no_variant_expect_data_presentation_with_row_hover', () => {
    renderTable();

    expect(screen.getByTestId('row')).toHaveClass('hover:bg-neutral-subtle/50');
  });

  it('test_table_given_reference_variant_expect_bordered_cells_and_no_hover', () => {
    renderTable('reference');

    expect(screen.getByRole('table')).toHaveClass('border-collapse');
    expect(screen.getByTestId('row')).not.toHaveClass(
      'hover:bg-neutral-subtle/50',
    );
    expect(screen.getByTestId('head')).toHaveClass('bg-neutral-subtle');
    expect(screen.getByTestId('head')).toHaveClass('text-heading-xxsmall');
    expect(screen.getByTestId('head')).not.toHaveClass(
      'text-xs',
      'font-semibold',
    );
    expect(screen.getByTestId('cell')).toHaveClass('border-default');
  });

  it('test_table_cell_given_align_prop_expect_matching_text_alignment', () => {
    render(
      <Table variant="reference">
        <TableBody>
          <TableRow>
            <TableCell align="center" data-testid="c">
              hund
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId('c')).toHaveClass('text-center');
  });
});
