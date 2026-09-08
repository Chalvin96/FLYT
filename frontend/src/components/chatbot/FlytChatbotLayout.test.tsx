import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';

import { ChatbotProvider, useChatbot } from './ChatbotProvider';
import { FlytChatbotLayout } from './FlytChatbotLayout';

const viewportState = vi.hoisted(() => ({ isDesktop: true }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => viewportState.isDesktop,
}));

afterEach(() => {
  viewportState.isDesktop = true;
});

function LayoutHarness() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open } = useChatbot();

  return (
    <>
      <button ref={triggerRef} onClick={() => open()} type="button">
        Open chatbot
      </button>
      <FlytChatbotLayout returnFocusRef={triggerRef}>
        <main>Page content</main>
      </FlytChatbotLayout>
    </>
  );
}

function layoutTree(initialOpenState: 'auto' | 'open' | 'closed' = 'closed') {
  return (
    <ChatbotProvider initialOpenState={initialOpenState}>
      <LayoutHarness />
    </ChatbotProvider>
  );
}

function renderLayout(initialOpenState: 'auto' | 'open' | 'closed' = 'closed') {
  return render(layoutTree(initialOpenState));
}

describe('FlytChatbotLayout', () => {
  it('test_flyt_chatbot_layout_given_closed_shell_expect_stable_target_and_models', () => {
    renderLayout();

    expect(screen.getByRole('main')).toHaveTextContent('Page content');
    expect(screen.getByTestId('flyt-chatbot-panel')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: 'ChatGPT, powered by Luna',
        hidden: true,
      }),
    ).toBeEnabled();
  });

  it('test_flyt_chatbot_layout_given_mobile_viewport_expect_desktop_rail_absent', () => {
    viewportState.isDesktop = false;
    renderLayout();

    expect(
      screen.queryByRole('complementary', { name: 'Ask Flyt chatbot' }),
    ).not.toBeInTheDocument();
  });

  it('test_flyt_chatbot_layout_given_closed_desktop_rail_expect_inert_surface', () => {
    renderLayout();

    expect(
      screen.getByRole('complementary', {
        name: 'Ask Flyt chatbot',
        hidden: true,
      }),
    ).toHaveAttribute('inert');
  });

  it('test_flyt_chatbot_layout_given_open_desktop_rail_expect_operable_surface', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open chatbot' }));

    expect(
      screen.getByRole('complementary', { name: 'Ask Flyt chatbot' }),
    ).not.toHaveAttribute('inert');
  });

  it('test_flyt_chatbot_layout_given_mobile_dialog_open_expect_composer_focused_and_focus_returned', async () => {
    const user = userEvent.setup();
    viewportState.isDesktop = false;
    renderLayout();

    const trigger = screen.getByRole('button', { name: 'Open chatbot' });
    await user.click(trigger);
    await expect(
      screen.getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close chatbot' }));
    await expect(trigger).toHaveFocus();
  });

  it('test_flyt_chatbot_layout_given_desktop_trigger_expect_open_focus_and_close_focus_return', async () => {
    const user = userEvent.setup();
    renderLayout();

    const trigger = screen.getByRole('button', { name: 'Open chatbot' });
    await user.click(trigger);
    await expect(
      screen.getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close chatbot' }));
    await expect(trigger).toHaveFocus();
  });

  it('test_flyt_chatbot_layout_given_breakpoint_change_expect_draft_and_focus_preserved', async () => {
    const user = userEvent.setup();
    const view = renderLayout();
    const trigger = screen.getByRole('button', { name: 'Open chatbot' });

    await user.click(trigger);
    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Keep this draft',
    );

    viewportState.isDesktop = false;
    view.rerender(layoutTree('closed'));
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveValue(
      'Keep this draft',
    );

    viewportState.isDesktop = true;
    view.rerender(layoutTree('closed'));
    await expect(
      screen.getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveValue(
      'Keep this draft',
    );
  });
});
