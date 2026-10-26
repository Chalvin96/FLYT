import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { ChatbotProvider } from './ChatbotProvider';
import { CHATBOT_OPEN_STATES } from './types';
import { useChatbotOpenState } from './useChatbotOpenState';

const viewportState = vi.hoisted(() => ({ isDesktop: true }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => viewportState.isDesktop,
}));

const ACCOUNT_ID = 7;
const PREFERENCE_KEY = 'flyt.chatbot.rail-preference:7';

function wrapper({ children }: { children: ReactNode }) {
  return <ChatbotProvider accountId={ACCOUNT_ID}>{children}</ChatbotProvider>;
}

const renderOpenState = () =>
  renderHook(() => useChatbotOpenState(), { wrapper });

beforeEach(() => {
  window.localStorage.clear();
  viewportState.isDesktop = true;
});

afterEach(() => {
  window.localStorage.clear();
  viewportState.isDesktop = true;
});

describe('useChatbotOpenState', () => {
  it('test_chatbot_open_state_given_first_use_expect_rail_and_dialog_closed', () => {
    const { result } = renderOpenState();

    expect(result.current.isRailOpen).toBe(false);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('test_chatbot_open_state_given_explicit_open_expect_preference_remembered', async () => {
    const { result } = renderOpenState();

    act(() => result.current.open());

    await waitFor(() => expect(result.current.isRailOpen).toBe(true));
    await waitFor(() =>
      expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe(
        CHATBOT_OPEN_STATES.OPEN,
      ),
    );
  });

  it('test_chatbot_open_state_given_stored_open_expect_desktop_rail_restored', () => {
    window.localStorage.setItem(PREFERENCE_KEY, CHATBOT_OPEN_STATES.OPEN);

    const { result } = renderOpenState();

    expect(result.current.isRailOpen).toBe(true);
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('test_chatbot_open_state_given_stored_open_on_mobile_expect_dialog_stays_closed', () => {
    window.localStorage.setItem(PREFERENCE_KEY, CHATBOT_OPEN_STATES.OPEN);
    viewportState.isDesktop = false;

    const { result } = renderOpenState();

    expect(result.current.isRailOpen).toBe(false);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('test_chatbot_open_state_given_mobile_open_expect_desktop_preference_untouched', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, CHATBOT_OPEN_STATES.CLOSED);
    viewportState.isDesktop = false;

    const { result } = renderOpenState();

    act(() => result.current.open());

    await waitFor(() => expect(result.current.isDialogOpen).toBe(true));
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe(
      CHATBOT_OPEN_STATES.CLOSED,
    );
  });

  it('test_chatbot_open_state_given_mobile_open_then_desktop_expect_preference_untouched', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, CHATBOT_OPEN_STATES.CLOSED);
    viewportState.isDesktop = false;

    const { result, rerender } = renderOpenState();
    act(() => result.current.open());
    await waitFor(() => expect(result.current.isDialogOpen).toBe(true));

    viewportState.isDesktop = true;
    rerender();

    expect(result.current.isRailOpen).toBe(true);
    expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe(
      CHATBOT_OPEN_STATES.CLOSED,
    );
  });

  it('test_chatbot_open_state_given_explicit_close_expect_preference_closed', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, CHATBOT_OPEN_STATES.OPEN);

    const { result } = renderOpenState();
    expect(result.current.isRailOpen).toBe(true);

    act(() => result.current.close());

    await waitFor(() => expect(result.current.isRailOpen).toBe(false));
    await waitFor(() =>
      expect(window.localStorage.getItem(PREFERENCE_KEY)).toBe(
        CHATBOT_OPEN_STATES.CLOSED,
      ),
    );
  });
});
