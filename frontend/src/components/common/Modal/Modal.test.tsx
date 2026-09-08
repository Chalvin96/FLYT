import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders title, description and content when open', () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="Delete card"
        description="This action cannot be undone"
      >
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.getByText('Delete card')).toBeInTheDocument();
    expect(
      screen.getByText('This action cannot be undone'),
    ).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Title">
        <p>Body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
