import { DndContext } from '@dnd-kit/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DropZone } from './DropZone';

/** DropZone owns useDroppable, so every render needs a DndContext ancestor. */
function renderInDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

describe('DropZone', () => {
  it('renders with the expected resting tokens', () => {
    renderInDnd(<DropZone id="zone-1" label="Bucket" />);
    const zone = screen.getByTestId('drop-zone');
    expect(zone).toHaveClass('border-dashed', 'border-border', 'bg-card');
  });

  it('exposes the accessible label via aria-label', () => {
    renderInDnd(<DropZone id="zone-1" label="Common gender" />);
    expect(screen.getByTestId('drop-zone')).toHaveAttribute(
      'aria-label',
      'Common gender',
    );
  });

  it('renders children inside the zone', () => {
    renderInDnd(
      <DropZone id="zone-1">
        <span data-testid="child">chip</span>
      </DropZone>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies the highlight tokens when isOver is overridden to true', () => {
    renderInDnd(<DropZone id="zone-1" isOver />);
    const zone = screen.getByTestId('drop-zone');
    expect(zone).toHaveAttribute('data-over', 'true');
    expect(zone).toHaveClass('border-primary-60', 'bg-primary-5');
  });

  it('reflects the resting state when isOver is overridden to false', () => {
    renderInDnd(<DropZone id="zone-1" isOver={false} />);
    const zone = screen.getByTestId('drop-zone');
    expect(zone).toHaveAttribute('data-over', 'false');
    expect(zone).not.toHaveClass('bg-primary-5');
  });

  it('stamps the data-dropzone-id attribute for debugging', () => {
    renderInDnd(<DropZone id="my-bucket" />);
    expect(screen.getByTestId('drop-zone')).toHaveAttribute(
      'data-dropzone-id',
      'my-bucket',
    );
  });

  it('does not duplicate label text as visible content (aria-label only)', () => {
    renderInDnd(<DropZone id="zone-1" label="Neuter" />);
    // Label is in aria-label, not in visible/DOM text content.
    const zone = screen.getByTestId('drop-zone');
    expect(zone).toHaveAttribute('aria-label', 'Neuter');
    expect(zone.textContent).toBe('');
  });

  it('merges custom className without clobbering tokens', () => {
    renderInDnd(<DropZone id="zone-1" className="min-h-[5rem]" />);
    expect(screen.getByTestId('drop-zone')).toHaveClass('min-h-[5rem]');
  });

  it('stays a plain div when no onClick is provided', () => {
    renderInDnd(<DropZone id="zone-1" label="Bucket" />);
    const zone = screen.getByTestId('drop-zone');
    expect(zone).not.toHaveAttribute('role');
    expect(zone).not.toHaveAttribute('tabindex');
  });

  it('becomes keyboard-operable when onClick is provided', () => {
    const onClick = vi.fn();
    renderInDnd(<DropZone id="zone-1" label="Bucket" onClick={onClick} />);
    const zone = screen.getByRole('button', { name: 'Bucket' });

    expect(zone).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(zone, { key: 'Enter' });
    fireEvent.keyDown(zone, { key: ' ' });

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
