import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';

import { CHATBOT_MODEL_IDS } from '@/api/chatbot';

import { ChatbotComposer } from './FlytChatbotComposer';
import { CHATBOT_AVAILABILITY_STATUSES } from './types';

const viewportState = vi.hoisted(() => ({ isDesktop: true }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => viewportState.isDesktop,
}));

function renderComposer() {
  const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
    event.preventDefault(),
  );
  const onDraftChange = vi.fn();

  render(
    <ChatbotComposer
      activeModel={CHATBOT_MODEL_IDS.FLYT}
      availabilityStatus={CHATBOT_AVAILABILITY_STATUSES.READY}
      composerState={{
        canSend: true,
        loading: false,
        availabilityNotice: null,
      }}
      context={null}
      draft="Hei"
      flytRemainingPercent={null}
      isModelUsable={() => true}
      modelActions={{}}
      modelReasons={{}}
      onDraftChange={onDraftChange}
      onModelChange={() => undefined}
      onSubmit={onSubmit}
      textareaRef={createRef<HTMLTextAreaElement>()}
    />,
  );

  return { onDraftChange, onSubmit };
}

const textbox = () => screen.getByRole('textbox', { name: 'Ask a question' });

beforeEach(() => {
  viewportState.isDesktop = true;
});

afterEach(() => {
  viewportState.isDesktop = true;
});

describe('ChatbotComposer', () => {
  it('test_chatbot_composer_given_desktop_enter_expect_submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderComposer();

    await user.click(textbox());
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('test_chatbot_composer_given_desktop_shift_enter_expect_newline', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderComposer();

    await user.click(textbox());
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('test_chatbot_composer_given_mobile_enter_expect_newline', async () => {
    viewportState.isDesktop = false;
    const user = userEvent.setup();
    const { onSubmit } = renderComposer();

    await user.click(textbox());
    await user.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('test_chatbot_composer_given_ime_composition_expect_no_submit', () => {
    const { onSubmit } = renderComposer();

    fireEvent.keyDown(textbox(), { key: 'Enter', isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('test_chatbot_composer_given_composition_key_code_expect_no_submit', () => {
    const { onSubmit } = renderComposer();

    fireEvent.keyDown(textbox(), { key: 'Enter', keyCode: 229 });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
