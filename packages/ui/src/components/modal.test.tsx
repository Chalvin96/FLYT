import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

describe('Modal', () => {
  it('test_modal_given_open_with_title_and_description_expect_header_and_content_rendered', () => {
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

  it('test_modal_given_no_description_expect_dialog_without_accessible_description', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Delete card">
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('test_modal_given_description_expect_dialog_described_by_it', () => {
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

    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'This action cannot be undone',
    );
  });

  it('test_modal_given_open_expect_dialog_focused_and_no_button_focused', async () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="Delete card"
        footer={
          <button type="button" onClick={() => {}}>
            Cancel
          </button>
        }
      >
        <p>Body content</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());

    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close' })).not.toHaveFocus();
  });

  it('test_modal_given_close_button_click_expect_on_close_called_once', async () => {
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
