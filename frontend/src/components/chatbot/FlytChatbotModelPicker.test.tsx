import * as DialogPrimitive from '@radix-ui/react-dialog';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CHATBOT_MODEL_ACTIONS,
  CHATBOT_MODEL_IDS,
  CHATBOT_MODEL_REASONS,
} from '@/api/chatbot';
import { ACCOUNT_PAGE_ANCHORS } from '@/components/nav/accountNavigation';

import { ModelPills } from './FlytChatbotModelPicker';
import { FlytChatbotPanel } from './FlytChatbotPanel';
import { CHATBOT_AVAILABILITY_STATUSES } from './types';

const lockedRadio = (name: string) => screen.getByRole('radio', { name });

describe('FlytChatbotModelPicker locked providers', () => {
  it('test_chatbot_model_picker_given_locked_model_expect_one_roving_tab_stop', () => {
    render(
      <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.DEEPSEEK]} />,
    );

    const group = screen.getByRole('radiogroup', { name: 'Choose model' });
    const deepseek = lockedRadio('DeepSeek, not connected');
    expect(deepseek).toHaveAttribute('aria-disabled', 'true');
    expect(deepseek).toHaveAttribute('aria-checked', 'false');
    expect(group).toHaveAttribute('tabindex', '0');
    expect(
      screen
        .getAllByRole('radio')
        .filter((radio) => radio.getAttribute('tabindex') !== '-1'),
    ).toEqual([]);
  });

  it('test_chatbot_model_picker_given_arrow_navigation_expect_locked_model_receives_focus', async () => {
    const user = userEvent.setup();
    render(
      <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.CHATGPT]} />,
    );

    const flyt = screen.getByRole('radio', { name: 'Flyt' });
    const chatgpt = lockedRadio('ChatGPT, powered by Luna, not connected');
    flyt.focus();
    await user.keyboard('{ArrowRight}');

    expect(chatgpt).toHaveFocus();
    expect(chatgpt).toHaveAttribute('tabindex', '0');
  });

  it('test_chatbot_model_picker_given_locked_model_focus_expect_selection_unchanged', async () => {
    const user = userEvent.setup();
    render(
      <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.CHATGPT]} />,
    );

    const flyt = screen.getByRole('radio', { name: 'Flyt' });
    const chatgpt = lockedRadio('ChatGPT, powered by Luna, not connected');
    flyt.focus();
    await user.keyboard('{ArrowRight}');

    expect(flyt).toHaveAttribute('aria-checked', 'true');
    expect(chatgpt).toHaveAttribute('aria-checked', 'false');
  });

  it('test_chatbot_model_picker_given_chatgpt_locked_expect_connect_cta_routes_to_account', async () => {
    const user = userEvent.setup();
    const onOpenAccountSettings = vi.fn();
    render(
      <FlytChatbotPanel
        onOpenAccountSettings={onOpenAccountSettings}
        unavailableModels={[CHATBOT_MODEL_IDS.CHATGPT]}
      />,
    );

    await user.click(lockedRadio('ChatGPT, powered by Luna, not connected'));

    expect(
      await screen.findByText(
        'Connect your ChatGPT account to ask questions with it.',
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Connect in Account settings' }),
    );

    expect(onOpenAccountSettings).toHaveBeenCalledWith(
      ACCOUNT_PAGE_ANCHORS.CHATGPT,
    );
  });

  it('test_chatbot_model_picker_given_expired_chatgpt_expect_reconnect_cta', async () => {
    const user = userEvent.setup();
    const onOpenAccountSettings = vi.fn();
    render(
      <FlytChatbotPanel
        modelActions={{
          [CHATBOT_MODEL_IDS.CHATGPT]: CHATBOT_MODEL_ACTIONS.RELINK_ACCOUNT,
        }}
        onOpenAccountSettings={onOpenAccountSettings}
        unavailableModels={[CHATBOT_MODEL_IDS.CHATGPT]}
      />,
    );

    await user.click(
      lockedRadio('ChatGPT, powered by Luna, reconnect your ChatGPT account'),
    );

    expect(
      await screen.findByText(
        'Your ChatGPT connection stopped working. Reconnect it to keep using this model.',
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Reconnect in Account settings' }),
    );

    expect(onOpenAccountSettings).toHaveBeenCalledWith(
      ACCOUNT_PAGE_ANCHORS.CHATGPT,
    );
  });

  it('test_chatbot_model_picker_given_missing_key_expect_provider_key_cta', async () => {
    const user = userEvent.setup();
    const onOpenAccountSettings = vi.fn();
    render(
      <FlytChatbotPanel
        modelReasons={{
          [CHATBOT_MODEL_IDS.DEEPSEEK]:
            CHATBOT_MODEL_REASONS.OPENROUTER_KEY_REQUIRED,
        }}
        onOpenAccountSettings={onOpenAccountSettings}
        unavailableModels={[CHATBOT_MODEL_IDS.DEEPSEEK]}
      />,
    );

    await user.click(
      lockedRadio('DeepSeek, set up a provider key in Account settings'),
    );

    expect(
      await screen.findByText('DeepSeek and z.ai need your own provider key.'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Add key in Account settings' }),
    );

    expect(onOpenAccountSettings).toHaveBeenCalledWith(
      ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY,
    );
  });

  it('test_chatbot_model_picker_given_unavailable_flyt_expect_no_account_cta', async () => {
    const user = userEvent.setup();
    render(<FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.FLYT]} />);

    await user.click(lockedRadio('Flyt, not available right now'));

    expect(
      await screen.findByText(
        'Flyt cannot answer right now. Pick another model and try again.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Account settings/ }),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_model_picker_given_loading_expect_busy_unlocked_pills', () => {
    render(
      <FlytChatbotPanel
        availabilityStatus={CHATBOT_AVAILABILITY_STATUSES.LOADING}
        unavailableModels={[
          CHATBOT_MODEL_IDS.FLYT,
          CHATBOT_MODEL_IDS.CHATGPT,
          CHATBOT_MODEL_IDS.DEEPSEEK,
          CHATBOT_MODEL_IDS.GLM,
        ]}
      />,
    );

    const chatgpt = screen.getByRole('radio', {
      name: 'ChatGPT, powered by Luna, checking availability',
    });
    expect(
      screen.getByRole('radiogroup', { name: 'Choose model' }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(chatgpt).toHaveAttribute(
      'data-availability-state',
      CHATBOT_AVAILABILITY_STATUSES.LOADING,
    );
    expect(chatgpt).not.toHaveAttribute('aria-disabled');
    expect(
      screen.queryByRole('button', { name: /Account settings|Try again/ }),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_model_picker_given_dialog_context_expect_locked_cta_reachable', async () => {
    const user = userEvent.setup();
    render(
      <DialogPrimitive.Root open>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay />
          <DialogPrimitive.Content>
            <DialogPrimitive.Title>Ask Flyt</DialogPrimitive.Title>
            <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.CHATGPT]} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>,
    );

    await user.click(lockedRadio('ChatGPT, powered by Luna, not connected'));

    expect(
      await screen.findByRole('button', {
        name: 'Connect in Account settings',
      }),
    ).toBeInTheDocument();
  });

  it('test_chatbot_model_picker_given_availability_error_expect_retry_cta', async () => {
    const user = userEvent.setup();
    const onRetryAvailability = vi.fn();
    render(
      <FlytChatbotPanel
        availabilityStatus={CHATBOT_AVAILABILITY_STATUSES.ERROR}
        onRetryAvailability={onRetryAvailability}
        unavailableModels={[
          CHATBOT_MODEL_IDS.FLYT,
          CHATBOT_MODEL_IDS.CHATGPT,
          CHATBOT_MODEL_IDS.DEEPSEEK,
          CHATBOT_MODEL_IDS.GLM,
        ]}
      />,
    );

    await user.click(
      lockedRadio('ChatGPT, powered by Luna, availability check failed'),
    );

    expect(
      await screen.findByText('Flyt could not check which models you can use.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetryAvailability).toHaveBeenCalledTimes(1);
  });

  it('test_chatbot_model_picker_given_group_expect_single_tab_stop', () => {
    render(<FlytChatbotPanel />);

    const group = screen.getByRole('radiogroup', { name: 'Choose model' });
    expect(group).toHaveAttribute('tabindex', '0');
    expect(
      screen
        .getAllByRole('radio')
        .filter((radio) => radio.getAttribute('tabindex') !== '-1'),
    ).toEqual([]);

    group.focus();

    expect(screen.getByRole('radio', { name: 'Flyt' })).toHaveFocus();
  });

  it('test_chatbot_model_picker_given_end_key_expect_last_model_focused', async () => {
    const user = userEvent.setup();
    render(<FlytChatbotPanel />);

    const flyt = screen.getByRole('radio', { name: 'Flyt' });
    flyt.focus();
    await user.keyboard('{End>}');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await user.keyboard('{/End}');

    expect(screen.getByRole('radio', { name: 'z.ai' })).toHaveFocus();
    expect(flyt).toHaveAttribute('aria-checked', 'true');
  });

  it('test_chatbot_model_picker_given_home_key_expect_first_model_focused', async () => {
    const user = userEvent.setup();
    render(<FlytChatbotPanel />);

    screen.getByRole('radio', { name: 'z.ai' }).focus();
    await user.keyboard('{Home>}');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await user.keyboard('{/Home}');

    const flyt = screen.getByRole('radio', { name: 'Flyt' });
    expect(flyt).toHaveFocus();
    expect(flyt).toHaveAttribute('aria-checked', 'true');
  });

  it('test_chatbot_model_picker_given_locked_setup_popover_expect_escape_dismisses', async () => {
    const user = userEvent.setup();
    render(
      <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.DEEPSEEK]} />,
    );

    await user.click(lockedRadio('DeepSeek, not connected'));
    expect(
      await screen.findByText('DeepSeek and z.ai need your own provider key.'),
    ).toBeVisible();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByText('DeepSeek and z.ai need your own provider key.'),
      ).not.toBeInTheDocument();
    });
  });

  it('test_chatbot_model_picker_given_locked_model_enter_expect_setup_guidance_and_cta', async () => {
    const user = userEvent.setup();
    render(
      <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.DEEPSEEK]} />,
    );

    lockedRadio('DeepSeek, not connected').focus();
    await user.keyboard('{Enter}');

    expect(
      await screen.findByText('DeepSeek and z.ai need your own provider key.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Add key in Account settings' }),
    ).toBeVisible();
  });

  it('test_chatbot_model_picker_given_locked_model_space_expect_setup_guidance_visible', async () => {
    const user = userEvent.setup();
    render(
      <FlytChatbotPanel unavailableModels={[CHATBOT_MODEL_IDS.DEEPSEEK]} />,
    );

    lockedRadio('DeepSeek, not connected').focus();
    await user.keyboard(' ');

    expect(
      await screen.findByText('DeepSeek and z.ai need your own provider key.'),
    ).toBeVisible();
  });

  it('test_chatbot_model_picker_given_tab_into_group_expect_checked_model_focused', async () => {
    const user = userEvent.setup();
    render(
      <ModelPills
        activeModel={CHATBOT_MODEL_IDS.CHATGPT}
        availabilityStatus={CHATBOT_AVAILABILITY_STATUSES.READY}
        isModelUsable={() => true}
        modelActions={{}}
        modelReasons={{}}
        onModelChange={vi.fn()}
      />,
    );

    await user.tab();

    expect(
      screen.getByRole('radio', { name: 'ChatGPT, powered by Luna' }),
    ).toHaveFocus();
  });
});
