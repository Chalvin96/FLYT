import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CHATBOT_MODEL_IDS, getChatbotSurface } from '@/api/chatbot';
import { chatbotKeys } from '@/hooks/chatbot/queries';
import { server } from '@/test/msw/server';

import { ChatbotProvider, useChatbot } from './ChatbotProvider';
import { FlytChatbotLayout } from './FlytChatbotLayout';
import { CHATBOT_OPEN_STATES, type ChatbotOpenState } from './types';
import { RAIL_TRANSITION_MS } from './useRailPresence';

await Promise.all([import('react-markdown'), import('remark-gfm')]);

const viewportState = vi.hoisted(() => ({ isDesktop: true }));
const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => viewportState.isDesktop,
}));

vi.mock('@/hooks/ui/usePrefersReducedMotion', () => ({
  useIsReducedMotionPreferred: () => motionState.reduced,
}));

afterEach(() => {
  vi.useRealTimers();
  viewportState.isDesktop = true;
  motionState.reduced = false;
  window.localStorage.clear();
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

function layoutTree(
  initialOpenState: ChatbotOpenState = CHATBOT_OPEN_STATES.CLOSED,
) {
  return (
    <ChatbotProvider initialOpenState={initialOpenState}>
      <LayoutHarness />
    </ChatbotProvider>
  );
}

function renderLayout(
  initialOpenState: ChatbotOpenState = CHATBOT_OPEN_STATES.CLOSED,
) {
  return render(layoutTree(initialOpenState));
}

async function remoteLayoutTree() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  await queryClient.ensureQueryData({
    queryKey: chatbotKeys.surface(null),
    queryFn: getChatbotSurface,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ChatbotProvider remote initialOpenState={CHATBOT_OPEN_STATES.OPEN}>
        <LayoutHarness />
      </ChatbotProvider>
    </QueryClientProvider>
  );
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

    const rail = screen.getByRole('complementary', {
      name: 'Ask Flyt chatbot',
      hidden: true,
    });
    await waitFor(() =>
      expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.OPEN),
    );
    expect(rail).not.toHaveAttribute('inert');
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
    const textbox = screen.getByLabelText('Ask a question');
    await waitFor(() => expect(textbox).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Close chatbot' }));
    await expect(trigger).toHaveFocus();
  });

  it('test_flyt_chatbot_layout_given_breakpoint_change_expect_draft_and_focus_preserved', async () => {
    const user = userEvent.setup();
    const view = renderLayout();
    const trigger = screen.getByText('Open chatbot', { selector: 'button' });

    await user.click(trigger);
    const textbox = screen.getByLabelText('Ask a question');
    await waitFor(() => expect(textbox).toHaveFocus());
    await user.paste('Keep this draft');

    viewportState.isDesktop = false;
    view.rerender(layoutTree(CHATBOT_OPEN_STATES.CLOSED));
    expect(screen.getByLabelText('Ask a question')).toHaveValue(
      'Keep this draft',
    );

    viewportState.isDesktop = true;
    view.rerender(layoutTree(CHATBOT_OPEN_STATES.CLOSED));
    const restoredTextbox = screen.getByLabelText('Ask a question');
    await waitFor(() => expect(restoredTextbox).toHaveFocus());
    expect(restoredTextbox).toHaveValue('Keep this draft');
  });

  it('test_flyt_chatbot_layout_given_persisted_open_expect_rail_open_without_focus', async () => {
    window.localStorage.setItem(
      'flyt.chatbot.rail-preference:9',
      CHATBOT_OPEN_STATES.OPEN,
    );

    render(
      <ChatbotProvider accountId={9}>
        <LayoutHarness />
      </ChatbotProvider>,
    );

    const rail = await screen.findByRole('complementary', {
      name: 'Ask Flyt chatbot',
      hidden: true,
    });
    expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.OPEN);
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Ask a question' }),
      ).not.toHaveFocus(),
    );
  });

  it('test_flyt_chatbot_layout_given_close_expect_column_reserved_until_panel_exits', () => {
    vi.useFakeTimers();
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Open chatbot' }));
    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });

    const rail = screen.getByRole('complementary', {
      name: 'Ask Flyt chatbot',
      hidden: true,
    });
    expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.OPEN);
    expect(rail).toHaveAttribute('data-rail-reserved', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Close chatbot' }));
    act(() => vi.advanceTimersToNextFrame());

    expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.CLOSED);
    expect(rail).toHaveAttribute('data-rail-reserved', 'true');

    act(() => vi.advanceTimersByTime(RAIL_TRANSITION_MS - 1));
    expect(rail).toHaveAttribute('data-rail-reserved', 'true');

    act(() => vi.advanceTimersByTime(1));
    expect(rail).toHaveAttribute('data-rail-reserved', 'false');
  });

  it('test_flyt_chatbot_layout_given_rapid_reversal_expect_rail_reopens_reserved', () => {
    vi.useFakeTimers();
    renderLayout();

    const trigger = screen.getByRole('button', { name: 'Open chatbot' });
    fireEvent.click(trigger);
    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });

    const rail = screen.getByRole('complementary', {
      name: 'Ask Flyt chatbot',
      hidden: true,
    });
    expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.OPEN);

    fireEvent.click(screen.getByRole('button', { name: 'Close chatbot' }));
    act(() => vi.advanceTimersToNextFrame());
    expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.CLOSED);
    expect(rail).toHaveAttribute('data-rail-reserved', 'true');

    fireEvent.click(trigger);
    expect(rail).toHaveAttribute('data-rail-reserved', 'true');

    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });
    expect(rail).toHaveAttribute('data-rail-state', CHATBOT_OPEN_STATES.OPEN);

    act(() => vi.advanceTimersByTime(RAIL_TRANSITION_MS));
    expect(rail).toHaveAttribute('data-rail-reserved', 'true');
  });

  it('test_flyt_chatbot_layout_given_reduced_motion_expect_rail_still_opens_and_releases_column', async () => {
    motionState.reduced = true;
    const user = userEvent.setup();
    renderLayout();

    const rail = () =>
      screen.getByRole('complementary', {
        name: 'Ask Flyt chatbot',
        hidden: true,
      });

    await user.click(screen.getByRole('button', { name: 'Open chatbot' }));
    await waitFor(() =>
      expect(rail()).toHaveAttribute(
        'data-rail-state',
        CHATBOT_OPEN_STATES.OPEN,
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Close chatbot' }));
    await waitFor(() =>
      expect(rail()).toHaveAttribute('data-rail-reserved', 'false'),
    );
  });

  it('test_flyt_chatbot_layout_given_send_and_surface_failures_expect_retry_resends_message', async () => {
    let surfaceRequestCount = 0;
    let sendRequestCount = 0;
    server.use(
      http.get('*/chatbot', () => {
        surfaceRequestCount += 1;
        if (surfaceRequestCount > 1) {
          return HttpResponse.json(
            { detail: { message: 'temporary outage' } },
            { status: 503 },
          );
        }
        return HttpResponse.json({
          models: [
            {
              id: CHATBOT_MODEL_IDS.FLYT,
              label: 'Flyt',
              detail: 'GLM 5.3 Flash',
              model: 'z-ai/glm-5.3-flash',
              available: true,
              reason: null,
              action: null,
              requiresOpenRouterKey: false,
            },
          ],
          openrouterKeyConfigured: false,
        });
      }),
      http.post('*/chatbot/messages', () => {
        sendRequestCount += 1;
        return HttpResponse.json(
          {
            detail: {
              message: 'The selected model could not answer right now.',
              code: 'CHATBOT_PROVIDER_TRANSIENT',
            },
          },
          { status: 503 },
        );
      }),
    );

    render(await remoteLayoutTree());
    const flytModel = screen.getByLabelText('Flyt');
    expect(flytModel).toHaveRole('radio');
    expect(flytModel).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Ask a question'), {
      target: { value: 'Explain V2' },
    });
    const sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toHaveRole('button');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(surfaceRequestCount).toBeGreaterThanOrEqual(2);
      expect(
        screen.queryAllByText('The selected model could not answer right now.'),
      ).not.toHaveLength(0);
      expect(
        screen.getByTestId('chatbot-availability-notice'),
      ).toHaveTextContent(
        'Flyt could not check which models you can use. Try again.',
      );
    });

    const retryButton = screen.getByText('Retry', { selector: 'button' });
    expect(retryButton).toHaveRole('button');
    fireEvent.click(retryButton);
    await waitFor(() => expect(sendRequestCount).toBe(2));
  });
});
